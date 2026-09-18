/**
 * Planificador de avisos: como máximo 4 por día. Aviso al abrirse la ventana y 30 min antes de cerrar.
 * Prioriza: cierres próximos > aperturas. Funciona igual si el permiso está denegado (no planifica).
 */
import type { Mission } from '@/shared/types';
import { NOTIFICATIONS } from '@/lib/game-balance';
import { isScheduledOn, zonedTimeToUtc, parseHHmm, formatHHmm, windowFor, weekdayOf } from '@/lib/time';

export interface PlannedNotification {
  id: string;
  at: Date;
  title: string;
  body: string;
  url: string;
  kind: 'open' | 'closing';
  missionId: string;
}

export function planDay(missions: Mission[], doneMissionIds: Set<string>, day: string, tz: string, now: Date): PlannedNotification[] {
  const candidates: PlannedNotification[] = [];
  for (const m of missions) {
    if (!m.active || m.mastery.state === 'automated') continue;
    if (m.type !== 'daily' && m.type !== 'side') continue;
    if (!isScheduledOn(m.schedule, day)) continue;
    const w = windowFor(m.schedule, weekdayOf(day));
    if (w === 'allDay') continue;
    if (doneMissionIds.has(m.id)) continue;
    const open = zonedTimeToUtc(day, w.start, tz);
    const closeMin = parseHHmm(w.end) - NOTIFICATIONS.closingWarningMinutes;
    const closing = zonedTimeToUtc(day, formatHHmm(Math.max(0, closeMin)), tz);
    if (open > now) candidates.push({ id: `${m.id}:${day}:open`, at: open, title: 'Ventana abierta', body: `${m.name} · hasta las ${w.end}`, url: '/', kind: 'open', missionId: m.id });
    if (closing > now) candidates.push({ id: `${m.id}:${day}:closing`, at: closing, title: 'Cierra en 30 min', body: m.name, url: '/', kind: 'closing', missionId: m.id });
  }
  // Prioridad: cierres primero, luego aperturas; dentro de cada grupo, por hora.
  candidates.sort((a, b) => (a.kind === b.kind ? a.at.getTime() - b.at.getTime() : a.kind === 'closing' ? -1 : 1));
  const chosen = candidates.slice(0, NOTIFICATIONS.maxPerDay);
  return chosen.sort((a, b) => a.at.getTime() - b.at.getTime());
}
