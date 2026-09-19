import { describe, it, expect } from 'vitest';
import { freeSlots, sanitizePlan, assignmentTemplate, manualTask } from '@/modules/calendar/tasks';
import { planWeekInputSchema, planWeekOutputSchema, tasksFromPhotoOutputSchema } from '@/shared/schemas/ai';
import { buildMission } from '@/core/missions/factory';
import { quotaFor } from '@/core/missions/quota';
import { DEFAULT_EFFECTS } from '@/core/skills/effects';
import { createInitialPlayer } from '@/core/character/player';
import { planDay } from '@/core/notifications/planner';
import type { MissionTemplate } from '@/core/module';
import type { CalendarEvent } from '@/modules/calendar/types';
import { AGENDA } from '@/lib/game-balance';

const tz = 'America/Lima';
const today = '2026-09-21'; // lunes
const now = new Date('2026-09-21T14:00:00Z'); // 09:00 Lima

const daily = (name: string, start: string, end: string): MissionTemplate => ({ moduleId: 'habits', name, description: name, attribute: 'disciplina', type: 'daily', difficulty: 'easy', schedule: { days: [0, 1, 2, 3, 4, 5, 6], window: { start, end } }, estimatedMinutes: 10, minimalVersion: { name, description: name } });

describe('huecos libres', () => {
  it('descuenta sueño, hora actual, eventos con hora y ventanas de misiones', () => {
    const events: CalendarEvent[] = [
      { id: 'e1', calendarId: 'c', summary: 'Reunión', start: '2026-09-21T15:00:00-05:00', end: '2026-09-21T16:00:00-05:00', allDay: false },
      { id: 'e2', calendarId: 'c', summary: 'Cumple', start: '2026-09-21', end: '2026-09-22', allDay: true },
    ];
    const missions = [buildMission(daily('Leer', '20:00', '21:00'), 'onboarding', today)];
    const r = freeSlots({ today, now, tz, events, missions, daysAhead: 2 });
    const hoy = r.huecos.filter((h) => h.dia === today);
    // 09:00 + 30 min de margen → primer hueco a las 09:30; reunión 15–16; misión 20–21; sueño desde 23:00.
    expect(hoy.map((h) => `${h.inicio}-${h.fin}`)).toEqual(['09:30-15:00', '16:00-20:00', '21:00-23:00']);
    const manana = r.huecos.filter((h) => h.dia === '2026-09-22');
    expect(manana[0]).toEqual({ dia: '2026-09-22', inicio: AGENDA.sleepEnd, fin: '20:00' });
    // Lo ocupado que viaja a la IA: solo título + horas, sin lugares; el de todo el día no bloquea.
    expect(r.ocupado.find((o) => o.titulo === 'Reunión')).toEqual({ dia: today, inicio: '15:00', fin: '16:00', titulo: 'Reunión' });
    expect(r.ocupado.some((o) => o.titulo === 'Cumple')).toBe(false);
    expect(r.ocupado.some((o) => o.titulo === 'Misión: Leer')).toBe(true);
    const parsed = planWeekInputSchema.safeParse({ hoy: today, ahora: '09:00', tareas: [manualTask('Comprar pilas')].map(({ id: _i, ...t }) => t), huecos: r.huecos, ocupado: r.ocupado, momento_preferido: 'varies', ronda: 0 });
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
  });
  it('una ventana larga solo bloquea la duración estimada', () => {
    const missions = [buildMission(daily('Agua', '06:00', '22:00'), 'onboarding', today)];
    const r = freeSlots({ today: '2026-09-22', now, tz, events: [], missions, daysAhead: 1 });
    expect(r.huecos[0].inicio).toBe('06:30');
  });
});

