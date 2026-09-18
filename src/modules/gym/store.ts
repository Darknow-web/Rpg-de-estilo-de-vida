/**
 * Datos del módulo gimnasio en Firestore: players/{uid}/gym/{profile|availability|routines/*|sessionLogs/*}.
 * El módulo escribe solo en su subcolección; XP, monedas y corazones pasan por el core.
 */
import { doc, collection, getDoc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { create } from 'zustand';
import { db } from '@/lib/firebase';
import type { GymProfile, GymAvailability, WeeklyRoutine, SessionLog } from './types';
import { nowIso } from '@/lib/ids';
import { clean } from '@/core/repo';

export function gymDoc(uid: string, id: 'profile' | 'availability') {
  return doc(db(), 'players', uid, 'gym', id);
}
export function routineDoc(uid: string, weekKey: string) {
  return doc(db(), 'players', uid, 'gym', 'routines', 'weeks', weekKey);
}
export function sessionLogDoc(uid: string, id: string) {
  return doc(db(), 'players', uid, 'gym', 'sessionLogs', 'items', id);
}
export function sessionLogsCol(uid: string) {
  return collection(db(), 'players', uid, 'gym', 'sessionLogs', 'items');
}

interface GymState {
  uid: string | null;
  profile: GymProfile | null;
  availability: GymAvailability | null;
  routine: WeeklyRoutine | null;
  routineWeek: string | null;
  logs: SessionLog[];
  loaded: boolean;
  bind(uid: string, weekKey: string): void;
  unbind(): void;
}

let unsubs: Unsubscribe[] = [];

export const useGym = create<GymState>((set, get) => ({
  uid: null,
  profile: null,
  availability: null,
  routine: null,
  routineWeek: null,
  logs: [],
  loaded: false,
  bind(uid, weekKey) {
    if (get().uid === uid && get().routineWeek === weekKey) return;
    get().unbind();
    set({ uid, routineWeek: weekKey, loaded: false });
    unsubs = [
      onSnapshot(gymDoc(uid, 'profile'), (s) => set({ profile: s.exists() ? (s.data() as GymProfile) : null, loaded: true })),
      onSnapshot(gymDoc(uid, 'availability'), (s) => set({ availability: s.exists() ? (s.data() as GymAvailability) : null })),
      onSnapshot(routineDoc(uid, weekKey), (s) => set({ routine: s.exists() ? (s.data() as WeeklyRoutine) : null })),
      onSnapshot(sessionLogsCol(uid), (s) => set({ logs: s.docs.map((d) => d.data() as SessionLog).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 60) })),
    ];
  },
  unbind() {
    for (const u of unsubs) u();
    unsubs = [];
    set({ uid: null, profile: null, availability: null, routine: null, routineWeek: null, logs: [], loaded: false });
  },
}));

export async function saveProfile(uid: string, profile: GymProfile): Promise<void> {
  await setDoc(gymDoc(uid, 'profile'), clean({ ...profile, updatedAt: nowIso() }));
}
export async function saveAvailability(uid: string, av: GymAvailability): Promise<void> {
  await setDoc(gymDoc(uid, 'availability'), clean({ ...av, updatedAt: nowIso() }));
}
export async function saveRoutine(uid: string, r: WeeklyRoutine): Promise<void> {
  await setDoc(routineDoc(uid, r.weekKey), clean(r));
}
export async function loadRoutine(uid: string, weekKey: string): Promise<WeeklyRoutine | null> {
  const s = await getDoc(routineDoc(uid, weekKey));
  return s.exists() ? (s.data() as WeeklyRoutine) : null;
}
export async function saveSessionLog(uid: string, log: SessionLog): Promise<void> {
  await setDoc(sessionLogDoc(uid, log.id), clean(log));
}
