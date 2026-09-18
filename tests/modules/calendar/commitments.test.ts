import { describe, it, expect } from 'vitest';
import { commitmentToMission, canAddCommitment, commitmentEligibility, punctualityWindow, commitmentToTemplate } from '@/modules/calendar/commitments';
import { groupEventsByDay, nextEvent, eventDay } from '@/modules/calendar/selectors';
import { eventsRange } from '@/modules/calendar/store';
import type { CalendarEvent } from '@/modules/calendar/types';
import { PUNCTUALITY } from '@/lib/game-balance';
import { isScheduledOn, windowStatus, zonedParts } from '@/lib/time';

const tz = 'America/Lima'; // UTC-5, sin horario de verano

const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'ev1',
  calendarId: 'primary',
  summary: 'Dentista',
  start: '2026-09-18T14:30:00-05:00',
  end: '2026-09-18T15:30:00-05:00',
  allDay: false,
  ...over,
});

describe('commitmentToMission', () => {
  const now = new Date('2026-09-17T20:00:00Z');

  it('crea una secundaria sin apuestas con ventana [inicio − 60 min, inicio] en hora de Lima y fecha única del evento', () => {
    const m = commitmentToMission(ev(), 'uid', now, tz);
    expect(m.type).toBe('side');
    expect(m.origin).toBe('calendar');
    expect(m.stakes).toBe('none');
    expect(m.attribute).toBe('disciplina');
    expect(m.difficulty).toBe('easy');
    expect(m.requiresPhoto).toBe(true);
    expect(m.evidenceHint).toBe('Foto del lugar al llegar');
    expect(m.estimatedMinutes).toBe(0);
    expect(m.moduleId).toBe('calendar');
    expect(m.name).toBe('Llegar a tiempo: Dentista');
    expect(m.schedule.once).toBe('2026-09-18');
    expect(m.schedule.days).toEqual([]);
    expect(m.schedule.window).toEqual({ start: '13:30', end: '14:30' });
    expect(m.moduleData).toMatchObject({ eventId: 'ev1', calendarId: 'primary', eventStart: '2026-09-18T19:30:00.000Z', eventSummary: 'Dentista' });
    expect(isScheduledOn(m.schedule, '2026-09-18')).toBe(true);
    expect(isScheduledOn(m.schedule, '2026-09-17')).toBe(false);
  });

  it('convierte instantes UTC a la fecha y hora de Lima (un evento a las 02:00Z es del día anterior en Lima)', () => {
    // 2026-09-19 02:00Z = 2026-09-18 21:00 Lima
    const m = commitmentToMission(ev({ start: '2026-09-19T02:00:00Z' }), 'uid', now, tz);
    expect(m.schedule.once).toBe('2026-09-18');
    expect(m.schedule.window).toEqual({ start: '20:00', end: '21:00' });
  });

  it('evento a las 00:30 Lima: la misión queda en el día del evento y la ventana se recorta a 00:00–00:30', () => {
    // Comportamiento elegido: nunca movemos la misión al día anterior; el cierre (hora del evento) se conserva.
    const m = commitmentToMission(ev({ start: '2026-09-18T00:30:00-05:00' }), 'uid', now, tz);
    expect(m.schedule.once).toBe('2026-09-18');
    expect(m.schedule.window).toEqual({ start: '00:00', end: '00:30' });
    // 00:10 Lima del 18 → ventana activa; 23:50 Lima del 17 → no programada ese día (no hay ventana "de ayer").
    expect(windowStatus(m.schedule, new Date('2026-09-18T05:10:00Z'), tz).state).toBe('active');
    expect(isScheduledOn(m.schedule, '2026-09-17')).toBe(false);
  });

  it('punctualityWindow y plantilla exponen la misma ventana', () => {
    expect(punctualityWindow('2026-09-18T14:30:00-05:00', tz)).toEqual({ day: '2026-09-18', start: '13:30', end: '14:30' });
    const t = commitmentToTemplate(ev(), tz);
    expect(t.stakes).toBe('none');
    expect(t.externalKey).toBe('calendar:primary:ev1');
    expect(t.schedule.window).toEqual({ start: '13:30', end: '14:30' });
  });

  it('elegibilidad: no todo-el-día, con hora válida y en el futuro', () => {
    expect(commitmentEligibility(ev(), now).ok).toBe(true);
    expect(commitmentEligibility(ev({ allDay: true, start: '2026-09-18', end: '2026-09-19' }), now).ok).toBe(false);
    expect(commitmentEligibility(ev({ start: '2026-09-10T10:00:00-05:00' }), now).ok).toBe(false);
  });

  it('cupo propio: máximo PUNCTUALITY.maxPerDay compromisos activos por día', () => {
    const ms = [1, 2, 3].map((i) => commitmentToMission(ev({ id: `e${i}` }), 'uid', now, tz));
    expect(canAddCommitment(ms.slice(0, 2)).ok).toBe(true);
    const full = canAddCommitment(ms);
    expect(full.ok).toBe(false);
    expect(full.used).toBe(PUNCTUALITY.maxPerDay);
    expect(full.reason).toMatch(/compromisos ese día/);
    // Las archivadas no cuentan.
    ms[0].active = false;
    expect(canAddCommitment(ms).ok).toBe(true);
  });
});

describe('selectores de agenda', () => {
  const events: CalendarEvent[] = [
    ev({ id: 'b', summary: 'Tarde', start: '2026-09-18T18:00:00-05:00', end: '2026-09-18T19:00:00-05:00' }),
    ev({ id: 'a', summary: 'Mañana', start: '2026-09-18T09:00:00-05:00', end: '2026-09-18T10:00:00-05:00' }),
    ev({ id: 'c', summary: 'Feriado', start: '2026-09-19', end: '2026-09-20', allDay: true }),
    ev({ id: 'd', summary: 'Noche tardía', start: '2026-09-20T03:30:00Z', end: '2026-09-20T04:00:00Z' }), // 22:30 Lima del 19
    ev({ id: 'e', summary: 'Cumple', start: '2026-09-18', end: '2026-09-19', allDay: true }),
  ];

  it('groupEventsByDay agrupa por día de Lima, ordena días y pone todo-el-día primero', () => {
    const g = groupEventsByDay(events, tz);
    expect(g.map((x) => x.day)).toEqual(['2026-09-18', '2026-09-19']);
    expect(g[0].events.map((e) => e.id)).toEqual(['e', 'a', 'b']);
    expect(g[1].events.map((e) => e.id)).toEqual(['c', 'd']);
    expect(eventDay(events[3], tz)).toBe('2026-09-19');
  });

  it('nextEvent devuelve el próximo con hora que no empezó, ignorando los de todo el día', () => {
    expect(nextEvent(events, new Date('2026-09-18T13:00:00Z'))?.id).toBe('a'); // 08:00 Lima
    expect(nextEvent(events, new Date('2026-09-18T15:00:00Z'))?.id).toBe('b'); // 10:00 Lima
    expect(nextEvent(events, new Date('2026-09-19T12:00:00Z'))?.id).toBe('d');
    expect(nextEvent(events, new Date('2026-09-21T12:00:00Z'))).toBeNull();
  });

  it('eventsRange va de hoy 00:00 Lima a +14 días', () => {
    const r = eventsRange(new Date('2026-09-18T03:00:00Z'), tz); // 22:00 Lima del 17
    expect(zonedParts(new Date(r.fromISO), tz)).toMatchObject({ day: '2026-09-17', hour: 0, minute: 0 });
    expect(zonedParts(new Date(r.toISO), tz)).toMatchObject({ day: '2026-10-01', hour: 0, minute: 0 });
  });
});
