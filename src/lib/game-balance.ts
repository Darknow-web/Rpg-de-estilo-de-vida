/**
 * game-balance.ts — ÚNICO lugar donde viven los números del juego.
 *
 * Cambiar un valor aquí no exige tocar lógica. Todo lo que sea XP, monedas,
 * corazones, umbrales, cupos, precios o efectos del árbol está en este archivo.
 * La lógica (src/core) solo importa constantes de aquí.
 */

import type { AttributeId, Difficulty, MissionType, RankId } from '@/shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// XP Y NIVELES
// ─────────────────────────────────────────────────────────────────────────────

export const XP = {
  /** XP de una misión de dificultad Media. Las demás se derivan por DIFFICULTY_MULTIPLIER. */
  BASE_PER_MISSION: 20,
  /** xp_para_siguiente(n) = floor(LEVEL_CURVE_BASE · n^LEVEL_CURVE_EXP) */
  LEVEL_CURVE_BASE: 18,
  LEVEL_CURVE_EXP: 1.6,
  MAX_LEVEL: 50,
  /** Completar dentro del margen de gracia: recompensa reducida, sin perder corazón. */
  GRACE_MULTIPLIER: 0.5,
  /** Misión Dominada: sigue dando monedas, XP a la mitad. */
  MASTERED_MULTIPLIER: 0.5,
  /** El atributo principal de la clase crece más rápido. */
  CLASS_PRIMARY_MULTIPLIER: 1.25,
  /** Vagabundo: sin atributo principal, un pequeño bonus parejo. */
  CLASS_VAGABOND_MULTIPLIER: 1.1,
  /** Bonus de descanso: tras N días sin actividad, las primeras M misiones dan +50 %. */
  REST_BONUS: { minDaysAway: 3, missions: 5, multiplier: 1.5 },
  /** Ráfaga de hito: completar una cadena otorga de golpe esta fracción del nivel actual. */
  MILESTONE_BURST_FRACTION: 0.25,
  /** Hito de misión principal: fracción del nivel actual por hito cumplido. */
  MAIN_MILESTONE_FRACTION: 0.15,
  /** Misión BOSS completada: fracción del nivel actual. */
  BOSS_FRACTION: 0.5,
  /** Nodo "Sesión profunda": misiones largas dan más XP. */
  DEEP_SESSION: { minMinutes: 60, multiplier: 1.5 },
  /** Nodo "Cierre del día": revisar el resumen del día. */
  DAY_CLOSE_XP: 15,
} as const;

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 0.75,
  medium: 1.0,
  hard: 1.5,
  epic: 2.0,
};
// XP por misión resultante: 15 / 20 / 30 / 40

/*
 * CALIBRACIÓN DE LA CURVA (cálculo real, no estimado)
 * ───────────────────────────────────────────────────
 * Supuesto: 4 misiones Media/día = 80 XP/día durante el primer mes. Después, el propio juego
 * sube el ritmo (cupo +1 por rango y por misión dominada, dificultad ×1.5/×2, ráfagas de cadena,
 * misiones boss). Modelo de ritmo creciente: 80/día (mes 1) → 140 (meses 2-3) → 200 (4-6) → 300 (7+).
 *
 *   Nivel   XP necesaria   XP acumulada   Día (ritmo constante 80)   Día (ritmo creciente)   Meta
 *   2       18             18             1                          1                       día 1     ✓
 *   5       165            341            5                          5                       semana 1  ✓
 *   8 (C)   404            1 297          17                         17
 *   10      605            2 403          31                         31                      mes 1     ✓
 *   18 (B)  1 674          11 793         148                        95
 *   25      2 908          28 303         354                        178                     mes 6     ✓ (ritmo creciente)
 *   32 (A)  4 379          54 414         681                        266
 *   50 (S)  9 111          176 272        2 204                      672                     año 1     ✗ (≈ 22 meses)
 *
 * Con esta fórmula NO existe BASE que cumpla "nivel 10 al mes" Y "nivel 50 al año": la relación
 * XP(50)/XP(25) es 6,2× para cualquier BASE, y el calendario pedía 2×. Se prioriza el tramo que
 * decide la retención (2, 5, 10, 25). El nivel 50 queda como leyenda de largo plazo.
 */
export function xpToNext(level: number): number {
  if (level >= XP.MAX_LEVEL) return Infinity;
  return Math.floor(XP.LEVEL_CURVE_BASE * Math.pow(level, XP.LEVEL_CURVE_EXP));
}

