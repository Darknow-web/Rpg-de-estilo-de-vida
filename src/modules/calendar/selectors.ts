/**
 * Selectores puros sobre eventos de agenda (sin React, sin Firestore).
 */
import { zonedParts } from '@/lib/time';
import { CALENDAR_TZ, type CalendarEvent } from './types';

/** Día lógico ("YYYY-MM-DD") al que pertenece el evento en la zona dada. */
export function eventDay(e: CalendarEvent, tz: string = CALENDAR_TZ): string {
  if (e.allDay) return e.start.slice(0, 10);
  const t = new Date(e.start);
  return Number.isNaN(t.getTime()) ? e.start.slice(0, 10) : zonedParts(t, tz).day;
}

export interface EventsByDay {
  day: string;
  events: CalendarEvent[];
}

/** Agrupa por día (ordenado ascendente); dentro de cada día, todo-el-día primero y luego por hora. */
export function groupEventsByDay(events: CalendarEvent[], tz: string = CALENDAR_TZ): EventsByDay[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const day = eventDay(e, tz);
    const list = map.get(day);
    if (list) list.push(e);
    else map.set(day, [e]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, list]) => ({
      day,
      events: list.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return Date.parse(a.start) - Date.parse(b.start) || a.summary.localeCompare(b.summary, 'es');
      }),
    }));
}

/** Próximo evento CON hora que todavía no empezó. Ignora los de todo el día. */
export function nextEvent(events: CalendarEvent[], now: Date): CalendarEvent | null {
  let best: CalendarEvent | null = null;
  let bestT = Infinity;
  for (const e of events) {
    if (e.allDay) continue;
    const t = Date.parse(e.start);
    if (!Number.isFinite(t) || t <= now.getTime()) continue;
    if (t < bestT) {
      bestT = t;
      best = e;
    }
  }
  return best;
}

/** Eventos de un día concreto (útil para la vista Hoy). */
export function eventsOn(events: CalendarEvent[], day: string, tz: string = CALENDAR_TZ): CalendarEvent[] {
  return groupEventsByDay(events, tz).find((g) => g.day === day)?.events ?? [];
}
