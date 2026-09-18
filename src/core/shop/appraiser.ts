/**
 * Tasador: IA con fallback local por palabras clave. Nunca bloquea la creación.
 */
import type { AppraisalInput, AppraisalOutput } from '@/shared/schemas/ai';
import { apiPost } from '@/lib/api';
import { REWARD_TIERS, APPRAISER, rewardPrice } from '@/lib/game-balance';
import type { GameContext } from '@/core/context';

export interface Appraisal extends AppraisalOutput {
  source: 'ai' | 'fallback';
  precio_en_monedas: number;
  nivel_o_rango_minimo: { rank: string; level: number } | null;
}

const KEYWORDS: { tier: 1 | 2 | 3 | 4 | 5; words: string[]; limit?: string }[] = [
  { tier: 1, words: ['siesta', 'descanso', 'tarde libre', 'serie', 'capítulo', 'episodio', 'película', 'peli', 'videojuego', 'jugar', 'música', 'baño', 'paseo', 'dormir', 'sin culpa', 'gratis', 'helado', 'café', 'chocolate', 'postre', 'pizza', 'hamburguesa', 'snack'], limit: '1 por semana' },
  { tier: 2, words: ['cena', 'restaurante', 'cine', 'salida', 'libro', 'masaje', 'concierto', 'bar', 'cerveza', 'vino', 'sushi', 'brunch', 'manicura', 'spa'], limit: '1 por mes' },
  { tier: 3, words: ['ropa', 'zapatillas', 'zapatos', 'audífonos', 'auriculares', 'perfume', 'gadget', 'accesorio', 'reloj', 'mochila', 'curso corto', 'taller', 'suscripción', 'lentes'] },
  { tier: 4, words: ['viaje', 'consola', 'bicicleta', 'tablet', 'celular', 'teléfono', 'curso', 'cámara', 'escapada', 'fin de semana', 'tatuaje', 'guitarra'] },
  { tier: 5, words: ['moto', 'auto', 'carro', 'coche', 'casa', 'departamento', 'maestría', 'laptop', 'computadora', 'pc', 'viaje internacional', 'europa', 'japón', 'mudanza', 'negocio'] },
];

const FREE_WORDS = ['siesta', 'descanso', 'tarde libre', 'sin culpa', 'gratis', 'paseo', 'dormir', 'día sin', 'sin correo', 'sin celular'];
const CONFLICT_PHYSICAL = ['alcohol', 'cerveza', 'vino', 'trago', 'pizza', 'hamburguesa', 'comida chatarra', 'chatarra', 'dulces', 'gaseosa', 'fritura', 'saltarme el entrenamiento'];
const CONFLICT_MONEY = ['compra', 'gastar', 'shopping', 'casino', 'apuesta'];
const CONFLICT_STUDY = ['saltarme la clase', 'faltar', 'no estudiar'];
const REINFORCE = [
  { goal: ['correr', 'gimnasio', 'entrenar', 'fuerza', 'músculo', 'maratón', 'peso', 'físico', 'deporte'], reward: ['zapatillas', 'ropa deportiva', 'mancuernas', 'bicicleta', 'gimnasio', 'membresía', 'suplemento', 'botella', 'esterilla', 'reloj deportivo'] },
  { goal: ['leer', 'estudiar', 'aprender', 'examen', 'carrera', 'idioma', 'curso', 'tesis'], reward: ['libro', 'curso', 'kindle', 'audífonos', 'escritorio', 'lámpara', 'cuaderno', 'clases'] },
  { goal: ['ahorrar', 'deuda', 'dinero', 'finanzas', 'ingresos'], reward: ['fondo', 'inversión', 'ahorro', 'cuenta'] },
  { goal: ['dormir', 'sueño', 'descansar', 'salud', 'ansiedad', 'estrés'], reward: ['colchón', 'almohada', 'masaje', 'spa', 'terapia', 'yoga'] },
];

