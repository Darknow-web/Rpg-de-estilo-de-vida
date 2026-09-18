import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
import { Icon, type IconId } from '@/components/ui/Icon';
import { Card, CountUp, IconSquare, Label, Notice, Pill } from '@/components/ui/primitives';

const TIER_ICON: IconId[] = ['moon', 'gem', 'star', 'flag', 'crown'];
const TIER_COLOR = ['var(--color-vitalidad)', 'var(--color-system)', 'var(--color-arcane)', 'var(--color-ember)', 'var(--color-gold)'];

/** Tienda: escalones como secciones con etiqueta y candado, filas con precio; sello "precio ajustado por ti". */
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
  const [redeemed, setRedeemed] = useState(false);

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
    if (!r.ok) {
      setMsg(r.error ?? '');
      return;
    }
    setRedeemed(true);
    setTimeout(() => {
      setRedeemed(false);
      setSel(null);
      pushFeedback([{ kind: 'info', title: 'Canje', body: `${sel.name}. Te lo ganaste.` }]);
    }, 1100);
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

  const canRedeem = (r: Reward) => meetsRequirement(r, p.level.current, p.level.rank) && p.economy.coins >= effectivePrice(r, ctx.effects.shopDiscount) && !frequencyBlocked(r, ctx.today) && p.status === 'alive';

  return (
    <div className="screen" style={{ '--tint': 'var(--color-gold)' } as CSSProperties}>
      <div className="head center">
        <span className="title">Tienda</span>
        <Link to="/wallet" className="act" aria-label="Monedero">
          <Icon id="wallet" style={{ width: 20, height: 20 }} />
        </Link>
      </div>
      <Card className="row">
        <div className="grow s" style={{ margin: 0 }}>
          Ganas ~{p.economy.estimatedCoinsPerDay} monedas al día. Los precios son días de esfuerzo.
          {ctx.effects.shopDiscount > 0 && <span style={{ color: 'var(--color-gold)' }}> Mercader: −{Math.round(ctx.effects.shopDiscount * 100)} %.</span>}
        </div>
        <Pill tone="gold" icon="coin">
          <CountUp value={p.economy.coins} />
        </Pill>
      </Card>
      {p.status === 'fallen' && (
        <Notice tone="danger" icon="skull">
          La tienda está cerrada mientras estás caído. Completa la resurrección.
        </Notice>
      )}
      {msg && (
        <Notice tone="sys" icon="spark">
          <span onClick={() => setMsg(null)}>{msg}</span>
        </Notice>
      )}

      {[1, 2, 3, 4, 5].map((tier) => {
        const list = rewards.filter((r) => r.tier === tier);
        if (!list.length) return null;
        const def = tierDef(tier);
        const req = def.requires;
        const unlocked = !req || p.level.current >= req.level || rankIndex(p.level.rank) >= rankIndex(req.rank);
        return (
          <section key={tier} className="flex flex-col gap-2">
            <Label
              right={
                !unlocked && req ? (
                  <span className="row" style={{ gap: 4 }}>
                    <Icon id="lock" />
                    Rango {req.rank} · Nv {req.level}
                  </span>
                ) : (
                  `~${def.effortDays} días`
                )
              }
            >
              {tier}. {def.name}
            </Label>
            <Card tone="tight" style={{ opacity: unlocked ? 1 : 0.6 }}>
              <div className="list">
                {list.map((r) => {
                  const price = effectivePrice(r, ctx.effects.shopDiscount);
                  const can = unlocked && canRedeem(r);
                  return (
                    <button key={r.id} type="button" onClick={() => openReward(r)} className="row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}>
                      <IconSquare icon={TIER_ICON[tier - 1]} color={TIER_COLOR[tier - 1]} size="sm" />
                      <div className="grow">
                        <div className="t truncate" style={{ fontSize: 14 }}>
                          {r.name}
                        </div>
                        <div className="s row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {r.frequencyLimit && <span>{r.frequencyLimit}</span>}
                          {r.isFree && <span style={{ color: 'var(--color-xp)' }}>gratis</span>}
                          {r.appraisal.reinforcesGoal && <span style={{ color: 'var(--color-xp)' }}>refuerza tu meta</span>}
                          {r.redemptions.length > 0 && <span>×{r.redemptions.length}</span>}
                          {r.playerAdjustedDown && <span className="stamp">precio ajustado por ti</span>}
                        </div>
                      </div>
                      <span className={`price ${can ? '' : 'dim'} num`}>
                        <Icon id="coin" />
                        {price.toLocaleString('es')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </section>
        );
      })}

      {reprice.length > 0 && !repriceOpen && rankIndex(p.level.rank) > 0 && (
        <Card tone="sys">
          <Label>
            <span style={{ color: 'var(--color-system)' }}>Rango {p.level.rank} · re-tasar la tienda</span>
          </Label>
          <div className="s mt-2">Ahora ganas más por día. Es una oferta: nunca subimos lo que ya podías pagar sin avisarte.</div>
          <button className="btn system sm auto mt-3" onClick={() => setRepriceOpen(true)}>
            Ver propuesta
          </button>
        </Card>
      )}

      <button className="btn" onClick={() => setCreating(true)}>
        <Icon id="plus" />
        Recompensa propia (solo el nombre)
      </button>

      <Sheet open={Boolean(sel)} onClose={() => setSel(null)} title={sel?.name}>
        {sel && (
          <div className="space-y-3 text-sm" style={{ position: 'relative' }}>
            {redeemed && (
              <div className="ov" style={{ position: 'absolute', inset: -20, zIndex: 2, pointerEvents: 'none' }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="coinfly" style={{ left: `${30 + i * 8}%`, top: '55%', '--dx': `${(i - 2.5) * 30}px`, animationDelay: `${i * 0.06}s` } as CSSProperties} />
                ))}
                <div className="mid pop" style={{ textAlign: 'center' }}>
                  <IconSquare icon="check" color="var(--color-xp)" size="lg" className="mx-auto" />
                </div>
              </div>
            )}
            <div className="s" style={{ margin: 0 }}>
              Nivel {sel.tier} · {tierDef(sel.tier).name} · {sel.effortDays} días de esfuerzo · {sel.frequencyLimit ?? 'sin límite'}
            </div>
            <p>{sel.appraisal.reasoning}</p>
            {sel.appraisal.conflictsWithGoal && sel.appraisal.conflictNote && !sel.appraisal.noteShown && <Notice tone="sys">{sel.appraisal.conflictNote}</Notice>}
            {sel.playerAdjustedDown && (
              <div className="s" style={{ color: 'var(--color-ember)' }}>
                Precio ajustado por ti: sugerido {sel.suggestedPrice} (nivel {sel.suggestedTier}). Puedes hacerte trampa, pero no sin saberlo.
              </div>
            )}
            {!meetsRequirement(sel, p.level.current, p.level.rank) && (
              <div className="s row" style={{ gap: 4 }}>
                <Icon id="lock" />
                Bloqueada hasta rango {tierDef(sel.tier).requires?.rank} o nivel {tierDef(sel.tier).requires?.level}, aunque te sobren monedas.
              </div>
            )}
            {frequencyBlocked(sel, ctx.today) && <div className="s">{frequencyBlocked(sel, ctx.today)}</div>}
            <div className="row" style={{ gap: 8, fontSize: 30, fontWeight: 600, color: 'var(--color-gold)' }}>
              <Icon id="coin" style={{ width: 24, height: 24 }} />
              <span className="num">{effectivePrice(sel, ctx.effects.shopDiscount).toLocaleString('es')}</span>
            </div>
            {!editing ? (
              <>
                <button className="btn gold" disabled={!canRedeem(sel) || redeemed} onClick={() => redeem()}>
                  Canjear
                </button>
                <CameraButton className="btn ghost" allowGallery={false} onPhoto={(f) => redeem(f)} disabled={!canRedeem(sel) || redeemed}>
                  Canjear con foto del premio
                </CameraButton>
                <div className="flex justify-between text-xs text-dim">
                  <button className="underline" onClick={() => setEditing(true)}>
                    Ajustar precio o nivel
                  </button>
                  <button className="underline" onClick={() => archiveReward(ctx, sel.id).then(() => setSel(null))}>
                    Quitar de la tienda
                  </button>
                </div>
                {sel.redemptions.length > 0 && <div className="s">Canjes: {sel.redemptions.map((r) => r.at.slice(0, 10)).join(', ')}</div>}
              </>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs text-dim">
                  Nivel
                  <select className="input mt-1" value={editTier} onChange={(e) => setEditTier(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map((t) => (
                      <option key={t} value={t}>
                        {t} · {tierDef(t).name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-dim">
                  Precio en monedas (sugerido {sel.suggestedPrice})
                  <input type="number" className="input mt-1" value={editPrice} min={1} onChange={(e) => setEditPrice(Number(e.target.value))} />
                </label>
                {(editPrice < sel.suggestedPrice || editTier < sel.suggestedTier) && <div className="s" style={{ color: 'var(--color-ember)' }}>Por debajo de lo sugerido: llevará el sello "precio ajustado por ti" y cuenta en tu perfil.</div>}
                <div className="flex gap-2">
                  <button className="btn system sm" onClick={() => adjustReward(ctx, sel.id, { priceCoins: editPrice, tier: editTier }).then(() => setSel(null))}>
                    Guardar
                  </button>
                  <button className="btn ghost sm auto" onClick={() => setEditing(false)}>
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

      <Sheet
        open={repriceOpen}
        onClose={() => {
          setRepriceOpen(false);
          void markSeen(`reprice:${p.level.rank}`);
        }}
        title={`Rango ${p.level.rank}: re-tasar la tienda`}
      >
        <p className="s">Ahora ganas más por día. Si no re-tasamos, los precios quedan ridículamente baratos. Es una oferta: nunca subimos lo que ya podías pagar sin avisarte.</p>
        <div className="card tight list mt-3">
          {reprice.map((x) => (
            <div key={x.rewardId} className="row">
              <span className="grow">{x.name}</span>
              <span className="num" style={x.couldAfford && x.to > x.from ? { color: 'var(--color-mute)', textDecoration: 'line-through' } : { color: 'var(--color-gold)', fontWeight: 700 }}>
                {x.from} → {x.to}
              </span>
            </div>
          ))}
        </div>
        <p className="s mt-2">Las tachadas ya podías pagarlas: se mantienen.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn system" onClick={acceptReprice}>
            Re-tasar
          </button>
          <button
            className="btn ghost auto"
            onClick={() => {
              setRepriceOpen(false);
              void markSeen(`reprice:${p.level.rank}`);
            }}
          >
            Dejar así
          </button>
        </div>
      </Sheet>
    </div>
  );
}
