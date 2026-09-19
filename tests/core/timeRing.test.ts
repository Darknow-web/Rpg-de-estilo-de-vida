import { describe, it, expect } from 'vitest';
import { ringFor, whatToDo } from '@/features/today/timeRing';
import type { TodayItem } from '@/core/missions/schedule';
import type { Mission } from '@/shared/types';

const mission = { id: 'm', name: 'Leer 2 páginas', description: 'Después de tomar café, leo 2 páginas de cualquier libro y le saco foto a la página.', minimalVersion: { name: 'Abrir el libro', description: 'Abrir el libro. Foto.' } } as unknown as Mission;

function item(state: TodayItem['state'], minutesLeft: number | null, window: TodayItem['window']['window'] = { start: '07:00', end: '09:00' }, minutesUntilOpen: number | null = null): TodayItem {
  return { mission, day: '2026-09-19', state, window: { state: state === 'done' || state === 'failed' ? 'expired' : (state as never), minutesLeft, minutesUntilOpen, window }, completion: null, sortKey: 0 };
}

describe('cronómetro de misión', () => {
  it('ventana de 2 h recién abierta: anillo lleno y cian', () => {
    const r = ringFor(item('active', 120));
    expect(r.show).toBe(true);
    expect(r.fraction).toBeCloseTo(1);
    expect(r.tone).toBe('xp');
    expect(r.long).toBe('Cierra a las 09:00 · quedan 2 h');
  });
  it('a mitad de ventana: mitad de anillo', () => {
    expect(ringFor(item('active', 60)).fraction).toBeCloseTo(0.5);
  });
  it('en la última media hora pasa a oro (aviso de que se va un corazón)', () => {
    const r = ringFor(item('active', 25));
    expect(r.tone).toBe('gold');
    expect(r.text).toBe('Quedan 25 min');
  });
  it('en gracia es rojo y la fracción es sobre las horas de gracia', () => {
    const r = ringFor(item('grace', 90), 3);
    expect(r.tone).toBe('hp');
    expect(r.fraction).toBeCloseTo(0.5);
    expect(r.long).toMatch(/en gracia 1 h 30 min/);
  });
  it('todo el día cuenta hasta las 23:59', () => {
    const r = ringFor(item('allDay', 720, 'allDay'));
    expect(r.fraction).toBeCloseTo(0.5);
    expect(r.long).toBe('Cierra a las 23:59 · quedan 12 h');
  });
  it('hecha, vencida y fallida no dibujan anillo', () => {
    expect(ringFor(item('done', null)).show).toBe(false);
    expect(ringFor(item('expired', null)).show).toBe(false);
    expect(ringFor(item('failed', null)).text).toMatch(/corazón descontado/);
  });
  it('próxima: anillo lleno apagado y hora de apertura', () => {
    const r = ringFor(item('upcoming', null, { start: '19:00', end: '21:00' }, 120));
    expect(r.tone).toBe('mute');
    expect(r.long).toBe('Abre a las 19:00 · en 2 h');
  });
});

describe('resumen de qué hacer', () => {
  it('usa la descripción completa si es corta', () => {
    expect(whatToDo({ name: 'x', description: 'Leo 2 páginas.' })).toBe('Leo 2 páginas.');
  });
  it('recorta en un espacio y añade puntos suspensivos', () => {
    const s = whatToDo(mission, 60);
    expect(s.length).toBeLessThanOrEqual(61);
    expect(s.endsWith('…')).toBe(true);
    expect(s).not.toMatch(/\s…$/);
  });
  it('si la descripción es igual al nombre, cae a la versión mínima', () => {
    expect(whatToDo({ name: 'Hacer la cama', description: 'Hacer la cama', minimalVersion: { description: 'Estirar la sábana. Foto.' } })).toBe('Estirar la sábana. Foto.');
  });
});
