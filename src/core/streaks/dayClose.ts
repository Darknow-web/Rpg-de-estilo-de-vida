/**
 * "Cierre del día": revisar el resumen del día. Con el nodo de Disciplina, da XP extra.
 */
import type { GameContext, FeedbackEvent } from '@/core/context';
import { batch, commitSoon, playerRef, clean } from '@/core/repo';
import { awardRewards } from '@/core/economy/award';
import { XP } from '@/lib/game-balance';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';

export function dayClosedToday(ctx: GameContext): boolean {
  return ctx.player.flags.seenIntro.includes(`dayclose:${ctx.today}`);
}

export async function closeDay(ctx: GameContext): Promise<FeedbackEvent[]> {
  if (dayClosedToday(ctx)) return [];
  const b = batch();
  let player = structuredClone(ctx.player);
  const events: FeedbackEvent[] = [];
  player.flags.seenIntro = [...player.flags.seenIntro.filter((s) => !s.startsWith('dayclose:')).slice(-20), `dayclose:${ctx.today}`];
  if (ctx.effects.dayCloseXp && player.status === 'alive') {
    const o = awardRewards(b, ctx.uid, player, ctx.effects, ctx.today, { source: 'day-close', refId: ctx.today, xp: XP.DAY_CLOSE_XP, coins: 0, attribute: 'disciplina', note: 'Cierre del día' });
    player = o.player;
    events.push({ kind: 'reward', xp: o.xp, coins: 0, attribute: 'disciplina', bonuses: ['cierre del día'], capped: 0 });
    if (o.leveledUp) events.push({ kind: 'levelUp', level: o.newLevel, skillPoints: o.skillPointsGained });
    logInBatch(b, ctx.uid, buildLogEntry('day_close', `Cerraste el día: +${o.xp} XP de Disciplina (nodo "Cierre del día").`));
  }
  b.set(playerRef(ctx.uid), clean(player));
  await commitSoon(b, 'closeDay');
  return events;
}
