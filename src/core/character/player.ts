import type { AttributeId, Player, RankId } from '@/shared/types';
import { ATTRIBUTE_IDS } from '@/shared/types';
import { HEARTS, XP_TABLE, levelFromTotalXp, rankForLevel, nextRank, SKILL_POINTS, attributeLevelFromXp, rankIndex } from '@/lib/game-balance';

export const PLAYER_SCHEMA_VERSION = 1;

export function createInitialPlayer(uid: string, displayName: string, timezone: string, today: string): Player {
  const attrs = {} as Record<AttributeId, { xp: number; level: number }>;
  for (const a of ATTRIBUTE_IDS) attrs[a] = { xp: 0, level: 1 };
  return {
    uid,
    profile: { displayName, timezone, createdAt: new Date().toISOString(), locale: 'es' },
    interview: null,
    class: null,
    attributes: attrs,
    level: { current: 1, totalXp: 0, skillPointsAvailable: 0, skillPointsEarned: 0, rank: 'D', treeResetsAvailable: 0, treeGeneration: 0 },
    hearts: { current: HEARTS.MAX_DEFAULT, max: HEARTS.MAX_DEFAULT, lastRegenDay: today },
    status: 'alive',
    pause: null,
    economy: { coins: 0, estimatedCoinsPerDay: 0, dailyCoinsEarned: 0, dailyCoinsDay: today, lastInterestWeek: '' },
    streak: {
      current: 0,
      best: 0,
      impossibleDaysUsedThisMonth: 0,
      impossibleDaysMonth: today.slice(0, 7),
      impossibleDays: [],
      lastActiveDay: today,
      lastProcessedDay: today,
      forgivenFailsThisWeek: 0,
      forgivenFailsWeek: '',
      streakAbsorbedThisWeek: 0,
      streakAbsorbedWeek: '',
      restDay: null,
      lastWeeklyCheck: '',
    },
    restBonus: { remainingMissions: 0 },
    flags: {
      advancedMode: false,
      onboardingDone: false,
      notificationsDay: today,
      notificationsSentToday: 0,
      storageWarned: false,
      seenIntro: [],
      unlockedViews: [],
    },
    campaign: null,
    stats: { rewardsUnderpriced: 0, missionsCompleted: 0, evidenceBytes: 0, chainsCompleted: 0, punctuality: { onTime: 0, early: 0, missed: 0 } },
    schemaVersion: PLAYER_SCHEMA_VERSION,
  };
}

export interface LevelProgress {
  level: number;
  rank: RankId;
  totalXp: number;
  xpIntoLevel: number;
  xpForLevel: number;
  fraction: number;
  nextRank: { id: RankId; level: number; title: string; xpMissing: number } | null;
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelFromTotalXp(totalXp);
  const base = XP_TABLE.cumulative[level] ?? 0;
  const need = XP_TABLE.toNext[level] ?? 1;
  const into = Math.max(0, totalXp - base);
  const rank = rankForLevel(level).id;
  const nr = nextRank(level);
  return {
    level,
    rank,
    totalXp,
    xpIntoLevel: into,
    xpForLevel: Number.isFinite(need) ? need : 0,
    fraction: Number.isFinite(need) ? Math.min(1, into / need) : 1,
    nextRank: nr ? { id: nr.id, level: nr.minLevel, title: nr.title, xpMissing: Math.max(0, XP_TABLE.cumulative[nr.minLevel] - totalXp) } : null,
  };
}

/**
 * Recalcula nivel, rango y puntos de habilidad a partir de los atributos.
 * Devuelve el nuevo bloque `level` y qué cambió (para animaciones y desbloqueos).
 */
export function recomputeLevel(player: Player, attributes: Record<AttributeId, { xp: number; level: number }>) {
  const totalXp = ATTRIBUTE_IDS.reduce((s, a) => s + attributes[a].xp, 0);
  const newLevel = levelFromTotalXp(totalXp);
  const oldLevel = player.level.current;
  const newRank = rankForLevel(newLevel);
  const oldRankIdx = rankIndex(player.level.rank);
  const newRankIdx = rankIndex(newRank.id);
  const levelsGained = Math.max(0, newLevel - oldLevel);
  const ranksGained = Math.max(0, newRankIdx - oldRankIdx);
  const pointsGained = levelsGained * SKILL_POINTS.perLevel + ranksGained * SKILL_POINTS.perRank;
  for (const a of ATTRIBUTE_IDS) attributes[a].level = attributeLevelFromXp(attributes[a].xp);
  return {
    level: {
      current: newLevel,
      totalXp,
      skillPointsAvailable: player.level.skillPointsAvailable + pointsGained,
      skillPointsEarned: player.level.skillPointsEarned + pointsGained,
      rank: newRank.id,
      treeResetsAvailable: player.level.treeResetsAvailable + ranksGained * SKILL_POINTS.treeResetsPerRank,
      treeGeneration: player.level.treeGeneration ?? 0,
    },
    leveledUp: levelsGained > 0,
    rankedUp: ranksGained > 0,
    newLevel,
    newRank: newRank.id,
    oldRank: player.level.rank,
  };
}
