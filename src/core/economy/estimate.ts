import type { Mission } from '@/shared/types';
import { COINS } from '@/lib/game-balance';

/** monedas_por_dia_estimadas = Σ monedas de misiones diarias activas × tasa de cumplimiento esperada (0.8). */
export function estimateCoinsPerDay(missions: Mission[]): number {
  const daily = missions.filter((m) => m.active && m.type === 'daily' && m.mastery.state !== 'automated');
  const perDay = daily.reduce((s, m) => {
    const daysPerWeek = m.schedule.days.length || 7;
    return s + (m.coins * daysPerWeek) / 7;
  }, 0);
  const weekly = missions.filter((m) => m.active && m.type === 'weekly');
  const weeklyPerDay = weekly.reduce((s, m) => s + (m.coins * (m.schedule.timesPerWeek ?? 1)) / 7, 0);
  const est = (perDay + weeklyPerDay) * COINS.EXPECTED_COMPLETION_RATE;
  return Math.max(COINS.MIN_ESTIMATED_PER_DAY, Math.round(est * 10) / 10);
}
