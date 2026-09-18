import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { effectivePrice, frequencyBlocked, meetsRequirement, redeemReward, tierDef, proposeRepricing, applyRepricing, markConflictNoteShown, archiveReward, adjustReward } from '@/core/shop/shop';
import { Sheet } from '@/components/ui/Sheet';
import { CameraButton } from '@/components/ui/CameraButton';
import { RewardCreate } from './RewardCreate';
import type { Reward } from '@/shared/types';
import { useGame } from '@/state/game';
import { rankIndex } from '@/lib/game-balance';
import { batch, commitSoon, playerRef, clean } from '@/core/repo';

/** Tienda: precios en días de esfuerzo → monedas. Nunca vacía. Sello "precio ajustado por ti". */
export function ShopScreen() {
  const ctx = useGameContext();
  const pushFeedback = useGame((s) => s.pushFeedback);
  const [sel, setSel] = useState<Reward | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [repriceOpen, setRepriceOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState(0);
  const [editTier, setEditTier] = useState(1);

  const rewards = useMemo(() => (ctx ? ctx.rewards.filter((r) => !r.archived).sort((a, b) => a.tier - b.tier || a.priceCoins - b.priceCoins) : []), [ctx]);
  const reprice = useMemo(() => (ctx ? proposeRepricing(ctx) : []), [ctx]);

  // Oferta de re-tasación al subir de rango (una vez por rango).
  useEffect(() => {
    if (!ctx) return;
    const key = `reprice:${ctx.player.level.rank}`;
    if (rankIndex(ctx.player.level.rank) > 0 && reprice.length > 0 && !ctx.player.flags.seenIntro.includes(key)) setRepriceOpen(true);
  }, [ctx?.player.level.rank, reprice.length]);

  if (!ctx) return null;
  const p = ctx.player;

  const redeem = async (photo?: Blob) => {
    if (!sel) return;
    const r = await redeemReward(ctx, sel.id, photo);
    setMsg(r.ok ? `Canjeado: ${sel.name}. Disfrútalo.` : r.error ?? '');
    if (r.ok) {
      pushFeedback([{ kind: 'info', title: 'Canje', body: `${sel.name}. Te lo ganaste.` }]);
      setSel(null);
    }
  };

  const openReward = (r: Reward) => {
    setSel(r);
    setEditing(false);
    setEditPrice(r.priceCoins);
    setEditTier(r.tier);
    if (r.appraisal.conflictsWithGoal && !r.appraisal.noteShown) void markConflictNoteShown(ctx, r.id);
  };

  const acceptReprice = async () => {
    const safe = reprice.filter((x) => !(x.couldAfford && x.to > x.from));
    await applyRepricing(ctx, safe.map((x) => ({ rewardId: x.rewardId, to: x.to })));
    setRepriceOpen(false);
    await markSeen(`reprice:${p.level.rank}`);
  };
  const markSeen = async (key: string) => {
    const b = batch();
    b.set(playerRef(ctx.uid), clean({ ...p, flags: { ...p.flags, seenIntro: [...p.flags.seenIntro, key].slice(-40) } }));
    await commitSoon(b, 'seen');
  };

  return (
    <div className="space-y-4 animate-fadein">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl text-gold">Tienda</h1>
          <p className="text-xs text-mist">Ganas ~{p.economy.estimatedCoinsPerDay} monedas/día. Los precios son días de esfuerzo.</p>
        </div>
        <div className="text-right">
          <div className="font-display text-xl text-gold">🪙 {p.economy.coins}</div>
          <Link to="/wallet" className="text-[11px] text-mist underline">
            monedero
          </Link>
        </div>
      </div>
      {p.status === 'fallen' && <div className="rounded-xl border border-blood/50 bg-blood/10 p-3 text-sm">La tienda está cerrada mientras estás caído. Completa la resurrección.</div>}
      {msg && (
        <div className="rounded-xl bg-void p-3 text-sm text-parchment" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}
      {ctx.effects.shopDiscount > 0 && <div className="text-xs text-gold">Mercader: {Math.round(ctx.effects.shopDiscount * 100)} % de descuento aplicado.</div>}

      {[1, 2, 3, 4, 5].map((tier) => {
        const list = rewards.filter((r) => r.tier === tier);
        if (!list.length) return null;
        const def = tierDef(tier);
        const req = def.requires;
        const unlocked = !req || p.level.current >= req.level || rankIndex(p.level.rank) >= rankIndex(req.rank);
        return (
          <section key={tier}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="uppercase tracking-widest text-mist">
                {tier}. {def.name} · ~{def.effortDays} días
              </span>
              {!unlocked && req && <span className="text-mist">🔒 rango {req.rank} o nivel {req.level}</span>}
            </div>
            <div className="space-y-2">
              {list.map((r) => {
                const price = effectivePrice(r, ctx.effects.shopDiscount);
                const can = unlocked && p.economy.coins >= price && !frequencyBlocked(r, ctx.today) && p.status !== 'fallen';
                return (
                  <button key={r.id} onClick={() => openReward(r)} className={`panel flex w-full items-center justify-between p-3 text-left ${unlocked ? '' : 'opacity-60'}`}>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-parchment">{r.name}</div>
                      <div className="flex flex-wrap gap-1 text-[11px] text-mist">
                        {r.frequencyLimit && <span>{r.frequencyLimit}</span>}
                        {r.isFree && <span className="text-life">gratis</span>}
                        {r.playerAdjustedDown && <span className="rounded bg-ember/20 px-1 text-ember">precio ajustado por ti</span>}
                        {r.appraisal.reinforcesGoal && <span className="text-life">refuerza tu meta</span>}
                        {r.redemptions.length > 0 && <span>canjeada ×{r.redemptions.length}</span>}
                      </div>
                    </div>
                    <div className={`ml-2 whitespace-nowrap font-display ${can ? 'text-gold' : 'text-mist'}`}>🪙 {price}</div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <button className="btn btn-primary w-full" onClick={() => setCreating(true)}>
        + Recompensa propia (solo el nombre)
      </button>

      <Sheet open={Boolean(sel)} onClose={() => setSel(null)} title={sel?.name}>
        {sel && (
          <div className="space-y-3 text-sm">
            <div className="text-xs text-mist">
              Nivel {sel.tier} · {tierDef(sel.tier).name} · {sel.effortDays} días de esfuerzo · {sel.frequencyLimit ?? 'sin límite'}
            </div>
            <p className="text-parchment">{sel.appraisal.reasoning}</p>
            {sel.appraisal.conflictsWithGoal && sel.appraisal.conflictNote && !sel.appraisal.noteShown && <div className="rounded-xl bg-void p-3 text-xs text-mist">{sel.appraisal.conflictNote}</div>}
            {sel.playerAdjustedDown && (
              <div className="text-xs text-ember">
                Precio ajustado por ti: sugerido {sel.suggestedPrice} (nivel {sel.suggestedTier}). Puedes hacerte trampa, pero no sin saberlo.
              </div>
            )}
            {!meetsRequirement(sel, p.level.current, p.level.rank) && <div className="text-xs text-mist">Bloqueada hasta rango {tierDef(sel.tier).requires?.rank} o nivel {tierDef(sel.tier).requires?.level}, aunque te sobren monedas.</div>}
            {frequencyBlocked(sel, ctx.today) && <div className="text-xs text-mist">{frequencyBlocked(sel, ctx.today)}</div>}
            <div className="font-display text-2xl text-gold">🪙 {effectivePrice(sel, ctx.effects.shopDiscount)}</div>
            {!editing ? (
              <>
                <div className="flex gap-2">
                  <button className="btn btn-gold flex-1" disabled={!meetsRequirement(sel, p.level.current, p.level.rank) || p.economy.coins < effectivePrice(sel, ctx.effects.shopDiscount) || Boolean(frequencyBlocked(sel, ctx.today)) || p.status !== 'alive'} onClick={() => redeem()}>
                    Canjear
                  </button>
                </div>
                <CameraButton className="btn btn-ghost w-full" allowGallery={false} onPhoto={(f) => redeem(f)} disabled={!meetsRequirement(sel, p.level.current, p.level.rank) || p.economy.coins < effectivePrice(sel, ctx.effects.shopDiscount) || Boolean(frequencyBlocked(sel, ctx.today)) || p.status !== 'alive'}>
                  📸 Canjear con foto del premio
                </CameraButton>
                <div className="flex justify-between text-xs">
                  <button className="text-mist underline" onClick={() => setEditing(true)}>
                    Ajustar precio o nivel
                  </button>
                  <button className="text-mist underline" onClick={() => archiveReward(ctx, sel.id).then(() => setSel(null))}>
                    Quitar de la tienda
                  </button>
                </div>
                {sel.redemptions.length > 0 && (
                  <div className="text-[11px] text-mist">
                    Canjes: {sel.redemptions.map((r) => r.at.slice(0, 10)).join(', ')}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs text-mist">
                  Nivel
                  <select className="input mt-1" value={editTier} onChange={(e) => setEditTier(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map((t) => (
                      <option key={t} value={t}>
                        {t} · {tierDef(t).name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-mist">
                  Precio en monedas (sugerido {sel.suggestedPrice})
                  <input type="number" className="input mt-1" value={editPrice} min={1} onChange={(e) => setEditPrice(Number(e.target.value))} />
                </label>
                {(editPrice < sel.suggestedPrice || editTier < sel.suggestedTier) && <div className="text-xs text-ember">Por debajo de lo sugerido: llevará el sello "precio ajustado por ti" y cuenta en tu perfil.</div>}
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm flex-1" onClick={() => adjustReward(ctx, sel.id, { priceCoins: editPrice, tier: editTier }).then(() => setSel(null))}>
                    Guardar
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nueva recompensa" tall>
        <RewardCreate onDone={() => setCreating(false)} />
      </Sheet>

      <Sheet open={repriceOpen} onClose={() => { setRepriceOpen(false); void markSeen(`reprice:${p.level.rank}`); }} title={`Rango ${p.level.rank}: re-tasar la tienda`}>
        <p className="text-sm text-mist">Ahora ganas más por día. Si no re-tasamos, los precios quedan ridículamente baratos. Es una oferta: nunca subimos lo que ya podías pagar sin avisarte.</p>
        <ul className="mt-3 space-y-1 text-sm">
          {reprice.map((x) => (
            <li key={x.rewardId} className="flex justify-between">
              <span className="text-parchment">{x.name}</span>
              <span className={x.couldAfford && x.to > x.from ? 'text-mist line-through' : 'text-gold'}>
                {x.from} → {x.to}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-mist">Las tachadas ya podías pagarlas: se mantienen.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary flex-1" onClick={acceptReprice}>
            Re-tasar
          </button>
          <button className="btn btn-ghost" onClick={() => { setRepriceOpen(false); void markSeen(`reprice:${p.level.rank}`); }}>
            Dejar así
          </button>
        </div>
      </Sheet>
    </div>
  );
}
