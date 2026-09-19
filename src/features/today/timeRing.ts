/**
 * Cronómetro de una misión de hoy: cuánto queda de la ventana y de qué color avisar.
 * Puro (sin React) para poder probarlo. Cian = hay tiempo; oro = última media hora (NOTIFICATIONS.closingWarningMinutes);
 * rojo = en gracia (ya cerró, aún no cuesta corazón); sin anillo = hecha, vencida o todavía no abre.
 */
import type { TodayItem } from '@/core/missions/schedule';
import { minutesToHuman, parseHHmm, formatHHmm } from '@/lib/time';
import { NOTIFICATIONS, GRACE } from '@/lib/game-balance';
import type { TimeRingTone } from '@/components/ui/primitives';

export interface RingInfo {
  /** Parte de la ventana que QUEDA (0–1). */
  fraction: number;
  tone: TimeRingTone;
  /** Texto corto para la fila: "quedan 42 min", "abre en 2 h", "hecha 08:12"… */
  text: string;
  /** Texto largo para la tarjeta activa: "Cierra a las 10:00 · quedan 42 min". */
  long: string;
  /** Si hay anillo que dibujar. */
  show: boolean;
}

export function ringFor(item: TodayItem, graceHours: number = GRACE.hoursAfterWindow, warnMinutes: number = NOTIFICATIONS.closingWarningMinutes): RingInfo {
  const w = item.window.window;
  const left = item.window.minutesLeft;
  const none = (text: string): RingInfo => ({ fraction: 0, tone: 'mute', text, long: text, show: false });

  if (item.state === 'done') return none(`Hecha${item.completion ? ` · ${item.completion.completedAt.slice(11, 16)}` : ''}`);
  if (item.state === 'failed') return none('Vencida · corazón descontado');
  if (item.state === 'expired') return none('Vencida');
  if (item.state === 'upcoming') {
    const until = item.window.minutesUntilOpen ?? 0;
    const opens = w === 'allDay' ? '' : `Abre a las ${w.start}`;
    return { fraction: 1, tone: 'mute', text: `Abre en ${minutesToHuman(until)}`, long: `${opens} · en ${minutesToHuman(until)}`, show: true };
  }
  if (item.state === 'grace') {
    const total = Math.max(1, graceHours * 60);
    const l = left ?? 0;
    return { fraction: l / total, tone: 'hp', text: `Gracia · ${minutesToHuman(l)} · 50 % XP`, long: `Ya cerró · en gracia ${minutesToHuman(l)} más, sin daño`, show: true };
  }
  // active o allDay
  const total = w === 'allDay' ? 24 * 60 : Math.max(1, parseHHmm(w.end) - parseHHmm(w.start));
  const l = left ?? 0;
  const closes = w === 'allDay' ? '23:59' : w.end;
  const tone: TimeRingTone = l <= warnMinutes ? 'gold' : 'xp';
  return {
    fraction: l / total,
    tone,
    text: `Quedan ${minutesToHuman(l)}`,
    long: `Cierra a las ${closes} · quedan ${minutesToHuman(l)}`,
    show: true,
  };
}

/** "07:00 – 09:00" o "Todo el día". */
export function windowText(w: TodayItem['window']['window']): string {
  return w === 'allDay' ? 'Todo el día' : `${w.start} – ${w.end}`;
}

/** Resumen de una línea: qué hay que hacer. Descripción recortada; si no hay, la versión mínima. */
export function whatToDo(m: { description: string; name: string; minimalVersion?: { description: string } }, max = 90): string {
  const src = (m.description && m.description.trim() !== m.name.trim() ? m.description : m.minimalVersion?.description ?? '').trim();
  if (src.length <= max) return src;
  const cut = src.slice(0, max);
  const at = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf(','));
  return `${cut.slice(0, at > 40 ? at : max).replace(/[,\s]+$/, '')}…`;
}

export { formatHHmm };
