/**
 * Cupo de misiones activas: impone "empezar pequeño" y explica en lenguaje de juego.
 */
import type { Mission, MissionType, Player } from '@/shared/types';
import { rankIndex, nextRank, XP_TABLE } from '@/lib/game-balance';
import { quotaMax, type ActiveEffects } from '@/core/skills/effects';

export interface QuotaInfo {
  type: MissionType;
  used: number;
  max: number;
  allowed: boolean;
  reason: string | null;
  nextUnlock: string | null;
}

export function countMastered(missions: Mission[]): number {
  return missions.filter((m) => m.type === 'daily' && (m.mastery.state === 'mastered' || m.mastery.state === 'automated')).length;
}

export function activeOfType(missions: Mission[], type: MissionType): Mission[] {
  // Las automatizadas salen de la bitácora: no ocupan cupo.
  return missions.filter((m) => m.active && m.type === type && m.mastery.state !== 'automated' && (m.type !== 'hidden' || m.revealed));
}

export function quotaFor(type: MissionType, player: Player, missions: Mission[], effects: ActiveEffects): QuotaInfo {
  const used = activeOfType(missions, type).length;
  const max = quotaMax(type, rankIndex(player.level.rank), countMastered(missions), effects);
  const allowed = used < max;
  let reason: string | null = null;
  let nextUnlock: string | null = null;
  if (!allowed) {
    const nr = nextRank(player.level.current);
    const missing = nr ? XP_TABLE.cumulative[nr.minLevel] - player.level.totalXp : null;
    if (type === 'daily') {
      reason = 'Tu bitácora diaria está llena. Necesitas dominar una misión o subir de rango para ampliarla.';
      const candidates = missions.filter((m) => m.active && m.type === 'daily' && m.mastery.state !== 'mastered' && m.mastery.state !== 'automated');
      const closest = candidates.sort((a, b) => b.mastery.daysDone - a.mastery.daysDone)[0];
      const parts: string[] = [];
      if (closest) parts.push(`"${closest.name}" lleva ${closest.mastery.daysDone}/30 días hacia Dominada`);
      if (nr && missing !== null) parts.push(`faltan ${missing} XP para rango ${nr.id}`);
      nextUnlock = parts.join(' · ') || null;
    } else {
      reason = `No hay cupo para misiones ${labelPlural(type)}. Sube de rango para desbloquear más.`;
      nextUnlock = nr && missing !== null ? `Faltan ${missing} XP para rango ${nr.id}` : 'Ya estás en el rango máximo.';
    }
  }
  return { type, used, max, allowed, reason, nextUnlock };
}

function labelPlural(type: MissionType): string {
  return { daily: 'diarias', weekly: 'semanales', main: 'principales', side: 'secundarias', boss: 'boss', hidden: 'ocultas' }[type];
}

export function allQuotas(player: Player, missions: Mission[], effects: ActiveEffects): QuotaInfo[] {
  return (['daily', 'weekly', 'main', 'side', 'boss'] as MissionType[]).map((t) => quotaFor(t, player, missions, effects));
}
