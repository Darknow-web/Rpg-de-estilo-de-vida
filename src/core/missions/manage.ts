/**
 * Alta, edición, archivo, escalado y bajada de misiones. Siempre a través del cupo.
 */
import type { Mission, MissionType } from '@/shared/types';
import type { MissionTemplate } from '@/core/module';
import type { GameContext } from '@/core/context';
import { batch, commitSoon, playerRef, subDoc, clean } from '@/core/repo';
import { buildMission } from './factory';
import { quotaFor } from './quota';
import { estimateCoinsPerDay } from '@/core/economy/estimate';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import { masteryAfterEscalation } from '@/core/mastery/mastery';
import { coinsForDifficulty, xpForDifficulty, MASTERY, HEARTS } from '@/lib/game-balance';
import { nowIso } from '@/lib/ids';
import { overlaps } from './schedule';

export interface CreateResult {
  ok: boolean;
  error?: string;
  nextUnlock?: string | null;
  mission?: Mission;
  overlapsWith?: string[];
}

export async function createMission(ctx: GameContext, template: MissionTemplate, origin: Mission['origin'], opts: { ignoreQuota?: boolean; inactive?: boolean } = {}): Promise<CreateResult> {
  if (!opts.ignoreQuota && !opts.inactive) {
    const q = quotaFor(template.type, ctx.player, ctx.missions, ctx.effects);
    if (!q.allowed) return { ok: false, error: q.reason ?? 'Sin cupo', nextUnlock: q.nextUnlock };
  }
  const mission = buildMission(template, origin, ctx.today);
  if (opts.inactive) mission.active = false;
  const b = batch();
  b.set(subDoc(ctx.uid, 'missions', mission.id), clean(mission));
  if (mission.active) {
    const p = structuredClone(ctx.player);
    p.economy.estimatedCoinsPerDay = estimateCoinsPerDay([...ctx.missions, mission]);
    b.set(playerRef(ctx.uid), clean(p));
  }
  await commitSoon(b, 'createMission');
  const ov = overlaps(ctx.missions, mission).map((m) => m.name);
  return { ok: true, mission, overlapsWith: ov.length ? ov : undefined };
}

export async function updateMission(ctx: GameContext, missionId: string, patch: Partial<Mission>, reason: string): Promise<void> {
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m) return;
  const b = batch();
  const next = { ...m, ...patch };
  // XP/monedas/corazones siempre derivan del balance si cambia la dificultad.
  if (patch.difficulty && patch.difficulty !== m.difficulty) {
    const mult = Math.pow(MASTERY.escalationRewardMultiplier, m.escalationLevel);
    next.xp = Math.round(xpForDifficulty(patch.difficulty) * mult);
    next.coins = Math.round(coinsForDifficulty(patch.difficulty) * mult);
    next.heartsOnFail = HEARTS.LOSS_BY_DIFFICULTY[patch.difficulty];
  }
  b.set(subDoc(ctx.uid, 'missions', missionId), clean(next));
  const p = structuredClone(ctx.player);
  p.economy.estimatedCoinsPerDay = estimateCoinsPerDay(ctx.missions.map((x) => (x.id === missionId ? next : x)));
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('mission_edited', `Editaste "${m.name}": ${reason}.`));
  await commitSoon(b, 'updateMission');
}

export async function archiveMission(ctx: GameContext, missionId: string, reason: string): Promise<void> {
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m) return;
  const b = batch();
  b.update(subDoc(ctx.uid, 'missions', missionId), { active: false, archivedAt: nowIso() });
  const p = structuredClone(ctx.player);
  p.economy.estimatedCoinsPerDay = estimateCoinsPerDay(ctx.missions.filter((x) => x.id !== missionId));
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('mission_archived', `Archivaste "${m.name}": ${reason}. Su historial de completaciones y fotos se conserva.`, { reversible: true, undoPayload: { missionId } }));
  await commitSoon(b, 'archiveMission');
}

export async function restoreMission(ctx: GameContext, missionId: string): Promise<CreateResult> {
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m) return { ok: false, error: 'No existe' };
  const q = quotaFor(m.type, ctx.player, ctx.missions, ctx.effects);
  if (!q.allowed) return { ok: false, error: q.reason ?? 'Sin cupo', nextUnlock: q.nextUnlock };
  const b = batch();
  b.update(subDoc(ctx.uid, 'missions', missionId), { active: true, archivedAt: null });
  logInBatch(b, ctx.uid, buildLogEntry('mission_restored', `Restauraste "${m.name}".`));
  await commitSoon(b, 'restoreMission');
  return { ok: true };
}

