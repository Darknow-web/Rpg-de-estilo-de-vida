import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { evidenceStorage, type StoredEvidence } from '@/lib/storage';
import { bytesToObjectUrl, humanBytes } from '@/lib/image';
import { EmptyState, PageHead } from '@/components/ui/primitives';

/** Galería de evidencias por misión: ver 30 fotos seguidas de tu esfuerzo es una recompensa en sí. */
export function GalleryScreen() {
  const { id } = useParams();
  const ctx = useGameContext();
  const navigate = useNavigate();
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
    <div className="screen" style={{ '--tint': 'var(--color-xp)' } as CSSProperties}>
      <PageHead title="Evidencias" onBack={() => navigate(`/missions/${id}`)} action={`${items.length} · ${humanBytes(items.reduce((s, i) => s + i.sizeBytes, 0))}`} />
      <div className="s" style={{ margin: 0 }}>
        {mission?.name ?? 'Misión'}
      </div>
      {loading && <p className="s">Cargando…</p>}
      {!loading && items.length === 0 && <EmptyState icon="camera" title="Aún no hay fotos" body="Cada misión completada deja una aquí." />}
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((it) => (
          <button key={it.id} className="relative aspect-square overflow-hidden rounded-xl bg-card-2" onClick={() => setOpen(it)}>
            {urls.get(it.id) ? <img src={urls.get(it.id)} alt={it.day} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-xs text-mute">archivada</div>}
            <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] font-semibold text-ink" style={{ background: 'linear-gradient(180deg, transparent, rgba(9,10,16,.85))' }}>
              {it.day.slice(5)}
            </div>
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <FullImage item={open} />
          <div className="mt-3 text-sm">
            {open.day} · {open.width}×{open.height} · {humanBytes(open.sizeBytes)}
          </div>
          <div className="s mt-1">Toca para cerrar</div>
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
  if (!url) return <div className="text-dim">Imagen archivada (solo miniatura)</div>;
  return <img src={url} alt={item.day} className="max-h-[75vh] max-w-full rounded-2xl object-contain" />;
}
