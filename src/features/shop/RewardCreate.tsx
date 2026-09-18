import { useState } from 'react';
import { useGameContext } from '@/state/game';
import { appraise, type Appraisal } from '@/core/shop/appraiser';
import { createReward, tierDef } from '@/core/shop/shop';
import { rewardPrice } from '@/lib/game-balance';

/** El jugador escribe solo el nombre. El tasador propone nivel, precio y razonamiento. El jugador puede ajustar. */
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
          <label className="block text-xs text-mist">
            Foto (opcional)
            <input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          <button className="btn btn-primary w-full" onClick={run} disabled={busy || name.trim().length < 2}>
            {busy ? 'Tasando…' : 'Tasar'}
          </button>
          <p className="text-[11px] text-mist">El tasador propone nivel, precio y límite con su razonamiento. Tú decides.</p>
        </>
      ) : (
        <>
          <div className="rounded-xl bg-void p-3">
            <div className="text-xs text-mist">Tasación {ap.source === 'ai' ? 'con IA' : 'local'}</div>
            <div className="mt-1 font-semibold text-parchment">{name}</div>
            <div className="mt-1 text-parchment">{ap.razonamiento}</div>
            {ap.conflicto_con_meta && ap.nota_de_conflicto && <div className="mt-2 text-xs text-mist">{ap.nota_de_conflicto}</div>}
            {ap.refuerza_meta && <div className="mt-1 text-xs text-life">Refuerza tu campaña.</div>}
            {ap.posible_duplicado_de && <div className="mt-1 text-xs text-ember">Parece duplicar "{ap.posible_duplicado_de}".</div>}
            <div className="mt-2 text-xs text-mist">
              Sugerido: nivel {ap.nivel_sugerido} ({tierDef(ap.nivel_sugerido).name}) · {ap.dias_de_esfuerzo} días · 🪙 {ap.precio_en_monedas}
              {ap.nivel_o_rango_minimo ? ` · requiere rango ${ap.nivel_o_rango_minimo.rank} o nivel ${ap.nivel_o_rango_minimo.level}` : ''}
              {ap.limite_de_frecuencia ? ` · ${ap.limite_de_frecuencia}` : ''}
            </div>
          </div>
          <label className="block text-xs text-mist">
            Nivel
            <select className="input mt-1" value={tier} onChange={(e) => changeTier(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((t) => (
                <option key={t} value={t}>
                  {t} · {tierDef(t).name} (~{tierDef(t).effortDays} días)
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-mist">
            Precio en monedas
            <input type="number" className="input mt-1" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </label>
          <label className="block text-xs text-mist">
            Límite de frecuencia
            <select className="input mt-1" value={limit ?? ''} onChange={(e) => setLimit(e.target.value || null)}>
              <option value="">Sin límite</option>
              <option value="1 por día">1 por día</option>
              <option value="1 por semana">1 por semana</option>
              <option value="1 por mes">1 por mes</option>
            </select>
          </label>
          {(price < ap.precio_en_monedas || tier < ap.nivel_sugerido) && <div className="text-xs text-ember">Por debajo de lo sugerido: la recompensa llevará el sello "precio ajustado por ti" y sumará a tu estadística. No te lo impedimos; solo lo hacemos visible.</div>}
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={save} disabled={busy}>
              Guardar en la tienda
            </button>
            <button className="btn btn-ghost" onClick={() => setAp(null)}>
              Volver
            </button>
          </div>
        </>
      )}
    </div>
  );
}
