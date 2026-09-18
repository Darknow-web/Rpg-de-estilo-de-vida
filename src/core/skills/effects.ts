/**
 * Efectos activos del árbol de habilidades. El core consulta SIEMPRE este objeto,
 * nunca los nodos directamente. Así cada nodo cambia una regla real.
 */
import { SKILL_TREE, HEARTS, GRACE, STREAK, QUOTAS, XP, COINS, type SkillNode } from '@/lib/game-balance';

export interface ActiveEffects {
  maxHeartsBonus: number;
  forgivenFailsPerWeek: number;
  dailyQuotaBonus: number;
  bossQuotaBonus: number;
  mainQuotaBonus: number;
  graceHours: number;
  impossibleDaysPerMonth: number;
  earlyBirdDoubleCoins: boolean;
  gymStreakToleratesOneFail: boolean;
  sportCountsAsStrengthMission: boolean;
  strengthFailHeartDiscount: number;
  twoStrengthMissionsUnlockFreeSide: boolean;
  streakToleratesFails: number;
  dayCloseXp: boolean;
  moveWindowOncePerDay: boolean;
  milestoneBurstFraction: number;
  canPreviewAndAcceptTomorrow: boolean;
  deepSessionBonus: boolean;
  revealHiddenHints: boolean;
  escalationKeepsHalfMastery: boolean;
  evidenceGalleryComparisons: boolean;
  weeklyReviewXp: number;
  shopDiscount: number;
  weeklyInterest: boolean;
  dailyCoinCapBonus: number;
  graceCoinMultiplier: number;
  interestCap: number;
  heartRegenPerCleanDay: number;
  weeklyRestDay: boolean;
  maxHeartLossPerFail: number | null;
  resurrectionDays: number;
  restBonusMinDays: number;
  restBonusMissions: number;
}

export const DEFAULT_EFFECTS: ActiveEffects = {
  maxHeartsBonus: 0,
  forgivenFailsPerWeek: 0,
  dailyQuotaBonus: 0,
  bossQuotaBonus: 0,
  mainQuotaBonus: 0,
  graceHours: GRACE.hoursAfterWindow,
  impossibleDaysPerMonth: STREAK.impossibleDaysPerMonth,
  earlyBirdDoubleCoins: false,
  gymStreakToleratesOneFail: false,
  sportCountsAsStrengthMission: false,
  strengthFailHeartDiscount: 0,
  twoStrengthMissionsUnlockFreeSide: false,
  streakToleratesFails: 0,
  dayCloseXp: false,
  moveWindowOncePerDay: false,
  milestoneBurstFraction: XP.MILESTONE_BURST_FRACTION,
  canPreviewAndAcceptTomorrow: false,
  deepSessionBonus: false,
  revealHiddenHints: false,
  escalationKeepsHalfMastery: false,
  evidenceGalleryComparisons: false,
  weeklyReviewXp: 0,
  shopDiscount: 0,
  weeklyInterest: false,
  dailyCoinCapBonus: 0,
  graceCoinMultiplier: COINS.GRACE_MULTIPLIER,
  interestCap: COINS.INTEREST.capCoins,
  heartRegenPerCleanDay: HEARTS.REGEN_PER_CLEAN_DAY,
  weeklyRestDay: false,
  maxHeartLossPerFail: null,
  resurrectionDays: HEARTS.RESURRECTION.consecutiveDays,
  restBonusMinDays: XP.REST_BONUS.minDaysAway,
  restBonusMissions: XP.REST_BONUS.missions,
};

export function nodeById(id: string): SkillNode | undefined {
  return SKILL_TREE.find((n) => n.id === id);
}

