import { useGame } from '@/state/game';
import { planDay } from '@/core/notifications/planner';
import { scheduleNotifications, permissionState } from '@/lib/notifications';

/** Replanifica los avisos del día (máx 4) con el estado actual. Silencioso si no hay permiso. */
export async function syncNotifications(): Promise<void> {
  if (permissionState() !== 'granted') return;
  const ctx = useGame.getState().context();
  if (!ctx || ctx.player.status !== 'alive') return;
  const done = new Set(ctx.completions.filter((c) => c.day === ctx.today && c.status !== 'annulled').map((c) => c.missionId));
  const plan = planDay(ctx.missions, done, ctx.today, ctx.tz, ctx.now);
  await scheduleNotifications(plan);
}
