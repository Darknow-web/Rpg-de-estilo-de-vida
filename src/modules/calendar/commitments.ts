/**
 * Compromisos de agenda → misión "Llegar a tiempo".
 *
 * Regla: la misión es secundaria (side), con fecha única, sin apuestas (stakes 'none'): fallar no quita
 * corazones ni toca la racha; solo suma al contador de puntualidad. La ventana abre PUNCTUALITY.windowMinutes
 * antes del evento y cierra a la hora exacta del evento. Llegar PUNCTUALITY.earlyMinutes antes da bonus de XP.
 *
 * Caso borde (evento antes de la 01:00 Lima, p. ej. 00:30): la ventana empezaría el día anterior. Decidimos
 * mantener la misión en la FECHA DEL EVENTO y recortar el inicio de la ventana a las 00:00 de ese día
 * (queda 00:00–00:30). Así `schedule.once` coincide con el día del evento, el cierre nunca se mueve y la
 * misión aparece en "Hoy" el día correcto. Un evento exactamente a las 00:00 queda con ventana 00:00–00:00
 * (solo se puede completar antes: "adelantarse" siempre cuenta como a tiempo).
 */
import type { Mission } from '@/shared/types';
import type { MissionTemplate } from '@/core/module';
import type { GameContext } from '@/core/context';
import { PUNCTUALITY } from '@/lib/game-balance';
import { formatHHmm, todayIn, zonedParts } from '@/lib/time';
import { buildMission } from '@/core/missions/factory';
import { createMission, archiveMission, type CreateResult } from '@/core/missions/manage';
import { CALENDAR_TZ, type CalendarEvent, type CalendarMissionData } from './types';

export const CALENDAR_MISSION_PREFIX = 'Llegar a tiempo: ';

export function isCalendarMission(m: Pick<Mission, 'origin'>): boolean {
  return m.origin === 'calendar';
}

export function calendarData(m: Mission): CalendarMissionData | null {
  const d = m.moduleData as Partial<CalendarMissionData> | undefined;
  if (!d || typeof d.eventId !== 'string' || typeof d.eventStart !== 'string') return null;
  return { eventId: d.eventId, calendarId: String(d.calendarId ?? ''), eventStart: d.eventStart, eventSummary: String(d.eventSummary ?? '') };
}

/** ¿Se puede marcar este evento como compromiso? (con hora, y en el futuro). */
export function commitmentEligibility(event: CalendarEvent, now: Date): { ok: true } | { ok: false; reason: string } {
  if (event.allDay) return { ok: false, reason: 'Los eventos de todo el día no tienen hora de llegada.' };
  const t = Date.parse(event.start);
  if (!Number.isFinite(t)) return { ok: false, reason: 'El evento no tiene una hora de inicio válida.' };
  if (t <= now.getTime()) return { ok: false, reason: 'Ese evento ya empezó.' };
  return { ok: true };
}

/** Cupo propio de la agenda: como máximo PUNCTUALITY.maxPerDay compromisos activos el mismo día. */
export function canAddCommitment(existingCalendarMissionsThatDay: Mission[]): { ok: boolean; used: number; max: number; reason: string | null } {
  const used = existingCalendarMissionsThatDay.filter((m) => m.active && isCalendarMission(m)).length;
  const ok = used < PUNCTUALITY.maxPerDay;
  return { ok, used, max: PUNCTUALITY.maxPerDay, reason: ok ? null : `Ya tienes ${PUNCTUALITY.maxPerDay} compromisos ese día. Tres llegadas puntuales bastan para un buen día; el resto es agenda, no misión.` };
}

/** Misiones de agenda activas programadas para un día. */
export function calendarMissionsOn(missions: Mission[], day: string): Mission[] {
  return missions.filter((m) => m.active && isCalendarMission(m) && m.schedule.once === day);
}

/** Misión de agenda activa ligada a un evento (si ya se marcó). */
export function findCommitment(missions: Mission[], eventId: string): Mission | undefined {
  return missions.find((m) => m.active && isCalendarMission(m) && calendarData(m)?.eventId === eventId);
}

