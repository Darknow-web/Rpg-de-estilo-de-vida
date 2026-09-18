import { describe, it, expect } from 'vitest';
import { XP_TABLE, xpToNext, levelFromTotalXp, rankForLevel, dailyCoinCap, coinsForDifficulty, xpForDifficulty, REWARD_TIERS, rewardPrice, SKILL_TREE, QUOTAS } from '@/lib/game-balance';

describe('curva de XP', () => {
  it('sigue floor(18·n^1.6) y la tabla precalculada coincide con los valores del diseño', () => {
    expect(xpToNext(1)).toBe(18);
    expect(xpToNext(4)).toBe(165);
    expect(xpToNext(9)).toBe(605);
    expect(xpToNext(24)).toBe(2908);
    expect(xpToNext(49)).toBe(9111);
    expect(XP_TABLE.cumulative[2]).toBe(18);
    expect(XP_TABLE.cumulative[5]).toBe(341);
    expect(XP_TABLE.cumulative[10]).toBe(2403);
    expect(XP_TABLE.cumulative[25]).toBe(28303);
    expect(XP_TABLE.cumulative[50]).toBe(176272);
  });
  it('el nivel 2 llega el primer día con ~4 misiones Media (80 XP)', () => {
    expect(levelFromTotalXp(80)).toBeGreaterThanOrEqual(2);
    expect(levelFromTotalXp(0)).toBe(1);
    expect(levelFromTotalXp(17)).toBe(1);
    expect(levelFromTotalXp(18)).toBe(2);
    expect(levelFromTotalXp(999_999)).toBe(50);
  });
  it('rangos en los niveles fijos', () => {
    expect(rankForLevel(1).id).toBe('D');
    expect(rankForLevel(7).id).toBe('D');
    expect(rankForLevel(8).id).toBe('C');
    expect(rankForLevel(18).id).toBe('B');
    expect(rankForLevel(32).id).toBe('A');
    expect(rankForLevel(50).id).toBe('S');
  });
});

describe('economía', () => {
  it('multiplicadores de dificultad', () => {
    expect(xpForDifficulty('easy')).toBe(15);
    expect(xpForDifficulty('medium')).toBe(20);
    expect(xpForDifficulty('hard')).toBe(30);
    expect(xpForDifficulty('epic')).toBe(40);
    expect(coinsForDifficulty('easy')).toBe(8);
    expect(coinsForDifficulty('epic')).toBe(20);
  });
  it('tope diario crece con el rango', () => {
    expect(dailyCoinCap('D')).toBe(60);
    expect(dailyCoinCap('S')).toBe(120);
    expect(dailyCoinCap('D', 20)).toBe(80);
  });
  it('precio = días × monedas/día, con mínimo', () => {
    expect(rewardPrice(2.5, 20)).toBe(50);
    expect(rewardPrice(1, 1)).toBe(5);
    expect(REWARD_TIERS.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('árbol y cupos', () => {
  it('tiene entre 25 y 35 nodos, ids únicos y prerequisitos válidos', () => {
    expect(SKILL_TREE.length).toBeGreaterThanOrEqual(25);
    expect(SKILL_TREE.length).toBeLessThanOrEqual(35);
    const ids = new Set(SKILL_TREE.map((n) => n.id));
    expect(ids.size).toBe(SKILL_TREE.length);
    for (const n of SKILL_TREE) for (const r of n.requires ?? []) expect(ids.has(r)).toBe(true);
    for (const n of SKILL_TREE) expect(Object.keys(n.effect).length).toBeGreaterThan(0);
  });
  it('cupo diario empieza en 3 y tope 10', () => {
    expect(QUOTAS.daily.start).toBe(3);
    expect(QUOTAS.daily.max).toBe(10);
  });
});
