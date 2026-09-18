/**
 * completeMission(): la ÚNICA puerta para completar una misión.
 * Abrir cámara → foto → guardar → recompensa. Sin foto no hay misión completada.
 */
import type { Completion, Medal, Mission, Player } from '@/shared/types';
import { XP, COINS, MASTERY } from '@/lib/game-balance';
import { newId, nowIso } from '@/lib/ids';
import { batch, commitSoon, playerRef, subDoc, clean } from '@/core/repo';
import { evidenceStorage, prepareEvidence } from '@/lib/storage';
import { windowStatus, yesterdayGraceStatus, zonedParts, addDays } from '@/lib/time';
import { awardRewards, fractionOfLevelXp } from '@/core/economy/award';
import { applyMasteryDone } from '@/core/mastery/mastery';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import { revive } from '@/core/hearts/hearts';
import { estimateCoinsPerDay } from '@/core/economy/estimate';
import { getModule } from '@/core/module';
import type { GameContext, FeedbackEvent } from '@/core/context';
import { checkHiddenMissions } from '@/core/missions/hidden';

export interface CompleteResult {
  ok: boolean;
  error?: string;
  completion?: Completion;
  events: FeedbackEvent[];
}

export interface EvidenceInput {
  file: Blob;
}

export async function completeMission(ctx: GameContext, missionId: string, evidence: EvidenceInput, opts: { day?: string } = {}): Promise<CompleteResult> {
  const mission = ctx.missions.find((m) => m.id === missionId);
  if (!mission || !mission.active) return { ok: false, error: 'La misión no existe o ya no está activa.', events: [] };
  if (ctx.player.status === 'paused') return { ok: false, error: 'El juego está en pausa. Reanúdalo para completar misiones.', events: [] };

  // ── Determinar día y estado de la ventana ──
  const today = ctx.today;
  let day = opts.day ?? today;
  let status: 'onTime' | 'grace' = 'onTime';
  if (mission.type === 'daily' || mission.type === 'side') {
    const ws = windowStatus(mission.schedule, ctx.now, ctx.tz, ctx.effects.graceHours);
    if (opts.day && opts.day === addDays(today, -1)) {
      const g = yesterdayGraceStatus(mission.schedule, ctx.now, ctx.tz, ctx.effects.graceHours);
      if (!g) return { ok: false, error: 'La ventana de ayer ya venció.', events: [] };
      status = 'grace';
      day = opts.day;
    } else if (ws.state === 'grace') status = 'grace';
    else if (ws.state === 'expired') return { ok: false, error: 'Esta ventana ya venció. Mañana tendrás otra oportunidad.', events: [] };
    else if (ws.state === 'upcoming') {
      // Permitido: completar antes de la ventana cuenta como a tiempo (nunca castigamos por adelantarse).
      status = 'onTime';
    }
  }
  const already = ctx.completions.find((c) => c.missionId === missionId && c.day === day && c.status !== 'annulled');
  if (already && mission.type !== 'weekly') return { ok: false, error: 'Ya completaste esta misión hoy.', events: [] };
  if (mission.type === 'weekly') {
    const doneToday = ctx.completions.some((c) => c.missionId === missionId && c.day === day && c.status !== 'annulled');
    if (doneToday) return { ok: false, error: 'Esta semanal ya cuenta hoy. Vuelve mañana para sumar otra.', events: [] };
  }

  // ── Foto obligatoria ──
  let evidenceId: string | null = null;
  const completionId = newId('c');
  let prepared: Awaited<ReturnType<typeof prepareEvidence>> | null = null;
  if (mission.requiresPhoto) {
    try {
      prepared = await prepareEvidence(evidence.file);
    } catch (err) {
      return { ok: false, error: `No se pudo procesar la foto: ${(err as Error).message}`, events: [] };
    }
    evidenceId = newId('ev');
  }

  const events: FeedbackEvent[] = [];
  const b = batch();
  let player: Player = structuredClone(ctx.player);
  const bonuses: string[] = [];

  // ── Multiplicadores ──
  let xpMult = 1;
  let coinMult = 1;
  if (status === 'grace') {
    xpMult *= XP.GRACE_MULTIPLIER;
    coinMult *= ctx.effects.graceCoinMultiplier;
    bonuses.push('gracia');
  }
  if (mission.mastery.state === 'mastered' || mission.mastery.state === 'automated') {
    xpMult *= XP.MASTERED_MULTIPLIER;
    bonuses.push('dominada');
  }
  if (player.restBonus.remainingMissions > 0) {
    xpMult *= XP.REST_BONUS.multiplier;
    player.restBonus.remainingMissions -= 1;
    bonuses.push('bonus de descanso');
  }
  if (ctx.effects.deepSessionBonus && mission.estimatedMinutes >= XP.DEEP_SESSION.minMinutes) {
    xpMult *= XP.DEEP_SESSION.multiplier;
    bonuses.push('sesión profunda');
  }
  const localHour = zonedParts(ctx.now, ctx.tz).hour;
  if (ctx.effects.earlyBirdDoubleCoins && localHour < COINS.EARLY_BIRD.beforeHour && status === 'onTime') {
    coinMult *= COINS.EARLY_BIRD.multiplier;
    bonuses.push('madrugador');
  }
  const clockSuspect = Math.abs(ctx.now.getTime() - Date.now()) > 10 * 60_000;

  // ── Recompensa ──
  const outcome = awardRewards(b, ctx.uid, player, ctx.effects, today, {
    source: 'mission',
    refId: completionId,
    xp: mission.xp * xpMult,
    coins: mission.coins * coinMult,
    attribute: mission.attribute,
    note: `Misión: ${mission.name}`,
  });
  player = outcome.player;
  events.push({ kind: 'reward', xp: outcome.xp, coins: outcome.coins, attribute: mission.attribute, bonuses, capped: outcome.coinsCapped });
  if (outcome.leveledUp) events.push({ kind: 'levelUp', level: outcome.newLevel, skillPoints: outcome.skillPointsGained });
  if (outcome.rankedUp) {
    events.push({ kind: 'rankUp', rank: outcome.newRank, title: rankTitle(outcome.newRank) });
    const medal: Medal = { id: newId('medal'), kind: 'rank', title: `Rango ${outcome.newRank}`, awardedAt: nowIso() };
    b.set(subDoc(ctx.uid, 'medals', medal.id), medal);
    logInBatch(b, ctx.uid, buildLogEntry('rank_up', `Subiste a rango ${outcome.newRank}: +1 cupo de misiones, +1 punto de habilidad, +1 reinicio de árbol. La tienda puede re-tasarse (te lo ofreceremos).`));
  }

  // ── Completación + evidencia ──
  const completion: Completion = {
    id: completionId,
    missionId,
    day,
    completedAt: nowIso(),
    status,
    evidenceId,
    xpAwarded: outcome.xp,
    coinsAwarded: outcome.coins,
    attribute: mission.attribute,
    bonuses,
    clockSuspect: clockSuspect || undefined,
  };
  b.set(subDoc(ctx.uid, 'completions', completionId), clean(completion));
  if (prepared && evidenceId) {
    await evidenceStorage.save(ctx.uid, { id: evidenceId, missionId, completionId, day, ...prepared });
    player.stats.evidenceBytes += prepared.bytes.byteLength + prepared.thumb.byteLength;
  }
  player.stats.missionsCompleted += 1;
  player.streak.lastActiveDay = today;

  // ── Dominio (solo diarias) ──
  const missionUpdate: Partial<Mission> = {};
  if (mission.type === 'daily') {
    const { mastery, transition } = applyMasteryDone(mission.mastery, day);
    missionUpdate.mastery = mastery;
    if (transition) {
      events.push({ kind: 'mastery', state: transition.to, missionName: mission.name });
      if (transition.to === 'mastered' || transition.to === 'automated') {
        const days = transition.to === 'mastered' ? COINS.MASTERY_BONUS_DAYS.mastered : COINS.MASTERY_BONUS_DAYS.automated;
        const bonusCoins = Math.round(days * Math.max(COINS.MIN_ESTIMATED_PER_DAY, player.economy.estimatedCoinsPerDay));
        const o2 = awardRewards(b, ctx.uid, player, ctx.effects, today, {
          source: 'mastery',
          refId: missionId,
          xp: 0,
          coins: bonusCoins,
          attribute: null,
          note: `${transition.to === 'mastered' ? 'Dominaste' : 'Automatizaste'} "${mission.name}"`,
          bypassDailyCap: true,
        });
        player = o2.player;
        const medal: Medal = {
          id: newId('medal'),
          kind: transition.to,
          title: transition.to === 'mastered' ? `Dominada: ${mission.name}` : `Rasgo: ${mission.name}`,
          missionId,
          awardedAt: nowIso(),
        };
        b.set(subDoc(ctx.uid, 'medals', medal.id), medal);
        events.push({ kind: 'medal', title: medal.title });
        logInBatch(
          b,
          ctx.uid,
          buildLogEntry(
            transition.to === 'mastered' ? 'mission_mastered' : 'mission_automated',
            transition.to === 'mastered'
              ? `"${mission.name}" llegó a Dominada (30 días, ≤3 fallas). Ya no descuenta corazones, da XP a la mitad, libera +1 cupo y te dio ${bonusCoins} monedas. Te propondremos una misión nueva para el cupo liberado.`
              : `"${mission.name}" llegó a Automatizada (66 días acumulados). Sale de la bitácora y pasa a Rasgos del personaje. Bonus: ${bonusCoins} monedas.`,
          ),
        );
      } else if (transition.to === 'consolidated') {
        logInBatch(b, ctx.uid, buildLogEntry('mission_consolidated', `"${mission.name}" llegó a Consolidada (14 días, ≤2 fallas). Te ofreceremos subir su exigencia; es una oferta, no una obligación.`));
      }
    }
  }

  // ── Cadenas ──
  if (mission.unlocksMissionId) {
    const next = ctx.missions.find((m) => m.id === mission.unlocksMissionId);
    if (next && !next.active) {
      b.update(subDoc(ctx.uid, 'missions', next.id), { active: true, revealed: true, unlockedByMissionId: missionId });
      events.push({ kind: 'info', title: 'Cadena', body: `Se desbloqueó "${next.name}".` });
      logInBatch(b, ctx.uid, buildLogEntry('chain_unlock', `Completar "${mission.name}" desbloqueó "${next.name}".`));
    }
  }
  if (mission.chainId) {
    const chain = ctx.missions.filter((m) => m.chainId === mission.chainId);
    const isLast = chain.every((m) => (m.chainOrder ?? 0) <= (mission.chainOrder ?? 0));
    if (isLast && chain.length > 1) {
      const burst = fractionOfLevelXp(player, ctx.effects.milestoneBurstFraction);
      const coins = Math.round(COINS.CHAIN_MEDAL_BONUS_DAYS * Math.max(COINS.MIN_ESTIMATED_PER_DAY, player.economy.estimatedCoinsPerDay));
      const o3 = awardRewards(b, ctx.uid, player, ctx.effects, today, { source: 'chain', refId: mission.chainId, xp: burst, coins, attribute: mission.attribute, note: 'Cadena completa', bypassDailyCap: true });
      player = o3.player;
      player.stats.chainsCompleted += 1;
      const medal: Medal = { id: newId('medal'), kind: 'chain', title: `Cadena completa`, chainId: mission.chainId, awardedAt: nowIso() };
      b.set(subDoc(ctx.uid, 'medals', medal.id), medal);
      events.push({ kind: 'chain', xp: o3.xp, coins: o3.coins });
      if (o3.leveledUp) events.push({ kind: 'levelUp', level: o3.newLevel, skillPoints: o3.skillPointsGained });
    }
  }

  // ── Secundarias y misiones con fecha única: se archivan al completarse ──
  if (mission.type === 'side' || (mission.type === 'hidden' && mission.schedule.once)) {
    missionUpdate.active = false;
    missionUpdate.archivedAt = nowIso();
  }

  // ── Resurrección ──
  if (player.status === 'fallen' && ctx.resurrection && !ctx.resurrection.resolved) {
    const q = ctx.resurrection;
    if (q.missionId === missionId || !q.missionId) {
      const consecutive = q.lastDayDone === null || q.lastDayDone === addDays(day, -1) || q.lastDayDone === day;
      const daysDone = q.lastDayDone === day ? q.daysDone : consecutive ? q.daysDone + 1 : 1;
      b.update(subDoc(ctx.uid, 'resurrection', q.id), { daysDone, lastDayDone: day });
      if (daysDone >= q.daysRequired) {
        const r = revive(b, ctx.uid, player, { ...q, daysDone }, ctx.effects, 'completed');
        player = r.player;
        events.push(...r.events);
      } else {
        events.push({ kind: 'info', title: 'Resurrección', body: `${daysDone}/${q.daysRequired} días. Sigue así.` });
      }
    }
  }

  if (Object.keys(missionUpdate).length) b.update(subDoc(ctx.uid, 'missions', missionId), clean(missionUpdate));

  // ── Misiones ocultas ──
  const revealed = checkHiddenMissions({ ...ctx, player, completions: [...ctx.completions, completion] }, b);
  for (const r of revealed) events.push({ kind: 'hidden', missionName: r.name });

  player.economy.estimatedCoinsPerDay = estimateCoinsPerDay(ctx.missions.map((m) => (m.id === missionId ? { ...m, ...missionUpdate } : m)));
  b.set(playerRef(ctx.uid), clean(player));
  void commitSoon(b, 'completeMission');

  const mod = getModule(mission.moduleId);
  if (mod?.onMissionCompleted) {
    void mod.onMissionCompleted({ missionId, completionId, day, status, evidenceId, mission }).catch((e) => console.warn('[module] onMissionCompleted', e));
  }

  return { ok: true, completion, events };
}

