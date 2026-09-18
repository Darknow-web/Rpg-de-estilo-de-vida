/**
 * Dominio de misiones: Nueva → En progreso → Consolidada → Dominada → Automatizada.
 * Umbrales en game-balance (14/2, 30/3, 66 acumulados; UCL 2010).
 */
import type { MasteryInfo, MasteryState } from '@/shared/types';
import { MASTERY } from '@/lib/game-balance';

export interface MasteryTransition {
  from: MasteryState;
  to: MasteryState;
  /** Si el progreso se reinició por exceso de fallas. */
  windowReset: boolean;
}

const HISTORY_MAX = 60;

function pushHistory(h: string, c: '1' | '0'): string {
  return (h + c).slice(-HISTORY_MAX);
}

export function applyMasteryDone(m: MasteryInfo, day: string): { mastery: MasteryInfo; transition: MasteryTransition | null } {
  const next: MasteryInfo = { ...m, daysDone: m.daysDone + 1, cumulativeDays: m.cumulativeDays + 1, history: pushHistory(m.history, '1') };
  if (next.state === 'new') next.windowStart = next.windowStart || day;
  const from = m.state;
  let to: MasteryState = from;
  if (from === 'new') to = 'progress';
  if ((to === 'progress' || from === 'progress') && next.daysDone >= MASTERY.consolidated.days && next.daysFailed <= MASTERY.consolidated.maxFails) to = 'consolidated';
  if ((to === 'consolidated' || from === 'consolidated') && next.daysDone >= MASTERY.mastered.days && next.daysFailed <= MASTERY.mastered.maxFails) to = 'mastered';
  if ((to === 'mastered' || from === 'mastered') && next.cumulativeDays >= MASTERY.automated.cumulativeDays) to = 'automated';
  next.state = to;
  return { mastery: next, transition: to !== from ? { from, to, windowReset: false } : null };
}

export function applyMasteryFail(m: MasteryInfo, day: string): { mastery: MasteryInfo; transition: MasteryTransition | null } {
  const next: MasteryInfo = { ...m, daysFailed: m.daysFailed + 1, history: pushHistory(m.history, '0') };
  const from = m.state;

  if (from === 'mastered') {
    // Dominada que se falla 5 veces en 14 días retrocede a Consolidada.
    const recent = next.history.slice(-MASTERY.demoteMasteredIf.windowDays);
    const fails = recent.split('').filter((c) => c === '0').length;
    if (fails >= MASTERY.demoteMasteredIf.fails) {
      next.state = 'consolidated';
      next.daysFailed = 0;
      return { mastery: next, transition: { from, to: 'consolidated', windowReset: false } };
    }
    return { mastery: next, transition: null };
  }

  const maxFails = from === 'consolidated' ? MASTERY.mastered.maxFails : MASTERY.consolidated.maxFails;
  if (next.daysFailed > maxFails && from !== 'automated') {
    // Exceso de fallas: la barra retrocede a la mitad (visible y acotado), nunca a cero.
    next.daysDone = Math.floor(next.daysDone / 2);
    next.daysFailed = 0;
    next.windowStart = day;
    const to: MasteryState = from === 'consolidated' && next.daysDone < MASTERY.consolidated.days ? 'progress' : from === 'new' ? 'new' : from;
    next.state = to;
    return { mastery: next, transition: { from, to, windowReset: true } };
  }
  return { mastery: next, transition: null };
}

/** Escalar reinicia la barra de dominio (con "Mentor", conserva la mitad). */
export function masteryAfterEscalation(m: MasteryInfo, day: string, keepHalf: boolean): MasteryInfo {
  return {
    state: 'progress',
    daysDone: keepHalf ? Math.floor(m.daysDone / 2) : 0,
    daysFailed: 0,
    cumulativeDays: m.cumulativeDays,
    windowStart: day,
    history: '',
  };
}

export interface MasteryBar {
  label: string;
  current: number;
  target: number;
  nextState: MasteryState | null;
  failsLeft: number | null;
}

export function masteryBar(m: MasteryInfo): MasteryBar {
  switch (m.state) {
    case 'new':
    case 'progress':
      return { label: 'Hacia Consolidada', current: m.daysDone, target: MASTERY.consolidated.days, nextState: 'consolidated', failsLeft: Math.max(0, MASTERY.consolidated.maxFails - m.daysFailed) };
    case 'consolidated':
      return { label: 'Hacia Dominada', current: m.daysDone, target: MASTERY.mastered.days, nextState: 'mastered', failsLeft: Math.max(0, MASTERY.mastered.maxFails - m.daysFailed) };
    case 'mastered':
      return { label: 'Hacia Automatizada', current: m.cumulativeDays, target: MASTERY.automated.cumulativeDays, nextState: 'automated', failsLeft: null };
    case 'automated':
      return { label: 'Rasgo del personaje', current: m.cumulativeDays, target: m.cumulativeDays, nextState: null, failsLeft: null };
  }
}

/** Dificultad dinámica: tasa de fallo en la ventana reciente. */
export function recentFailRate(m: MasteryInfo, windowDays = MASTERY.dynamicDifficulty.windowDays): { rate: number; samples: number } {
  const recent = m.history.slice(-windowDays);
  const samples = recent.length;
  if (!samples) return { rate: 0, samples: 0 };
  const fails = recent.split('').filter((c) => c === '0').length;
  return { rate: fails / samples, samples };
}
