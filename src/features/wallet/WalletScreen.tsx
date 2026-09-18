import { useGame, useGameContext } from '@/state/game';

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

/** Wallet: historial completo e inmutable. Debe cuadrar siempre. */
export function WalletScreen() {
  const ctx = useGameContext();
  const wallet = useGame((s) => s.wallet);
  if (!ctx) return null;
  const earned = wallet.filter((w) => w.delta > 0).reduce((s, w) => s + w.delta, 0);
  const spent = wallet.filter((w) => w.delta < 0).reduce((s, w) => s - w.delta, 0);
  return (
    <div className="space-y-4 animate-fadein">
      <div className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Monedero</div>
        <div className="font-display mt-1 text-4xl text-gold">🪙 {ctx.player.economy.coins}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-mist">
          <div>Ganadas (últimas 200): <span className="text-parchment">{earned}</span></div>
          <div>Gastadas: <span className="text-parchment">{spent}</span></div>
          <div>Ritmo estimado: <span className="text-parchment">{ctx.player.economy.estimatedCoinsPerDay}/día</span></div>
          <div>Hoy: <span className="text-parchment">{ctx.player.economy.dailyCoinsDay === ctx.today ? ctx.player.economy.dailyCoinsEarned : 0}</span></div>
        </div>
      </div>
      <div className="space-y-1">
        {wallet.length === 0 && <p className="text-sm text-mist">Todavía no hay movimientos. Completa tu primera misión.</p>}
        {wallet.map((w) => (
          <div key={w.id || w.createdAt} className="flex items-center justify-between rounded-xl bg-void px-3 py-2 text-sm">
            <div>
              <div className="text-parchment">{w.note}</div>
              <div className="text-[11px] text-mist">
                {SOURCE_LABEL[w.source] ?? w.source} · {new Date(w.createdAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="text-right">
              <div className={w.delta >= 0 ? 'text-gold' : 'text-ember'}>{w.delta >= 0 ? '+' : ''}{w.delta}</div>
              <div className="text-[11px] text-mist">= {w.balanceAfter}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