describe('plan: la IA propone, el cliente verifica', () => {
  const tareas = [manualTask('Comprar pilas'), manualTask('Ordenar garaje', { duracion_minutos: 120 })].map(({ id: _i, ...t }) => t);
  const input = { hoy: today, ahora: '09:00', tareas, huecos: [{ dia: today, inicio: '10:00', fin: '12:00' }], ocupado: [], momento_preferido: 'morning' as const, ronda: 0 };
  it('descarta asignaciones fuera de los huecos y las pasa a sin_lugar', () => {
    const plan = planWeekOutputSchema.parse({
      asignaciones: [
        { tarea_index: 0, dia: today, inicio: '10:00', fin: '10:30', razon: 'cabe' },
        { tarea_index: 1, dia: today, inicio: '11:00', fin: '13:00', razon: 'se pasa del hueco' },
      ],
      sin_lugar: [],
      preguntas: [{ id: 't1_lugar', texto: '¿Dónde pongo el garaje?', opciones: ['Sábado', 'Dividir'] }],
      movimientos_sugeridos: [],
      resumen: 'ok',
    });
    const s = sanitizePlan(plan, input);
    expect(s.asignaciones).toHaveLength(1);
    expect(s.sin_lugar.map((x) => x.tarea_index)).toEqual([1]);
    expect(s.preguntas).toHaveLength(1);
  });
  it('el esquema limita preguntas a 3 y exige 2–4 opciones', () => {
    const base = { asignaciones: [], sin_lugar: [], movimientos_sugeridos: [], resumen: '' };
    expect(planWeekOutputSchema.safeParse({ ...base, preguntas: [{ id: 'a', texto: 'x?', opciones: ['solo una'] }] }).success).toBe(false);
    expect(planWeekOutputSchema.safeParse({ ...base, preguntas: Array.from({ length: 4 }, (_, i) => ({ id: `q${i}`, texto: 'x?', opciones: ['a', 'b'] })) }).success).toBe(false);
  });
  it('foto de pendientes: máximo 20 tareas, atributo del juego, prioridad válida', () => {
    const t = { nombre: 'Pagar luz', duracion_minutos: 10, atributo: 'riqueza', prioridad: 'alta', fecha_limite: '2026-09-25' };
    expect(tasksFromPhotoOutputSchema.safeParse({ tareas: [t], no_reconocido: [] }).success).toBe(true);
    expect(tasksFromPhotoOutputSchema.safeParse({ tareas: [{ ...t, atributo: 'carisma' }], no_reconocido: [] }).success).toBe(false);
    expect(tasksFromPhotoOutputSchema.safeParse({ tareas: Array.from({ length: 21 }, () => t), no_reconocido: [] }).success).toBe(false);
  });
});

describe('tarea planificada como misión', () => {
  const task = manualTask('Llamar al banco', { atributo: 'riqueza', duracion_minutos: 60 });
  const m = buildMission(assignmentTemplate(task, { dia: today, inicio: '10:00', fin: '11:00', razon: 'cabe' }, { calendarId: 'c', gcalEventId: 'g1' }), 'agenda', today);
  it('es secundaria con fecha, ventana, foto obligatoria y corazón en juego', () => {
    expect(m.type).toBe('side');
    expect(m.origin).toBe('agenda');
    expect(m.schedule.once).toBe(today);
    expect(m.schedule.window).toEqual({ start: '10:00', end: '11:00' });
    expect(m.requiresPhoto).toBe(true);
    expect(m.stakes).toBe('normal');
    expect(m.heartsOnFail).toBeGreaterThanOrEqual(1);
    expect(m.attribute).toBe('riqueza');
    expect(m.xp).toBeGreaterThan(0);
    expect(m.moduleData?.gcalEventId).toBe('g1');
  });
  it('no consume cupo de secundarias', () => {
    const player = createInitialPlayer('u', 'T', tz, today);
    const q = quotaFor('side', player, [m, m, m, m], DEFAULT_EFFECTS);
    expect(q.used).toBe(0);
  });
  it('recibe avisos de apertura y cierre como una diaria, dentro del tope de 4', () => {
    const n = planDay([m], new Set(), today, tz, new Date('2026-09-21T05:00:00-05:00'));
    expect(n.map((x) => x.kind)).toEqual(['open', 'closing']);
  });
});
