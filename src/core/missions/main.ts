/**
 * Misiones PRINCIPALES (hitos) y BOSS (checklist, una sola oportunidad).
 */
import type { Medal, Mission, Player } from '@/shared/types';
import type { GameContext, FeedbackEvent } from '@/core/context';
import { batch, commitSoon, playerRef, subDoc, clean } from '@/core/repo';
import { awardRewards, fractionOfLevelXp } from '@/core/economy/award';
import { XP, COINS } from '@/lib/game-balance';
import { newId, nowIso } from '@/lib/ids';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import { evidenceStorage, prepareEvidence } from '@/lib/storage';

export async function completeMilestone(ctx: GameContext, missionId: string, index: number, photo: Blob): Promise<{ ok: boolean; error?: string; events: FeedbackEvent[] }> {
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m || m.type !== 'main' || !m.milestones?.[index]) return { ok: false, error: 'Hito no encontrado', events: [] };
  if (m.milestones[index].done) return { ok: false, error: 'Ese hito ya está cumplido', events: [] };
  let prepared;
  try {
    prepared = await prepareEvidence(photo);
  } catch (e) {
    return { ok: false, error: (e as Error).message, events: [] };
  }
  const events: FeedbackEvent[] = [];
  const b = batch();
  const completionId = newId('c');
  const evidenceId = newId('ev');
  const milestones = m.milestones.map((h, i) => (i === index ? { ...h, done: true, doneAt: nowIso() } : h));
  const allDone = milestones.every((h) => h.done);
  let player: Player = structuredClone(ctx.player);
  const xp = fractionOfLevelXp(player, XP.MAIN_MILESTONE_FRACTION);
  const coins = Math.round(m.coins * 2);
  const o = awardRewards(b, ctx.uid, player, ctx.effects, ctx.today, { source: 'milestone', refId: completionId, xp, coins, attribute: m.attribute, note: `Hito: ${m.milestones[index].title}` });
  player = o.player;
  events.push({ kind: 'reward', xp: o.xp, coins: o.coins, attribute: m.attribute, bonuses: ['hito'], capped: o.coinsCapped });
  if (o.leveledUp) events.push({ kind: 'levelUp', level: o.newLevel, skillPoints: o.skillPointsGained });
  b.set(subDoc(ctx.uid, 'completions', completionId), clean({ id: completionId, missionId, day: ctx.today, completedAt: nowIso(), status: 'onTime', evidenceId, xpAwarded: o.xp, coinsAwarded: o.coins, attribute: m.attribute, bonuses: ['hito'] }));
  await evidenceStorage.save(ctx.uid, { id: evidenceId, missionId, completionId, day: ctx.today, ...prepared });
  const patch: Partial<Mission> = { milestones };
  if (allDone) {
    const burst = fractionOfLevelXp(player, ctx.effects.milestoneBurstFraction * 2);
    const bonus = Math.round(COINS.BOSS_BONUS_DAYS * 2 * Math.max(COINS.MIN_ESTIMATED_PER_DAY, player.economy.estimatedCoinsPerDay));
    const o2 = awardRewards(b, ctx.uid, player, ctx.effects, ctx.today, { source: 'milestone', refId: missionId, xp: burst, coins: bonus, attribute: m.attribute, note: `Misión principal completa: ${m.name}`, bypassDailyCap: true });
    player = o2.player;
    events.push({ kind: 'chain', xp: o2.xp, coins: o2.coins });
    const medal: Medal = { id: newId('medal'), kind: 'main', title: `Campaña: ${m.name}`, missionId, awardedAt: nowIso() };
    b.set(subDoc(ctx.uid, 'medals', medal.id), medal);
    events.push({ kind: 'medal', title: medal.title });
    patch.active = false;
    patch.archivedAt = nowIso();
    logInBatch(b, ctx.uid, buildLogEntry('main_completed', `Completaste tu misión principal "${m.name}". Puedes crear una nueva desde la bitácora o rehacer la entrevista.`));
  }
  b.update(subDoc(ctx.uid, 'missions', missionId), clean(patch));
  player.stats.missionsCompleted += 1;
  b.set(playerRef(ctx.uid), clean(player));
  await commitSoon(b, 'milestone');
  return { ok: true, events };
}

