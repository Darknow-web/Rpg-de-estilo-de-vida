import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firestore fuera: batch falso que guarda las escrituras ──
type Write = { op: 'set' | 'update'; ref: string; data: Record<string, unknown> };
const writes: Write[] = [];
function fakeBatch() {
  return {
    set: (ref: string, data: Record<string, unknown>) => writes.push({ op: 'set', ref, data }),
    update: (ref: string, data: Record<string, unknown>) => writes.push({ op: 'update', ref, data }),
    commit: async () => undefined,
  };
}
vi.mock('@/core/repo', () => ({
  batch: () => fakeBatch(),
  commitSoon: async () => undefined,
  subDoc: (_u: string, c: string, id: string) => `${c}/${id}`,
  playerRef: (u: string) => `players/${u}`,
  clean: <T,>(o: T): T => JSON.parse(JSON.stringify(o)),
}));
vi.mock('@/lib/systemLog', () => ({
  buildLogEntry: (action: string, reason: string) => ({ id: `log_${action}`, at: '', action, reason, reversible: false }),
  logInBatch: (b: { set: (r: string, d: Record<string, unknown>) => void }, _u: string, e: { id: string } & Record<string, unknown>) => b.set(`systemLog/${e.id}`, e),
}));
vi.mock('@/lib/storage', () => ({
  prepareEvidence: async () => ({ bytes: new Uint8Array(10), thumb: new Uint8Array(2), width: 8, height: 8 }),
  evidenceStorage: { save: async () => undefined },
}));

import { completeMission } from '@/core/completion/complete';
import { runCatchup } from '@/core/catchup/catchup';
import { quotaFor } from '@/core/missions/quota';
import { planDay } from '@/core/notifications/planner';
import { createInitialPlayer } from '@/core/character/player';
import { DEFAULT_EFFECTS } from '@/core/skills/effects';
import { buildMission } from '@/core/missions/factory';
import { commitmentToMission } from '@/modules/calendar/commitments';
import type { CalendarEvent } from '@/modules/calendar/types';
import type { GameContext } from '@/core/context';
import type { Mission } from '@/shared/types';
import { PUNCTUALITY, QUOTAS, XP, NOTIFICATIONS } from '@/lib/game-balance';
import type { MissionTemplate } from '@/core/module';

const tz = 'America/Lima';
const uid = 'u1';

const event = (id = 'ev1', start = '2026-09-18T14:30:00-05:00'): CalendarEvent => ({ id, calendarId: 'primary', summary: 'Dentista', start, end: start, allDay: false });

function ctxAt(nowIso: string, missions: Mission[], over: Partial<GameContext> = {}): GameContext {
  const now = new Date(nowIso);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const player = createInitialPlayer(uid, 'Test', tz, today);
  player.flags.onboardingDone = true;
  player.streak.lastProcessedDay = '2026-09-17';
  return { uid, player, missions, completions: [], failures: [], rewards: [], skills: [], effects: DEFAULT_EFFECTS, resurrection: null, tz, today, now, ...over };
}

const blob = new Blob(['x']);

beforeEach(() => {
  writes.length = 0;
});

