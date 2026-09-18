/**
 * Catch-up: al abrir la app (y cada minuto), resuelve lo que pasó desde la última vez.
 * - Aplica las fallas pendientes de una vez (ventanas vencidas), respetando pausa, día imposible,
 *   descanso sagrado, misiones dominadas y "segunda oportunidad".
 * - Regenera corazones por día limpio, actualiza racha, evalúa semanales, vence resurrecciones,
 *   aplica interés compuesto y activa el bonus de descanso.
 * - Devuelve un resumen claro (nunca una pantalla de culpa) y deja todo en systemLog.
 */
import type { Failure, Mission, Player } from '@/shared/types';
import { addDays, daysBetween, isScheduledOn, parseHHmm, weekKey, weekdayOf, zonedParts, monthKey, windowFor } from '@/lib/time';
import { batch, commitSoon, playerRef, subDoc, clean } from '@/core/repo';
import { newId, nowIso } from '@/lib/ids';
import { applyMasteryFail } from '@/core/mastery/mastery';
import { applyDamage, heartsLossFor, regenForCleanDay, revive, maxHearts } from '@/core/hearts/hearts';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import type { GameContext, FeedbackEvent } from '@/core/context';
import { COINS } from '@/lib/game-balance';
import { checkHiddenMissions } from '@/core/missions/hidden';
import { getModule } from '@/core/module';

export interface CatchupSummary {
  daysAway: number;
  failuresApplied: { missionName: string; day: string; heartsLost: number; forgivenBy?: string }[];
  heartsRegenerated: number;
  heartsLost: number;
  streakNow: number;
  streakBroken: boolean;
  died: boolean;
  revivedByExpiry: boolean;
  restBonusActivated: boolean;
  interestEarned: number;
  /** Compromisos de agenda (stakes 'none') vencidos sin foto: sin daño ni racha, solo el contador de puntualidad. */
  commitmentsMissed: { missionName: string; day: string }[];
  events: FeedbackEvent[];
  /** true si hubo algo que mostrar. */
  hasNews: boolean;
}

function graceEndMinutes(m: Mission, day: string, graceHours: number): number {
  const w = windowFor(m.schedule, weekdayOf(day));
  const end = w === 'allDay' ? 24 * 60 : parseHHmm(w.end);
  return end + graceHours * 60;
}

/** ¿Ya venció (con gracia) la ventana de la misión para el día dado, en el instante actual? */
function expiredFor(m: Mission, day: string, ctx: GameContext): boolean {
  const p = zonedParts(ctx.now, ctx.tz);
  const dayDiff = daysBetween(day, p.day); // 0 = hoy, 1 = ayer…
  const nowMin = dayDiff * 24 * 60 + p.minutesOfDay;
  return nowMin > graceEndMinutes(m, day, ctx.effects.graceHours);
}

function isPaused(player: Player, day: string): boolean {
  return Boolean(player.pause && player.pause.from <= day && day <= player.pause.until);
}

