import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { evidenceStorage } from '@/lib/storage';
import { addDays } from '@/lib/time';
import type { GameContext } from '@/core/context';
import { batch, commitSoon, playerRef, clean } from '@/core/repo';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';

/** Archiva evidencias antiguas: conserva miniatura, borra la imagen grande. Con aprobación del jugador. */
export async function archiveOldEvidence(ctx: GameContext, olderThanDays: number): Promise<number> {
  const cutoff = addDays(ctx.today, -olderThanDays);
  const q = query(collection(db(), 'players', ctx.uid, 'evidence'), where('archived', '==', false), orderBy('day', 'asc'), limit(200));
  const snap = await getDocs(q);
  let n = 0;
  let freed = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if ((data.day as string) >= cutoff) continue;
    try {
      await evidenceStorage.archive(ctx.uid, d.id);
      n++;
      freed += (data.sizeBytes as number) ?? 0;
    } catch {
      /* continúa */
    }
  }
  if (n > 0) {
    const b = batch();
    const p = structuredClone(ctx.player);
    p.stats.evidenceBytes = Math.max(0, p.stats.evidenceBytes - freed);
    b.set(playerRef(ctx.uid), clean(p));
    logInBatch(b, ctx.uid, buildLogEntry('evidence_archived', `Archivaste ${n} evidencias de más de ${olderThanDays} días para liberar espacio (${Math.round(freed / 1024)} KB). Las miniaturas se conservan.`));
    await commitSoon(b, 'archiveEvidence');
  }
  return n;
}
