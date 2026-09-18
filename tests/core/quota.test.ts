import { describe, it, expect } from 'vitest';
import { quotaFor } from '@/core/missions/quota';
import { computeEffects, DEFAULT_EFFECTS } from '@/core/skills/effects';
import { createInitialPlayer } from '@/core/character/player';
import { buildMission } from '@/core/missions/factory';
import type { MissionTemplate } from '@/core/module';

const tpl = (name: string): MissionTemplate => ({ moduleId: 'habits', name, description: name, attribute: 'disciplina', type: 'daily', difficulty: 'easy', schedule: { days: [0, 1, 2, 3, 4, 5, 6], window: 'allDay' }, estimatedMinutes: 5, minimalVersion: { name, description: name } });

describe('cupo', () => {
  const player = createInitialPlayer('u', 'Test', 'UTC', '2026-01-01');
  it('3 diarias al inicio; la cuarta se rechaza con explicación de juego', () => {
    const missions = ['a', 'b', 'c'].map((n) => buildMission(tpl(n), 'player', '2026-01-01'));
    const q = quotaFor('daily', player, missions, DEFAULT_EFFECTS);
    expect(q.max).toBe(3);
    expect(q.allowed).toBe(false);
    expect(q.reason).toMatch(/dominar una misión o subir de rango/);
    expect(q.nextUnlock).toMatch(/XP para rango C/);
  });
  it('+1 por misión dominada, +1 por nodo Bitácora ampliada, +1 por rango', () => {
    const missions = ['a', 'b', 'c'].map((n) => buildMission(tpl(n), 'player', '2026-01-01'));
    missions[0].mastery.state = 'mastered';
    expect(quotaFor('daily', player, missions, DEFAULT_EFFECTS).max).toBe(4);
    expect(quotaFor('daily', player, missions, computeEffects(['bitacora_ampliada_1'])).max).toBe(5);
    const pC = { ...player, level: { ...player.level, rank: 'C' as const, current: 8 } };
    expect(quotaFor('daily', pC, missions, computeEffects(['bitacora_ampliada_1'])).max).toBe(6);
  });
  it('las automatizadas no ocupan cupo', () => {
    const missions = ['a', 'b', 'c'].map((n) => buildMission(tpl(n), 'player', '2026-01-01'));
    missions[0].mastery.state = 'automated';
    const q = quotaFor('daily', player, missions, DEFAULT_EFFECTS);
    expect(q.used).toBe(2);
  });
});

describe('efectos del árbol', () => {
  it('cada nodo cambia una regla observable', () => {
    expect(computeEffects(['corazon_extra_1']).maxHeartsBonus).toBe(1);
    expect(computeEffects(['gracia_extendida']).graceHours).toBe(5);
    expect(computeEffects(['regeneracion']).heartRegenPerCleanDay).toBe(2);
    expect(computeEffects(['segundo_aire']).resurrectionDays).toBe(2);
    expect(computeEffects(['mercader']).shopDiscount).toBe(0.1);
    expect(computeEffects(['piel_gruesa']).maxHeartLossPerFail).toBe(2);
    expect(computeEffects([]).graceHours).toBe(3);
  });
});
