/**
 * Qué misiones tocan hoy y en qué estado están (pendiente, activa, en gracia, vencida, hecha).
 */
import type { Completion, Mission } from '@/shared/types';
import { isScheduledOn, windowStatus, yesterdayGraceStatus, addDays, parseHHmm, weekKey, startOfWeek, windowFor, weekdayOf, type WindowStatus } from '@/lib/time';

export type MissionDayState = 'done' | 'upcoming' | 'active' | 'grace' | 'expired' | 'allDay' | 'failed';

export interface TodayItem {
  mission: Mission;
  /** Día lógico al que pertenece (hoy o ayer si está en gracia cruzando medianoche). */
  day: string;
  state: MissionDayState;
  window: WindowStatus;
  completion: Completion | null;
  /** Para semanales: cuántas veces va esta semana. */
  weeklyProgress?: { done: number; target: number };
  sortKey: number;
}

export function completionsFor(completions: Completion[], missionId: string, day: string): Completion | null {
  return completions.find((c) => c.missionId === missionId && c.day === day && c.status !== 'annulled') ?? null;
}

export function weeklyCount(completions: Completion[], missionId: string, day: string): number {
  const wk = weekKey(day);
  return completions.filter((c) => c.missionId === missionId && c.status !== 'annulled' && weekKey(c.day) === wk).length;
}

export interface TodayView {
  timed: TodayItem[];
  allDay: TodayItem[];
  weekly: TodayItem[];
  longTerm: Mission[];
  /** Misiones que un módulo aporta pero no tocan hoy (para no dejar vacía la vista). */
  restToday: boolean;
}

export function buildToday(missions: Mission[], completions: Completion[], failedToday: Set<string>, at: Date, tz: string, today: string, graceHours: number): TodayView {
  const timed: TodayItem[] = [];
  const allDay: TodayItem[] = [];
  const weekly: TodayItem[] = [];
  const longTerm: Mission[] = [];
  const yesterday = addDays(today, -1);

  for (const m of missions) {
    if (!m.active) continue;
    if (m.type === 'hidden' && !m.revealed) continue;
    if (m.mastery.state === 'automated') continue;

    if (m.type === 'main' || m.type === 'boss') {
      longTerm.push(m);
      continue;
    }

    if (m.type === 'weekly') {
      const target = m.schedule.timesPerWeek ?? 1;
      const done = weeklyCount(completions, m.id, today);
      const c = completionsFor(completions, m.id, today);
      const ws = windowStatus({ ...m.schedule, window: 'allDay' }, at, tz, graceHours);
      weekly.push({
        mission: m,
        day: today,
        state: done >= target ? 'done' : c ? 'done' : 'allDay',
        window: ws,
        completion: c,
        weeklyProgress: { done, target },
        sortKey: 10_000,
      });
      continue;
    }

    // daily / side / hidden (con fecha)
    const scheduledToday = isScheduledOn(m.schedule, today);
    const scheduledYesterday = isScheduledOn(m.schedule, yesterday);

    if (scheduledYesterday && !scheduledToday) {
      const g = yesterdayGraceStatus(m.schedule, at, tz, graceHours);
      const c = completionsFor(completions, m.id, yesterday);
      if (g && !c) {
        timed.push({ mission: m, day: yesterday, state: 'grace', window: g, completion: null, sortKey: -1 });
      }
      continue;
    }
    if (!scheduledToday) {
      // Ayer en gracia y hoy también programada: mostrar la de ayer en gracia si no se hizo.
      continue;
    }
    if (scheduledYesterday) {
      const g = yesterdayGraceStatus(m.schedule, at, tz, graceHours);
      const cy = completionsFor(completions, m.id, yesterday);
      if (g && !cy && !failedToday.has(`${m.id}:${yesterday}`)) {
        timed.push({ mission: m, day: yesterday, state: 'grace', window: g, completion: null, sortKey: -1 });
      }
    }

    const c = completionsFor(completions, m.id, today);
    const ws = windowStatus(m.schedule, at, tz, graceHours);
    let state: MissionDayState;
    if (c) state = 'done';
    else if (failedToday.has(`${m.id}:${today}`)) state = 'failed';
    else state = ws.state;
    const w = windowFor(m.schedule, weekdayOf(today));
    const item: TodayItem = {
      mission: m,
      day: today,
      state,
      window: ws,
      completion: c,
      sortKey: w === 'allDay' ? 9_000 : parseHHmm(w.start),
    };
    if (w === 'allDay') allDay.push(item);
    else timed.push(item);
  }

  timed.sort((a, b) => a.sortKey - b.sortKey);
  return { timed, allDay, weekly, longTerm, restToday: timed.length === 0 && allDay.length === 0 };
}

export interface WeekDayLoad {
  day: string;
  missions: Mission[];
  minutes: number;
  done: number;
}

export function buildWeek(missions: Mission[], completions: Completion[], today: string): WeekDayLoad[] {
  const monday = startOfWeek(today);
  const out: WeekDayLoad[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const ms = missions.filter((m) => m.active && (m.type === 'daily' || m.type === 'side') && m.mastery.state !== 'automated' && isScheduledOn(m.schedule, day));
    const minutes = ms.reduce((s, m) => s + m.estimatedMinutes, 0);
    const done = ms.filter((m) => completionsFor(completions, m.id, day)).length;
    out.push({ day, missions: ms, minutes, done });
  }
  return out;
}

/** Detecta solapes entre misiones con hora el mismo día (avisa, deja decidir). */
export function overlaps(missions: Mission[], candidate: { schedule: Mission['schedule'] }, excludeId?: string): Mission[] {
  if (candidate.schedule.window === 'allDay') return [];
  const cs = parseHHmm(candidate.schedule.window.start);
  const ce = parseHHmm(candidate.schedule.window.end);
  return missions.filter((m) => {
    if (m.id === excludeId || !m.active || m.schedule.window === 'allDay') return false;
    if (!m.schedule.days.some((d) => candidate.schedule.days.includes(d))) return false;
    const s = parseHHmm(m.schedule.window.start);
    const e = parseHHmm(m.schedule.window.end);
    return s < ce && cs < e;
  });
}