export function fallbackAppraise(input: AppraisalInput): AppraisalOutput {
  const name = input.rewardName.toLowerCase();
  const goal = `${input.playerGoal} ${input.why}`.toLowerCase();
  let tier: 1 | 2 | 3 | 4 | 5 = 2;
  let limit: string | null = null;
  for (const k of KEYWORDS) {
    if (k.words.some((w) => name.includes(w))) {
      tier = k.tier;
      limit = k.limit ?? null;
      break;
    }
  }
  const isFree = FREE_WORDS.some((w) => name.includes(w));
  if (isFree) {
    tier = 1;
    limit = limit ?? '1 por semana';
  }
  const notes: string[] = [];
  let conflict = false;
  let conflictNote: string | null = null;
  const physicalGoal = /correr|gimnasio|entrenar|fuerza|músculo|peso|físico|salud|deporte|maratón|dormir|sueño/.test(goal);
  const moneyGoal = /ahorr|deuda|dinero|finanz|gast/.test(goal);
  const studyGoal = /estudi|examen|carrera|aprender|tesis|curso/.test(goal);
  if ((physicalGoal && CONFLICT_PHYSICAL.some((w) => name.includes(w))) || (moneyGoal && CONFLICT_MONEY.some((w) => name.includes(w))) || (studyGoal && CONFLICT_STUDY.some((w) => name.includes(w)))) {
    conflict = true;
    tier = Math.min(5, tier + 1) as 1 | 2 | 3 | 4 | 5;
    limit = limit ?? '1 por mes';
    conflictNote = 'Esta recompensa va en otra dirección que tu meta declarada, así que sube un escalón y tiene límite de frecuencia. Sigue siendo tuya: nadie la prohíbe.';
    notes.push('Ajustada por conflicto con tu meta.');
  }
  let reinforces = false;
  for (const r of REINFORCE) {
    if (r.goal.some((g) => goal.includes(g)) && r.reward.some((w) => name.includes(w))) {
      reinforces = true;
      if (!conflict && tier > 1) tier = (tier - 1) as 1 | 2 | 3 | 4 | 5;
      notes.push('Refuerza tu campaña: baja un escalón como premio a la coherencia.');
      break;
    }
  }
  if (input.recentCheapRewards >= APPRAISER.antiAbuse.cheapRewardsInRow && tier < 2) {
    tier = 2;
    notes.push('Creaste varias recompensas baratas seguidas: el piso sube a nivel 2, dicho abiertamente.');
  }
  const dup = input.existingRewards.find((r) => r.name.toLowerCase().trim() === name.trim());
  const def = REWARD_TIERS[tier - 1];
  const reasoning = notes.length ? notes.join(' ') : `Por su costo y su frecuencia sana, encaja como ${def.name} (nivel ${tier}).`;
  return {
    nivel_sugerido: tier,
    dias_de_esfuerzo: def.effortDays,
    limite_de_frecuencia: limit,
    razonamiento: `${reasoning} (Tasación local: la IA no estaba disponible.)`,
    conflicto_con_meta: conflict,
    nota_de_conflicto: conflictNote,
    refuerza_meta: reinforces,
    posible_duplicado_de: dup?.name ?? null,
  };
}

export function finalizeAppraisal(out: AppraisalOutput, estimatedCoinsPerDay: number, source: 'ai' | 'fallback'): Appraisal {
  const tier = REWARD_TIERS[Math.min(5, Math.max(1, out.nivel_sugerido)) - 1];
  const days = Math.min(tier.effortRange[1], Math.max(tier.effortRange[0], out.dias_de_esfuerzo));
  return {
    ...out,
    dias_de_esfuerzo: days,
    source,
    precio_en_monedas: rewardPrice(days, estimatedCoinsPerDay),
    nivel_o_rango_minimo: tier.requires,
  };
}

export function buildAppraisalInput(ctx: GameContext, rewardName: string): AppraisalInput {
  const a = ctx.player.interview?.answers;
  const dayAgo = new Date(Date.now() - APPRAISER.antiAbuse.windowHours * 3600_000).toISOString();
  const recentCheap = ctx.rewards.filter((r) => r.tier === 1 && r.createdAt >= dayAgo && r.appraisal.source === 'player').length;
  return {
    rewardName,
    playerGoal: a?.q1_goal ?? '',
    why: a?.q2_why ?? '',
    rewardWishes: a?.q8_rewards ?? '',
    rank: ctx.player.level.rank,
    level: ctx.player.level.current,
    estimatedCoinsPerDay: Math.max(1, ctx.player.economy.estimatedCoinsPerDay),
    recentCheapRewards: recentCheap,
    existingRewards: ctx.rewards.filter((r) => !r.archived).map((r) => ({ name: r.name, tier: r.tier })),
  };
}

export async function appraise(ctx: GameContext, rewardName: string): Promise<Appraisal> {
  const input = buildAppraisalInput(ctx, rewardName);
  const res = await apiPost<AppraisalOutput>('/api/ai/appraise', input, 25_000);
  if (res.ok) return finalizeAppraisal(res.data, input.estimatedCoinsPerDay, 'ai');
  return finalizeAppraisal(fallbackAppraise(input), input.estimatedCoinsPerDay, 'fallback');
}
