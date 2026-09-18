/**
 * Generador de rutina semanal:
 * - Encaja sesiones en los bloques libres (duración que quepa en el bloque).
 * - Reparte patrones de movimiento de forma equilibrada.
 * - Al menos un día completo de descanso; no programa gimnasio en días de deporte declarado.
 * - SOLO usa ejercicios cuyo equipamiento está registrado. Avisa qué patrones quedan sin cubrir.
 * - Si no hay bloques suficientes, propone la mejor combinación posible y lo dice.
 */
import { EXERCISES, exerciseAvailable, PATTERN_LABEL, type ExerciseDef, type Pattern } from '../data/exercises';
import type { AvailabilityBlock, GymProfile, RoutineSession, WeeklyRoutine } from '../types';
import { parseHHmm, formatHHmm } from '@/lib/time';
import { nowIso } from '@/lib/ids';

const STRENGTH_PATTERNS: Pattern[] = ['empuje', 'traccion', 'pierna', 'core'];
const SESSION_TEMPLATES: { focus: string; patterns: Pattern[] }[] = [
  { focus: 'Cuerpo completo A', patterns: ['pierna', 'empuje', 'traccion', 'core', 'cardio'] },
  { focus: 'Cuerpo completo B', patterns: ['traccion', 'pierna', 'empuje', 'core', 'cardio'] },
  { focus: 'Cuerpo completo C', patterns: ['empuje', 'pierna', 'traccion', 'core', 'cardio'] },
  { focus: 'Pierna y core', patterns: ['pierna', 'pierna', 'core', 'cardio'] },
  { focus: 'Torso', patterns: ['empuje', 'traccion', 'empuje', 'traccion', 'core'] },
];

/** Cuántas sesiones proponer: conservador, según tiempo declarado y nivel. Sube por escalado, no por calendario. */
export function proposeSessionsPerWeek(timeAnswer: string | undefined, level: number): { sessions: number; maxMinutes: number; reason: string } {
  let sessions = 2;
  let maxMinutes = 30;
  if (timeAnswer === '30') {
    sessions = 2;
    maxMinutes = 35;
  } else if (timeAnswer === '60') {
    sessions = 3;
    maxMinutes = 50;
  } else if (timeAnswer === 'more') {
    sessions = 3;
    maxMinutes = 60;
  }
  if (level >= 18) sessions += 1;
  sessions = Math.min(4, sessions);
  return { sessions, maxMinutes, reason: `Con ${timeAnswer === 'more' ? 'más de 60' : timeAnswer ?? '30'} minutos al día y nivel ${level}, empezamos con ${sessions} sesiones de hasta ${maxMinutes} min. Cuando domines la misión, te propondremos subir.` };
}

export function generateRoutine(profile: GymProfile, blocks: AvailabilityBlock[], weekKey: string, opts: { minSessionMinutes?: number } = {}): WeeklyRoutine {
  const minSession = opts.minSessionMinutes ?? 25;
  const equipment = new Set(profile.equipment.map((e) => e.id));
  equipment.add('bodyweight');
  const available = EXERCISES.filter((e) => exerciseAvailable(e, equipment));
  const byPattern = new Map<Pattern, ExerciseDef[]>();
  for (const p of [...STRENGTH_PATTERNS, 'cardio'] as Pattern[]) byPattern.set(p, available.filter((e) => e.pattern === p));
  const uncovered = [...byPattern.entries()].filter(([, list]) => list.length === 0).map(([p]) => PATTERN_LABEL[p]);
  const notes: string[] = [];
  if (uncovered.length) notes.push(`Sin equipamiento para: ${uncovered.join(', ')}. Registra máquinas o elige otro preset para cubrirlos.`);

  const sportDays = new Set(profile.sports.flatMap((s) => s.days));
  // Bloques válidos: fuera de días de deporte, con duración mínima.
  const usable = blocks
    .map((b) => ({ ...b, minutes: parseHHmm(b.end) - parseHHmm(b.start) }))
    .filter((b) => b.minutes >= minSession && !sportDays.has(b.day))
    .sort((a, b) => b.minutes - a.minutes);
  if (blocks.some((b) => sportDays.has(b.day))) notes.push('Los días con deporte declarado se tratan como carga de entrenamiento: no se programa gimnasio.');

  const target = Math.max(1, profile.sessionsPerWeek);
  // Elegir días: distribuir dejando descanso entre sesiones cuando se pueda, y ≥1 día libre total.
  const chosen: typeof usable = [];
  const usedDays = new Set<number>();
  const busyDays = new Set<number>(sportDays);
  const candidates = [...usable].sort((a, b) => a.day - b.day);
  // Primera pasada: días no consecutivos
  for (const b of candidates) {
    if (chosen.length >= target) break;
    if (usedDays.has(b.day)) continue;
    if (usedDays.has((b.day + 6) % 7) || usedDays.has((b.day + 1) % 7)) continue;
    chosen.push(b);
    usedDays.add(b.day);
  }
  // Segunda pasada: permitir consecutivos si faltan sesiones, sin ocupar los 7 días
  for (const b of candidates) {
    if (chosen.length >= target) break;
    if (usedDays.has(b.day)) continue;
    const totalBusy = new Set([...usedDays, ...busyDays, b.day]).size;
    if (totalBusy >= 7) continue;
    chosen.push(b);
    usedDays.add(b.day);
  }
  if (chosen.length < target) {
    notes.push(`Tu semana tiene ${chosen.length} hueco${chosen.length === 1 ? '' : 's'} útil${chosen.length === 1 ? '' : 'es'} de ${minSession}+ min (pedíamos ${target}). Esta es la mejor combinación posible; agrega bloques para llegar a ${target}.`);
  }
  chosen.sort((a, b) => a.day - b.day);

  const sessions: RoutineSession[] = chosen.map((b, index) => {
    const minutes = Math.min(profile.maxSessionMinutes, b.minutes);
    const template = SESSION_TEMPLATES[index % (chosen.length >= 3 ? 3 : 2)];
    const exercises: RoutineSession['exercises'] = [];
    let used = 6; // calentamiento
    const picked = new Set<string>();
    for (const p of template.patterns) {
      const list = byPattern.get(p) ?? [];
      // rota ejercicios entre sesiones para variar
      const pool = list.filter((e) => !picked.has(e.id));
      const ex = pool[(index + exercises.length) % Math.max(1, pool.length)] ?? list[0];
      if (!ex) continue;
      const cost = p === 'cardio' ? Math.min(ex.minutes, Math.max(6, minutes - used)) : ex.minutes;
      if (used + cost > minutes) continue;
      exercises.push({ exerciseId: ex.id, sets: ex.sets, reps: ex.reps, restSec: ex.restSec });
      picked.add(ex.id);
      used += cost;
    }
    return { index, day: b.day, start: b.start, end: formatHHmm(Math.min(parseHHmm(b.end), parseHHmm(b.start) + minutes)), minutes, focus: template.focus, exercises };
  });

  return { weekKey, sessions, uncoveredPatterns: uncovered, notes, missionId: null, generatedAt: nowIso() };
}
