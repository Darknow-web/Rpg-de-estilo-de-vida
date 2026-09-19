/**
 * Cliente de Google Calendar con Google Identity Services, modelo de token.
 * - Lee eventos y ESCRIBE solo lo que el jugador confirma desde el planificador de la agenda (tareas de la lista).
 *   Las misiones diarias nunca se escriben en el calendario.
 * - El token de acceso y su vencimiento viven SOLO en memoria (variable de módulo): al recargar se pide otro.
 * - Todo va directo del navegador a googleapis.com; el servidor de Life Quest y Firestore nunca ven la agenda.
 * - Un 401 limpia el token y lanza `CalendarAuthError` para que la UI ofrezca reconectar.
 */
import type { CalendarEvent, CalendarInfo } from './types';

declare global {
  interface Window {
    // Tipado mínimo de GIS: no añadimos dependencias por unas pocas llamadas.
    google?: any;
  }
}

export const GIS_SRC = 'https://accounts.google.com/gsi/client';
/** Leer + crear/editar/borrar eventos (no da acceso a la configuración de los calendarios ni a otros datos de Google). */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3';

/** El token venció o el jugador no dio permiso. La UI debe ofrecer "Conectar de nuevo". */
export class CalendarAuthError extends Error {
  readonly code = 'calendar_auth' as const;
  constructor(message = 'La sesión con Google Calendar venció o fue rechazada.') {
    super(message);
    this.name = 'CalendarAuthError';
  }
}

/** Cualquier otro fallo de la API de Calendar (red, 403 sin API habilitada, 404 de calendario, etc.). */
export class CalendarApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CalendarApiError';
  }
}

// ── Estado en memoria ──
let token: string | null = null;
let expiresAt = 0;
let gisLoading: Promise<void> | null = null;

export function clientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
}

/** ¿Hay Client ID configurado? Sin él, la UI debe explicar cómo obtenerlo (docs/DEPLOY.md). */
export function calendarConfigured(): boolean {
  return clientId().length > 0;
}

/** Token vigente (con 60 s de margen) o null. */
export function currentToken(): string | null {
  if (token && Date.now() < expiresAt) return token;
  return null;
}

export function clearToken(): void {
  token = null;
  expiresAt = 0;
}

/** Inyecta el script de GIS una sola vez. Resuelve cuando `window.google.accounts.oauth2` está disponible. */
export function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('GIS solo funciona en el navegador.'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement('script');
    const onLoad = () => (window.google?.accounts?.oauth2 ? resolve() : reject(new Error('GIS cargó sin accounts.oauth2.')));
    const onError = () => {
      gisLoading = null;
      reject(new Error('No se pudo cargar Google Identity Services. ¿Hay conexión?'));
    };
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return gisLoading;
}

/**
 * Pide un token de acceso (leer y escribir eventos; la app solo escribe lo que el jugador confirma).
 * - `interactive: true` → pantalla de consentimiento (primera vez o al reconectar).
 * - `interactive: false` → intento silencioso (prompt ''), que GIS resuelve sin preguntar si el jugador ya consintió.
 * Devuelve el token vigente si aún no venció.
 */
export function requestToken({ interactive }: { interactive: boolean }): Promise<string> {
  const cached = currentToken();
  if (cached) return Promise.resolve(cached);
  if (!calendarConfigured()) return Promise.reject(new CalendarAuthError('Falta VITE_GOOGLE_CLIENT_ID. Revisa docs/DEPLOY.md → "Google Calendar (gratis)".'));
  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId(),
          scope: CALENDAR_SCOPE,
          callback: (resp: { access_token?: string; expires_in?: number | string; error?: string; error_description?: string }) => {
            if (resp.error || !resp.access_token) {
              clearToken();
              reject(new CalendarAuthError(resp.error_description ?? resp.error ?? 'Google no entregó un token.'));
              return;
            }
            token = resp.access_token;
            const seconds = Number(resp.expires_in ?? 3600);
            expiresAt = Date.now() + Math.max(60, seconds - 60) * 1000;
            resolve(token);
          },
          error_callback: (err: { type?: string; message?: string }) => {
            clearToken();
            reject(new CalendarAuthError(err?.type === 'popup_closed' ? 'Cerraste la ventana de Google antes de dar permiso.' : (err?.message ?? 'No se pudo abrir la ventana de Google.')));
          },
        });
        client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      }),
  );
}

/** Revoca el permiso en Google y olvida el token. */
export function revoke(): Promise<void> {
  const t = token;
  clearToken();
  if (!t || typeof window === 'undefined' || !window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise<void>((resolve) => {
    try {
      window.google.accounts.oauth2.revoke(t, () => resolve());
    } catch {
      resolve();
    }
  });
}

// ── Llamadas a la API ──

async function apiGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    throw new CalendarApiError(0, `Sin conexión con Google Calendar: ${(err as Error).message}`);
  }
  if (res.status === 401) {
    clearToken();
    throw new CalendarAuthError();
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? '';
    } catch {
      /* sin cuerpo */
    }
    throw new CalendarApiError(res.status, detail || `Google Calendar respondió ${res.status}.`);
  }
  return (await res.json()) as T;
}

