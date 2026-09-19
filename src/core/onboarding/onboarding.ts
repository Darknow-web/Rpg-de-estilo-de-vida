/**
 * Onboarding: entrevista → IA (o fallback) → propuesta editable → aplicar campaña.
 * Nada se guarda sin que el jugador confirme.
 */
import type { OnboardingInput, OnboardingOutput } from '@/shared/schemas/ai';
import type { CampaignExplanation, ClassId, InterviewAnswers, Player, Reward, Mission } from '@/shared/types';
import { apiPost } from '@/lib/api';
import { fallbackCampaign } from '@/data/fallback/campaigns';
import { CLASSES } from '@/core/character/classes';
import { buildMission } from '@/core/missions/factory';
import type { MissionTemplate } from '@/core/module';
import { batch, commitSoon, playerRef, subDoc, clean } from '@/core/repo';
import { newId, nowIso } from '@/lib/ids';
import { REWARD_TIERS, rewardPrice, ONBOARDING } from '@/lib/game-balance';
import { estimateCoinsPerDay } from '@/core/economy/estimate';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import { HIDDEN_CATALOG } from '@/core/missions/hidden';

export interface GeneratedCampaign {
  output: OnboardingOutput;
  source: 'ai' | 'fallback';
  reason?: string;
}

const RISK_PATTERNS = /suicid|quitarme la vida|hacerme daño|autolesi|cortarme|no comer|dejar de comer|vomitar|purga|bulimia|anorexia|matarme|desaparecer/i;

export function detectRisk(answers: InterviewAnswers): boolean {
  return RISK_PATTERNS.test(`${answers.q1_goal} ${answers.q2_why} ${answers.q7_anchors}`);
}

export async function generateCampaign(answers: InterviewAnswers, regenerationIndex: number, rejected?: OnboardingInput['rejected']): Promise<GeneratedCampaign> {
  const input: OnboardingInput = { answers, regenerationIndex, rejected };
  const res = await apiPost<OnboardingOutput>('/api/ai/onboarding', input, 60_000);
  if (res.ok) {
    const out = res.data;
    if (detectRisk(answers)) out.riesgo_detectado = true;
    return { output: out, source: 'ai' };
  }
  const forced = rejected?.class ? pickOtherClass(rejected.class as ClassId) : undefined;
  const out = fallbackCampaign(answers, forced);
  out.riesgo_detectado = detectRisk(answers);
  return { output: out, source: 'fallback', reason: res.reason };
}

function pickOtherClass(rejected: ClassId): ClassId {
  const order: ClassId[] = ['asceta', 'guerrero', 'erudito', 'sanador', 'mercader', 'vagabundo'];
  return order.find((c) => c !== rejected) ?? 'vagabundo';
}

export interface ApplyCampaignInput {
  answers: InterviewAnswers;
  output: OnboardingOutput;
  source: 'ai' | 'fallback';
  classId: ClassId;
  /** Misiones diarias/semanales tal como quedaron tras editar (entre ONBOARDING.dailyMissions.min y .max diarias). */
  daily: OnboardingOutput['misiones_diarias'];
  weekly: OnboardingOutput['misiones_semanales'];
  main: OnboardingOutput['mision_principal'] | null;
  rewards: OnboardingOutput['recompensas_sugeridas'];
  regenerationsUsed: number;
  /** true si el jugador rehace la entrevista con progreso existente (no se pierde nada). */
  redo: boolean;
}

function templateFromDaily(d: OnboardingOutput['misiones_diarias'][number]): MissionTemplate {
  return {
    moduleId: 'habits',
    name: d.nombre,
    description: d.descripcion,
    attribute: d.atributo,
    type: 'daily',
    difficulty: d.dificultad,
    schedule: { days: d.dias.length ? d.dias : [0, 1, 2, 3, 4, 5, 6], window: d.ventana === 'todo_el_dia' ? 'allDay' : { start: d.ventana.inicio, end: d.ventana.fin } },
    estimatedMinutes: d.duracion_minutos,
    minimalVersion: { name: d.version_minima_viable.nombre, description: d.version_minima_viable.descripcion },
    anchor: d.ancla,
    evidenceHint: d.evidencia_sugerida,
  };
}

function templateFromWeekly(w: OnboardingOutput['misiones_semanales'][number]): MissionTemplate {
  return {
    moduleId: 'habits',
    name: w.nombre,
    description: w.descripcion,
    attribute: w.atributo,
    type: 'weekly',
    difficulty: w.dificultad,
    schedule: { days: [], timesPerWeek: w.veces_por_semana, window: 'allDay' },
    estimatedMinutes: w.duracion_minutos,
    minimalVersion: { name: w.version_minima_viable.nombre, description: w.version_minima_viable.descripcion },
    evidenceHint: w.evidencia_sugerida,
  };
}

