/**
 * Corazones, muerte y resurrección.
 */
import type { WriteBatch } from 'firebase/firestore';
import type { Failure, Mission, Player, ResurrectionQuest, Medal } from '@/shared/types';
import { HEARTS, COINS } from '@/lib/game-balance';
import { newId, nowIso } from '@/lib/ids';
import { subDoc } from '@/core/repo';
import { addDays } from '@/lib/time';
import type { ActiveEffects } from '@/core/skills/effects';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import type { FeedbackEvent } from '@/core/context';

export function maxHearts(effects: ActiveEffects): number {
  return HEARTS.MAX_DEFAULT + effects.maxHeartsBonus;
}

/** Cuántos corazones cuesta fallar esta misión, con los efectos del árbol aplicados. */
export function heartsLossFor(mission: Mission, effects: ActiveEffects): number {
  let loss = mission.heartsOnFail;
  if (mission.attribute === 'fuerza' && effects.strengthFailHeartDiscount) loss = Math.max(1, loss - effects.strengthFailHeartDiscount);
  if (effects.maxHeartLossPerFail !== null) loss = Math.min(loss, effects.maxHeartLossPerFail);
  return loss;
}

export interface DamageResult {
  player: Player;
  died: boolean;
  events: FeedbackEvent[];
}

/** Aplica daño al jugador (copia). Si llega a 0 → estado caído + misión de resurrección. */
export function applyDamage(b: WriteBatch, uid: string, player: Player, amount: number, missionName: string, ctx: { missions: Mission[]; failures: Failure[]; today: string; effects: ActiveEffects }): DamageResult {
  const p: Player = structuredClone(player);
  const events: FeedbackEvent[] = [];
  if (amount <= 0 || p.status !== 'alive') return { player: p, died: false, events };
  p.hearts.current = Math.max(0, p.hearts.current - amount);
  events.push({ kind: 'heartsLost', amount, missionName });
  if (p.hearts.current === 0) {
    p.status = 'fallen';
    const quest = createResurrectionQuest(ctx.missions, ctx.failures, ctx.today, ctx.effects);
    b.set(subDoc(uid, 'resurrection', quest.id), quest);
    logInBatch(b, uid, buildLogEntry('game_over', `Te quedaste sin corazones al fallar "${missionName}". Se creó la misión de resurrección "${quest.missionName}" (${quest.daysRequired} días seguidos, plazo ${HEARTS.RESURRECTION.maxDurationDays} días).`));
    events.push({ kind: 'fallen' });
  }
  return { player: p, died: p.status === 'fallen', events };
}

/** La misión más fallada en los últimos 30 días; si no hay datos, la diaria activa con menos dominio. */
export function pickResurrectionTarget(missions: Mission[], failures: Failure[], today: string): Mission | null {
  const since = addDays(today, -HEARTS.RESURRECTION.lookbackDays);
  const counts = new Map<string, number>();
  for (const f of failures) if (f.day >= since) counts.set(f.missionId, (counts.get(f.missionId) ?? 0) + 1);
  const active = missions.filter((m) => m.active && m.type === 'daily' && m.mastery.state !== 'automated');
  let best: Mission | null = null;
  let bestCount = -1;
  for (const m of active) {
    const c = counts.get(m.id) ?? 0;
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return best ?? active[0] ?? null;
}

export function createResurrectionQuest(missions: Mission[], failures: Failure[], today: string, effects: ActiveEffects): ResurrectionQuest {
  const target = pickResurrectionTarget(missions, failures, today);
  return {
    id: newId('res'),
    missionId: target?.id ?? '',
    missionName: target?.name ?? 'Cualquier misión diaria',
    startedAt: today,
    deadline: addDays(today, HEARTS.RESURRECTION.maxDurationDays),
    daysDone: 0,
    daysRequired: effects.resurrectionDays,
    lastDayDone: null,
    resolved: null,
  };
}

export interface ReviveResult {
  player: Player;
  events: FeedbackEvent[];
}

/** Revivir tras completar la misión de resurrección: mitad de corazones máximos. */
export function revive(b: WriteBatch, uid: string, player: Player, quest: ResurrectionQuest, effects: ActiveEffects, reason: 'completed' | 'expired'): ReviveResult {
  const p: Player = structuredClone(player);
  const events: FeedbackEvent[] = [];
  const max = maxHearts(effects);
  p.hearts.max = max;
  p.hearts.current = Math.max(1, Math.round(max * HEARTS.REVIVE_FRACTION));
  p.status = 'alive';
  b.update(subDoc(uid, 'resurrection', quest.id), { resolved: reason === 'completed' ? 'revived' : 'expired' });
  if (reason === 'completed') {
    const medal: Medal = { id: newId('medal'), kind: 'resurrection', title: 'Renacido', awardedAt: nowIso() };
    b.set(subDoc(uid, 'medals', medal.id), medal);
    logInBatch(b, uid, buildLogEntry('revived', `Completaste "${quest.missionName}" ${quest.daysRequired} días seguidos. Revives con ${p.hearts.current} corazones.`));
    events.push({ kind: 'medal', title: 'Renacido' });
  } else {
    const penalty = Math.floor(p.economy.coins * COINS.RESURRECTION_EXPIRY_PENALTY);
    if (penalty > 0) {
      p.economy.coins -= penalty;
      const w = { id: newId('w'), delta: -penalty, balanceAfter: p.economy.coins, source: 'resurrection-penalty' as const, refId: quest.id, createdAt: nowIso(), note: 'La misión de resurrección venció' };
      b.set(subDoc(uid, 'wallet', w.id), w);
    }
    logInBatch(b, uid, buildLogEntry('revived_expired', `La misión de resurrección venció a los ${HEARTS.RESURRECTION.maxDurationDays} días. Revives con ${p.hearts.current} corazones y pierdes ${penalty} monedas. Tu XP, habilidades e historial quedan intactos.`));
  }
  events.push({ kind: 'revived', hearts: p.hearts.current });
  return { player: p, events };
}

/** Regeneración: +1 por día limpio (o 2 con "Regeneración"). Nunca de golpe. */
export function regenForCleanDay(player: Player, effects: ActiveEffects, day: string): Player {
  const p: Player = structuredClone(player);
  if (p.status !== 'alive') return p;
  if (p.hearts.lastRegenDay >= day) return p;
  p.hearts.max = maxHearts(effects);
  p.hearts.current = Math.min(p.hearts.max, p.hearts.current + effects.heartRegenPerCleanDay);
  p.hearts.lastRegenDay = day;
  return p;
}
