import { describe, it, expect } from 'vitest';
import { applyMasteryDone, applyMasteryFail, masteryAfterEscalation, recentFailRate } from '@/core/mastery/mastery';
import type { MasteryInfo } from '@/shared/types';

const fresh = (): MasteryInfo => ({ state: 'new', daysDone: 0, daysFailed: 0, cumulativeDays: 0, windowStart: '2026-01-01', history: '' });

function run(days: number, failEvery = 0): MasteryInfo {
  let m = fresh();
  for (let i = 1; i <= days; i++) {
    if (failEvery && i % failEvery === 0) m = applyMasteryFail(m, `d${i}`).mastery;
    else m = applyMasteryDone(m, `d${i}`).mastery;
  }
  return m;
}

describe('dominio', () => {
  it('Nueva → En progreso con la primera completación', () => {
    const { mastery, transition } = applyMasteryDone(fresh(), 'd1');
    expect(mastery.state).toBe('progress');
    expect(transition?.to).toBe('progress');
  });
  it('Consolidada a los 14 días con ≤2 fallas', () => {
    expect(run(13).state).toBe('progress');
    expect(run(14).state).toBe('consolidated');
    expect(run(16, 8).state).toBe('consolidated'); // 2 fallas
  });
  it('Dominada a los 30 días con ≤3 fallas', () => {
    expect(run(30).state).toBe('mastered');
    expect(run(29).state).toBe('consolidated');
  });
  it('Automatizada a los 66 acumulados', () => {
    expect(run(65).state).toBe('mastered');
    expect(run(66).state).toBe('automated');
  });
  it('exceso de fallas retrocede la barra a la mitad, nunca a cero desde arriba', () => {
    let m = run(10);
    m = applyMasteryFail(m, 'x1').mastery;
    m = applyMasteryFail(m, 'x2').mastery;
    const r = applyMasteryFail(m, 'x3');
    expect(r.transition?.windowReset).toBe(true);
    expect(r.mastery.daysDone).toBe(5);
    expect(r.mastery.daysFailed).toBe(0);
  });
  it('Dominada con 5 fallas en 14 días vuelve a Consolidada', () => {
    let m = run(30);
    for (let i = 0; i < 4; i++) m = applyMasteryFail(m, `f${i}`).mastery;
    expect(m.state).toBe('mastered');
    const r = applyMasteryFail(m, 'f5');
    expect(r.mastery.state).toBe('consolidated');
  });
  it('escalar reinicia (o conserva la mitad con Mentor) sin perder acumulados', () => {
    const m = run(20);
    expect(masteryAfterEscalation(m, 'e', false).daysDone).toBe(0);
    expect(masteryAfterEscalation(m, 'e', true).daysDone).toBe(10);
    expect(masteryAfterEscalation(m, 'e', true).cumulativeDays).toBe(20);
  });
  it('tasa de fallo reciente', () => {
    const m = run(14, 2);
    expect(recentFailRate(m).rate).toBeCloseTo(0.5);
  });
});