describe('puntualidad: completar un compromiso', () => {
  it('llegar ≥ 10 min antes marca early y multiplica la XP por (1 + earlyBonus) antes de awardRewards', async () => {
    const m = commitmentToMission(event(), uid, new Date('2026-09-17T20:00:00Z'), tz);
    // 14:00 Lima = 19:00Z → 30 min antes del evento (ventana 13:30–14:30 activa)
    const ctx = ctxAt('2026-09-18T19:00:00Z', [m]);
    const r = await completeMission(ctx, m.id, { file: blob });
    expect(r.ok).toBe(true);
    expect(r.early).toBe(true);
    expect(r.minutesEarly).toBe(30);
    expect(r.completion?.xpAwarded).toBe(Math.round(m.xp * (1 + PUNCTUALITY.earlyBonus)));
    expect(r.completion?.bonuses).toContain('con adelanto');
    expect(r.punctuality).toEqual({ onTime: 1, early: 1, missed: 0 });
    // La misión (fecha única, secundaria) se archiva al completarse.
    const upd = writes.find((w) => w.op === 'update' && w.ref === `missions/${m.id}`);
    expect(upd?.data.active).toBe(false);
  });

  it('llegar con menos de 10 min de margen cuenta como a tiempo pero sin bonus', async () => {
    const m = commitmentToMission(event(), uid, new Date('2026-09-17T20:00:00Z'), tz);
    // 14:25 Lima = 19:25Z → 5 min antes
    const ctx = ctxAt('2026-09-18T19:25:00Z', [m]);
    const r = await completeMission(ctx, m.id, { file: blob });
    expect(r.ok).toBe(true);
    expect(r.early).toBe(false);
    expect(r.minutesEarly).toBe(5);
    expect(r.completion?.xpAwarded).toBe(m.xp);
    expect(r.punctuality).toEqual({ onTime: 1, early: 0, missed: 0 });
  });

  it('en gracia (después de la hora del evento) no suma a onTime ni da bonus', async () => {
    const m = commitmentToMission(event(), uid, new Date('2026-09-17T20:00:00Z'), tz);
    // 15:00 Lima = 20:00Z → 30 min tarde, dentro de la gracia de 3 h
    const ctx = ctxAt('2026-09-18T20:00:00Z', [m]);
    const r = await completeMission(ctx, m.id, { file: blob });
    expect(r.ok).toBe(true);
    expect(r.completion?.status).toBe('grace');
    expect(r.early).toBe(false);
    expect(r.punctuality).toEqual({ onTime: 0, early: 0, missed: 0 });
    expect(r.completion?.xpAwarded).toBe(Math.round(m.xp * XP.GRACE_MULTIPLIER));
  });

  it('la décima llegada a tiempo otorga la medalla punctual_10 "Puntual (bronce)"', async () => {
    const m = commitmentToMission(event(), uid, new Date('2026-09-17T20:00:00Z'), tz);
    const ctx = ctxAt('2026-09-18T19:00:00Z', [m]);
    ctx.player.stats.punctuality = { onTime: 9, early: 2, missed: 1 };
    const r = await completeMission(ctx, m.id, { file: blob });
    expect(r.ok).toBe(true);
    expect(r.punctuality).toEqual({ onTime: 10, early: 3, missed: 1 });
    const medal = writes.find((w) => w.ref === 'medals/punctual_10');
    expect(medal?.data).toMatchObject({ id: 'punctual_10', kind: 'punctual', title: 'Puntual (bronce)' });
    expect(r.events.some((e) => e.kind === 'medal' && e.title === 'Puntual (bronce)')).toBe(true);
    // El jugador escrito lleva el contador actualizado.
    const p = writes.filter((w) => w.ref === `players/${uid}`).at(-1)?.data as { stats: { punctuality: unknown } };
    expect(p.stats.punctuality).toEqual({ onTime: 10, early: 3, missed: 1 });
  });

  it('la novena llegada no da medalla; una misión normal no toca el contador', async () => {
    const m = commitmentToMission(event(), uid, new Date('2026-09-17T20:00:00Z'), tz);
    const ctx = ctxAt('2026-09-18T19:00:00Z', [m]);
    ctx.player.stats.punctuality = { onTime: 8, early: 0, missed: 0 };
    await completeMission(ctx, m.id, { file: blob });
    expect(writes.some((w) => w.ref.startsWith('medals/'))).toBe(false);

    writes.length = 0;
    const tpl: MissionTemplate = { moduleId: 'habits', name: 'Leer', description: 'Leer', attribute: 'intelecto', type: 'daily', difficulty: 'easy', schedule: { days: [0, 1, 2, 3, 4, 5, 6], window: 'allDay' }, estimatedMinutes: 10, minimalVersion: { name: 'Leer', description: 'Leer' } };
    const d = buildMission(tpl, 'player', '2026-09-18');
    const ctx2 = ctxAt('2026-09-18T19:00:00Z', [d]);
    const r = await completeMission(ctx2, d.id, { file: blob });
    expect(r.ok).toBe(true);
    expect(r.early).toBeUndefined();
    expect(r.punctuality).toBeUndefined();
  });
});