/** Ventana y fecha (en la zona dada) para llegar a tiempo a un instante. Aplica el recorte a las 00:00 (ver cabecera). */
export function punctualityWindow(eventStartISO: string, tz: string = CALENDAR_TZ): { day: string; start: string; end: string } {
  const at = new Date(eventStartISO);
  const p = zonedParts(at, tz);
  const endMin = p.minutesOfDay;
  const startMin = Math.max(0, endMin - PUNCTUALITY.windowMinutes);
  return { day: p.day, start: formatHHmm(startMin), end: formatHHmm(endMin) };
}

/** Plantilla de misión para un evento (sin XP/monedas: los pone el balance vía buildMission/createMission). */
export function commitmentToTemplate(event: CalendarEvent, tz: string = CALENDAR_TZ): MissionTemplate {
  const w = punctualityWindow(event.start, tz);
  const data: CalendarMissionData = { eventId: event.id, calendarId: event.calendarId, eventStart: new Date(event.start).toISOString(), eventSummary: event.summary };
  return {
    moduleId: 'calendar',
    name: `${CALENDAR_MISSION_PREFIX}${event.summary}`,
    description: `${event.summary} empieza a las ${w.end}${event.location ? ` en ${event.location}` : ''}. Llega antes y demuéstralo con una foto del lugar.`,
    attribute: 'disciplina',
    type: 'side',
    difficulty: 'easy',
    schedule: { days: [], window: { start: w.start, end: w.end }, once: w.day },
    estimatedMinutes: 0,
    minimalVersion: { name: `Avisar si llego tarde: ${event.summary}`, description: 'Si no vas a llegar, avisa con antelación. Llegar tarde con aviso sigue siendo respeto.' },
    anchor: `${PUNCTUALITY.windowMinutes} min antes de "${event.summary}"`,
    evidenceHint: 'Foto del lugar al llegar',
    stakes: 'none',
    moduleData: data as unknown as Record<string, unknown>,
    externalKey: `calendar:${event.calendarId}:${event.id}`,
  };
}

/**
 * Misión completa (sin escribir nada). `now` fija el día de creación del dominio; `uid` se conserva por
 * simetría con otros constructores del core (la misión no guarda el uid: vive bajo players/{uid}).
 */
export function commitmentToMission(event: CalendarEvent, _uid: string, now: Date, tz: string = CALENDAR_TZ): Mission {
  const mission = buildMission(commitmentToTemplate(event, tz), 'calendar', todayIn(tz, now));
  mission.requiresPhoto = true;
  mission.stakes = 'none';
  mission.estimatedMinutes = 0;
  return mission;
}

/**
 * Marca un evento como compromiso: crea la misión por la misma puerta que el resto (createMission).
 * No consume el cupo de secundarias (origin 'calendar' no cuenta), pero sí respeta PUNCTUALITY.maxPerDay.
 * Idempotente: si el evento ya tiene misión activa, la devuelve.
 */
export async function markCommitment(ctx: GameContext, event: CalendarEvent): Promise<CreateResult> {
  const existing = findCommitment(ctx.missions, event.id);
  if (existing) return { ok: true, mission: existing };
  const elig = commitmentEligibility(event, ctx.now);
  if (!elig.ok) return { ok: false, error: elig.reason };
  const template = commitmentToTemplate(event, ctx.tz);
  const cap = canAddCommitment(calendarMissionsOn(ctx.missions, template.schedule.once!));
  if (!cap.ok) return { ok: false, error: cap.reason ?? 'Sin cupo de compromisos ese día.' };
  return createMission(ctx, template, 'calendar', { ignoreQuota: true });
}

/** Quita el compromiso: archiva la misión (active: false). Nunca se borra. */
export async function unmarkCommitment(ctx: GameContext, eventId: string): Promise<{ ok: boolean; error?: string }> {
  const m = findCommitment(ctx.missions, eventId);
  if (!m) return { ok: false, error: 'Ese evento no está marcado como compromiso.' };
  await archiveMission(ctx, m.id, 'quitaste el compromiso de la agenda');
  return { ok: true };
}