export function computeEffects(unlocked: Iterable<string>): ActiveEffects {
  const e: ActiveEffects = { ...DEFAULT_EFFECTS };
  for (const id of unlocked) {
    const node = nodeById(id);
    if (!node) continue;
    const f = node.effect;
    if (f.maxHearts) e.maxHeartsBonus += f.maxHearts;
    if (f.forgivenFailsPerWeek) e.forgivenFailsPerWeek += f.forgivenFailsPerWeek;
    if (f.dailyQuota) e.dailyQuotaBonus += f.dailyQuota;
    if (f.bossQuota) e.bossQuotaBonus += f.bossQuota;
    if (f.mainQuota) e.mainQuotaBonus += f.mainQuota;
    if (f.graceHours) e.graceHours = Math.max(e.graceHours, f.graceHours);
    if (f.impossibleDaysPerMonth) e.impossibleDaysPerMonth = Math.max(e.impossibleDaysPerMonth, f.impossibleDaysPerMonth);
    if (f.earlyBirdDoubleCoins) e.earlyBirdDoubleCoins = true;
    if (f.gymStreakToleratesOneFail) e.gymStreakToleratesOneFail = true;
    if (f.sportCountsAsStrengthMission) e.sportCountsAsStrengthMission = true;
    if (f.strengthFailHeartDiscount) e.strengthFailHeartDiscount += f.strengthFailHeartDiscount;
    if (f.twoStrengthMissionsUnlockFreeSide) e.twoStrengthMissionsUnlockFreeSide = true;
    if (f.streakToleratesFails) e.streakToleratesFails += f.streakToleratesFails;
    if (f.dayCloseXp) e.dayCloseXp = true;
    if (f.moveWindowOncePerDay) e.moveWindowOncePerDay = true;
    if (f.milestoneBurstFraction) e.milestoneBurstFraction = Math.max(e.milestoneBurstFraction, f.milestoneBurstFraction);
    if (f.canPreviewAndAcceptTomorrow) e.canPreviewAndAcceptTomorrow = true;
    if (f.deepSessionBonus) e.deepSessionBonus = true;
    if (f.revealHiddenHints) e.revealHiddenHints = true;
    if (f.escalationKeepsHalfMastery) e.escalationKeepsHalfMastery = true;
    if (f.evidenceGalleryComparisons) e.evidenceGalleryComparisons = true;
    if (f.weeklyReviewXp) e.weeklyReviewXp = Math.max(e.weeklyReviewXp, f.weeklyReviewXp);
    if (f.shopDiscount) e.shopDiscount = Math.max(e.shopDiscount, f.shopDiscount);
    if (f.weeklyInterest) e.weeklyInterest = true;
    if (f.dailyCoinCapBonus) e.dailyCoinCapBonus += f.dailyCoinCapBonus;
    if (f.graceCoinMultiplier) e.graceCoinMultiplier = Math.max(e.graceCoinMultiplier, f.graceCoinMultiplier);
    if (f.interestCap) e.interestCap = Math.max(e.interestCap, f.interestCap);
    if (f.heartRegenPerCleanDay) e.heartRegenPerCleanDay = Math.max(e.heartRegenPerCleanDay, f.heartRegenPerCleanDay);
    if (f.weeklyRestDay) e.weeklyRestDay = true;
    if (f.maxHeartLossPerFail) e.maxHeartLossPerFail = f.maxHeartLossPerFail;
    if (f.resurrectionDays) e.resurrectionDays = Math.min(e.resurrectionDays, f.resurrectionDays);
    if (f.restBonusMinDays) e.restBonusMinDays = Math.min(e.restBonusMinDays, f.restBonusMinDays);
    if (f.restBonusMissions) e.restBonusMissions = Math.max(e.restBonusMissions, f.restBonusMissions);
  }
  return e;
}

export function quotaMax(type: 'daily' | 'weekly' | 'main' | 'side' | 'boss' | 'hidden', rankIdx: number, masteredCount: number, effects: ActiveEffects): number {
  const q = QUOTAS[type];
  let bonus = 0;
  if (type === 'daily') bonus += effects.dailyQuotaBonus;
  if (type === 'boss') bonus += effects.bossQuotaBonus;
  if (type === 'main') bonus += effects.mainQuotaBonus;
  return Math.min(q.max, q.start + q.perRank * rankIdx + q.perMastered * masteredCount + bonus);
}