describe('puntualidad: vencimiento sin apuestas (catchup)', () => {
  it('un compromiso vencido no quita corazones ni rompe la racha; suma missed y archiva la misión', async () => {
    const m = commitmentToMission(event(), uid, new Date('2026-09-17T20:00:00Z'), tz);
    // 18:00 Lima del 18 = 23:00Z → la ventana (13:30–14:30) + 3 h de gracia venció a las 17:30.
    const ctx = ctxAt('2026-09-18T23:00:00Z', [m]);
    ctx.player.streak.current = 5;
    const s = await runCatchup(ctx);
    expect(s.heartsLost).toBe(0);
    expect(s.failuresApplied).toEqual([]);
    expect(s.commitmentsMissed).toEqual([{ missionName: m.name, day: '2026-09-18' }]);
    expect(s.streakBroken).toBe(false);
    expect(s.streakNow).toBe(5);
    expect(s.hasNews).toBe(true);
    expect(s.events.some((e) => e.kind === 'heartsLost')).toBe(false);
    const player = writes.filter((w) => w.ref === `players/${uid}`).at(-1)?.data as { hearts: { current: number }; stats: { punctuality: unknown } };
    expect(player.hearts.current).toBe(5);
    expect(player.stats.punctuality).toEqual({ onTime: 0, early: 0, missed: 1 });
    const upd = writes.find((w) => w.op === 'update' && w.ref === `missions/${m.id}`);
    expect(upd?.data.active).toBe(false);
    const failure = writes.find((w) => w.ref.startsWith('failures/'));
    expect(failure?.data).toMatchObject({ missionId: m.id, heartsLost: 0, forgivenBy: 'noStakes' });
    const log = writes.find((w) => w.ref === 'systemLog/log_commitment_missed');
    expect(String(log?.data.reason)).toMatch(/no quitan corazones/);
  });

  it('una secundaria normal vencida sí quita corazones (el resto del comportamiento no cambia)', async () => {
    const tpl: MissionTemplate = { moduleId: 'habits', name: 'Trámite', description: 'x', attribute: 'disciplina', type: 'side', difficulty: 'easy', schedule: { days: [], window: { start: '13:30', end: '14:30' }, once: '2026-09-18' }, estimatedMinutes: 10, minimalVersion: { name: 'x', description: 'x' } };
    const m = buildMission(tpl, 'player', '2026-09-17');
    const ctx = ctxAt('2026-09-18T23:00:00Z', [m]);
    const s = await runCatchup(ctx);
    expect(s.heartsLost).toBe(1);
    expect(s.failuresApplied).toHaveLength(1);
    expect(s.commitmentsMissed).toEqual([]);
  });
});

describe('puntualidad: cupo y avisos', () => {
  it('las misiones de agenda no consumen el cupo de secundarias', () => {
    const player = createInitialPlayer(uid, 'Test', tz, '2026-09-18');
    const now = new Date('2026-09-17T20:00:00Z');
    const cal = [1, 2, 3].map((i) => commitmentToMission(event(`e${i}`), uid, now, tz));
    const q = quotaFor('side', player, cal, DEFAULT_EFFECTS);
    expect(q.used).toBe(0);
    expect(q.max).toBe(QUOTAS.side.start);
    expect(q.allowed).toBe(true);
  });

  it('el planificador solo emite el aviso de apertura "Sale en 60 min" para compromisos y respeta el tope de 4', () => {
    const now = new Date('2026-09-18T10:00:00Z'); // 05:00 Lima
    const cal = commitmentToMission(event(), uid, now, tz);
    const plan = planDay([cal], new Set(), '2026-09-18', tz, now);
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('open');
    expect(plan[0].title).toBe('Sale en 60 min: Dentista');
    expect(plan[0].at.toISOString()).toBe('2026-09-18T18:30:00.000Z'); // 13:30 Lima
    // Con muchas misiones, el tope diario sigue en NOTIFICATIONS.maxPerDay.
    const many = [1, 2, 3, 4, 5].map((h) => commitmentToMission(event(`e${h}`, `2026-09-18T1${h}:00:00-05:00`), uid, now, tz));
    const tpl: MissionTemplate = { moduleId: 'habits', name: 'Leer', description: 'x', attribute: 'intelecto', type: 'daily', difficulty: 'easy', schedule: { days: [0, 1, 2, 3, 4, 5, 6], window: { start: '20:00', end: '21:00' } }, estimatedMinutes: 10, minimalVersion: { name: 'x', description: 'x' } };
    const daily = buildMission(tpl, 'player', '2026-09-18');
    const big = planDay([...many, daily], new Set(), '2026-09-18', tz, now);
    expect(big.length).toBe(NOTIFICATIONS.maxPerDay);
    expect(big.some((n) => n.kind === 'closing' && n.missionId === daily.id)).toBe(true);
    expect(big.filter((n) => n.kind === 'closing')).toHaveLength(1);
  });
});