export async function toggleBossItem(ctx: GameContext, missionId: string, index: number): Promise<void> {
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m || m.type !== 'boss' || !m.checklist?.[index]) return;
  const checklist = m.checklist.map((h, i) => (i === index ? { ...h, done: !h.done, doneAt: !h.done ? nowIso() : undefined } : h));
  const b = batch();
  b.update(subDoc(ctx.uid, 'missions', missionId), { checklist: clean(checklist) });
  await commitSoon(b, 'bossItem');
}

/** Cerrar un BOSS: checklist completa + foto. Recompensa fuerte. Una sola oportunidad. */
export async function completeBoss(ctx: GameContext, missionId: string, photo: Blob): Promise<{ ok: boolean; error?: string; events: FeedbackEvent[] }> {
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m || m.type !== 'boss') return { ok: false, error: 'No es un boss', events: [] };
  if (!m.checklist?.every((h) => h.done)) return { ok: false, error: 'Completa toda la lista antes de enfrentar al boss.', events: [] };
  let prepared;
  try {
    prepared = await prepareEvidence(photo);
  } catch (e) {
    return { ok: false, error: (e as Error).message, events: [] };
  }
  const events: FeedbackEvent[] = [];
  const b = batch();
  const completionId = newId('c');
  const evidenceId = newId('ev');
  let player: Player = structuredClone(ctx.player);
  const xp = fractionOfLevelXp(player, XP.BOSS_FRACTION);
  const coins = Math.round(COINS.BOSS_BONUS_DAYS * Math.max(COINS.MIN_ESTIMATED_PER_DAY, player.economy.estimatedCoinsPerDay));
  const o = awardRewards(b, ctx.uid, player, ctx.effects, ctx.today, { source: 'boss', refId: completionId, xp, coins, attribute: m.attribute, note: `Boss: ${m.name}`, bypassDailyCap: true });
  player = o.player;
  player.stats.missionsCompleted += 1;
  events.push({ kind: 'reward', xp: o.xp, coins: o.coins, attribute: m.attribute, bonuses: ['boss'], capped: 0 });
  if (o.leveledUp) events.push({ kind: 'levelUp', level: o.newLevel, skillPoints: o.skillPointsGained });
  if (o.rankedUp) events.push({ kind: 'rankUp', rank: o.newRank, title: '' });
  const medal: Medal = { id: newId('medal'), kind: 'boss', title: `Boss vencido: ${m.name}`, missionId, awardedAt: nowIso() };
  b.set(subDoc(ctx.uid, 'medals', medal.id), medal);
  events.push({ kind: 'medal', title: medal.title });
  b.set(subDoc(ctx.uid, 'completions', completionId), clean({ id: completionId, missionId, day: ctx.today, completedAt: nowIso(), status: 'onTime', evidenceId, xpAwarded: o.xp, coinsAwarded: o.coins, attribute: m.attribute, bonuses: ['boss'] }));
  await evidenceStorage.save(ctx.uid, { id: evidenceId, missionId, completionId, day: ctx.today, ...prepared });
  b.update(subDoc(ctx.uid, 'missions', missionId), { active: false, archivedAt: nowIso() });
  b.set(playerRef(ctx.uid), clean(player));
  logInBatch(b, ctx.uid, buildLogEntry('boss_defeated', `Venciste al boss "${m.name}": +${o.xp} XP, +${o.coins} monedas.`));
  await commitSoon(b, 'boss');
  return { ok: true, events };
}

/** Un boss vencido por el tiempo (fecha única pasada) se archiva sin daño extra: tuvo una sola oportunidad. */
export async function failBossByDeadline(ctx: GameContext, missionId: string): Promise<void> {
  const b = batch();
  b.update(subDoc(ctx.uid, 'missions', missionId), { active: false, archivedAt: nowIso() });
  logInBatch(b, ctx.uid, buildLogEntry('boss_expired', 'El plazo del boss venció. Solo tenía una oportunidad; no descuenta corazones.'));
  await commitSoon(b, 'bossExpired');
}
