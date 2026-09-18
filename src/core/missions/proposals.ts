/**
 * Propuestas automáticas: la app PROPONE, el jugador APRUEBA con un toque.
 * - Cupo liberado → misión nueva (IA o banco local).
 * - Consolidada → oferta de escalado.
 * - Fallo >50 % en dos semanas → oferta de bajar a mínima viable.
 * - 100 % en dos semanas → oferta de escalar.
 */
import type { Mission, AttributeId } from '@/shared/types';
import type { NextMissionInput, NextMissionOutput } from '@/shared/schemas/ai';
import type { GameContext } from '@/core/context';
import type { MissionTemplate } from '@/core/module';
import { apiPost } from '@/lib/api';
import { quotaFor } from './quota';
import { recentFailRate } from '@/core/mastery/mastery';
import { MASTERY } from '@/lib/game-balance';
import { MISSION_BANK } from '@/data/fallback/missionBank';
import { ATTRIBUTE_IDS } from '@/shared/types';
import { classPrimary } from '@/core/character/classes';

export type ProposalKind = 'new_mission' | 'escalate' | 'lower' | 'escalate_perfect';

export interface Proposal {
  id: string;
  kind: ProposalKind;
  missionId?: string;
  title: string;
  body: string;
}

/** Qué propuestas hay pendientes ahora (se calcula, no se guarda; el jugador decide). */
export function pendingProposals(ctx: GameContext, dismissed: Set<string>): Proposal[] {
  const out: Proposal[] = [];
  if (!ctx.player.flags.onboardingDone || ctx.player.status !== 'alive') return out;
  const q = quotaFor('daily', ctx.player, ctx.missions, ctx.effects);
  if (q.allowed && q.used < q.max && ctx.missions.some((m) => m.type === 'daily')) {
    const id = `new:${q.used}/${q.max}`;
    if (!dismissed.has(id)) out.push({ id, kind: 'new_mission', title: 'Cupo libre en tu bitácora', body: `Tienes ${q.max - q.used} espacio${q.max - q.used > 1 ? 's' : ''} libre${q.max - q.used > 1 ? 's' : ''}. Te proponemos la siguiente misión, con su razón.` });
  }
  for (const m of ctx.missions) {
    if (!m.active || m.type !== 'daily') continue;
    if (m.mastery.state === 'consolidated' && m.escalationLevel === 0) {
      const id = `esc:${m.id}:${m.mastery.windowStart}`;
      if (!dismissed.has(id)) out.push({ id, kind: 'escalate', missionId: m.id, title: `"${m.name}" está Consolidada`, body: 'Puedes subir su exigencia en vez de agregar una misión nueva. Sube XP y monedas y no consume cupo. Es una oferta.' });
    }
    const { rate, samples } = recentFailRate(m.mastery);
    if (samples >= MASTERY.dynamicDifficulty.minSamples) {
      if (rate > MASTERY.dynamicDifficulty.lowerIfFailRateAbove && m.difficulty !== 'easy') {
        const id = `low:${m.id}:${m.mastery.history.length}`;
        if (!dismissed.has(id)) out.push({ id, kind: 'lower', missionId: m.id, title: `"${m.name}" se está fallando mucho`, body: `Fallaste más de la mitad de las veces en las últimas dos semanas. Es mejor cumplir algo pequeño que fallar algo grande: te proponemos su versión mínima viable.` });
      } else if (rate === 0 && samples >= MASTERY.dynamicDifficulty.windowDays && m.mastery.state !== 'consolidated' && m.mastery.state !== 'mastered') {
        const id = `perf:${m.id}:${m.mastery.history.length}`;
        if (!dismissed.has(id)) out.push({ id, kind: 'escalate_perfect', missionId: m.id, title: `"${m.name}" al 100 %`, body: 'Dos semanas sin fallar. ¿Subimos un poco la exigencia?' });
      }
    }
  }
  return out;
}

export interface MissionSuggestion {
  template: MissionTemplate;
  reason: string;
  whatChanges: string | null;
  source: 'ai' | 'fallback';
}