/** Anular una completación: queda anotada, nunca se borra. No devuelve la XP ni las monedas al jugador (se registra como anulada). */
export async function annulCompletion(ctx: GameContext, completionId: string, reason: string): Promise<void> {
  const c = ctx.completions.find((x) => x.id === completionId);
  if (!c || c.status === 'annulled') return;
  const b = batch();
  b.update(subDoc(ctx.uid, 'completions', completionId), { status: 'annulled', annulledAt: nowIso(), annulReason: reason });
  const mission = ctx.missions.find((m) => m.id === c.missionId);
  if (mission && mission.type === 'daily') {
    // Retira el día del dominio (sin castigo adicional).
    const m = { ...mission.mastery, daysDone: Math.max(0, mission.mastery.daysDone - 1), cumulativeDays: Math.max(0, mission.mastery.cumulativeDays - 1) };
    b.update(subDoc(ctx.uid, 'missions', mission.id), { mastery: m });
  }
  logInBatch(b, ctx.uid, buildLogEntry('completion_annulled', `Anulaste la completación de "${mission?.name ?? c.missionId}" del ${c.day}: "${reason}". Queda registrada; la XP y monedas ya otorgadas se conservan en el historial.`));
  await commitSoon(b, 'annulCompletion');
}

function rankTitle(rank: Player['level']['rank']): string {
  return { D: 'Novato', C: 'Iniciado', B: 'Veterano', A: 'Élite', S: 'Leyenda' }[rank];
}

export { MASTERY };