function buildXpTable(): { toNext: number[]; cumulative: number[] } {
  const toNext: number[] = [0]; // índice 0 sin uso
  const cumulative: number[] = [0, 0]; // cumulative[n] = XP total para ESTAR en nivel n
  for (let n = 1; n < XP.MAX_LEVEL; n++) {
    const need = xpToNext(n);
    toNext[n] = need;
    cumulative[n + 1] = cumulative[n] + need;
  }
  return { toNext, cumulative };
}

/** XP_TABLE.toNext[n] = XP para pasar de n a n+1. XP_TABLE.cumulative[n] = XP total para estar en nivel n. */
export const XP_TABLE = buildXpTable();

/** Nivel general a partir de la XP total (suma de todos los atributos). */
export function levelFromTotalXp(totalXp: number): number {
  let level = 1;
  while (level < XP.MAX_LEVEL && totalXp >= XP_TABLE.cumulative[level + 1]) level++;
  return level;
}

/**
 * Nivel de un atributo. Misma curva pero más suave (los atributos reparten la XP total).
 * xp_atributo(n) = floor(ATTRIBUTE_CURVE_BASE · n^1.6)
 */
export const ATTRIBUTE_CURVE_BASE = 8;
export function attributeXpToNext(level: number): number {
  return Math.floor(ATTRIBUTE_CURVE_BASE * Math.pow(level, XP.LEVEL_CURVE_EXP));
}
export function attributeLevelFromXp(xp: number): number {
  let level = 1;
  let acc = 0;
  while (level < XP.MAX_LEVEL) {
    const need = attributeXpToNext(level);
    if (xp < acc + need) break;
    acc += need;
    level++;
  }
  return level;
}
export function attributeXpIntoLevel(xp: number): { into: number; need: number } {
  let level = 1;
  let acc = 0;
  while (level < XP.MAX_LEVEL) {
    const need = attributeXpToNext(level);
    if (xp < acc + need) return { into: xp - acc, need };
    acc += need;
    level++;
  }
  return { into: 0, need: 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGOS
// ─────────────────────────────────────────────────────────────────────────────

export interface RankDef {
  id: RankId;
  minLevel: number;
  title: string;
  quotaBonus: number;
  unlocks: MissionType[];
  frame: string;
}

export const RANKS: readonly RankDef[] = [
  { id: 'D', minLevel: 1, title: 'Novato', quotaBonus: 0, unlocks: ['daily', 'weekly', 'main'], frame: 'frame-d' },
  { id: 'C', minLevel: 8, title: 'Iniciado', quotaBonus: 1, unlocks: ['side'], frame: 'frame-c' },
  { id: 'B', minLevel: 18, title: 'Veterano', quotaBonus: 2, unlocks: ['boss'], frame: 'frame-b' },
  { id: 'A', minLevel: 32, title: 'Élite', quotaBonus: 3, unlocks: ['hidden'], frame: 'frame-a' },
  { id: 'S', minLevel: 50, title: 'Leyenda', quotaBonus: 4, unlocks: [], frame: 'frame-s' },
] as const;

export function rankForLevel(level: number): RankDef {
  let current = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) current = r;
  return current;
}
export function nextRank(level: number): RankDef | null {
  return RANKS.find((r) => r.minLevel > level) ?? null;
}
export function rankIndex(rank: RankId): number {
  return RANKS.findIndex((r) => r.id === rank);
}

export const SKILL_POINTS = { perLevel: 1, perRank: 1, treeResetsPerRank: 1 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// MONEDAS
// ─────────────────────────────────────────────────────────────────────────────

export const COINS = {
  /** Monedas de una misión Media → 8 / 10 / 15 / 20 según dificultad. */
  BASE_PER_MISSION: 10,
  /** Tope diario anti-farmeo: 60 en D … 120 en S. Sin tope, la economía se rompe en una semana. */
  DAILY_CAP: { base: 60, perRank: 15 },
  GRACE_MULTIPLIER: 0.5,
  /** Nodo "Madrugador": misiones completadas antes de esta hora dan monedas dobles. */
  EARLY_BIRD: { beforeHour: 8, multiplier: 2 },
  /** Bonus de dominio = días × monedas_por_día_estimadas. */
  MASTERY_BONUS_DAYS: { mastered: 5, automated: 15 },
  CHAIN_MEDAL_BONUS_DAYS: 2,
  BOSS_BONUS_DAYS: 3,
  /** monedas_por_dia_estimadas = Σ monedas de misiones diarias activas × tasa esperada. */
  EXPECTED_COMPLETION_RATE: 0.8,
  /** Mínimo para que la tienda tenga precios razonables aunque haya 1 misión. */
  MIN_ESTIMATED_PER_DAY: 15,
  /** Nodo "Interés compuesto". */
  INTEREST: { weeklyRate: 0.02, capCoins: 200 },
  MERCHANT_DISCOUNT: 0.1,
  /** Si la resurrección vence sin cumplirse: revive perdiendo esta fracción de monedas. */
  RESURRECTION_EXPIRY_PENALTY: 0.5,
} as const;

export function coinsForDifficulty(d: Difficulty): number {
  return Math.round(COINS.BASE_PER_MISSION * DIFFICULTY_MULTIPLIER[d]);
}
export function xpForDifficulty(d: Difficulty): number {
  return Math.round(XP.BASE_PER_MISSION * DIFFICULTY_MULTIPLIER[d]);
}
export function dailyCoinCap(rank: RankId, bonus = 0): number {
  return COINS.DAILY_CAP.base + COINS.DAILY_CAP.perRank * rankIndex(rank) + bonus;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIENDA: ESCALERA DE RECOMPENSAS
// ─────────────────────────────────────────────────────────────────────────────

export interface RewardTierDef {
  tier: 1 | 2 | 3 | 4 | 5;
  name: string;
  /** Días de esfuerzo por defecto. */
  effortDays: number;
  /** Rango permitido de días para el tasador. */
  effortRange: [number, number];
  requires: { rank: RankId; level: number } | null;
}

export const REWARD_TIERS: readonly RewardTierDef[] = [
  { tier: 1, name: 'Caprichito', effortDays: 2.5, effortRange: [1.5, 3.5], requires: null },
  { tier: 2, name: 'Recompensa', effortDays: 7, effortRange: [5, 10], requires: { rank: 'C', level: 8 } },
  { tier: 3, name: 'Premio', effortDays: 18, effortRange: [14, 24], requires: { rank: 'B', level: 18 } },
  { tier: 4, name: 'Trofeo', effortDays: 60, effortRange: [45, 75], requires: { rank: 'A', level: 32 } },
  { tier: 5, name: 'Leyenda', effortDays: 150, effortRange: [120, 180], requires: { rank: 'S', level: 50 } },
] as const;

export const APPRAISER = {
  /** Anti-abuso: N recompensas baratas en la ventana → el piso sube un escalón, avisando. */
  antiAbuse: { cheapRewardsInRow: 3, windowHours: 24, floorTierBump: 1 },
} as const;

export function rewardPrice(effortDays: number, estimatedCoinsPerDay: number): number {
  return Math.max(5, Math.round(effortDays * estimatedCoinsPerDay));
}

// ─────────────────────────────────────────────────────────────────────────────
// CUPOS (imponen "empezar pequeño")
// ─────────────────────────────────────────────────────────────────────────────

export const QUOTAS: Record<MissionType, { start: number; perRank: number; perMastered: number; max: number }> = {
  daily: { start: 3, perRank: 1, perMastered: 1, max: 10 },
  weekly: { start: 2, perRank: 1, perMastered: 0, max: 6 },
  main: { start: 1, perRank: 0, perMastered: 0, max: 2 },
  side: { start: 2, perRank: 1, perMastered: 0, max: 6 },
  boss: { start: 1, perRank: 0, perMastered: 0, max: 2 },
  hidden: { start: 99, perRank: 0, perMastered: 0, max: 99 },
};

// ─────────────────────────────────────────────────────────────────────────────
// DOMINIO
// ─────────────────────────────────────────────────────────────────────────────

export const MASTERY = {
  /** Nueva → En progreso: primer cumplimiento. */
  consolidated: { days: 14, maxFails: 2 },
  mastered: { days: 30, maxFails: 3 },
  /** UCL (Lally et al. 2010): promedio 66 días, rango 18–254. Tardar más es normal. */
  automated: { cumulativeDays: 66, rangeText: '18 a 254 días' },
  /** Dominada que se falla mucho vuelve a Consolidada. */
  demoteMasteredIf: { fails: 5, windowDays: 14 },
  /** Dificultad dinámica: observa la tasa real de cumplimiento en la ventana. */
  dynamicDifficulty: { lowerIfFailRateAbove: 0.5, raiseIfCompletionIs: 1.0, windowDays: 14, minSamples: 6 },
  /** Escalar sube XP y monedas de forma proporcional. */
  escalationRewardMultiplier: 1.25,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CORAZONES, MUERTE Y RESURRECCIÓN
// ─────────────────────────────────────────────────────────────────────────────

export const HEARTS = {
  MAX_DEFAULT: 5,
  LOSS_BY_DIFFICULTY: { easy: 1, medium: 1, hard: 2, epic: 3 } as Record<Difficulty, number>,
  /** +1 corazón por cada día completo sin fallar ninguna misión. Nunca de golpe. */
  REGEN_PER_CLEAN_DAY: 1,
  REVIVE_FRACTION: 0.5,
  RESURRECTION: { consecutiveDays: 3, maxDurationDays: 7, lookbackDays: 30 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// GRACIA, RACHAS, PAUSA, NOTIFICACIONES, EVIDENCIA
// ─────────────────────────────────────────────────────────────────────────────

export const GRACE = { hoursAfterWindow: 3 } as const;
export const STREAK = { impossibleDaysPerMonth: 2, warnBeforeBreak: true } as const;
export const NOTIFICATIONS = { maxPerDay: 4, closingWarningMinutes: 30 } as const;
export const EVIDENCE = {
  maxLongSide: 800,
  jpegQuality: 0.7,
  thumbLongSide: 240,
  thumbQuality: 0.6,
  /** Límite duro por foto (también en las reglas de Firestore). */
  maxBytes: 300_000,
  warnAtQuotaFraction: 0.7,
  /** Cuota compartida de Firestore en la capa Starter: 1 GiB. */
  quotaBytes: 1_073_741_824,
} as const;
export const TIME = { clockSkewWarnMinutes: 10 } as const;
export const ONBOARDING = { maxRegenerations: 3, dailyMissions: 3 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// ÁRBOL DE HABILIDADES (32 nodos) — cada nodo CAMBIA UNA REGLA del juego
// ─────────────────────────────────────────────────────────────────────────────

export type SkillBranch = 'trunk' | AttributeId;

/** Efectos que el core interpreta. Un nodo puede tener varios. */
export interface SkillEffect {
  maxHearts?: number;
  forgivenFailsPerWeek?: number;
  dailyQuota?: number;
  graceHours?: number;
  impossibleDaysPerMonth?: number;
  earlyBirdDoubleCoins?: boolean;
  gymStreakToleratesOneFail?: boolean;
  sportCountsAsStrengthMission?: boolean;
  strengthFailHeartDiscount?: number;
  twoStrengthMissionsUnlockFreeSide?: boolean;
  streakToleratesFails?: number;
  dayCloseXp?: boolean;
  moveWindowOncePerDay?: boolean;
  milestoneBurstFraction?: number;
  canPreviewAndAcceptTomorrow?: boolean;
  deepSessionBonus?: boolean;
  bossQuota?: number;
  mainQuota?: number;
  revealHiddenHints?: boolean;
  escalationKeepsHalfMastery?: boolean;
  evidenceGalleryComparisons?: boolean;
  weeklyReviewXp?: number;
  shopDiscount?: number;
  weeklyInterest?: boolean;
  dailyCoinCapBonus?: number;
  graceCoinMultiplier?: number;
  interestCap?: number;
  heartRegenPerCleanDay?: number;
  weeklyRestDay?: boolean;
  maxHeartLossPerFail?: number;
  resurrectionDays?: number;
  restBonusMinDays?: number;
  restBonusMissions?: number;
}

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  cost: number;
  requires?: string[];
  minLevel?: number;
  minAttrLevel?: number;
  effect: SkillEffect;
}

export const SKILL_TREE: readonly SkillNode[] = [
  // ── TRONCO ──
  { id: 'corazon_extra_1', branch: 'trunk', cost: 1, effect: { maxHearts: 1 } },
  { id: 'corazon_extra_2', branch: 'trunk', cost: 2, requires: ['corazon_extra_1'], minLevel: 12, effect: { maxHearts: 1 } },
  { id: 'segunda_oportunidad', branch: 'trunk', cost: 1, effect: { forgivenFailsPerWeek: 1 } },
  { id: 'bitacora_ampliada_1', branch: 'trunk', cost: 1, effect: { dailyQuota: 1 } },
  { id: 'bitacora_ampliada_2', branch: 'trunk', cost: 2, requires: ['bitacora_ampliada_1'], minLevel: 15, effect: { dailyQuota: 1 } },
  { id: 'gracia_extendida', branch: 'trunk', cost: 1, effect: { graceHours: 5 } },
  { id: 'dia_imposible_extra', branch: 'trunk', cost: 1, minLevel: 6, effect: { impossibleDaysPerMonth: 3 } },
  // ── FUERZA ──
  { id: 'madrugador', branch: 'fuerza', cost: 1, minAttrLevel: 2, effect: { earlyBirdDoubleCoins: true } },
  { id: 'resistencia', branch: 'fuerza', cost: 1, minAttrLevel: 3, effect: { gymStreakToleratesOneFail: true } },
  { id: 'deportista', branch: 'fuerza', cost: 1, minAttrLevel: 3, effect: { sportCountsAsStrengthMission: true } },
  { id: 'cuerpo_templado', branch: 'fuerza', cost: 2, requires: ['resistencia'], minAttrLevel: 6, effect: { strengthFailHeartDiscount: 1 } },
  { id: 'sesion_doble', branch: 'fuerza', cost: 2, requires: ['madrugador'], minAttrLevel: 8, effect: { twoStrengthMissionsUnlockFreeSide: true } },
  // ── DISCIPLINA ──
  { id: 'racha_de_hierro', branch: 'disciplina', cost: 1, minAttrLevel: 2, effect: { streakToleratesFails: 1 } },
  { id: 'cierre_del_dia', branch: 'disciplina', cost: 1, minAttrLevel: 2, effect: { dayCloseXp: true } },
  { id: 'ventana_flexible', branch: 'disciplina', cost: 1, minAttrLevel: 4, effect: { moveWindowOncePerDay: true } },
  { id: 'cadena_maestra', branch: 'disciplina', cost: 2, requires: ['cierre_del_dia'], minAttrLevel: 6, effect: { milestoneBurstFraction: 0.4 } },
  { id: 'planificador', branch: 'disciplina', cost: 2, requires: ['ventana_flexible'], minAttrLevel: 8, effect: { canPreviewAndAcceptTomorrow: true } },
  // ── INTELECTO ──
  { id: 'sesion_profunda', branch: 'intelecto', cost: 1, minAttrLevel: 2, effect: { deepSessionBonus: true } },
  { id: 'estratega', branch: 'intelecto', cost: 1, minAttrLevel: 3, effect: { bossQuota: 1, mainQuota: 1 } },
  { id: 'curiosidad', branch: 'intelecto', cost: 1, minAttrLevel: 4, effect: { revealHiddenHints: true } },
  { id: 'mentor', branch: 'intelecto', cost: 2, requires: ['sesion_profunda'], minAttrLevel: 6, effect: { escalationKeepsHalfMastery: true } },
  { id: 'archivista', branch: 'intelecto', cost: 2, requires: ['curiosidad'], minAttrLevel: 8, effect: { evidenceGalleryComparisons: true, weeklyReviewXp: 30 } },
  // ── RIQUEZA ──
  { id: 'mercader', branch: 'riqueza', cost: 1, minAttrLevel: 2, effect: { shopDiscount: 0.1 } },
  { id: 'interes_compuesto', branch: 'riqueza', cost: 2, minAttrLevel: 4, effect: { weeklyInterest: true } },
  { id: 'tesorero', branch: 'riqueza', cost: 1, minAttrLevel: 3, effect: { dailyCoinCapBonus: 20 } },
  { id: 'ahorrador', branch: 'riqueza', cost: 1, minAttrLevel: 3, effect: { graceCoinMultiplier: 0.75 } },
  { id: 'inversionista', branch: 'riqueza', cost: 2, requires: ['interes_compuesto'], minAttrLevel: 8, effect: { interestCap: 500 } },
  // ── VITALIDAD ──
  { id: 'regeneracion', branch: 'vitalidad', cost: 1, minAttrLevel: 2, effect: { heartRegenPerCleanDay: 2 } },
  { id: 'descanso_sagrado', branch: 'vitalidad', cost: 1, minAttrLevel: 3, effect: { weeklyRestDay: true } },
  { id: 'piel_gruesa', branch: 'vitalidad', cost: 2, minAttrLevel: 5, effect: { maxHeartLossPerFail: 2 } },
  { id: 'segundo_aire', branch: 'vitalidad', cost: 2, requires: ['regeneracion'], minAttrLevel: 6, effect: { resurrectionDays: 2 } },
  { id: 'sueno_reparador', branch: 'vitalidad', cost: 2, requires: ['descanso_sagrado'], minAttrLevel: 8, effect: { restBonusMinDays: 2, restBonusMissions: 8 } },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// CLASES
// ─────────────────────────────────────────────────────────────────────────────

export const CLASS_PRIMARY: Record<string, AttributeId | null> = {
  guerrero: 'fuerza',
  erudito: 'intelecto',
  asceta: 'disciplina',
  mercader: 'riqueza',
  sanador: 'vitalidad',
  vagabundo: null,
};
