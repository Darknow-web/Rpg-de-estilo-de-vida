/**
 * Tiempo del juego: día lógico, ventanas horarias y margen de gracia.
 * TODO se calcula en la zona horaria guardada en el perfil del jugador, no en la del dispositivo.
 * Cambiar la hora del dispositivo no cambia el día lógico: el día se deriva de un instante UTC + tz.
 */
import type { MissionSchedule, TimeWindow } from '@/shared/types';
import { GRACE } from '@/lib/game-balance';

export type DayString = string; // 'YYYY-MM-DD'

let clockOffsetMs = 0; // servidor − dispositivo (se ajusta con /api/time)
export function setClockOffset(ms: number) {
  clockOffsetMs = ms;
}
export function getClockOffset() {
  return clockOffsetMs;
}
/** Instante "de confianza": hora del dispositivo corregida por la desviación observada contra el servidor. */
export function now(): Date {
  return new Date(Date.now() + clockOffsetMs);
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  day: DayString;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 domingo
  minutesOfDay: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function zonedParts(date: Date, tz: string): ZonedParts {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = fmt(tz).formatToParts(date);
  } catch {
    parts = fmt('UTC').formatToParts(date);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute,
    second: Number(get('second')),
    weekday: WEEKDAYS.indexOf(get('weekday')),
    minutesOfDay: hour * 60 + minute,
  };
}

export function todayIn(tz: string, at: Date = now()): DayString {
  return zonedParts(at, tz).day;
}

export function addDays(day: DayString, n: number): DayString {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: DayString, b: DayString): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function weekdayOf(day: DayString): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Clave de semana ISO-ish "YYYY-Www" (semana que empieza lunes). */
export function weekKey(day: DayString): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function monthKey(day: DayString): string {
  return day.slice(0, 7);
}

/** Lunes de la semana del día dado. */
export function startOfWeek(day: DayString): DayString {
  const wd = weekdayOf(day);
  const back = wd === 0 ? 6 : wd - 1;
  return addDays(day, -back);
}

export function parseHHmm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
export function formatHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function minutesToHuman(min: number): string {
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export type WindowState = 'upcoming' | 'active' | 'grace' | 'expired' | 'allDay';

export interface WindowStatus {
  state: WindowState;
  /** Minutos hasta que cierre la ventana (si activa) o hasta que termine la gracia. */
  minutesLeft: number | null;
  /** Minutos hasta que abra (si upcoming). */
  minutesUntilOpen: number | null;
  window: TimeWindow | 'allDay';
}

/**
 * Estado de una ventana horaria para un instante dado (en tz del jugador).
 * Todo el día = ventana 00:00–23:59, con gracia hasta las 03:00 del día siguiente.
 */
/** Ventana efectiva para un día de la semana (el módulo gimnasio usa ventanas distintas por día). */
export function windowFor(schedule: MissionSchedule, weekday: number): TimeWindow | 'allDay' {
  return schedule.windowsByDay?.[String(weekday)] ?? schedule.window;
}

export function windowStatus(schedule: MissionSchedule, at: Date, tz: string, graceHours: number = GRACE.hoursAfterWindow): WindowStatus {
  const p = zonedParts(at, tz);
  const w = windowFor(schedule, p.weekday);
  if (w === 'allDay') {
    const end = 24 * 60;
    return { state: 'allDay', minutesLeft: end - p.minutesOfDay, minutesUntilOpen: null, window: 'allDay' };
  }
  const start = parseHHmm(w.start);
  const end = parseHHmm(w.end);
  const graceEnd = end + graceHours * 60;
  const m = p.minutesOfDay;
  if (m < start) return { state: 'upcoming', minutesLeft: null, minutesUntilOpen: start - m, window: w };
  if (m <= end) return { state: 'active', minutesLeft: end - m, minutesUntilOpen: null, window: w };
  if (m <= graceEnd) return { state: 'grace', minutesLeft: graceEnd - m, minutesUntilOpen: null, window: w };
  return { state: 'expired', minutesLeft: null, minutesUntilOpen: null, window: w };
}

/**
 * Estado de la ventana de AYER que todavía puede estar en gracia (ventanas que terminan tarde y
 * cuya gracia cruza la medianoche). Devuelve 'grace' con minutos restantes o null.
 */
export function yesterdayGraceStatus(schedule: MissionSchedule, at: Date, tz: string, graceHours: number = GRACE.hoursAfterWindow): WindowStatus | null {
  const p = zonedParts(at, tz);
  const w = windowFor(schedule, (p.weekday + 6) % 7);
  const end = w === 'allDay' ? 24 * 60 : parseHHmm(w.end);
  const graceEnd = end + graceHours * 60 - 24 * 60;
  if (graceEnd <= 0) return null;
  if (p.minutesOfDay <= graceEnd) {
    return { state: 'grace', minutesLeft: graceEnd - p.minutesOfDay, minutesUntilOpen: null, window: w };
  }
  return null;
}

/** ¿Está la misión programada para este día (por días de la semana o fecha única)? */
export function isScheduledOn(schedule: MissionSchedule, day: DayString): boolean {
  if (schedule.once) return schedule.once === day;
  if (!schedule.days.length) return false;
  return schedule.days.includes(weekdayOf(day));
}

/** Instante UTC de "day HH:mm" en la zona horaria dada (aproximación robusta para notificaciones). */
export function zonedTimeToUtc(day: DayString, hhmm: string, tz: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const target = parseHHmm(hhmm);
  let guess = Date.UTC(y, m - 1, d, Math.floor(target / 60), target % 60);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), tz);
    const diffDays = daysBetween(p.day, day);
    const diffMin = diffDays * 24 * 60 + (target - p.minutesOfDay);
    if (diffMin === 0) break;
    guess += diffMin * 60_000;
  }
  return new Date(guess);
}

export function formatDayHuman(day: DayString, locale = 'es'): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
