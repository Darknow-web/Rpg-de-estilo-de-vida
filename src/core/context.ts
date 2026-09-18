/**
 * GameContext: foto del estado del jugador que el core recibe en cada acción.
 * Se construye desde el store (snapshots de Firestore) para no releer la base en cada paso.
 */
import type { Completion, Failure, Mission, Player, ResurrectionQuest, Reward } from '@/shared/types';
import type { ActiveEffects } from '@/core/skills/effects';

export interface GameContext {
  uid: string;
  player: Player;
  missions: Mission[];
  completions: Completion[];
  failures: Failure[];
  rewards: Reward[];
  skills: string[];
  effects: ActiveEffects;
  resurrection: ResurrectionQuest | null;
  tz: string;
  today: string;
  now: Date;
}

/** Eventos de feedback que la UI convierte en animación/sonido. */
export type FeedbackEvent =
  | { kind: 'reward'; xp: number; coins: number; attribute: Mission['attribute']; bonuses: string[]; capped: number }
  | { kind: 'levelUp'; level: number; skillPoints: number }
  | { kind: 'rankUp'; rank: Player['level']['rank']; title: string }
  | { kind: 'medal'; title: string }
  | { kind: 'mastery'; state: Mission['mastery']['state']; missionName: string }
  | { kind: 'chain'; xp: number; coins: number }
  | { kind: 'heartsLost'; amount: number; missionName: string }
  | { kind: 'fallen' }
  | { kind: 'revived'; hearts: number }
  | { kind: 'hidden'; missionName: string }
  | { kind: 'info'; title: string; body: string };
