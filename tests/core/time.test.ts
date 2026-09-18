import { describe, it, expect } from 'vitest';
import { windowStatus, yesterdayGraceStatus, zonedParts, addDays, daysBetween, weekKey, isScheduledOn, zonedTimeToUtc, startOfWeek } from '@/lib/time';

const tz = 'America/Lima'; // UTC-5, sin horario de verano

describe('tiempo del juego', () => {
  it('día lógico en la zona del jugador, no del dispositivo', () => {
    // 2026-03-10 03:30 UTC = 2026-03-09 22:30 en Lima
    const p = zonedParts(new Date('2026-03-10T03:30:00Z'), tz);
    expect(p.day).toBe('2026-03-09');
    expect(p.hour).toBe(22);
    expect(p.weekday).toBe(1);
  });
  it('estados de ventana: upcoming, active, grace, expired', () => {
    const s = { days: [1], window: { start: '17:00', end: '19:00' } };
    // Lima = UTC-5. Todas las horas abajo son del lunes 9 de marzo en Lima.
    expect(windowStatus(s, new Date('2026-03-09T21:00:00Z'), tz).state).toBe('upcoming'); // 16:00
    expect(windowStatus(s, new Date('2026-03-09T23:00:00Z'), tz).state).toBe('active'); // 18:00
    expect(windowStatus(s, new Date('2026-03-10T01:00:00Z'), tz).state).toBe('grace'); // 20:00 (gracia hasta 22:00)
    expect(windowStatus(s, new Date('2026-03-10T01:00:00Z'), tz).minutesLeft).toBe(120);
    expect(windowStatus(s, new Date('2026-03-10T03:30:00Z'), tz).state).toBe('expired'); // 22:30
    expect(windowStatus(s, new Date('2026-03-10T01:00:00Z'), tz, 5).state).toBe('grace'); // "Gracia extendida" (5 h)
    expect(windowStatus(s, new Date('2026-03-10T03:30:00Z'), tz, 5).state).toBe('grace');
  });
  it('gracia que cruza medianoche', () => {
    const s = { days: [1, 2], window: { start: '20:00', end: '23:00' } };
    // 00:30 Lima del día 10 → ventana de ayer en gracia (hasta 02:00)
    const g = yesterdayGraceStatus(s, new Date('2026-03-10T05:30:00Z'), tz);
    expect(g?.state).toBe('grace');
    expect(g?.minutesLeft).toBe(90);
    expect(yesterdayGraceStatus(s, new Date('2026-03-10T07:30:00Z'), tz)).toBeNull();
  });
  it('utilidades de días', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(daysBetween('2026-01-01', '2026-01-04')).toBe(3);
    expect(weekKey('2026-03-09')).toBe('2026-W11');
    expect(startOfWeek('2026-03-12')).toBe('2026-03-09');
    expect(isScheduledOn({ days: [1], window: 'allDay' }, '2026-03-09')).toBe(true);
    expect(isScheduledOn({ days: [1], window: 'allDay' }, '2026-03-10')).toBe(false);
    expect(isScheduledOn({ days: [], window: 'allDay', once: '2026-03-10' }, '2026-03-10')).toBe(true);
  });
  it('zonedTimeToUtc invierte zonedParts', () => {
    const d = zonedTimeToUtc('2026-03-09', '19:30', tz);
    expect(zonedParts(d, tz)).toMatchObject({ day: '2026-03-09', hour: 19, minute: 30 });
  });
});
