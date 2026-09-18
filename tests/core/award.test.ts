import { describe, it, expect, vi } from 'vitest';

vi.mock('@/core/repo', () => ({
  subDoc: (_u: string, c: string, id: string) => `${c}/${id}`,
  playerRef: (u: string) => `players/${u}`,
}));

import { awardRewards, spendCoins } from '@/core/economy/award';
import { createInitialPlayer } from '@/core/character/player';
import { DEFAULT_EFFECTS } from '@/core/skills/effects';
import { CLASSES } from '@/core/character/classes';

function fakeBatch() {
  const writes: { ref: string; data: unknown }[] = [];
  return { writes, set: (ref: string, data: unknown) => writes.push({ ref, data }), update: () => undefined } as unknown as import('firebase/firestore').WriteBatch & { writes: typeof writes };
}

describe('awardRewards', () => {
  it('suma XP al atributo, registra wallet, sube de nivel y da puntos', () => {
    const p = createInitialPlayer('u', 't', 'UTC', '2026-01-01');
    const b = fakeBatch();
    const o = awardRewards(b, 'u', p, DEFAULT_EFFECTS, '2026-01-01', { source: 'mission', refId: 'c1', xp: 20, coins: 10, attribute: 'fuerza', note: 'x' });
    expect(o.xp).toBe(20);
    expect(o.coins).toBe(10);
    expect(o.leveledUp).toBe(true);
    expect(o.newLevel).toBe(2);
    expect(o.skillPointsGained).toBe(1);
    expect(o.player.attributes.fuerza.xp).toBe(20);
    expect(o.player.economy.coins).toBe(10);
    expect(b.writes.some((w) => w.ref.startsWith('wallet/'))).toBe(true);
  });
  it('tope diario de monedas: lo que sobra no entra y se reporta', () => {
    let p = createInitialPlayer('u', 't', 'UTC', '2026-01-01');
    const b = fakeBatch();
    for (let i = 0; i < 7; i++) p = awardRewards(b, 'u', p, DEFAULT_EFFECTS, '2026-01-01', { source: 'mission', refId: `c${i}`, xp: 0, coins: 10, attribute: 'fuerza', note: 'x' }).player;
    expect(p.economy.coins).toBe(60);
    const o = awardRewards(b, 'u', p, DEFAULT_EFFECTS, '2026-01-01', { source: 'mission', refId: 'c9', xp: 0, coins: 10, attribute: 'fuerza', note: 'x' });
    expect(o.coins).toBe(0);
    expect(o.coinsCapped).toBe(10);
    // Bonus de dominio ignora el tope
    const o2 = awardRewards(b, 'u', o.player, DEFAULT_EFFECTS, '2026-01-01', { source: 'mastery', refId: 'm', xp: 0, coins: 50, attribute: null, note: 'x', bypassDailyCap: true });
    expect(o2.coins).toBe(50);
    // Nuevo día reinicia el tope
    const o3 = awardRewards(b, 'u', o2.player, DEFAULT_EFFECTS, '2026-01-02', { source: 'mission', refId: 'c10', xp: 0, coins: 10, attribute: 'fuerza', note: 'x' });
    expect(o3.coins).toBe(10);
  });
  it('atributo principal de la clase crece 25 % más rápido', () => {
    const p = createInitialPlayer('u', 't', 'UTC', '2026-01-01');
    p.class = { id: 'guerrero', name: CLASSES.guerrero.name, description: '', identityPhrase: '', primaryAttribute: 'fuerza', reason: '', acceptedAt: '' };
    const b = fakeBatch();
    expect(awardRewards(b, 'u', p, DEFAULT_EFFECTS, '2026-01-01', { source: 'mission', refId: 'c', xp: 20, coins: 0, attribute: 'fuerza', note: '' }).xp).toBe(25);
    expect(awardRewards(b, 'u', p, DEFAULT_EFFECTS, '2026-01-01', { source: 'mission', refId: 'c', xp: 20, coins: 0, attribute: 'intelecto', note: '' }).xp).toBe(20);
  });
  it('caído: no gana XP ni monedas', () => {
    const p = createInitialPlayer('u', 't', 'UTC', '2026-01-01');
    p.status = 'fallen';
    const o = awardRewards(fakeBatch(), 'u', p, DEFAULT_EFFECTS, '2026-01-01', { source: 'mission', refId: 'c', xp: 20, coins: 10, attribute: 'fuerza', note: '' });
    expect(o.xp).toBe(0);
    expect(o.coins).toBe(0);
  });
  it('gastar nunca deja saldo negativo y registra en wallet', () => {
    const p = createInitialPlayer('u', 't', 'UTC', '2026-01-01');
    p.economy.coins = 30;
    const b = fakeBatch();
    const p2 = spendCoins(b, 'u', p, 20, 'redeem', 'r1', 'canje');
    expect(p2.economy.coins).toBe(10);
    expect(() => spendCoins(b, 'u', p2, 20, 'redeem', 'r1', 'canje')).toThrow();
  });
});
