import { describe, it, expect } from 'vitest';
import { generateRoutine, proposeSessionsPerWeek } from '@/modules/gym/routine/generator';
import { EXERCISES, exerciseAvailable } from '@/modules/gym/data/exercises';
import { GYM_PRESETS } from '@/modules/gym/data/equipment';
import { parseAvailabilityLocal } from '@/modules/gym/availability/parse';
import type { GymProfile } from '@/modules/gym/types';

const profile = (equipment: string[], sessions = 3, sports: GymProfile['sports'] = []): GymProfile => ({ gymType: 'barrio', equipment: equipment.map((id) => ({ id, name: id })), sports, sessionsPerWeek: sessions, maxSessionMinutes: 45, createdAt: '', updatedAt: '' });

describe('generador de rutina', () => {
  it('solo usa ejercicios con equipamiento registrado', () => {
    const p = profile(['mat', 'dumbbells']);
    const r = generateRoutine(p, [{ day: 1, start: '18:00', end: '19:00' }, { day: 3, start: '18:00', end: '19:00' }, { day: 5, start: '18:00', end: '19:00' }], '2026-W11');
    const eq = new Set(['mat', 'dumbbells', 'bodyweight']);
    for (const s of r.sessions) for (const e of s.exercises) expect(exerciseAvailable(EXERCISES.find((x) => x.id === e.exerciseId)!, eq)).toBe(true);
    expect(r.sessions.length).toBe(3);
  });
  it('no programa en días de deporte y deja al menos un día de descanso', () => {
    const p = profile(GYM_PRESETS.cadena.equipment, 4, [{ name: 'fútbol', days: [0] }]);
    const blocks = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '18:00', end: '19:30' }));
    const r = generateRoutine(p, blocks, '2026-W11');
    expect(r.sessions.some((s) => s.day === 0)).toBe(false);
    expect(new Set(r.sessions.map((s) => s.day)).size).toBeLessThan(7);
    expect(r.sessions.length).toBeLessThanOrEqual(4);
  });
  it('avisa cuando no hay bloques suficientes y propone lo posible', () => {
    const p = profile(GYM_PRESETS.barrio.equipment, 3);
    const r = generateRoutine(p, [{ day: 2, start: '07:00', end: '07:40' }], '2026-W11');
    expect(r.sessions.length).toBe(1);
    expect(r.notes.join(' ')).toMatch(/mejor combinación posible/);
  });
  it('avisa qué patrones quedan sin cubrir con poco equipamiento', () => {
    const p = profile([], 2);
    const r = generateRoutine(p, [{ day: 1, start: '18:00', end: '19:00' }, { day: 4, start: '18:00', end: '19:00' }], '2026-W11');
    // Solo peso corporal: cubre empuje, pierna, core, cardio; falta tracción.
    expect(r.uncoveredPatterns).toContain('Tracción');
  });
  it('las sesiones caben en el bloque', () => {
    const p = profile(GYM_PRESETS.cadena.equipment, 2);
    const r = generateRoutine(p, [{ day: 1, start: '07:00', end: '07:30' }, { day: 4, start: '20:00', end: '22:00' }], '2026-W11');
    expect(r.sessions[0].minutes).toBe(30);
    expect(r.sessions[1].minutes).toBe(45);
  });
  it('propuesta conservadora de sesiones', () => {
    expect(proposeSessionsPerWeek('15', 1).sessions).toBe(2);
    expect(proposeSessionsPerWeek('60', 1).sessions).toBe(3);
    expect(proposeSessionsPerWeek('more', 20).sessions).toBe(4);
  });
});

describe('parser local de disponibilidad', () => {
  it('interpreta días y franjas y pregunta lo ambiguo', () => {
    const r = parseAvailabilityLocal('lunes temprano antes de las 9, martes desde las 8 de la noche, sábado de 10 a 12, jueves a veces');
    expect(r.blocks).toContainEqual({ day: 1, start: '06:00', end: '09:00' });
    expect(r.blocks).toContainEqual({ day: 2, start: '20:00', end: '22:30' });
    expect(r.blocks).toContainEqual({ day: 6, start: '10:00', end: '12:00' });
    expect(r.ambiguities.length).toBeGreaterThan(0);
  });
});