export async function runCatchup(ctx: GameContext): Promise<CatchupSummary> {
  const summary: CatchupSummary = {
    daysAway: 0,
    failuresApplied: [],
    heartsRegenerated: 0,
    heartsLost: 0,
    streakNow: ctx.player.streak.current,
    streakBroken: false,
    died: false,
    revivedByExpiry: false,
    restBonusActivated: false,
    interestEarned: 0,
    commitmentsMissed: [],
    events: [],
    hasNews: false,
  };
  if (!ctx.player.flags.onboardingDone) return summary;

  const b = batch();
  let player: Player = structuredClone(ctx.player);
  const today = ctx.today;
  const failureKeys = new Set(ctx.failures.map((f) => `${f.missionId}:${f.day}`));
  const completionKeys = new Set(ctx.completions.filter((c) => c.status !== 'annulled').map((c) => `${c.missionId}:${c.day}`));
  const missionUpdates = new Map<string, Partial<Mission>>();
  const missions = ctx.missions.map((m) => structuredClone(m));
  let writes = 0;

  // ── Bonus de descanso (días sin abrir la app) ──
  summary.daysAway = Math.max(0, daysBetween(player.streak.lastActiveDay, today));
  if (summary.daysAway >= ctx.effects.restBonusMinDays && player.status !== 'paused') {
    player.restBonus.remainingMissions = Math.max(player.restBonus.remainingMissions, ctx.effects.restBonusMissions);
    summary.restBonusActivated = true;
    logInBatch(b, ctx.uid, buildLogEntry('rest_bonus', `Volviste tras ${summary.daysAway} días. Tus próximas ${ctx.effects.restBonusMissions} misiones dan +50 % de XP. Bienvenido de vuelta.`));
    writes++;
  }
  player.streak.lastActiveDay = today;

  // ── Pausa vencida ──
  if (player.status === 'paused' && player.pause && player.pause.until < today) {
    player.status = 'alive';
    // Los días en pausa no cuentan como procesados pendientes: saltamos hasta el fin de la pausa.
    player.streak.lastProcessedDay = player.pause.until;
    player.hearts.lastRegenDay = player.pause.until;
    player.pause = null;
    logInBatch(b, ctx.uid, buildLogEntry('pause_ended', 'La pausa terminó. El juego se reanuda sin daño ni rachas rotas.'));
    writes++;
  }
  if (player.status === 'paused') {
    if (writes) {
      b.set(playerRef(ctx.uid), clean(player));
      await commitSoon(b, 'catchup-paused');
    }
    return summary;
  }

  // ── Recorre días desde el último procesado hasta hoy (incluido, parcialmente) ──
  const firstDay = addDays(player.streak.lastProcessedDay, 1) <= today ? addDays(player.streak.lastProcessedDay, 1) : today;
  const dayCursorStart = daysBetween(firstDay, today) > 60 ? addDays(today, -60) : firstDay;
  let lastFullyClosed = player.streak.lastProcessedDay;

  for (let day = dayCursorStart; day <= today; day = addDays(day, 1)) {
    const paused = isPaused(player, day);
    const impossible = player.streak.impossibleDays.includes(day);
    const restDay = ctx.effects.weeklyRestDay && player.streak.restDay !== null && weekdayOf(day) === player.streak.restDay;
    const wk = weekKey(day);
    if (player.streak.forgivenFailsWeek !== wk) {
      player.streak.forgivenFailsWeek = wk;
      player.streak.forgivenFailsThisWeek = 0;
    }
    if (player.streak.streakAbsorbedWeek !== wk) {
      player.streak.streakAbsorbedWeek = wk;
      player.streak.streakAbsorbedThisWeek = 0;
    }

    let dayHeartsLost = 0;
    let dayHadUnforgivenFail = false;
    let allExpired = true;
    const scheduled = missions.filter((m) => m.active && (m.type === 'daily' || m.type === 'side') && m.mastery.state !== 'automated' && isScheduledOn(m.schedule, day));

    for (const m of scheduled) {
      const key = `${m.id}:${day}`;
      if (completionKeys.has(key) || failureKeys.has(key)) continue;
      if (!expiredFor(m, day, ctx)) {
        allExpired = false;
        continue;
      }
      // ── Sin apuestas (compromiso de agenda): no hay daño ni racha; se anota, se archiva y sigue ──
      if (m.stakes === 'none') {
        const failure: Failure = { id: newId('f'), missionId: m.id, day, heartsLost: 0, forgivenBy: 'noStakes', createdAt: nowIso() };
        b.set(subDoc(ctx.uid, 'failures', failure.id), clean(failure));
        failureKeys.add(key);
        const pct = (player.stats.punctuality ??= { onTime: 0, early: 0, missed: 0 });
        pct.missed += 1;
        missionUpdates.set(m.id, { ...(missionUpdates.get(m.id) ?? {}), active: false, archivedAt: nowIso() });
        summary.commitmentsMissed.push({ missionName: m.name, day });
        logInBatch(b, ctx.uid, buildLogEntry('commitment_missed', `"${m.name}" (${day}) venció sin foto. Los compromisos de agenda no quitan corazones ni rompen la racha: solo suma 1 al contador de puntualidad (${pct.missed} sin cumplir). La misión se archiva.`));
        writes++;
        const cmod = getModule(m.moduleId);
        if (cmod?.onMissionFailed) void cmod.onMissionFailed(m.id, day).catch(() => undefined);
        continue;
      }
      // ── Falla ──
      let forgivenBy: Failure['forgivenBy'] | undefined;
      if (paused) forgivenBy = 'pause';
      else if (impossible) forgivenBy = 'impossibleDay';
      else if (restDay) forgivenBy = 'restDay';
      else if (m.mastery.state === 'mastered') forgivenBy = 'mastered';
      else if (player.streak.forgivenFailsThisWeek < ctx.effects.forgivenFailsPerWeek) {
        forgivenBy = 'skill';
        player.streak.forgivenFailsThisWeek += 1;
      }
      const loss = forgivenBy ? 0 : heartsLossFor(m, ctx.effects);
      const failure: Failure = { id: newId('f'), missionId: m.id, day, heartsLost: loss, forgivenBy, createdAt: nowIso() };
      b.set(subDoc(ctx.uid, 'failures', failure.id), clean(failure));
      failureKeys.add(key);
      writes++;
      summary.failuresApplied.push({ missionName: m.name, day, heartsLost: loss, forgivenBy });

      if (m.type === 'daily' && !paused && !impossible) {
        const { mastery, transition } = applyMasteryFail(m.mastery, day);
        m.mastery = mastery;
        missionUpdates.set(m.id, { ...(missionUpdates.get(m.id) ?? {}), mastery });
        if (transition) {
          logInBatch(b, ctx.uid, buildLogEntry('mastery_change', transition.windowReset ? `"${m.name}" acumuló demasiadas fallas: la barra de dominio retrocede a la mitad (${mastery.daysDone} días). No pierdes XP ni monedas.` : `"${m.name}" bajó a ${transition.to} por fallas repetidas.`));
        }
      }
      if (m.type === 'side') {
        missionUpdates.set(m.id, { ...(missionUpdates.get(m.id) ?? {}), active: false, archivedAt: nowIso() });
      }
      if (!forgivenBy) {
        dayHadUnforgivenFail = true;
        if (loss > 0 && player.status === 'alive') {
          const dmg = applyDamage(b, ctx.uid, player, loss, m.name, { missions, failures: [...ctx.failures, failure], today, effects: ctx.effects });
          player = dmg.player;
          dayHeartsLost += loss;
          summary.events.push(...dmg.events);
          if (dmg.died) summary.died = true;
        }
      }
      const mod = getModule(m.moduleId);
      if (mod?.onMissionFailed) void mod.onMissionFailed(m.id, day).catch(() => undefined);
    }
    summary.heartsLost += dayHeartsLost;

    // ── Cierre del día (solo si ya pasó toda la gracia de ese día) ──
    const nowParts = zonedParts(ctx.now, ctx.tz);
    const minutesSinceDayStart = daysBetween(day, nowParts.day) * 24 * 60 + nowParts.minutesOfDay;
    const dayClosed = day < today && allExpired && minutesSinceDayStart >= 24 * 60 + ctx.effects.graceHours * 60;
    if (dayClosed && day > lastFullyClosed) {
      // Semanales: al cerrar el domingo, evalúa la semana.
      if (weekdayOf(day) === 0 && player.streak.lastWeeklyCheck !== wk) {
        player.streak.lastWeeklyCheck = wk;
        for (const m of missions.filter((x) => x.active && x.type === 'weekly')) {
          const target = m.schedule.timesPerWeek ?? 1;
          const done = ctx.completions.filter((c) => c.missionId === m.id && c.status !== 'annulled' && weekKey(c.day) === wk).length;
          if (done < target && !paused && !impossible) {
            const loss = heartsLossFor(m, ctx.effects);
            const failure: Failure = { id: newId('f'), missionId: m.id, day, heartsLost: loss, createdAt: nowIso() };
            b.set(subDoc(ctx.uid, 'failures', failure.id), clean(failure));
            summary.failuresApplied.push({ missionName: `${m.name} (${done}/${target} esta semana)`, day, heartsLost: loss });
            if (player.status === 'alive') {
              const dmg = applyDamage(b, ctx.uid, player, loss, m.name, { missions, failures: ctx.failures, today, effects: ctx.effects });
              player = dmg.player;
              summary.heartsLost += loss;
              summary.events.push(...dmg.events);
              if (dmg.died) summary.died = true;
            }
            dayHadUnforgivenFail = true;
            writes++;
          }
        }
      }

      // Racha
      if (!paused) {
        // Los compromisos de agenda (sin apuestas) no cuentan ni a favor ni en contra de la racha.
        const scheduledCount = scheduled.filter((m) => m.stakes !== 'none').length;
        if (impossible || restDay) {
          // conserva
        } else if (dayHadUnforgivenFail) {
          if (player.streak.streakAbsorbedThisWeek < ctx.effects.streakToleratesFails) {
            player.streak.streakAbsorbedThisWeek += 1;
            logInBatch(b, ctx.uid, buildLogEntry('streak_shield', `"Racha de hierro" absorbió el fallo del ${day}: tu racha sigue en ${player.streak.current}.`));
          } else if (player.streak.current > 0) {
            logInBatch(b, ctx.uid, buildLogEntry('streak_broken', `La racha de ${player.streak.current} días se reinició por las fallas del ${day}. Empieza una nueva hoy.`));
            player.streak.current = 0;
            summary.streakBroken = true;
          }
        } else if (scheduledCount > 0) {
          player.streak.current += 1;
          player.streak.best = Math.max(player.streak.best, player.streak.current);
        }
        // Regeneración: día limpio (sin corazones perdidos)
        if (dayHeartsLost === 0 && player.status === 'alive' && player.hearts.current < maxHearts(ctx.effects)) {
          const before = player.hearts.current;
          player = regenForCleanDay(player, ctx.effects, day);
          summary.heartsRegenerated += player.hearts.current - before;
        }
      }
      lastFullyClosed = day;
      writes++;
    }
  }
  if (lastFullyClosed > player.streak.lastProcessedDay) player.streak.lastProcessedDay = lastFullyClosed;

  // ── Mes nuevo: reinicia días imposibles ──
  if (player.streak.impossibleDaysMonth !== monthKey(today)) {
    player.streak.impossibleDaysMonth = monthKey(today);
    player.streak.impossibleDaysUsedThisMonth = 0;
    writes++;
  }

  // ── Resurrección vencida ──
  if (player.status === 'fallen' && ctx.resurrection && !ctx.resurrection.resolved && today > ctx.resurrection.deadline) {
    const r = revive(b, ctx.uid, player, ctx.resurrection, ctx.effects, 'expired');
    player = r.player;
    summary.revivedByExpiry = true;
    summary.events.push(...r.events);
    writes++;
  }
  // Resurrección: si se rompió la cadena de días seguidos, reinicia el contador (visible).
  if (player.status === 'fallen' && ctx.resurrection && !ctx.resurrection.resolved && ctx.resurrection.lastDayDone && daysBetween(ctx.resurrection.lastDayDone, today) > 1 && ctx.resurrection.daysDone > 0) {
    b.update(subDoc(ctx.uid, 'resurrection', ctx.resurrection.id), { daysDone: 0, lastDayDone: null });
    logInBatch(b, ctx.uid, buildLogEntry('resurrection_reset', 'La misión de resurrección exige días seguidos: el contador vuelve a 0/3. El plazo de 7 días sigue corriendo.'));
    writes++;
  }

  // ── Interés compuesto semanal ──
  const thisWeek = weekKey(today);
  if (ctx.effects.weeklyInterest && player.economy.lastInterestWeek !== thisWeek && player.status === 'alive') {
    if (player.economy.lastInterestWeek) {
      const interest = Math.min(ctx.effects.interestCap, Math.floor(player.economy.coins * COINS.INTEREST.weeklyRate));
      if (interest > 0) {
        player.economy.coins += interest;
        b.set(subDoc(ctx.uid, 'wallet', newId('w')), { id: '', delta: interest, balanceAfter: player.economy.coins, source: 'interest', refId: thisWeek, createdAt: nowIso(), note: 'Interés compuesto semanal' });
        summary.interestEarned = interest;
        logInBatch(b, ctx.uid, buildLogEntry('interest', `"Interés compuesto" te dio ${interest} monedas por las monedas no gastadas.`));
      }
    }
    player.economy.lastInterestWeek = thisWeek;
    writes++;
  }

  // ── Corazones máximos (por si cambió el árbol) ──
  const mh = maxHearts(ctx.effects);
  if (player.hearts.max !== mh) {
    player.hearts.max = mh;
    player.hearts.current = Math.min(player.hearts.current, mh);
    writes++;
  }

  // ── Misiones ocultas ──
  const revealed = checkHiddenMissions({ ...ctx, player, missions }, b);
  for (const r of revealed) summary.events.push({ kind: 'hidden', missionName: r.name });
  writes += revealed.length;

  for (const [id, upd] of missionUpdates) b.update(subDoc(ctx.uid, 'missions', id), clean(upd));

  if (writes > 0 || summary.failuresApplied.length) {
    if (summary.failuresApplied.length) {
      const lost = summary.failuresApplied.filter((f) => f.heartsLost > 0);
      logInBatch(b, ctx.uid, buildLogEntry('catchup', `Se aplicaron ${summary.failuresApplied.length} fallas pendientes (${lost.length} con daño, ${summary.heartsLost} corazones). ${summary.heartsRegenerated ? `Regeneraste ${summary.heartsRegenerated}.` : ''}`.trim()));
    }
    b.set(playerRef(ctx.uid), clean(player));
    await commitSoon(b, 'catchup');
  }

  summary.streakNow = player.streak.current;
  summary.hasNews = summary.failuresApplied.length > 0 || summary.commitmentsMissed.length > 0 || summary.heartsRegenerated > 0 || summary.restBonusActivated || summary.died || summary.revivedByExpiry || summary.interestEarned > 0;
  return summary;
}
