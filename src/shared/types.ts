/**
 * Tipos de dominio compartidos entre cliente y servidor.
 * Nada aquí depende de React ni de Firebase.
 */

export type AttributeId = 'fuerza' | 'disciplina' | 'intelecto' | 'riqueza' | 'vitalidad';
export const ATTRIBUTE_IDS: AttributeId[] = ['fuerza', 'disciplina', 'intelecto', 'riqueza', 'vitalidad'];

export type ClassId = 'guerrero' | 'erudito' | 'asceta' | 'mercader' | 'sanador' | 'vagabundo';
export const CLASS_IDS: ClassId[] = ['guerrero', 'erudito', 'asceta', 'mercader', 'sanador', 'vagabundo'];

export type RankId = 'D' | 'C' | 'B' | 'A' | 'S';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'epic';
export type MissionType = 'daily' | 'weekly' | 'main' | 'side' | 'boss' | 'hidden';
export type MasteryState = 'new' | 'progress' | 'consolidated' | 'mastered' | 'automated';
export type ModuleId = 'habits' | 'gym';
export type PlayerStatus = 'alive' | 'fallen' | 'paused';
export type MissionOrigin = 'onboarding' | 'ai-proposal' | 'player' | 'escalation' | 'resurrection' | 'gym' | 'fallback';

/** Ventana horaria en hora local del jugador ("HH:mm"). */
export interface TimeWindow {
  start: string;
  end: string;
}

export interface MissionSchedule {
  /** 0 = domingo … 6 = sábado (para diarias). */
  days: number[];
  /** Solo semanales. */
  timesPerWeek?: number;
  window: TimeWindow | 'allDay';
  /** Ventanas distintas por día de la semana (módulo gimnasio). Tiene prioridad sobre `window`. */
  windowsByDay?: Record<string, TimeWindow>;
  /** Fecha única "YYYY-MM-DD" para secundarias/boss. */
  once?: string;
}

export interface MinimalVersion {
  name: string;
  description: string;
}

export interface MasteryInfo {
  state: MasteryState;
  daysDone: number;
  daysFailed: number;
  /** Total acumulado de días cumplidos desde la creación (para Automatizada, 66). */
  cumulativeDays: number;
  /** Día en que empezó la ventana actual de dominio. */
  windowStart: string;
  /** Últimos 30 días: 1 hecho, 0 fallo, - sin programar. Más reciente al final. */
  history: string;
}

export interface Milestone {
  title: string;
  done: boolean;
  doneAt?: string;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  attribute: AttributeId;
  type: MissionType;
  difficulty: Difficulty;
  xp: number;
  coins: number;
  requiresPhoto: boolean;
  schedule: MissionSchedule;
  estimatedMinutes: number;
  heartsOnFail: number;
  unlocksMissionId?: string;
  chainId?: string;
  chainOrder?: number;
  minimalVersion: MinimalVersion;
  mastery: MasteryInfo;
  milestones?: Milestone[];
  checklist?: Milestone[];
  hiddenCondition?: { kind: string; params: Record<string, unknown> };
  revealed?: boolean;
  moduleId: ModuleId;
  moduleData?: Record<string, unknown>;
  origin: MissionOrigin;
  /** Ancla del método Tiny Habits ("después de lavarme los dientes…"). */
  anchor?: string;
  evidenceHint?: string;
  active: boolean;
  createdAt: string;
  archivedAt?: string;
  /** Escalado: cuántas veces se subió la exigencia. */
  escalationLevel: number;
  /** Si la misión fue desbloqueada por otra (cadena). */
  unlockedByMissionId?: string;
}

export interface AttributeProgress {
  xp: number;
  level: number;
}

export interface InterviewAnswers {
  q1_goal: string;
  q2_why: string;
  q3_tried: string[];
  q4_time: '15' | '30' | '60' | 'more';
  q5_moment: 'morning' | 'afternoon' | 'evening' | 'varies';
  q6_demotivator: 'boredom' | 'no_results' | 'too_hard' | 'forget' | 'punishment';
  q7_anchors: string;
  q8_rewards: string;
}

export interface PlayerProfile {
  displayName: string;
  timezone: string;
  createdAt: string;
  locale: string;
}

export interface PlayerClass {
  id: ClassId;
  name: string;
  description: string;
  identityPhrase: string;
  primaryAttribute: AttributeId | null;
  reason: string;
  acceptedAt: string;
}