/**
 * Escalar: misma misión, más exigente. Reinicia dominio (o la mitad con Mentor), sube XP y monedas
 * ×1.25 acumulativo, NO consume cupo. Siempre es una oferta que el jugador acepta.
 */
export async function escalateMission(ctx: GameContext, missionId: string, newVersion: { name: string; description: string; difficulty?: Mission['difficulty']; anchor?: string; estimatedMinutes?: number }): Promise<void> {
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m) return;
  const esc = m.escalationLevel + 1;
  const diff = newVersion.difficulty ?? m.difficulty;
  const mult = Math.pow(MASTERY.escalationRewardMultiplier, esc);
  const next: Mission = {
    ...m,
    name: newVersion.name,
    description: newVersion.description,
    difficulty: diff,
    anchor: newVersion.anchor ?? m.anchor,
    estimatedMinutes: newVersion.estimatedMinutes ?? m.estimatedMinutes,
    xp: Math.round(xpForDifficulty(diff) * mult),
    coins: Math.round(coinsForDifficulty(diff) * mult),
    heartsOnFail: HEARTS.LOSS_BY_DIFFICULTY[diff],
    escalationLevel: esc,
    minimalVersion: { name: m.name, description: m.description },
    mastery: masteryAfterEscalation(m.mastery, ctx.today, ctx.effects.escalationKeepsHalfMastery),
  };
  const b = batch();
  b.set(subDoc(ctx.uid, 'missions', missionId), clean(next));
  const p = structuredClone(ctx.player);
  p.economy.estimatedCoinsPerDay = estimateCoinsPerDay(ctx.missions.map((x) => (x.id === missionId ? next : x)));
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('mission_escalated', `Escalaste "${m.name}" → "${next.name}". XP ${m.xp}→${next.xp}, monedas ${m.coins}→${next.coins}. La barra de dominio ${ctx.effects.escalationKeepsHalfMastery ? 'conserva la mitad (Mentor)' : 'se reinicia'}. La versión anterior queda guardada como mínima viable.`, { reversible: true, undoPayload: { missionId, previous: m } }));
  await commitSoon(b, 'escalateMission');
}

/** Bajar a la versión mínima viable (dificultad dinámica). No reinicia dominio. */
export async function lowerToMinimal(ctx: GameContext, missionId: string, version?: { name: string; description: string }): Promise<void> {
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m) return;
  const v = version ?? m.minimalVersion;
  const next: Mission = {
    ...m,
    name: v.name,
    description: v.description,
    difficulty: 'easy',
    xp: xpForDifficulty('easy'),
    coins: coinsForDifficulty('easy'),
    heartsOnFail: HEARTS.LOSS_BY_DIFFICULTY.easy,
    escalationLevel: 0,
  };
  const b = batch();
  b.set(subDoc(ctx.uid, 'missions', missionId), clean(next));
  const p = structuredClone(ctx.player);
  p.economy.estimatedCoinsPerDay = estimateCoinsPerDay(ctx.missions.map((x) => (x.id === missionId ? next : x)));
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('mission_lowered', `"${m.name}" bajó a su versión mínima viable "${next.name}". Cumplir algo pequeño vale más que fallar algo grande. Tu dominio se conserva.`, { reversible: true, undoPayload: { missionId, previous: m } }));
  await commitSoon(b, 'lowerToMinimal');
}

/** Ventana flexible (nodo): mover la ventana de hoy una vez sin penalización. */
export async function moveWindowToday(ctx: GameContext, missionId: string, window: { start: string; end: string }): Promise<{ ok: boolean; error?: string }> {
  if (!ctx.effects.moveWindowOncePerDay) return { ok: false, error: 'Necesitas el nodo "Ventana flexible".' };
  const m = ctx.missions.find((x) => x.id === missionId);
  if (!m) return { ok: false, error: 'No existe' };
  const movedToday = (m.moduleData?.windowMovedDay as string | undefined) === ctx.today;
  if (movedToday) return { ok: false, error: 'Ya moviste esta ventana hoy.' };
  const b = batch();
  b.update(subDoc(ctx.uid, 'missions', missionId), { schedule: { ...m.schedule, window }, moduleData: { ...(m.moduleData ?? {}), windowMovedDay: ctx.today, originalWindow: m.schedule.window } });
  logInBatch(b, ctx.uid, buildLogEntry('window_moved', `Moviste la ventana de "${m.name}" a ${window.start}–${window.end} (Ventana flexible).`));
  await commitSoon(b, 'moveWindow');
  return { ok: true };
}

export function typeQuotaLabel(type: MissionType): string {
  return { daily: 'diarias', weekly: 'semanales', main: 'principales', side: 'secundarias', boss: 'boss', hidden: 'ocultas' }[type];
}
