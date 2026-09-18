import { useEffect, useState } from 'react';
import { useGameContext } from '@/state/game';
import { appraise, type Appraisal } from '@/core/shop/appraiser';
import { createReward, tierDef } from '@/core/shop/shop';
import { rewardPrice } from '@/lib/game-balance';
import { Icon } from '@/components/ui/Icon';
import { Card, Chip, Label, Notice } from '@/components/ui/primitives';

/** El jugador escribe solo el nombre. El tasador propone nivel, precio y razonamiento (escrito letra a letra). El jugador puede ajustar. */
export function RewardCreate({ onDone }: { onDone: () => void }) {
  const ctx = useGameContext();
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [ap, setAp] = useState<Appraisal | null>(null);
  const [tier, setTier] = useState(1);
  const [price, setPrice] = useState(0);
  const [limit, setLimit] = useState<string | null>(null);
  if (!ctx) return null;

  const run = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const a = await appraise(ctx, name.trim());
      setAp(a);
      setTier(a.nivel_sugerido);
      setPrice(a.precio_en_monedas);
      setLimit(a.limite_de_frecuencia);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!ap) return;
    setBusy(true);
    try {
      await createReward(ctx, name, ap, { tier, priceCoins: price, frequencyLimit: limit }, photo ?? undefined);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const changeTier = (t: number) => {
    setTier(t);
    setPrice(rewardPrice(tierDef(t).effortDays, ctx.player.economy.estimatedCoinsPerDay));
  };

  return (
    <div className="space-y-3 text-sm">
      {!ap ? (
        <>
          <input className="input" placeholder="¿Qué quieres poder canjear? (solo el nombre)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <label className="block text-xs text-dim">
            Foto (opcional)
            <input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <button className="btn system" onClick={run} disabled={busy || name.trim().length < 2}>
            <Icon id="scale" />
            {busy ? 'Tasando…' : 'Tasar'}
          </button>
          <p className="s">El tasador propone nivel, precio y límite con su razonamiento. Tú decides.</p>
        </>
      ) : (
        <>
          <Card tone="sys">
            <Label right={ap.source === 'ai' ? 'IA' : 'local'}>Tasación {ap.source === 'ai' ? 'con IA' : 'local'}</Label>
            <div className="t mt-2">{name}</div>
            <div className="row mt-2" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Chip color="var(--color-gold)">Nivel {ap.nivel_sugerido} · {tierDef(ap.nivel_sugerido).name}</Chip>
              <Chip color="var(--color-dim)">{ap.dias_de_esfuerzo} días</Chip>
              <Chip color="var(--color-gold)" icon="coin">
                {ap.precio_en_monedas}
              </Chip>
              {ap.limite_de_frecuencia && <Chip color="var(--color-dim)">{ap.limite_de_frecuencia}</Chip>}
            </div>
            <Typewriter text={ap.razonamiento} className="s mt-3 italic" />
            {ap.conflicto_con_meta && ap.nota_de_conflicto && <div className="s mt-2">{ap.nota_de_conflicto}</div>}
            {ap.refuerza_meta && <div className="s mt-1" style={{ color: 'var(--color-xp)' }}>Refuerza tu campaña.</div>}
            {ap.posible_duplicado_de && <div className="s mt-1" style={{ color: 'var(--color-ember)' }}>Parece duplicar "{ap.posible_duplicado_de}".</div>}
            {ap.nivel_o_rango_minimo && <div className="s mt-1">Requiere rango {ap.nivel_o_rango_minimo.rank} o nivel {ap.nivel_o_rango_minimo.level}.</div>}
          </Card>
          <label className="block text-xs text-dim">
            Nivel
            <select className="input mt-1" value={tier} onChange={(e) => changeTier(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((t) => (
                <option key={t} value={t}>
                  {t} · {tierDef(t).name} (~{tierDef(t).effortDays} días)
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-dim">
            Precio en monedas
            <input type="number" className="input mt-1" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </label>
          <label className="block text-xs text-dim">
            Límite de frecuencia
            <select className="input mt-1" value={limit ?? ''} onChange={(e) => setLimit(e.target.value || null)}>
              <option value="">Sin límite</option>
              <option value="1 por día">1 por día</option>
              <option value="1 por semana">1 por semana</option>
              <option value="1 por mes">1 por mes</option>
            </select>
          </label>
          {(price < ap.precio_en_monedas || tier < ap.nivel_sugerido) && (
            <Notice tone="danger">Por debajo de lo sugerido: la recompensa llevará el sello "precio ajustado por ti" y sumará a tu estadística. No te lo impedimos; solo lo hacemos visible.</Notice>
          )}
          <div className="flex gap-2">
            <button className="btn gold" onClick={save} disabled={busy}>
              Guardar en la tienda
            </button>
            <button className="btn ghost auto" onClick={() => setAp(null)}>
              Volver
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Texto que aparece letra a letra (máquina de escribir corta). */
export function Typewriter({ text, className, speed = 14 }: { text: string; className?: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setN(text.length);
      return;
    }
    let i = 0;
    const t = setInterval(() => {
      i += 2;
      setN(i);
      if (i >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return <div className={className}>{text.slice(0, n)}</div>;
}
