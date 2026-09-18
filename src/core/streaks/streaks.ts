/**
 * Día imposible, pausa y descanso sagrado. Contramedidas contra "castigar por estar ocupado".
 */
import { batch, commitSoon, playerRef, clean } from '@/core/repo';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import type { GameContext } from '@/core/context';
import { monthKey } from '@/lib/time';

export function impossibleDaysLeft(ctx: GameContext): number {
  const used = ctx.player.streak.impossibleDaysMonth === monthKey(ctx.today) ? ctx.player.streak.impossibleDaysUsedThisMonth : 0;
  return Math.max(0, ctx.effects.impossibleDaysPerMonth - used);
}

/** Declara hoy (o ayer) como día imposible: sin penalización, sin justificar, conserva la racha. */
export async function declareImpossibleDay(ctx: GameContext, day: string): Promise<{ ok: boolean; error?: string }> {
  if (impossibleDaysLeft(ctx) <= 0) return { ok: false, error: 'Ya usaste tus días imposibles de este mes.' };
  if (ctx.player.streak.impossibleDays.includes(day)) return { ok: false, error: 'Ese día ya está marcado.' };
  const p = structuredClone(ctx.player);
  if (p.streak.impossibleDaysMonth !== monthKey(ctx.today)) {
    p.streak.impossibleDaysMonth = monthKey(ctx.today);
    p.streak.impossibleDaysUsedThisMonth = 0;
  }
  p.streak.impossibleDaysUsedThisMonth += 1;
  p.streak.impossibleDays = [...p.streak.impossibleDays.slice(-30), day];
  const b = batch();
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('impossible_day', `Declaraste el ${day} como día imposible. Las misiones de ese día no descuentan corazones ni rompen la racha. Te quedan ${impossibleDaysLeft(ctx) - 1} este mes.`, { reversible: true, undoPayload: { day } }));
  await commitSoon(b, 'impossibleDay');
  return { ok: true };
}

export async function undoImpossibleDay(ctx: GameContext, day: string): Promise<void> {
  const p = structuredClone(ctx.player);
  if (!p.streak.impossibleDays.includes(day)) return;
  p.streak.impossibleDays = p.streak.impossibleDays.filter((d) => d !== day);
  p.streak.impossibleDaysUsedThisMonth = Math.max(0, p.streak.impossibleDaysUsedThisMonth - 1);
  const b = batch();
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('impossible_day_undone', `Quitaste la marca de día imposible del ${day}.`));
  await commitSoon(b, 'undoImpossibleDay');
}

/** Pausa / viaje: congela el juego por completo entre dos fechas (incluidas). */
export async function pauseGame(ctx: GameContext, from: string, until: string): Promise<{ ok: boolean; error?: string }> {
  if (until < from) return { ok: false, error: 'La fecha final debe ser posterior a la inicial.' };
  if (ctx.player.status === 'fallen') return { ok: false, error: 'No puedes pausar mientras estás caído. Completa la resurrección primero.' };
  const p = structuredClone(ctx.player);
  p.status = 'paused';
  p.pause = { from, until };
  const b = batch();
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('pause', `Juego en pausa del ${from} al ${until}: sin daño, sin rachas rotas, sin XP. Se reanuda solo al terminar.`, { reversible: true }));
  await commitSoon(b, 'pause');
  return { ok: true };
}

export async function resumeGame(ctx: GameContext): Promise<void> {
  if (ctx.player.status !== 'paused') return;
  const p = structuredClone(ctx.player);
  p.status = 'alive';
  p.pause = null;
  p.streak.lastProcessedDay = ctx.today;
  p.hearts.lastRegenDay = ctx.today;
  p.streak.lastActiveDay = ctx.today;
  const b = batch();
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('resume', 'Reanudaste el juego antes de tiempo. Los días en pausa no cuentan.'));
  await commitSoon(b, 'resume');
}

/** Descanso sagrado (nodo): elige el día de la semana que no cuenta como fallo. */
export async function setRestDay(ctx: GameContext, weekday: number | null): Promise<void> {
  const p = structuredClone(ctx.player);
  p.streak.restDay = weekday;
  const b = batch();
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('rest_day', weekday === null ? 'Quitaste tu día de descanso sagrado.' : `Tu día de descanso sagrado es ahora el ${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][weekday]}.`));
  await commitSoon(b, 'restDay');
}
