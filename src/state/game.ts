/**
 * Store de juego: escucha Firestore (con caché offline) y expone un GameContext siempre fresco.
 */
import { create } from 'zustand';
import { onSnapshot, query, where, orderBy, limit, type Unsubscribe } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Completion, Failure, Medal, Mission, Player, ResurrectionQuest, Reward, SystemLogEntry, WalletEntry } from '@/shared/types';
import { col, playerRef } from '@/core/repo';
import { computeEffects, DEFAULT_EFFECTS, type ActiveEffects } from '@/core/skills/effects';
import type { GameContext, FeedbackEvent } from '@/core/context';
import { todayIn, now, addDays, deviceTimezone } from '@/lib/time';

interface SkillDoc {
  id: string;
  nodeId: string;
  resetGeneration: number;
}

interface GameState {
  user: User | null;
  authReady: boolean;
  uid: string | null;
  player: Player | null;
  playerLoaded: boolean;
  missions: Mission[];
  completions: Completion[];
  failures: Failure[];
  rewards: Reward[];
  skillDocs: SkillDoc[];
  skills: string[];
  medals: Medal[];
  wallet: WalletEntry[];
  systemLog: SystemLogEntry[];
  resurrection: ResurrectionQuest | null;
  effects: ActiveEffects;
  feedback: FeedbackEvent[];
  online: boolean;
  tick: number;

  setUser(user: User | null): void;
  bind(uid: string): void;
  unbind(): void;
  pushFeedback(events: FeedbackEvent[]): void;
  shiftFeedback(): void;
  setOnline(v: boolean): void;
  bumpTick(): void;
  context(): GameContext | null;
}

let unsubs: Unsubscribe[] = [];

function deriveSkills(docs: SkillDoc[], player: Player | null): string[] {
  const gen = player?.level.treeGeneration ?? 0;
  return docs.filter((d) => (d.resetGeneration ?? 0) === gen).map((d) => d.nodeId);
}

export const useGame = create<GameState>((set, get) => ({
  user: null,
  authReady: false,
  uid: null,
  player: null,
  playerLoaded: false,
  missions: [],
  completions: [],
  failures: [],
  rewards: [],
  skillDocs: [],
  skills: [],
  medals: [],
  wallet: [],
  systemLog: [],
  resurrection: null,
  effects: DEFAULT_EFFECTS,
  feedback: [],
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  tick: 0,

  setUser(user) {
    set({ user, authReady: true });
    const uid = user?.uid ?? null;
    if (uid !== get().uid) {
      get().unbind();
      if (uid) get().bind(uid);
    }
  },

  bind(uid) {
    set({ uid, playerLoaded: false });
    const since = addDays(todayIn(deviceTimezone()), -45);
    const applySkills = (docs: SkillDoc[], player: Player | null) => {
      const skills = deriveSkills(docs, player);
      set({ skillDocs: docs, skills, effects: computeEffects(skills) });
    };
    unsubs = [
      onSnapshot(
        playerRef(uid),
        (snap) => {
          const player = snap.exists() ? (snap.data() as Player) : null;
          set({ player, playerLoaded: true });
          applySkills(get().skillDocs, player);
        },
        (e) => console.error('[snap] player', e),
      ),
      onSnapshot(col(uid, 'missions'), (snap) => set({ missions: snap.docs.map((d) => d.data() as Mission) }), (e) => console.error('[snap] missions', e)),
      onSnapshot(query(col(uid, 'completions'), where('day', '>=', since)), (snap) => set({ completions: snap.docs.map((d) => d.data() as Completion) }), (e) => console.error('[snap] completions', e)),
      onSnapshot(query(col(uid, 'failures'), where('day', '>=', since)), (snap) => set({ failures: snap.docs.map((d) => d.data() as Failure) }), (e) => console.error('[snap] failures', e)),
      onSnapshot(col(uid, 'rewards'), (snap) => set({ rewards: snap.docs.map((d) => d.data() as Reward) }), (e) => console.error('[snap] rewards', e)),
      onSnapshot(
        col(uid, 'skills'),
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, nodeId: (d.data().nodeId as string) ?? d.id, resetGeneration: (d.data().resetGeneration as number) ?? 0 }));
          applySkills(docs, get().player);
        },
        (e) => console.error('[snap] skills', e),
      ),
      onSnapshot(col(uid, 'medals'), (snap) => set({ medals: snap.docs.map((d) => d.data() as Medal) }), (e) => console.error('[snap] medals', e)),
      onSnapshot(query(col(uid, 'wallet'), orderBy('createdAt', 'desc'), limit(200)), (snap) => set({ wallet: snap.docs.map((d) => d.data() as WalletEntry) }), (e) => console.error('[snap] wallet', e)),
      onSnapshot(query(col(uid, 'systemLog'), orderBy('at', 'desc'), limit(80)), (snap) => set({ systemLog: snap.docs.map((d) => d.data() as SystemLogEntry) }), (e) => console.error('[snap] log', e)),
      onSnapshot(
        col(uid, 'resurrection'),
        (snap) => {
          const open = snap.docs.map((d) => d.data() as ResurrectionQuest).filter((r) => !r.resolved);
          set({ resurrection: open.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0] ?? null });
        },
        (e) => console.error('[snap] resurrection', e),
      ),
    ];
  },

  unbind() {
    for (const u of unsubs) u();
    unsubs = [];
    set({
      uid: null,
      player: null,
      playerLoaded: false,
      missions: [],
      completions: [],
      failures: [],
      rewards: [],
      skillDocs: [],
      skills: [],
      medals: [],
      wallet: [],
      systemLog: [],
      resurrection: null,
      effects: DEFAULT_EFFECTS,
      feedback: [],
    });
  },

  pushFeedback(events) {
    if (!events.length) return;
    set({ feedback: [...get().feedback, ...events] });
  },
  shiftFeedback() {
    set({ feedback: get().feedback.slice(1) });
  },
  setOnline(v) {
    set({ online: v });
  },
  bumpTick() {
    set({ tick: get().tick + 1 });
  },

  context() {
    const s = get();
    if (!s.uid || !s.player) return null;
    const tz = s.player.profile.timezone || deviceTimezone();
    const at = now();
    return {
      uid: s.uid,
      player: s.player,
      missions: s.missions,
      completions: s.completions,
      failures: s.failures,
      rewards: s.rewards,
      skills: s.skills,
      effects: s.effects,
      resurrection: s.resurrection,
      tz,
      today: todayIn(tz, at),
      now: at,
    };
  },
}));

/** Hook: contexto reactivo (se recalcula con cada cambio relevante del store y cada tick de reloj). */
export function useGameContext(): GameContext | null {
  useGame((s) => s.tick);
  useGame((s) => s.player);
  useGame((s) => s.missions);
  useGame((s) => s.completions);
  useGame((s) => s.failures);
  useGame((s) => s.skills);
  useGame((s) => s.resurrection);
  useGame((s) => s.rewards);
  return useGame.getState().context();
}
