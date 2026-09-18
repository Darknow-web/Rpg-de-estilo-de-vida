/**
 * Disponibilidad en texto libre → bloques. IA primero; si no está, parser local por expresiones regulares.
 * Si algo es ambiguo, se pregunta: nunca se adivina.
 */
import { apiPost } from '@/lib/api';
import type { AvailabilityOutput } from '@/shared/schemas/ai';
import type { AvailabilityBlock } from '../types';

const DAY_WORDS: [RegExp, number][] = [
  [/domingo/i, 0],
  [/lunes/i, 1],
  [/martes/i, 2],
  [/mi[eé]rcoles/i, 3],
  [/jueves/i, 4],
  [/viernes/i, 5],
  [/s[aá]bado/i, 6],
];

function toHHmm(h: number, m = 0): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Interpreta "temprano", "antes de las 9", "desde las 8 de la noche", "de 6 a 7", "tarde". */
function windowFromFragment(frag: string): { start: string; end: string } | null {
  const f = frag.toLowerCase();
  const range = f.match(/de\s*(\d{1,2})(?::(\d{2}))?\s*(?:a|hasta|-)\s*(\d{1,2})(?::(\d{2}))?/);
  const pm = /noche|tarde|pm|p\.m/.test(f);
  if (range) {
    let s = Number(range[1]);
    let e = Number(range[3]);
    if (pm && s < 12) s += 12;
    if (pm && e < 12 && e + 12 > s) e += 12;
    if (e <= s) e = s + 1;
    return { start: toHHmm(s, Number(range[2] ?? 0)), end: toHHmm(Math.min(23, e), Number(range[4] ?? 0)) };
  }
  const before = f.match(/antes de las?\s*(\d{1,2})/);
  if (before) {
    const e = Number(before[1]) + (pm && Number(before[1]) < 12 ? 12 : 0);
    return { start: toHHmm(Math.max(5, e - 3)), end: toHHmm(e) };
  }
  const after = f.match(/(?:desde|después de|a partir de|despues de) las?\s*(\d{1,2})/);
  if (after) {
    const s = Number(after[1]) + (pm && Number(after[1]) < 12 ? 12 : 0);
    return { start: toHHmm(s), end: toHHmm(Math.min(23, s + 2), 30) };
  }
  if (/temprano|mañana|madrugada/.test(f)) return { start: '06:00', end: '09:00' };
  if (/mediod[ií]a|almuerzo/.test(f)) return { start: '12:00', end: '14:00' };
  if (/tarde/.test(f)) return { start: '15:00', end: '18:00' };
  if (/noche/.test(f)) return { start: '20:00', end: '22:30' };
  return null;
}

export function parseAvailabilityLocal(text: string): { blocks: AvailabilityBlock[]; ambiguities: string[] } {
  const blocks: AvailabilityBlock[] = [];
  const ambiguities: string[] = [];
  const fragments = text.split(/[,;.\n]|\by\b/).map((s) => s.trim()).filter(Boolean);
  for (const frag of fragments) {
    const days = DAY_WORDS.filter(([re]) => re.test(frag)).map(([, d]) => d);
    const w = windowFromFragment(frag);
    if (/entre semana|d[ií]as de semana|lunes a viernes/i.test(frag)) days.push(1, 2, 3, 4, 5);
    if (/fin de semana|fines de semana/i.test(frag)) days.push(0, 6);
    if (days.length && w) for (const d of new Set(days)) blocks.push({ day: d, start: w.start, end: w.end });
    else if (days.length && !w) ambiguities.push(`"${frag}": ¿a qué hora? (mañana, tarde o noche, o una franja como "de 7 a 8")`);
    else if (!days.length && w) ambiguities.push(`"${frag}": ¿qué días?`);
    else if (/a veces|depende|no s[eé]|varía/i.test(frag)) ambiguities.push(`"${frag}": ¿puedes fijar al menos un día seguro?`);
  }
  return { blocks, ambiguities };
}

export async function parseAvailability(text: string): Promise<{ blocks: AvailabilityBlock[]; ambiguities: string[]; source: 'ai' | 'local' }> {
  const res = await apiPost<AvailabilityOutput>('/api/ai/parse-availability', { text }, 25_000);
  if (res.ok) return { blocks: res.data.bloques.map((b) => ({ day: b.dia, start: b.inicio, end: b.fin })), ambiguities: res.data.ambiguedades, source: 'ai' };
  const local = parseAvailabilityLocal(text);
  return { ...local, source: 'local' };
}

/**
 * Adaptador .ics (stub preparado): recibe el texto de un calendario y devuelve los huecos libres
 * de la semana. Interfaz lista; la implementación completa vendrá cuando se necesite.
 */
export interface CalendarImportAdapter {
  name: string;
  parseFreeBlocks(icsText: string, weekStart: string, dayStart?: string, dayEnd?: string): Promise<AvailabilityBlock[]>;
}

export const icsAdapter: CalendarImportAdapter = {
  name: 'ics',
  async parseFreeBlocks(icsText) {
    // Stub: detecta que es un .ics válido y avisa. Implementación futura: leer VEVENT/DTSTART/DTEND
    // y restar los eventos a la jornada para obtener los huecos.
    if (!/BEGIN:VCALENDAR/.test(icsText)) throw new Error('El archivo no parece un calendario .ics');
    throw new Error('La importación de .ics está preparada pero aún no implementada. Pega tu disponibilidad en texto por ahora.');
  },
};