function momentWindow(moment: string): MissionTemplate['schedule']['window'] {
  switch (moment) {
    case 'morning':
      return { start: '06:30', end: '10:00' };
    case 'afternoon':
      return { start: '13:00', end: '18:00' };
    case 'evening':
      return { start: '19:00', end: '22:30' };
    default:
      return 'allDay';
  }
}

function buildInput(ctx: GameContext, reason: NextMissionInput['reason'], target?: Mission): NextMissionInput {
  const a = ctx.player.interview?.answers;
  const attrs: Record<string, number> = {};
  for (const id of ATTRIBUTE_IDS) attrs[id] = ctx.player.attributes[id].level;
  return {
    reason,
    answers: { q1_goal: a?.q1_goal ?? '', q2_why: a?.q2_why ?? '', q4_time: a?.q4_time ?? '30', q5_moment: a?.q5_moment ?? 'varies', q7_anchors: a?.q7_anchors ?? '' },
    className: ctx.player.class?.name ?? 'Vagabundo',
    activeMissions: ctx.missions.filter((m) => m.active && (m.type === 'daily' || m.type === 'weekly') && m.mastery.state !== 'automated').map((m) => ({ name: m.name, attribute: m.attribute, difficulty: m.difficulty, masteryState: m.mastery.state, estimatedMinutes: m.estimatedMinutes })),
    masteredMissions: ctx.missions.filter((m) => m.mastery.state === 'mastered' || m.mastery.state === 'automated').map((m) => m.name),
    attributes: attrs,
    targetMission: target ? { name: target.name, description: target.description, xp: target.xp, coins: target.coins, difficulty: target.difficulty, anchor: target.anchor } : undefined,
  };
}

function fromOutput(out: NextMissionOutput): MissionTemplate {
  const m = out.mision;
  return {
    moduleId: 'habits',
    name: m.nombre,
    description: m.descripcion,
    attribute: m.atributo,
    type: m.tipo,
    difficulty: m.dificultad,
    schedule: m.tipo === 'weekly' ? { days: [], timesPerWeek: m.veces_por_semana ?? 1, window: 'allDay' } : { days: m.dias.length ? m.dias : [0, 1, 2, 3, 4, 5, 6], window: m.ventana === 'todo_el_dia' ? 'allDay' : { start: m.ventana.inicio, end: m.ventana.fin } },
    estimatedMinutes: m.duracion_minutos,
    minimalVersion: { name: m.version_minima_viable.nombre, description: m.version_minima_viable.descripcion },
    anchor: m.ancla,
    evidenceHint: m.evidencia_sugerida,
  };
}

function laggingAttribute(ctx: GameContext): AttributeId {
  const primary = ctx.player.class ? classPrimary(ctx.player.class.id) : null;
  const sorted = [...ATTRIBUTE_IDS].sort((a, b) => ctx.player.attributes[a].xp - ctx.player.attributes[b].xp);
  // Alterna: si el más rezagado está muy lejos del principal, propón rezagado; si no, principal.
  const lag = sorted[0];
  if (!primary) return lag;
  return ctx.player.attributes[primary].xp - ctx.player.attributes[lag].xp > 100 ? lag : primary;
}

function fallbackNew(ctx: GameContext): MissionSuggestion {
  const attr = laggingAttribute(ctx);
  const used = new Set(ctx.missions.map((m) => m.name.toLowerCase()));
  const bank = MISSION_BANK[attr].filter((b) => !used.has(b.name.toLowerCase()));
  const pick = bank[0] ?? MISSION_BANK[attr][0];
  const a = ctx.player.interview?.answers;
  const anchorRaw = a?.q7_anchors?.trim();
  const anchor = anchorRaw ? `Después de ${anchorRaw.replace(/^después de\s*/i, '').split(/[,.;]/)[0].trim()}` : 'Después de mi primera pausa del día';
  return {
    template: {
      moduleId: 'habits',
      name: pick.name,
      description: pick.description.replace('{ancla}', anchor),
      attribute: attr,
      type: 'daily',
      difficulty: 'easy',
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], window: momentWindow(a?.q5_moment ?? 'varies') },
      estimatedMinutes: pick.minutes,
      minimalVersion: pick.minimal,
      anchor,
      evidenceHint: pick.evidence,
    },
    reason: `Tu atributo ${attr} es el que más espacio tiene para crecer y esta misión es lo bastante pequeña para no fallar. (Propuesta local: la IA no estaba disponible.)`,
    whatChanges: null,
    source: 'fallback',
  };
}

