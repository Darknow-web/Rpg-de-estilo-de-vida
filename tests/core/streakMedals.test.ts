import { describe, it, expect, vi, beforeEach } from 'vitest';

type Write = { op: 'set' | 'update'; ref: string; data: Record<string, unknown> };
const writes: Write[] = [];
vi.mock('@/core/repo', () => ({
  batch: () => ({
    set: (ref: string, data: Record<string, unknown>) => writes.push({ op: 'set', ref, data }),
    update: (ref: string, data: Record<string, unknown>) => writes.push({ op: 'update', ref, data }),
    commit: async () => undefined,
  }),
  commitSoon: async () => undefined,
  subDoc: (_u: string, c: string, id: string) => `${c}/${id}`,
  playerRef: (u: string) => `players/${u}`,
  clean: <T,>(o: T): T => JSON.parse(JSON.stringify(o)),
}));
vi.mock('@/lib/systemLog', () => ({
  buildLogEntry: (action: string, reason: string) => ({ id: `log_${action}`, at: '', action, reason, reversible: false }),
  logInBatch: (b: { set: (r: string, d: Record<string, unknown>) => void }, _u: string, e: { id: string } & Record<string, unknown>) => b.set(`systemLog/${e.id}`, e),
}));

import { runCatchup } from '@/core/catchup/catchup';
import { createInitialPlayer } from '@/core/character/player';
import { DEFAULT_EFFECTS } from '@/core/skills/effects';
import { buildMission } from '@/core/missions/factory';
import type { GameContext } from '@/core/context';
import type { Completion, Mission } from '@/shared/types';
import { STREAK } from '@/lib/game-balance';
import type { MissionTemplate } from '@/core/module';

const tz = 'America/Lima';
const uid = 'u1';

function daily(): Mission {
  const tpl: MissionTemplate = { moduleId: 'habits', name: 'Agua', description: 'x', attribute: 'vitalidad', type: 'daily', difficulty: 'easy', schedule: { days: [0, 1, 2, 3, 4, 5, 6], window: 'allDay' }, estimatedMinutes: 2, minimalVersion: { name: 'x', description: 'x' } };
  return buildMission(tpl, 'player', '2026-09-01');
}

function ctxFor(streakBefore: number, yesterday: string, today: string): GameContext {
  const m = daily();
  const now = new Date(`${today}T15:00:00-05:00`);
  const player = createInitialPlayer(uid, 'Test', tz, today);
  player.flags.onboardingDone = true;
  player.streak.current = streakBefore;
  player.streak.lastProcessedDay = new Date(new Date(`${yesterday}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  const done: Completion = { id: 'c1', missionId: m.id, day: yesterday, status: 'onTime', xpAwarded: 10, coinsAwarded: 5, completedAt: `${yesterday}T13:00:00.000Z`, evidenceId: null } as Completion;
  return { uid, player, missions: [m], completions: [done], failures: [], rewards: [], skills: [], effects: DEFAULT_EFFECTS, resurrection: null, tz, today, now };
}

beforeEach(() => {
  writes.length = 0;
});

describe('medallas de racha', () => {
  it(`al cerrar el día ${STREAK.medalDays[0]} de racha se otorga streak_${STREAK.medalDays[0]} (bronce) una sola vez`, async () => {
    const days = STREAK.medalDays[0];
    const ctx = ctxFor(days - 1, '2026-09-17', '2026-09-18');
    const s = await runCatchup(ctx);
    expect(s.streakNow).toBe(days);
    const medal = writes.find((w) => w.ref === `medals/streak_${days}`);
    expect(medal?.data).toMatchObject({ kind: 'streak', title: `Racha de ${days} días (bronce)` });
    expect(s.events.some((e) => e.kind === 'medal' && e.title.includes(`${days}`))).toBe(true);
    const player = writes.filter((w) => w.ref === `players/${uid}`).at(-1)?.data as { streak: { medalDays: number[] } };
    expect(player.streak.medalDays).toEqual([days]);
    expect(writes.some((w) => w.ref === 'systemLog/log_medal_streak')).toBe(true);
  });

  it('si ya se tenía la medalla (racha rehecha), no se vuelve a escribir', async () => {
    const days = STREAK.medalDays[0];
    const ctx = ctxFor(days - 1, '2026-09-17', '2026-09-18');
    ctx.player.streak.medalDays = [days];
    await runCatchup(ctx);
    expect(writes.some((w) => w.ref === `medals/streak_${days}`)).toBe(false);
  });

  it('un día que no alcanza umbral no otorga nada', async () => {
    const ctx = ctxFor(2, '2026-09-17', '2026-09-18');
    const s = await runCatchup(ctx);
    expect(s.streakNow).toBe(3);
    expect(writes.some((w) => w.ref.startsWith('medals/'))).toBe(false);
  });
});
