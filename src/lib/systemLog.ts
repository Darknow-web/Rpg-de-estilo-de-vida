/**
 * Historial de "qué hizo el sistema y por qué". Toda acción automática queda aquí,
 * es reversible cuando se puede, y el jugador puede revisarla.
 */
import { doc, setDoc, updateDoc, type WriteBatch } from 'firebase/firestore';
import { db } from './firebase';
import { newId, nowIso } from './ids';
import type { SystemLogEntry } from '@/shared/types';

export function buildLogEntry(action: string, reason: string, opts: { reversible?: boolean; undoPayload?: Record<string, unknown> } = {}): SystemLogEntry {
  return {
    id: newId('log'),
    at: nowIso(),
    action,
    reason,
    reversible: Boolean(opts.reversible),
    undoPayload: opts.undoPayload,
  };
}

export function logRef(uid: string, id: string) {
  return doc(db(), 'players', uid, 'systemLog', id);
}

/** Agrega la entrada a un batch (para que quede atómica con la acción). */
export function logInBatch(batch: WriteBatch, uid: string, entry: SystemLogEntry) {
  batch.set(logRef(uid, entry.id), entry);
}

export async function logSystem(uid: string, action: string, reason: string, opts?: { reversible?: boolean; undoPayload?: Record<string, unknown> }) {
  const entry = buildLogEntry(action, reason, opts);
  await setDoc(logRef(uid, entry.id), entry);
  return entry;
}

export async function markUndone(uid: string, id: string) {
  await updateDoc(logRef(uid, id), { undoneAt: nowIso() });
}
