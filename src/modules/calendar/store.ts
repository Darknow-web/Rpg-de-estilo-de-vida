/**
 * Estado del módulo Agenda: calendarios, selección y eventos de los próximos 14 días.
 * Se persiste en localStorage (clave `lq-calendar`) para que la agenda se vea al instante al abrir.
 * El token de acceso NO se persiste (vive en memoria, ver client.ts).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { addDays, todayIn, zonedTimeToUtc } from '@/lib/time';
import { nowIso } from '@/lib/ids';
import { CalendarAuthError, CalendarApiError, listCalendars, listEvents, requestToken, revoke } from './client';
import { CALENDAR_LOOKAHEAD_DAYS, CALENDAR_TZ, type CalendarEvent, type CalendarInfo } from './types';

export interface CalendarState {
  connected: boolean;
  selectedCalendarIds: string[];
  calendars: CalendarInfo[];
  events: CalendarEvent[];
  fetchedAt?: string;
  error?: string;
  /** true mientras hay una petición en curso (para el botón de refrescar). */
  loading: boolean;
  /** Consentimiento interactivo → calendarios → selecciona el principal → eventos. */
  connect(): Promise<void>;
  /** Vuelve a pedir calendarios y eventos. Sin `interactive`, si el token venció deja `error` y no abre popups. */
  refresh(interactive?: boolean): Promise<void>;
  toggleCalendar(id: string): Promise<void>;
  disconnect(): Promise<void>;
}

export const CALENDAR_STORAGE_KEY = 'lq-calendar';

/** Ventana de descarga: hoy 00:00 (Lima) → +CALENDAR_LOOKAHEAD_DAYS días. */
export function eventsRange(now: Date = new Date(), tz: string = CALENDAR_TZ): { fromISO: string; toISO: string } {
  const today = todayIn(tz, now);
  return {
    fromISO: zonedTimeToUtc(today, '00:00', tz).toISOString(),
    toISO: zonedTimeToUtc(addDays(today, CALENDAR_LOOKAHEAD_DAYS), '00:00', tz).toISOString(),
  };
}

function describe(err: unknown): string {
  if (err instanceof CalendarAuthError) return err.message;
  if (err instanceof CalendarApiError) {
    if (err.status === 403) return 'Google rechazó la petición (403). Revisa que la Google Calendar API esté habilitada y tu correo esté como tester (docs/DEPLOY.md).';
    return err.message;
  }
  return (err as Error)?.message ?? 'Error desconocido al leer la agenda.';
}

function pickSelection(calendars: CalendarInfo[], previous: string[]): string[] {
  const ids = new Set(calendars.map((c) => c.id));
  const kept = previous.filter((id) => ids.has(id));
  if (kept.length) return kept;
  const primary = calendars.find((c) => c.primary) ?? calendars[0];
  return primary ? [primary.id] : [];
}

export const useCalendar = create<CalendarState>()(
  persist(
    (set, get) => {
      async function sync(interactive: boolean): Promise<void> {
        set({ loading: true, error: undefined });
        try {
          const token = await requestToken({ interactive });
          const calendars = await listCalendars(token);
          // Conserva la selección previa si esos calendarios siguen existiendo; si no, el principal.
          const selectedCalendarIds = pickSelection(calendars, get().selectedCalendarIds);
          const { fromISO, toISO } = eventsRange();
          const events = await listEvents(token, selectedCalendarIds, fromISO, toISO);
          set({ connected: true, calendars, selectedCalendarIds, events, fetchedAt: nowIso(), error: undefined, loading: false });
        } catch (err) {
          // Con error de permiso mantenemos `connected` (y los eventos en caché) para que la UI ofrezca reconectar.
          set({ loading: false, error: describe(err) });
          throw err;
        }
      }
      return {
        connected: false,
        selectedCalendarIds: [],
        calendars: [],
        events: [],
        fetchedAt: undefined,
        error: undefined,
        loading: false,
        async connect() {
          await sync(true).catch(() => undefined);
        },
        async refresh(interactive = false) {
          if (!get().connected && !interactive) return;
          await sync(interactive).catch(() => undefined);
        },
        async toggleCalendar(id) {
          const cur = get().selectedCalendarIds;
          const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
          set({ selectedCalendarIds: next });
          if (!get().connected) return;
          set({ loading: true, error: undefined });
          try {
            const token = await requestToken({ interactive: false });
            const { fromISO, toISO } = eventsRange();
            const events = await listEvents(token, next, fromISO, toISO);
            set({ events, fetchedAt: nowIso(), loading: false });
          } catch (err) {
            set({ loading: false, error: describe(err) });
          }
        },
        async disconnect() {
          await revoke();
          set({ connected: false, selectedCalendarIds: [], calendars: [], events: [], fetchedAt: undefined, error: undefined, loading: false });
        },
      };
    },
    {
      name: CALENDAR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ connected: s.connected, selectedCalendarIds: s.selectedCalendarIds, calendars: s.calendars, events: s.events, fetchedAt: s.fetchedAt }),
    },
  ),
);
