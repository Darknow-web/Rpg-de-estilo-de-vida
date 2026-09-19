/**
 * Agenda inteligente: lista de pendientes (foto o texto) → tareas → plan en los huecos libres → misiones + eventos.
 *
 * Reglas:
 * - La foto de la lista NO se guarda (misma excepción que el escaneo del gimnasio): viaja, se envía a Gemini y se descarta.
 * - A Gemini solo van título, día y horas de lo que ya ocupa la semana (nunca descripciones, lugares ni invitados).
 * - Nada se escribe (ni misiones ni eventos de Google Calendar) hasta que el jugador confirma el plan.
 * - Cada tarea planificada es una misión secundaria con fecha, ventana y foto obligatoria; fallar cuesta un corazón.
 *   No consume cupo de secundarias (origin 'agenda'). Completar pasa por completeMission → awardRewards, como todo.
 * - Al quitar una tarea, el evento de Google Calendar se borra solo si lo creó la app (moduleData.gcalEventId) y con confirmación.
 */
import type { Mission } from '@/shared/types';
import type { MissionTemplate } from '@/core/module';
import type { GameContext } from '@/core/context';
import { compressImage } from '@/lib/image';
import { apiPost } from '@/lib/api';
import { newId, nowIso } from '@/lib/ids';
import { addDays, formatHHmm, isScheduledOn, parseHHmm, weekdayOf, windowFor, zonedParts } from '@/lib/time';
import { AGENDA } from '@/lib/game-balance';
import { batch, commitSoon } from '@/core/repo';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import { createMission, archiveMission } from '@/core/missions/manage';
import { planWeekOutputSchema, tasksFromPhotoOutputSchema, type PendingTaskAi, type PlanWeekInput, type PlanWeekOutput } from '@/shared/schemas/ai';
import { createEvent, deleteEvent, updateEventTime } from './client';
import { eventDay } from './selectors';
import type { CalendarEvent } from './types';

export interface PendingTask extends PendingTaskAi {
  id: string;
}

export type AgendaAiReason = 'rate_limited' | 'network' | 'timeout' | 'bad_request' | 'invalid_response' | 'compress_failed' | (string & {});

/** La IA no pudo (sin clave, sin red, cuota, respuesta inválida). La UI ofrece escribir las tareas a mano o reintentar. */
export class AgendaAiUnavailable extends Error {
  readonly name = 'AgendaAiUnavailable';
  constructor(
    public readonly reason: AgendaAiReason,
    message?: string,
  ) {
    super(
      message ??
        (reason === 'rate_limited'
          ? 'Ya usaste la IA de agenda de hoy. Puedes escribir las tareas a mano.'
          : reason === 'timeout' || reason === 'network'
            ? 'Sin conexión con el servidor. Puedes escribir las tareas a mano.'
            : 'La IA no está disponible ahora. Puedes escribir las tareas a mano.'),
    );
  }
}

export const TASK_PHOTO = { maxLongSide: 1200, jpegQuality: 0.7, maxBytes: 200_000, timeoutMs: 60_000 } as const;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      const comma = url.indexOf(',');
      resolve(comma >= 0 ? url.slice(comma + 1) : url);
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });
}

/** Foto de la lista → tareas (IA). Lanza AgendaAiUnavailable si no hay IA. */
export async function scanTasksPhoto(file: File, today: string, nota?: string): Promise<{ tareas: PendingTask[]; noReconocido: string[] }> {
  let img;
  try {
    // Una lista escrita necesita más resolución que una máquina de gimnasio: 1200 px de lado largo.
    let side: number = TASK_PHOTO.maxLongSide;
    let q: number = TASK_PHOTO.jpegQuality;
    img = await compressImage(file, side, q);
    while (img.blob.size > TASK_PHOTO.maxBytes && (q > 0.4 || side > 600)) {
      if (q > 0.4) q = Math.max(0.4, Math.round((q - 0.1) * 100) / 100);
      else side = Math.round(side * 0.8);
      img = await compressImage(img.blob, side, q);
    }
    if (img.blob.size > TASK_PHOTO.maxBytes) throw new AgendaAiUnavailable('compress_failed', 'La foto pesa demasiado incluso comprimida.');
  } catch (err) {
    if (err instanceof AgendaAiUnavailable) throw err;
    throw new AgendaAiUnavailable('compress_failed', 'No se pudo leer la foto.');
  }
  const image = await blobToBase64(img.blob);
  const res = await apiPost<unknown>('/api/ai/tasks-from-photo', { image, hoy: today, ...(nota?.trim() ? { nota: nota.trim() } : {}) }, TASK_PHOTO.timeoutMs);
  if (!res.ok) throw new AgendaAiUnavailable(res.reason === 'http_429' ? 'rate_limited' : res.reason === 'http_400' ? 'bad_request' : res.reason);
  const parsed = tasksFromPhotoOutputSchema.safeParse(res.data);
  if (!parsed.success) throw new AgendaAiUnavailable('invalid_response');
  return { tareas: parsed.data.tareas.map((t) => ({ ...t, id: newId('task') })), noReconocido: parsed.data.no_reconocido };
}