const NUM = /(\d+)/;
function bumpNumbers(s: string, factor: number): string {
  return s.replace(NUM, (n) => String(Math.max(1, Math.round(Number(n) * factor))));
}

function fallbackEscalate(m: Mission): MissionSuggestion {
  const nextDiff: Mission['difficulty'] = m.difficulty === 'easy' ? 'medium' : m.difficulty === 'medium' ? 'hard' : 'epic';
  const name = NUM.test(m.name) ? bumpNumbers(m.name, 1.5) : `${m.name} (versión exigente)`;
  const description = NUM.test(m.description) ? bumpNumbers(m.description, 1.5) : `${m.description} Añade un paso más que el de hoy.`;
  return {
    template: { moduleId: m.moduleId, name, description, attribute: m.attribute, type: 'daily', difficulty: nextDiff, schedule: m.schedule, estimatedMinutes: Math.round(m.estimatedMinutes * 1.5), minimalVersion: { name: m.name, description: m.description }, anchor: m.anchor, evidenceHint: m.evidenceHint },
    reason: 'Llevas dos semanas cumpliendo: el cuerpo (y la cabeza) piden un poco más.',
    whatChanges: 'Sube la cantidad ~50 % y la dificultad un escalón. La versión actual queda guardada como mínima viable.',
    source: 'fallback',
  };
}

export async function suggestNewMission(ctx: GameContext): Promise<MissionSuggestion> {
  const res = await apiPost<NextMissionOutput>('/api/ai/next-mission', buildInput(ctx, 'quota_freed'), 30_000);
  if (res.ok) return { template: fromOutput(res.data), reason: res.data.razon, whatChanges: null, source: 'ai' };
  return fallbackNew(ctx);
}

export async function suggestEscalation(ctx: GameContext, mission: Mission): Promise<MissionSuggestion> {
  const res = await apiPost<NextMissionOutput>('/api/ai/next-mission', buildInput(ctx, 'escalation', mission), 30_000);
  if (res.ok) {
    const t = fromOutput(res.data);
    return { template: { ...t, schedule: mission.schedule, type: 'daily' }, reason: res.data.razon, whatChanges: res.data.que_cambia, source: 'ai' };
  }
  return fallbackEscalate(mission);
}

export async function suggestLowering(ctx: GameContext, mission: Mission): Promise<MissionSuggestion> {
  const res = await apiPost<NextMissionOutput>('/api/ai/next-mission', buildInput(ctx, 'lower_to_minimal', mission), 30_000);
  if (res.ok) {
    const t = fromOutput(res.data);
    return { template: { ...t, schedule: mission.schedule, type: 'daily', difficulty: 'easy' }, reason: res.data.razon, whatChanges: res.data.que_cambia, source: 'ai' };
  }
  return {
    template: { moduleId: mission.moduleId, name: mission.minimalVersion.name, description: mission.minimalVersion.description, attribute: mission.attribute, type: 'daily', difficulty: 'easy', schedule: mission.schedule, estimatedMinutes: Math.max(1, Math.round(mission.estimatedMinutes / 2)), minimalVersion: mission.minimalVersion, anchor: mission.anchor, evidenceHint: mission.evidenceHint },
    reason: 'Cumplir algo pequeño todos los días construye más que fallar algo grande.',
    whatChanges: 'Vuelve a la versión mínima viable que definiste al crearla. Tu dominio se conserva.',
    source: 'fallback',
  };
}
