import type { Mission, MissionOrigin, MasteryInfo } from '@/shared/types';
import type { MissionTemplate } from '@/core/module';
import { HEARTS, coinsForDifficulty, xpForDifficulty, MASTERY } from '@/lib/game-balance';
import { newId, nowIso } from '@/lib/ids';

export function freshMastery(today: string): MasteryInfo {
  return { state: 'new', daysDone: 0, daysFailed: 0, cumulativeDays: 0, windowStart: today, history: '' };
}

/** Construye una misión completa a partir de una plantilla. XP, monedas y corazones salen del balance. */
export function buildMission(t: MissionTemplate, origin: MissionOrigin, today: string, opts: { id?: string; escalationLevel?: number } = {}): Mission {
  const esc = opts.escalationLevel ?? 0;
  const mult = Math.pow(MASTERY.escalationRewardMultiplier, esc);
  return {
    id: opts.id ?? newId('m'),
    name: t.name,
    description: t.description,
    attribute: t.attribute,
    type: t.type,
    difficulty: t.difficulty,
    xp: Math.round(xpForDifficulty(t.difficulty) * mult),
    coins: Math.round(coinsForDifficulty(t.difficulty) * mult),
    requiresPhoto: true,
    schedule: t.schedule,
    estimatedMinutes: t.estimatedMinutes,
    heartsOnFail: HEARTS.LOSS_BY_DIFFICULTY[t.difficulty],
    chainId: t.chainId,
    chainOrder: t.chainOrder,
    minimalVersion: t.minimalVersion,
    mastery: freshMastery(today),
    milestones: t.milestones?.map((title) => ({ title, done: false })),
    checklist: t.checklist?.map((title) => ({ title, done: false })),
    moduleId: t.moduleId,
    moduleData: t.moduleData ? { ...t.moduleData, externalKey: t.externalKey } : t.externalKey ? { externalKey: t.externalKey } : undefined,
    origin,
    stakes: t.stakes,
    anchor: t.anchor,
    evidenceHint: t.evidenceHint,
    active: true,
    createdAt: nowIso(),
    escalationLevel: esc,
  };
}

export const DIFFICULTY_LABEL: Record<Mission['difficulty'], string> = {
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
  epic: 'Épica',
};

export const TYPE_LABEL: Record<Mission['type'], string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  main: 'Principal',
  side: 'Secundaria',
  boss: 'Boss',
  hidden: 'Oculta',
};

export const MASTERY_LABEL: Record<MasteryInfo['state'], string> = {
  new: 'Nueva',
  progress: 'En progreso',
  consolidated: 'Consolidada',
  mastered: 'Dominada',
  automated: 'Automatizada',
};