/** Tarea escrita a mano (sin IA): duración por defecto 30 min, atributo Disciplina, prioridad media. */
export function manualTask(nombre: string, partial: Partial<PendingTaskAi> = {}): PendingTask {
  return { id: newId('task'), nombre: nombre.trim().slice(0, 80), duracion_minutos: 30, atributo: 'disciplina', prioridad: 'media', ...partial };
}

// ── Huecos libres ──

interface Interval {
  start: number;
  end: number;
}

function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list
    .filter((i) => i.end > i.start)
    .map((i) => ({ start: Math.max(0, i.start), end: Math.min(24 * 60, i.end) }))
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export interface FreeSlotsInput {
  today: string;
  now: Date;
  tz: string;
  events: CalendarEvent[];
  missions: Mission[];
  daysAhead?: number;
}

export interface FreeSlotsResult {
  huecos: PlanWeekInput['huecos'];
  ocupado: PlanWeekInput['ocupado'];
  days: string[];
}

/**
 * Huecos libres por día para los próximos días: se descuentan eventos con hora, ventanas de misiones (incluido el
 * gimnasio con su ventana por día), sueño y, hoy, todo lo anterior a ahora + AGENDA.todayLeadMinutes.
 * `ocupado` lleva solo título, día y horas: es lo único del calendario que viaja a la IA.
 */
export function freeSlots(input: FreeSlotsInput): FreeSlotsResult {
  const daysAhead = input.daysAhead ?? AGENDA.daysAhead;
  const days = Array.from({ length: daysAhead }, (_, i) => addDays(input.today, i));
  const nowParts = zonedParts(input.now, input.tz);
  const sleepEnd = parseHHmm(AGENDA.sleepEnd);
  const sleepStart = parseHHmm(AGENDA.sleepStart);
  const huecos: PlanWeekInput['huecos'] = [];
  const ocupado: PlanWeekInput['ocupado'] = [];

  for (const day of days) {
    const busy: Interval[] = [
      { start: 0, end: sleepEnd },
      { start: sleepStart, end: 24 * 60 },
    ];
    if (day === nowParts.day) busy.push({ start: 0, end: nowParts.minutesOfDay + AGENDA.todayLeadMinutes });

    for (const e of input.events) {
      if (e.allDay || eventDay(e, input.tz) !== day) continue;
      const s = zonedParts(new Date(e.start), input.tz);
      const en = new Date(e.end);
      const endParts = zonedParts(en, input.tz);
      const end = endParts.day === day ? endParts.minutesOfDay : 24 * 60;
      busy.push({ start: s.minutesOfDay, end });
      ocupado.push({ dia: day, inicio: formatHHmm(s.minutesOfDay), fin: formatHHmm(Math.min(end, 24 * 60 - 1)), titulo: e.summary.slice(0, 80) });
    }

    for (const m of input.missions) {
      if (!m.active || m.mastery.state === 'automated') continue;
      if (m.type !== 'daily' && m.type !== 'side') continue;
      if (!isScheduledOn(m.schedule, day)) continue;
      const w = windowFor(m.schedule, weekdayOf(day));
      if (w === 'allDay') continue;
      const s = parseHHmm(w.start);
      const e = parseHHmm(w.end);
      // Una ventana larga (más de 2 h) no bloquea entera: la misión dura estimatedMinutes dentro de ella.
      const span = e - s;
      const block = span > 120 ? Math.max(30, Math.min(span, m.estimatedMinutes || 30)) : span;
      busy.push({ start: s, end: s + block });
      ocupado.push({ dia: day, inicio: w.start, fin: formatHHmm(Math.min(s + block, 24 * 60 - 1)), titulo: (m.moduleId === 'gym' ? `Gimnasio: ${m.name}` : `Misión: ${m.name}`).slice(0, 80) });
    }

    const merged = mergeIntervals(busy);
    let cursor = 0;
    for (const b of merged) {
      if (b.start - cursor >= AGENDA.minSlotMinutes) huecos.push({ dia: day, inicio: formatHHmm(cursor), fin: formatHHmm(b.start) });
      cursor = Math.max(cursor, b.end);
    }
    if (24 * 60 - cursor >= AGENDA.minSlotMinutes) huecos.push({ dia: day, inicio: formatHHmm(cursor), fin: '23:59' });
  }
  return { huecos: huecos.slice(0, 120), ocupado: ocupado.slice(0, 150), days };
}

