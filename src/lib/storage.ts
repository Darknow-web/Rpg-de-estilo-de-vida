/**
 * Capa de abstracción para las fotos de evidencia.
 *
 * Backend por defecto: bytes en Firestore (`players/{uid}/evidence/{id}`), porque Cloud Storage
 * for Firebase exige plan Blaze desde febrero de 2026 y la capa Starter no lo incluye.
 * Cuando actives Blaze, cambia EVIDENCE_BACKEND a 'cloud-storage' e implementa el adaptador:
 * el resto de la app no cambia.
 */
import { Bytes, doc, getDoc, setDoc, updateDoc, deleteField, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { EvidenceRecord } from '@/shared/types';
import { EVIDENCE } from './game-balance';
import { compressImage } from './image';

export type EvidenceBackend = 'firestore-bytes' | 'cloud-storage';
export const EVIDENCE_BACKEND: EvidenceBackend = (import.meta.env.VITE_EVIDENCE_BACKEND as EvidenceBackend) || 'firestore-bytes';

export interface StoredEvidence extends EvidenceRecord {
  bytes: Uint8Array | null;
  thumb: Uint8Array | null;
}

export interface EvidenceStorage {
  /** Guarda una foto ya comprimida. Devuelve el registro. */
  save(uid: string, input: { id: string; missionId: string; completionId: string; day: string; bytes: Uint8Array; thumb: Uint8Array; width: number; height: number }): Promise<EvidenceRecord>;
  get(uid: string, evidenceId: string): Promise<StoredEvidence | null>;
  listForMission(uid: string, missionId: string, max?: number): Promise<StoredEvidence[]>;
  /** Archivar: conserva miniatura, borra la imagen grande. Reversible: no (la imagen grande se pierde). */
  archive(uid: string, evidenceId: string): Promise<void>;
}

function evidenceDoc(uid: string, id: string) {
  return doc(db(), 'players', uid, 'evidence', id);
}

function fromSnap(id: string, data: Record<string, unknown>): StoredEvidence {
  const b = data.bytes as Bytes | undefined;
  const t = data.thumb as Bytes | undefined;
  return {
    id,
    missionId: data.missionId as string,
    completionId: data.completionId as string,
    day: data.day as string,
    mime: (data.mime as string) ?? 'image/jpeg',
    width: (data.width as number) ?? 0,
    height: (data.height as number) ?? 0,
    sizeBytes: (data.sizeBytes as number) ?? 0,
    archived: Boolean(data.archived),
    createdAt: (data.createdAt as string) ?? '',
    bytes: b ? b.toUint8Array() : null,
    thumb: t ? t.toUint8Array() : null,
  };
}

const firestoreBytesStorage: EvidenceStorage = {
  async save(uid, input) {
    const record: EvidenceRecord = {
      id: input.id,
      missionId: input.missionId,
      completionId: input.completionId,
      day: input.day,
      mime: 'image/jpeg',
      width: input.width,
      height: input.height,
      sizeBytes: input.bytes.byteLength,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    // setDoc funciona offline: queda en cola y se sube al reconectar.
    void setDoc(evidenceDoc(uid, input.id), {
      ...record,
      bytes: Bytes.fromUint8Array(input.bytes),
      thumb: Bytes.fromUint8Array(input.thumb),
    });
    return record;
  },
  async get(uid, evidenceId) {
    const snap = await getDoc(evidenceDoc(uid, evidenceId));
    if (!snap.exists()) return null;
    return fromSnap(snap.id, snap.data());
  },
  async listForMission(uid, missionId, max = 60) {
    const q = query(collection(db(), 'players', uid, 'evidence'), where('missionId', '==', missionId), orderBy('day', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromSnap(d.id, d.data()));
  },
  async archive(uid, evidenceId) {
    await updateDoc(evidenceDoc(uid, evidenceId), { archived: true, bytes: deleteField(), sizeBytes: 0 });
  },
};

/** Adaptador para Cloud Storage for Firebase. Se activa cuando el proyecto tenga plan Blaze. */
const cloudStorageAdapter: EvidenceStorage = {
  async save() {
    throw new Error('CloudStorageAdapter: activa el plan Blaze y completa src/lib/storage.ts (ver docs/DEPLOY.md).');
  },
  async get() {
    throw new Error('CloudStorageAdapter no implementado');
  },
  async listForMission() {
    throw new Error('CloudStorageAdapter no implementado');
  },
  async archive() {
    throw new Error('CloudStorageAdapter no implementado');
  },
};

export const evidenceStorage: EvidenceStorage = EVIDENCE_BACKEND === 'cloud-storage' ? cloudStorageAdapter : firestoreBytesStorage;

/** Prepara una foto (imagen grande + miniatura) desde un archivo de cámara o galería. */
export async function prepareEvidence(file: Blob): Promise<{ bytes: Uint8Array; thumb: Uint8Array; width: number; height: number }> {
  const big = await compressImage(file);
  const small = await compressImage(big.blob, EVIDENCE.thumbLongSide, EVIDENCE.thumbQuality);
  return { bytes: big.bytes, thumb: small.bytes, width: big.width, height: big.height };
}
