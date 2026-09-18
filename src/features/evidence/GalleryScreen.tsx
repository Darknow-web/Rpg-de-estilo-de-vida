import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { evidenceStorage, type StoredEvidence } from '@/lib/storage';
import { bytesToObjectUrl, humanBytes } from '@/lib/image';

/** Galería de evidencias por misión: ver 30 fotos seguidas de tu esfuerzo es una recompensa en sí. */
export function GalleryScreen() {
  const { id } = useParams();
  const ctx = useGameContext();
  const [items, setItems] = useState<StoredEvidence[]>([]);
  const [open, setOpen] = useState<StoredEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const mission = ctx?.missions.find((m) => m.id === id);

  useEffect(() => {
    if (!ctx || !id) return;
    setLoading(true);
    evidenceStorage
      .listForMission(ctx.uid, id, 90)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [ctx?.uid, id]);

  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) {
      const b = it.thumb ?? it.bytes;
      if (b) map.set(it.id, bytesToObjectUrl(b));
    }
    return map;
  }, [items]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  if (!ctx) return null;
  return (
    <div className="space-y-3 animate-fadein">
      <div>
        <Link to={`/missions/${id}`} className="text-xs text-mist">
          ← {mission?.name ?? 'Misión'}
        </Link>
        <h1 className="font-display text-xl text-gold">Galería de evidencias</h1>
        <p className="text-xs text-mist">{items.length} fotos · {humanBytes(items.reduce((s, i) => s + i.sizeBytes, 0))}</p>
      </div>
      {loading && <p className="text-sm text-mist">Cargando…</p>}
      {!loading && items.length === 0 && <p className="text-sm text-mist">Aún no hay fotos. Cada misión completada deja una aquí.</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((it) => (
          <button key={it.id} className="relative aspect-square overflow-hidden rounded-lg bg-void" onClick={() => setOpen(it)}>
            {urls.get(it.id) ? <img src={urls.get(it.id)} alt={it.day} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-xs text-mist">archivada</div>}
            <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-parchment">{it.day.slice(5)}</div>
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <FullImage item={open} />
          <div className="mt-3 text-sm text-parchment">{open.day} · {open.width}×{open.height} · {humanBytes(open.sizeBytes)}</div>
          <div className="mt-1 text-xs text-mist">Toca para cerrar</div>
        </div>
      )}
    </div>
  );
}

function FullImage({ item }: { item: StoredEvidence }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const b = item.bytes ?? item.thumb;
    if (!b) return;
    const u = bytesToObjectUrl(b);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item]);
  if (!url) return <div className="text-mist">Imagen archivada (solo miniatura)</div>;
  return <img src={url} alt={item.day} className="max-h-[75vh] max-w-full rounded-xl object-contain" />;
}