// ── Planificar (IA) ──

export async function planTasks(input: PlanWeekInput): Promise<PlanWeekOutput> {
  const res = await apiPost<unknown>('/api/ai/plan-week', input, 60_000);
  if (!res.ok) throw new AgendaAiUnavailable(res.reason === 'http_429' ? 'rate_limited' : res.reason === 'http_400' ? 'bad_request' : res.reason, res.reason === 'http_429' ? 'Ya usaste las planificaciones de hoy (20). Inténtalo mañana.' : undefined);
  const parsed = planWeekOutputSchema.safeParse(res.data);
  if (!parsed.success) throw new AgendaAiUnavailable('invalid_response');
  return sanitizePlan(parsed.data, input);
}

/** Descarta asignaciones fuera de los huecos o con índice inválido (la IA propone; el cliente verifica). */
export function sanitizePlan(plan: PlanWeekOutput, input: PlanWeekInput): PlanWeekOutput {
  const fits = (a: PlanWeekOutput['asignaciones'][number]) => {
    const t = input.tareas[a.tarea_index];
    if (!t) return false;
    const s = parseHHmm(a.inicio);
    const e = parseHHmm(a.fin);
    if (e <= s) return false;
    return input.huecos.some((h) => h.dia === a.dia && parseHHmm(h.inicio) <= s && e <= parseHHmm(h.fin));
  };
  const seen = new Set<number>();
  const asignaciones = plan.asignaciones.filter((a) => {
    if (seen.has(a.tarea_index) || !fits(a)) return false;
    seen.add(a.tarea_index);
    return true;
  });
  const dropped = plan.asignaciones.filter((a) => !asignaciones.includes(a) && input.tareas[a.tarea_index] && !seen.has(a.tarea_index)).map((a) => ({ tarea_index: a.tarea_index, motivo: 'La propuesta chocaba con algo ya ocupado; vuelve a planificar o elige una opción.' }));
  const sinLugarIdx = new Set(plan.sin_lugar.map((s) => s.tarea_index));
  return { ...plan, asignaciones, sin_lugar: [...plan.sin_lugar.filter((s) => !seen.has(s.tarea_index)), ...dropped.filter((d) => !sinLugarIdx.has(d.tarea_index))] };
}

// ── Aplicar el plan (solo tras confirmar) ──

export interface AgendaMissionData {
  agendaTask: true;
  taskId: string;
  prioridad: PendingTaskAi['prioridad'];
  calendarId?: string;
  gcalEventId?: string;
}

export function agendaData(m: Mission): AgendaMissionData | null {
  const d = m.moduleData as Partial<AgendaMissionData> | undefined;
  if (!d || d.agendaTask !== true) return null;
  return { agendaTask: true, taskId: String(d.taskId ?? ''), prioridad: (d.prioridad as AgendaMissionData['prioridad']) ?? 'media', calendarId: d.calendarId, gcalEventId: d.gcalEventId };
}

export function isAgendaMission(m: Pick<Mission, 'origin'>): boolean {
  return m.origin === 'agenda';
}

export function assignmentTemplate(task: PendingTask, a: { dia: string; inicio: string; fin: string; razon?: string }, extra: Partial<AgendaMissionData> = {}): MissionTemplate {
  const data: AgendaMissionData = { agendaTask: true, taskId: task.id, prioridad: task.prioridad, ...extra };
  return {
    moduleId: 'calendar',
    name: task.nombre,
    description: `${task.nombre}. Planificada para el ${a.dia} de ${a.inicio} a ${a.fin} (${task.duracion_minutos} min)${a.razon ? `: ${a.razon}` : ''}. Termínala y toma una foto del resultado.`,
    attribute: task.atributo,
    type: 'side',
    difficulty: task.duracion_minutos <= 30 ? 'easy' : 'medium',
    schedule: { days: [], window: { start: a.inicio, end: a.fin }, once: a.dia },
    estimatedMinutes: task.duracion_minutos,
    minimalVersion: { name: `Empezar: ${task.nombre}`, description: 'Si no llegas a terminarla, deja hecha la primera parte y toma la foto de eso.' },
    anchor: `${a.dia} · ${a.inicio}`,
    evidenceHint: 'Foto de la tarea terminada',
    stakes: 'normal',
    moduleData: data as unknown as Record<string, unknown>,
    externalKey: `agenda:${task.id}`,
  };
}