export async function applyCampaign(uid: string, player: Player, existingMissions: Mission[], today: string, input: ApplyCampaignInput): Promise<void> {
  const b = batch();
  const p: Player = structuredClone(player);
  const cls = CLASSES[input.classId];
  const aiClass = input.output.clase;
  p.class = {
    id: input.classId,
    name: cls.name,
    description: cls.description,
    identityPhrase: cls.identityPhrase,
    primaryAttribute: cls.primaryAttribute,
    reason: aiClass.id === input.classId ? aiClass.razon_de_asignacion : 'Elegiste esta clase tú mismo. Una clase impuesta se siente ajena; esta es tuya.',
    acceptedAt: nowIso(),
  };
  p.interview = { answers: input.answers, answeredAt: nowIso(), regenerationsUsed: input.regenerationsUsed };
  const explanation: CampaignExplanation = {
    forClass: input.output.explicacion.por_clase,
    perMission: input.output.explicacion.por_mision.map((x) => ({ missionName: x.nombre_mision, whatYouSaid: x.que_dijiste, attribute: x.atributo, howItHelps: x.como_ayuda_a_tu_meta })),
    generalStrategy: input.output.explicacion.estrategia_general,
    whatComesNext: input.output.explicacion.que_pasa_despues,
  };
  p.campaign = { explanation, generatedAt: nowIso(), source: input.source };
  p.flags.onboardingDone = true;
  p.streak.lastActiveDay = today;
  p.streak.lastProcessedDay = today;
  p.hearts.lastRegenDay = today;

  // Al rehacer la entrevista, las misiones anteriores se archivan (historial intacto), nunca se borran.
  if (input.redo) {
    for (const m of existingMissions.filter((x) => x.active && x.origin !== 'gym')) {
      b.update(subDoc(uid, 'missions', m.id), { active: false, archivedAt: nowIso() });
    }
  }

  const created: Mission[] = [];
  for (const d of input.daily.slice(0, ONBOARDING.dailyMissions.max)) {
    const m = buildMission(templateFromDaily(d), input.source === 'ai' ? 'onboarding' : 'fallback', today);
    b.set(subDoc(uid, 'missions', m.id), clean(m));
    created.push(m);
  }
  for (const w of input.weekly.slice(0, 2)) {
    const m = buildMission(templateFromWeekly(w), input.source === 'ai' ? 'onboarding' : 'fallback', today);
    b.set(subDoc(uid, 'missions', m.id), clean(m));
    created.push(m);
  }
  if (input.main) {
    const m = buildMission(
      {
        moduleId: 'habits',
        name: input.main.nombre,
        description: input.main.descripcion,
        attribute: input.main.atributo,
        type: 'main',
        difficulty: 'hard',
        schedule: { days: [], window: 'allDay' },
        estimatedMinutes: 0,
        minimalVersion: { name: input.main.nombre, description: input.main.descripcion },
        milestones: input.main.hitos,
      },
      input.source === 'ai' ? 'onboarding' : 'fallback',
      today,
    );
    b.set(subDoc(uid, 'missions', m.id), clean(m));
    created.push(m);
  }
  // Misiones ocultas (inactivas hasta que se cumpla su condición). Solo la primera vez.
  if (!input.redo) {
    for (const h of HIDDEN_CATALOG) {
      const m = buildMission(h.template, 'onboarding', today);
      m.active = false;
      m.revealed = false;
      m.hiddenCondition = { kind: h.condition.kind, params: { value: h.condition.value, hint: h.hint } };
      b.set(subDoc(uid, 'missions', m.id), clean(m));
    }
  }

  p.economy.estimatedCoinsPerDay = estimateCoinsPerDay([...existingMissions.filter((m) => !input.redo && m.active), ...created]);

  // Tienda inicial ya tasada (siempre funcional aunque el jugador nunca agregue nada).
  for (const r of input.rewards) {
    const tier = REWARD_TIERS[Math.min(5, Math.max(1, r.nivel)) - 1];
    const reward: Reward = {
      id: newId('r'),
      name: r.nombre,
      tier: tier.tier,
      effortDays: tier.effortDays,
      priceCoins: rewardPrice(tier.effortDays, p.economy.estimatedCoinsPerDay),
      suggestedPrice: rewardPrice(tier.effortDays, p.economy.estimatedCoinsPerDay),
      suggestedTier: tier.tier,
      frequencyLimit: r.limite_de_frecuencia,
      isFree: r.es_gratuita,
      appraisal: { source: 'onboarding', reasoning: r.por_que_encaja, conflictsWithGoal: false, conflictNote: null, noteShown: true, reinforcesGoal: false },
      playerAdjustedDown: false,
      redemptions: [],
      createdAt: nowIso(),
      archived: false,
    };
    b.set(subDoc(uid, 'rewards', reward.id), clean(reward));
  }

  b.set(playerRef(uid), clean(p));
  logInBatch(b, uid, buildLogEntry(input.redo ? 'campaign_redone' : 'campaign_created', `${input.redo ? 'Rehiciste la entrevista y aceptaste una campaña nueva' : 'Aceptaste tu campaña'}: clase ${cls.name}, ${input.daily.length} misiones diarias, ${input.weekly.length} semanales, ${input.rewards.length} recompensas tasadas a ${p.economy.estimatedCoinsPerDay} monedas/día. Fuente: ${input.source === 'ai' ? 'IA' : 'set local de respaldo'}.${input.redo ? ' Tu nivel, monedas, medallas e historial se conservan.' : ''}`));
  await commitSoon(b, 'applyCampaign');
}
