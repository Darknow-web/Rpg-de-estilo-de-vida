/**
 * awardRewards(): ÚNICA puerta por la que entran XP y monedas al personaje.
 * Ninguna vista ni módulo escribe monedas ni XP directamente.
 */
import type { WriteBatch } from 'firebase/firestore';
import type { AttributeId, Player, WalletEntry, WalletSource } from '@/shared/types';
import { ATTRIBUTE_IDS } from '@/shared/types';
import { dailyCoinCap, XP, XP_TABLE } from '@/lib/game-balance';
import { newId, nowIso } from '@/lib/ids';
import { subDoc } from '@/core/repo';
import { recomputeLevel } from '@/core/character/player';
import { classPrimary } from '@/core/character/classes';
import type { ActiveEffects } from '@/core/skills/effects';

export interface AwardInput {
  source: WalletSource;
  refId: string;
  xp: number;
  coins: number;
  attribute: AttributeId | null;
  note: string;
  /** Si true, ignora el tope diario (bonus de dominio, cadenas). */
  bypassDailyCap?: boolean;
}

export interface AwardOutcome {
  xp: number;
  coins: number;
  coinsCapped: number;
  leveledUp: boolean;
  rankedUp: boolean;
  newLevel: number;
  newRank: Player['level']['rank'];
  oldRank: Player['level']['rank'];
  skillPointsGained: number;
  /** Player actualizado (para encadenar más premios en el mismo batch). */
  player: Player;
}

/**
 * Aplica XP y monedas a una COPIA del jugador y escribe las entradas en el batch.
 * Devuelve el jugador actualizado; el que llama escribe `player` al final (una sola vez).
 */
export function awardRewards(b: WriteBatch, uid: string, player: Player, effects: ActiveEffects, today: string, input: AwardInput): AwardOutcome {
  const p: Player = structuredClone(player);
  const attrs = p.attributes;

  // ── XP ──
  let xp = Math.max(0, Math.round(input.xp));
  if (input.attribute && p.class) {
    const primary = classPrimary(p.class.id);
    if (primary && primary === input.attribute) xp = Math.round(xp * XP.CLASS_PRIMARY_MULTIPLIER);
    else if (!primary) xp = Math.round(xp * XP.CLASS_VAGABOND_MULTIPLIER);
  }
  if (p.status === 'fallen') xp = 0;
  if (xp > 0) {
    const target: AttributeId = input.attribute ?? mostLaggingAttribute(attrs);
    attrs[target].xp += xp;
  }

  // ── Monedas con tope diario ──
  let coins = Math.max(0, Math.round(input.coins));
  if (p.status === 'fallen') coins = 0;
  if (p.economy.dailyCoinsDay !== today) {
    p.economy.dailyCoinsDay = today;
    p.economy.dailyCoinsEarned = 0;
  }
  let capped = 0;
  if (coins > 0 && !input.bypassDailyCap) {
    const cap = dailyCoinCap(p.level.rank, effects.dailyCoinCapBonus);
    const room = Math.max(0, cap - p.economy.dailyCoinsEarned);
    if (coins > room) {
      capped = coins - room;
      coins = room;
    }
    p.economy.dailyCoinsEarned += coins;
  }
  if (coins > 0) {
    p.economy.coins += coins;
    const entry: WalletEntry = {
      id: newId('w'),
      delta: coins,
      balanceAfter: p.economy.coins,
      source: input.source,
      refId: input.refId,
      createdAt: nowIso(),
      note: input.note,
    };
    b.set(subDoc(uid, 'wallet', entry.id), entry);
  }

  const lvl = recomputeLevel(p, attrs);
  const pointsGained = lvl.level.skillPointsEarned - p.level.skillPointsEarned;
  p.level = lvl.level;
  p.attributes = attrs;

  return {
    xp,
    coins,
    coinsCapped: capped,
    leveledUp: lvl.leveledUp,
    rankedUp: lvl.rankedUp,
    newLevel: lvl.newLevel,
    newRank: lvl.newRank,
    oldRank: lvl.oldRank,
    skillPointsGained: pointsGained,
    player: p,
  };
}

/** Gasto de monedas (canje). Registra en wallet y devuelve el jugador actualizado. */
export function spendCoins(b: WriteBatch, uid: string, player: Player, amount: number, source: WalletSource, refId: string, note: string): Player {
  const p: Player = structuredClone(player);
  const amt = Math.max(0, Math.round(amount));
  if (amt > p.economy.coins) throw new Error('Monedas insuficientes');
  p.economy.coins -= amt;
  const entry: WalletEntry = { id: newId('w'), delta: -amt, balanceAfter: p.economy.coins, source, refId, createdAt: nowIso(), note };
  b.set(subDoc(uid, 'wallet', entry.id), entry);
  return p;
}

function mostLaggingAttribute(attrs: Record<AttributeId, { xp: number; level: number }>): AttributeId {
  return [...ATTRIBUTE_IDS].sort((a, b) => attrs[a].xp - attrs[b].xp)[0];
}

/** XP equivalente a una fracción del nivel actual (ráfagas de hito). */
export function fractionOfLevelXp(player: Player, fraction: number): number {
  const need = XP_TABLE.toNext[player.level.current];
  return Math.round((Number.isFinite(need) ? need : XP_TABLE.toNext[XP.MAX_LEVEL - 1]) * fraction);
}