export interface ApplyPlanOptions {
  /** Escribir cada tarea en Google Calendar (token vigente + calendario destino). */
  calendar?: { token: string; calendarId: string };
  /** Movimientos aceptados uno a uno (evento existente → nueva hora). */
  moves?: { event: CalendarEvent; to: { dia: string; inicio: string; fin: string } }[];
}

export interface ApplyPlanResult {
  created: Mission[];
  calendarErrors: string[];
}

/** Crea las misiones (y, si se pidió, los eventos) de las asignaciones confirmadas. Nunca antes. */
export async function applyPlan(ctx: GameContext, tasks: PendingTask[], plan: PlanWeekOutput, opts: ApplyPlanOptions = {}): Promise<ApplyPlanResult> {
  const created: Mission[] = [];
  const calendarErrors: string[] = [];

  for (const mv of opts.moves ?? []) {
    if (!opts.calendar) break;
    try {
      await updateEventTime(opts.calendar.token, mv.event.calendarId, mv.event.id, { day: mv.to.dia, start: mv.to.inicio, end: mv.to.fin, tz: ctx.tz });
    } catch (err) {
      calendarErrors.push(`No se pudo mover "${mv.event.summary}": ${(err as Error).message}`);
    }
  }

  for (const a of plan.asignaciones) {
    const task = tasks[a.tarea_index];
    if (!task) continue;
    let extra: Partial<AgendaMissionData> = {};
    if (opts.calendar) {
      try {
        const ev = await createEvent(opts.calendar.token, opts.calendar.calendarId, {
          summary: `${AGENDA.eventPrefix}${task.nombre}`,
          description: `Tarea de Life Quest · ${task.duracion_minutos} min · ${task.atributo}. Se completa con una foto en la app.`,
          day: a.dia,
          start: a.inicio,
          end: a.fin,
          tz: ctx.tz,
        });
        extra = { calendarId: opts.calendar.calendarId, gcalEventId: ev.id };
      } catch (err) {
        calendarErrors.push(`"${task.nombre}" no se pudo escribir en el calendario: ${(err as Error).message}`);
      }
    }
    const r = await createMission(ctx, assignmentTemplate(task, a, extra), 'agenda', { ignoreQuota: true });
    if (r.ok && r.mission) created.push(r.mission);
  }

  if (created.length) {
    const b = batch();
    logInBatch(
      b,
      ctx.uid,
      buildLogEntry(
        'agenda_planned',
        `Planificaste ${created.length} tarea${created.length === 1 ? '' : 's'} de tu lista: ${created.map((m) => `"${m.name}" (${m.schedule.once} ${m.schedule.window !== 'allDay' ? m.schedule.window.start : ''})`).join(', ')}.${opts.calendar ? ' También se crearon en tu Google Calendar.' : ''} Cada una da XP y monedas al completarla con foto; si vence, cuesta un corazón.`,
      ),
    );
    await commitSoon(b, 'agendaPlanned');
  }
  return { created, calendarErrors };
}

/** Quita una tarea planificada: archiva la misión y, si la app creó el evento y hay token, lo borra del calendario. */
export async function removeAgendaMission(ctx: GameContext, mission: Mission, opts: { token?: string; deleteFromCalendar: boolean }): Promise<{ ok: boolean; calendarError?: string }> {
  const d = agendaData(mission);
  let calendarError: string | undefined;
  if (opts.deleteFromCalendar && d?.gcalEventId && d.calendarId && opts.token) {
    try {
      await deleteEvent(opts.token, d.calendarId, d.gcalEventId);
    } catch (err) {
      calendarError = (err as Error).message;
    }
  }
  await archiveMission(ctx, mission.id, opts.deleteFromCalendar && d?.gcalEventId ? 'quitaste la tarea de la agenda y del calendario' : 'quitaste la tarea de la agenda');
  return { ok: true, calendarError };
}

/** Hora actual "HH:mm" en la zona del jugador. */
export function nowHHmm(now: Date, tz: string): string {
  return formatHHmm(zonedParts(now, tz).minutesOfDay);
}

export { nowIso };