export interface Player {
  uid: string;
  profile: PlayerProfile;
  interview: {
    answers: InterviewAnswers;
    answeredAt: string;
    regenerationsUsed: number;
  } | null;
  class: PlayerClass | null;
  attributes: Record<AttributeId, AttributeProgress>;
  level: {
    current: number;
    totalXp: number;
    skillPointsAvailable: number;
    skillPointsEarned: number;
    rank: RankId;
    treeResetsAvailable: number;
    /** Generación del árbol: los nodos de generaciones anteriores no cuentan (reinicio sin borrar). */
    treeGeneration: number;
  };
  hearts: { current: number; max: number; lastRegenDay: string };
  status: PlayerStatus;
  pause: { from: string; until: string } | null;
  economy: {
    coins: number;
    estimatedCoinsPerDay: number;
    dailyCoinsEarned: number;
    dailyCoinsDay: string;
    lastInterestWeek: string;
  };
  streak: {
    current: number;
    best: number;
    impossibleDaysUsedThisMonth: number;
    impossibleDaysMonth: string;
    impossibleDays: string[];
    lastActiveDay: string;
    lastProcessedDay: string;
    forgivenFailsThisWeek: number;
    forgivenFailsWeek: string;
    streakAbsorbedThisWeek: number;
    streakAbsorbedWeek: string;
    restDay: number | null;
    /** Última semana en la que se evaluaron las misiones semanales. */
    lastWeeklyCheck: string;
  };
  restBonus: { remainingMissions: number };
  flags: {
    advancedMode: boolean;
    onboardingDone: boolean;
    notificationsDay: string;
    notificationsSentToday: number;
    storageWarned: boolean;
    seenIntro: string[];
    unlockedViews: string[];
  };
  campaign: {
    explanation: CampaignExplanation;
    generatedAt: string;
    source: 'ai' | 'fallback';
  } | null;
  stats: {
    rewardsUnderpriced: number;
    missionsCompleted: number;
    evidenceBytes: number;
    chainsCompleted: number;
  };
  schemaVersion: number;
}

export interface CampaignExplanation {
  forClass: string;
  perMission: { missionName: string; whatYouSaid: string; attribute: AttributeId; howItHelps: string }[];
  generalStrategy: string;
  whatComesNext: string;
}

export type CompletionStatus = 'onTime' | 'grace' | 'annulled';

export interface Completion {
  id: string;
  missionId: string;
  day: string;
  completedAt: string;
  status: CompletionStatus;
  evidenceId: string | null;
  xpAwarded: number;
  coinsAwarded: number;
  attribute: AttributeId;
  bonuses: string[];
  clockSuspect?: boolean;
  annulledAt?: string;
  annulReason?: string;
}

export interface Failure {
  id: string;
  missionId: string;
  day: string;
  heartsLost: number;
  forgivenBy?: 'skill' | 'impossibleDay' | 'restDay' | 'mastered' | 'pause' | 'skill-strength';
  createdAt: string;
}

export type WalletSource =
  | 'mission'
  | 'milestone'
  | 'mastery'
  | 'medal'
  | 'interest'
  | 'redeem'
  | 'resurrection-penalty'
  | 'chain'
  | 'boss'
  | 'day-close';

export interface WalletEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  source: WalletSource;
  refId: string;
  createdAt: string;
  note: string;
}

export interface Reward {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  effortDays: number;
  priceCoins: number;
  suggestedPrice: number;
  suggestedTier: number;
  frequencyLimit: string | null;
  isFree: boolean;
  appraisal: {
    source: 'ai' | 'fallback' | 'onboarding' | 'player';
    reasoning: string;
    conflictsWithGoal: boolean;
    conflictNote: string | null;
    noteShown: boolean;
    reinforcesGoal: boolean;
  };
  playerAdjustedDown: boolean;
  redemptions: { at: string; coins: number; photoEvidenceId: string | null }[];
  createdAt: string;
  archived: boolean;
}

export interface SystemLogEntry {
  id: string;
  at: string;
  action: string;
  reason: string;
  reversible: boolean;
  undoPayload?: Record<string, unknown>;
  undoneAt?: string;
}

export interface Medal {
  id: string;
  kind: 'mastered' | 'automated' | 'chain' | 'boss' | 'rank' | 'resurrection' | 'main';
  title: string;
  missionId?: string;
  chainId?: string;
  awardedAt: string;
}

export interface ResurrectionQuest {
  id: string;
  missionId: string;
  missionName: string;
  startedAt: string;
  deadline: string;
  daysDone: number;
  daysRequired: number;
  lastDayDone: string | null;
  resolved: 'revived' | 'expired' | null;
}

export interface EvidenceRecord {
  id: string;
  missionId: string;
  completionId: string;
  day: string;
  mime: string;
  width: number;
  height: number;
  sizeBytes: number;
  archived: boolean;
  createdAt: string;
}
