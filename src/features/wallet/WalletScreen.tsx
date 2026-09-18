import type { CSSProperties } from 'react';
import { useGame, useGameContext } from '@/state/game';
import { Icon } from '@/components/ui/Icon';
import { Card, CountUp, EmptyState, Label, PageHead } from '@/components/ui/primitives';

const SOURCE_LABEL: Record<string, string> = {
  mission: 'Misión',
  milestone: 'Hito',
  mastery: 'Dominio',
  medal: 'Medalla',
  interest: 'Interés',
  redeem: 'Canje',
  'resurrection-penalty': 'Resurrección vencida',
  chain: 'Cadena',
  boss: 'Boss',
  'day-close': 'Cierre del día',
};

/** Monedero: saldo grande, ritmo estimado, movimientos inmutables. Debe cuadrar siempre. */
export function WalletScreen() {
  const ctx = useGameContext();
  const wallet = useGame((s) => s.wallet);
  if (!ctx) return null;
  const e = ctx.player.economy;
  const today = e.dailyCoinsDay === ctx.today ? e.dailyCoinsEarned : 0;
  return (
    <div className="screen" style={{ '--tint': 'var(--color-gold)' } as CSSProperties}>
      <PageHead title="Monedero" />
      <Card style={{ textAlign: 'center' }}>
        <Label>Saldo</Label>
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 10 }}>
          <Icon id="coin" style={{ width: 30, height: 30, color: 'var(--color-gold)' }} />
          <span className="big" style={{ fontSize: 48, fontWeight: 600 }}>
            <CountUp value={e.coins} />
          </span>
        </div>
        <div className="s" style={{ marginTop: 10 }}>
          Ganas ~{e.estimatedCoinsPerDay} al día · hoy {today}
        </div>
      </Card>
      <Label right={`${wallet.length} movimientos`}>Historial</Label>
      {wallet.length === 0 ? (
        <EmptyState icon="wallet" title="Todavía no hay movimientos" body="Completa tu primera misión." />
      ) : (
        <Card tone="tight">
          <div className="list">
            {wallet.map((w) => (
              <div key={w.id || w.createdAt} className="row">
                <div className="grow">
                  <div className="t" style={{ fontSize: 14 }}>
                    {w.note}
                  </div>
                  <div className="s">
                    {SOURCE_LABEL[w.source] ?? w.source} · {new Date(w.createdAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 700, color: w.delta >= 0 ? 'var(--color-gold)' : 'var(--color-ember)' }}>
                    {w.delta >= 0 ? '+' : ''}
                    {w.delta}
                  </div>
                  <div className="s num">= {w.balanceAfter}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