interface GCalendarListItem {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  deleted?: boolean;
}

export async function listCalendars(token: string): Promise<CalendarInfo[]> {
  const out: CalendarInfo[] = [];
  let pageToken: string | undefined;
  do {
    const page = await apiGet<{ items?: GCalendarListItem[]; nextPageToken?: string }>('/users/me/calendarList', token, {
      minAccessRole: 'reader',
      showHidden: 'false',
      ...(pageToken ? { pageToken } : {}),
    });
    for (const c of page.items ?? []) {
      if (c.deleted) continue;
      out.push({ id: c.id, summary: c.summaryOverride ?? c.summary ?? c.id, backgroundColor: c.backgroundColor, primary: c.primary || undefined });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  // El principal primero, luego alfabético.
  return out.sort((a, b) => (a.primary === b.primary ? a.summary.localeCompare(b.summary, 'es') : a.primary ? -1 : 1));
}

interface GEventItem {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  colorId?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export function toCalendarEvent(item: GEventItem, calendarId: string): CalendarEvent | null {
  const start = item.start?.dateTime ?? item.start?.date;
  const end = item.end?.dateTime ?? item.end?.date ?? start;
  if (!start || !end || item.status === 'cancelled') return null;
  return {
    id: item.id,
    calendarId,
    summary: item.summary?.trim() || '(Sin título)',
    start,
    end,
    allDay: !item.start?.dateTime,
    location: item.location || undefined,
    htmlLink: item.htmlLink,
    colorId: item.colorId,
  };
}

/** Clave de orden: los de todo el día quedan al inicio de su fecha (medianoche UTC precede a cualquier hora de Lima). */
export function eventSortKey(e: CalendarEvent): number {
  const t = Date.parse(e.start);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Eventos de varios calendarios entre dos instantes, fusionados y ordenados por inicio.
 * Un calendario que falle con 404/403 se omite (fue eliminado o dejó de compartirse); el 401 sí se propaga.
 */
export async function listEvents(token: string, calendarIds: string[], fromISO: string, toISO: string): Promise<CalendarEvent[]> {
  const all: CalendarEvent[] = [];
  for (const calendarId of calendarIds) {
    try {
      const page = await apiGet<{ items?: GEventItem[] }>(`/calendars/${encodeURIComponent(calendarId)}/events`, token, {
        timeMin: fromISO,
        timeMax: toISO,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });
      for (const it of page.items ?? []) {
        const ev = toCalendarEvent(it, calendarId);
        if (ev) all.push(ev);
      }
    } catch (err) {
      if (err instanceof CalendarApiError && (err.status === 404 || err.status === 403)) continue;
      throw err;
    }
  }
  return all.sort((a, b) => eventSortKey(a) - eventSortKey(b) || a.summary.localeCompare(b.summary, 'es'));
}

// ── Escritura (solo tareas confirmadas por el jugador) ──

async function apiSend<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, token: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new CalendarApiError(0, `Sin conexión con Google Calendar: ${(err as Error).message}`);
  }
  if (res.status === 401) {
    clearToken();
    throw new CalendarAuthError();
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? '';
    } catch {
      /* sin cuerpo */
    }
    throw new CalendarApiError(res.status, detail || `Google Calendar respondió ${res.status}.`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface NewEvent {
  summary: string;
  description?: string;
  /** Día "YYYY-MM-DD" y horas "HH:mm" en la zona `tz`. */
  day: string;
  start: string;
  end: string;
  tz: string;
}

function eventBody(e: NewEvent) {
  return {
    summary: e.summary,
    description: e.description,
    start: { dateTime: `${e.day}T${e.start}:00`, timeZone: e.tz },
    end: { dateTime: `${e.day}T${e.end}:00`, timeZone: e.tz },
    // Sin invitados, sin recordatorios extra: la app ya avisa (tope de 4 al día).
    reminders: { useDefault: false },
    extendedProperties: { private: { lifeQuest: '1' } },
  };
}

/** Crea un evento en el calendario indicado. Devuelve el evento tal como quedó en Google. */
export async function createEvent(token: string, calendarId: string, e: NewEvent): Promise<CalendarEvent> {
  const item = await apiSend<GEventItem>('POST', `/calendars/${encodeURIComponent(calendarId)}/events`, token, eventBody(e));
  const ev = toCalendarEvent(item, calendarId);
  if (!ev) throw new CalendarApiError(500, 'Google devolvió un evento sin fechas.');
  return ev;
}

/** Cambia la hora de un evento existente (movimiento aceptado por el jugador). */
export async function updateEventTime(token: string, calendarId: string, eventId: string, when: { day: string; start: string; end: string; tz: string }): Promise<void> {
  await apiSend<GEventItem>('PATCH', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, token, {
    start: { dateTime: `${when.day}T${when.start}:00`, timeZone: when.tz },
    end: { dateTime: `${when.day}T${when.end}:00`, timeZone: when.tz },
  });
}

/** Borra un evento. Solo se llama para eventos que creó la app y con confirmación del jugador. Un 404/410 se considera ya borrado. */
export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await apiSend<void>('DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, token);
  } catch (err) {
    if (err instanceof CalendarApiError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}
