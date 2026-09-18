/**
 * Referencias y utilidades de Firestore para el subárbol players/{uid}.
 */
import { collection, doc, writeBatch, type WriteBatch, type DocumentReference, type CollectionReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type SubCollection =
  | 'missions'
  | 'completions'
  | 'failures'
  | 'evidence'
  | 'wallet'
  | 'rewards'
  | 'skills'
  | 'medals'
  | 'systemLog'
  | 'notifications'
  | 'resurrection'
  | 'pushSubscriptions'
  | 'gym';

export function playerRef(uid: string): DocumentReference {
  return doc(db(), 'players', uid);
}
export function col(uid: string, name: SubCollection): CollectionReference {
  return collection(db(), 'players', uid, name);
}
export function subDoc(uid: string, name: SubCollection, id: string): DocumentReference {
  return doc(db(), 'players', uid, name, id);
}
export function batch(): WriteBatch {
  return writeBatch(db());
}

/** Commit sin bloquear la UI: offline queda en cola; los errores se registran. */
export function commitSoon(b: WriteBatch, label: string): Promise<void> {
  return b.commit().catch((err) => {
    console.error(`[firestore] fallo en ${label}:`, err);
  });
}

/** Firestore no acepta `undefined`; limpiamos objetos antes de escribir (ignoreUndefinedProperties ayuda, pero no en arrays). */
export function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}
