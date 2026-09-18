/**
 * Tienda: alta de recompensas (tasadas), canje, re-tasación al subir de rango.
 */
import type { Reward, RankId } from '@/shared/types';
import type { GameContext } from '@/core/context';
import { batch, commitSoon, playerRef, subDoc, clean } from '@/core/repo';
import { newId, nowIso } from '@/lib/ids';
import { REWARD_TIERS, rewardPrice, rankIndex } from '@/lib/game-balance';
import { spendCoins } from '@/core/economy/award';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import type { Appraisal } from './appraiser';
import { evidenceStorage, prepareEvidence } from '@/lib/storage';
import { weekKey, monthKey } from '@/lib/time';

export function tierDef(tier: number) {
  return REWARD_TIERS[Math.min(5, Math.max(1, tier)) - 1];
}

export function meetsRequirement(reward: Reward, level: number, rank: RankId): boolean {
  const req = tierDef(reward.tier).requires;
  if (!req) return true;
  return level >= req.level || rankIndex(rank) >= rankIndex(req.rank);
}

export function frequencyBlocked(reward: Reward, today: string): string | null {
  if (!reward.frequencyLimit) return null;
  const f = reward.frequencyLimit.toLowerCase();
  const last = reward.redemptions[reward.redemptions.length - 1];
  if (!last) return null;
  const lastDay = last.at.slice(0, 10);
  if (f.includes('semana') && weekKey(lastDay) === weekKey(today)) return 'Ya lo canjeaste esta semana.';
  if (f.includes('mes') && monthKey(lastDay) === monthKey(today)) return 'Ya lo canjeaste este mes.';
  if (f.includes('día') || f.includes('dia')) {
    if (lastDay === today) return 'Ya lo canjeaste hoy.';
  }
  return null;
}

export function effectivePrice(reward: Reward, discount: number): number {
  return Math.max(1, Math.round(reward.priceCoins * (1 - discount)));
}

export async function createReward(ctx: GameContext, name: string, appraisal: Appraisal, chosen: { tier: number; priceCoins: number; frequencyLimit: string | null }, photo?: Blob): Promise<Reward> {
  const suggestedPrice = appraisal.precio_en_monedas;
  const adjustedDown = chosen.priceCoins < suggestedPrice || chosen.tier < appraisal.nivel_sugerido;
  const reward: Reward = {
    id: newId('r'),
    name: name.trim(),
    tier: Math.min(5, Math.max(1, chosen.tier)) as Reward['tier'],
    effortDays: appraisal.dias_de_esfuerzo,
    priceCoins: Math.max(1, Math.round(chosen.priceCoins)),
    suggestedPrice,
    suggestedTier: appraisal.nivel_sugerido,
    frequencyLimit: chosen.frequencyLimit,
    isFree: false,
    appraisal: {
      source: appraisal.source === 'ai' ? 'ai' : 'fallback',
      reasoning: appraisal.razonamiento,
      conflictsWithGoal: appraisal.conflicto_con_meta,
      conflictNote: appraisal.nota_de_conflicto,
      noteShown: false,
      reinforcesGoal: appraisal.refuerza_meta,
    },
    playerAdjustedDown: adjustedDown,
    redemptions: [],
    createdAt: nowIso(),
    archived: false,
  };
  if (adjustedDown) reward.appraisal.source = 'player';
  const b = batch();
  b.set(subDoc(ctx.uid, 'rewards', reward.id), clean(reward));
  if (adjustedDown) {
    const p = structuredClone(ctx.player);
    p.stats.rewardsUnderpriced += 1;
    b.set(playerRef(ctx.uid), clean(p));
  }
  if (photo) {
    try {
      const prepared = await prepareEvidence(photo);
      await evidenceStorage.save(ctx.uid, { id: `rph_${reward.id}`, missionId: `reward:${reward.id}`, completionId: '', day: ctx.today, ...prepared });
    } catch {
      /* la foto es opcional */
    }
  }
  logInBatch(b, ctx.uid, buildLogEntry('reward_created', adjustedDown ? `Creaste "${reward.name}" con precio ajustado por ti (${reward.priceCoins} vs ${suggestedPrice} sugeridas). Llevará el sello "precio ajustado por ti".` : `Creaste "${reward.name}" (nivel ${reward.tier}, ${reward.priceCoins} monedas). ${appraisal.razonamiento}`));
  await commitSoon(b, 'createReward');
  return reward;
}

export async function markConflictNoteShown(ctx: GameContext, rewardId: string): Promise<void> {
  const r = ctx.rewards.find((x) => x.id === rewardId);
  if (!r || r.appraisal.noteShown) return;
  const b = batch();
  b.update(subDoc(ctx.uid, 'rewards', rewardId), { 'appraisal.noteShown': true });
  await commitSoon(b, 'noteShown');
}

export async function redeemReward(ctx: GameContext, rewardId: string, photo?: Blob): Promise<{ ok: boolean; error?: string }> {
  const r = ctx.rewards.find((x) => x.id === rewardId);
  if (!r || r.archived) return { ok: false, error: 'La recompensa no existe.' };
  if (ctx.player.status === 'fallen') return { ok: false, error: 'La tienda está cerrada mientras estás caído.' };
  if (!meetsRequirement(r, ctx.player.level.current, ctx.player.level.rank)) {
    const req = tierDef(r.tier).requires!;
    return { ok: false, error: `Necesitas rango ${req.rank} o nivel ${req.level} para canjear un ${tierDef(r.tier).name}.` };
  }
  const fb = frequencyBlocked(r, ctx.today);
  if (fb) return { ok: false, error: fb };
  const price = effectivePrice(r, ctx.effects.shopDiscount);
  if (ctx.player.economy.coins < price) return { ok: false, error: `Te faltan ${price - ctx.player.economy.coins} monedas.` };
  const b = batch();
  const p = spendCoins(b, ctx.uid, ctx.player, price, 'redeem', rewardId, `Canje: ${r.name}`);
  let photoEvidenceId: string | null = null;
  if (photo) {
    try {
      const prepared = await prepareEvidence(photo);
      photoEvidenceId = newId('ev');
      await evidenceStorage.save(ctx.uid, { id: photoEvidenceId, missionId: `reward:${rewardId}`, completionId: '', day: ctx.today, ...prepared });
    } catch {
      photoEvidenceId = null;
    }
  }
  b.update(subDoc(ctx.uid, 'rewards', rewardId), { redemptions: clean([...r.redemptions, { at: nowIso(), coins: price, photoEvidenceId }]) });
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('reward_redeemed', `Canjeaste "${r.name}" por ${price} monedas${ctx.effects.shopDiscount ? ` (con ${Math.round(ctx.effects.shopDiscount * 100)} % de Mercader)` : ''}. Disfrútalo: te lo ganaste.`));
  await commitSoon(b, 'redeem');
  return { ok: true };
}

export async function archiveReward(ctx: GameContext, rewardId: string): Promise<void> {
  const b = batch();
  b.update(subDoc(ctx.uid, 'rewards', rewardId), { archived: true });
  await commitSoon(b, 'archiveReward');
}

export async function adjustReward(ctx: GameContext, rewardId: string, patch: { priceCoins?: number; tier?: number; frequencyLimit?: string | null; name?: string }): Promise<void> {
  const r = ctx.rewards.find((x) => x.id === rewardId);
  if (!r) return;
  const next: Reward = { ...r, ...('name' in patch ? { name: patch.name ?? r.name } : {}), ...(patch.tier ? { tier: Math.min(5, Math.max(1, patch.tier)) as Reward['tier'] } : {}), ...(patch.priceCoins ? { priceCoins: Math.max(1, Math.round(patch.priceCoins)) } : {}), ...(patch.frequencyLimit !== undefined ? { frequencyLimit: patch.frequencyLimit } : {}) };
  const wasDown = r.playerAdjustedDown;
  next.playerAdjustedDown = next.priceCoins < r.suggestedPrice || next.tier < r.suggestedTier;
  const b = batch();
  b.set(subDoc(ctx.uid, 'rewards', rewardId), clean(next));
  if (wasDown !== next.playerAdjustedDown) {
    const p = structuredClone(ctx.player);
    p.stats.rewardsUnderpriced = Math.max(0, p.stats.rewardsUnderpriced + (next.playerAdjustedDown ? 1 : -1));
    b.set(playerRef(ctx.uid), clean(p));
  }
  logInBatch(b, ctx.uid, buildLogEntry('reward_adjusted', `Ajustaste "${next.name}": nivel ${next.tier}, ${next.priceCoins} monedas${next.playerAdjustedDown ? ' (por debajo de lo sugerido: lleva sello)' : ''}.`));
  await commitSoon(b, 'adjustReward');
}

/**
 * Re-tasación al subir de rango: recalcula precios con el nuevo ritmo. Es una OFERTA.
 * Nunca sube el precio de algo que ya podías pagar sin avisarte: devolvemos la propuesta para que la UI la muestre.
 */
export function proposeRepricing(ctx: GameContext): { rewardId: string; name: string; from: number; to: number; couldAfford: boolean }[] {
  const est = ctx.player.economy.estimatedCoinsPerDay;
  return ctx.rewards
    .filter((r) => !r.archived && !r.playerAdjustedDown)
    .map((r) => {
      const to = rewardPrice(r.effortDays, est);
      return { rewardId: r.id, name: r.name, from: r.priceCoins, to, couldAfford: ctx.player.economy.coins >= r.priceCoins };
    })
    .filter((x) => x.to !== x.from);
}

export async function applyRepricing(ctx: GameContext, items: { rewardId: string; to: number }[]): Promise<void> {
  if (!items.length) return;
  const b = batch();
  for (const it of items) {
    b.update(subDoc(ctx.uid, 'rewards', it.rewardId), { priceCoins: it.to, suggestedPrice: it.to });
  }
  logInBatch(b, ctx.uid, buildLogEntry('shop_repriced', `Re-tasaste ${items.length} recompensas con tu nuevo ritmo de ganancia (${ctx.player.economy.estimatedCoinsPerDay} monedas/día).`, { reversible: true, undoPayload: { items: ctx.rewards.filter((r) => items.some((i) => i.rewardId === r.id)).map((r) => ({ rewardId: r.id, price: r.priceCoins })) } }));
  await commitSoon(b, 'repricing');
}
