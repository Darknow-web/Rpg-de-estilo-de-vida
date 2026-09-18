import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { levelProgress } from '@/core/character/player';
import { Hearts } from './ui/Hearts';

export function TopBar() {
  const ctx = useGameContext();
  if (!ctx) return null;
  const p = ctx.player;
  const lp = levelProgress(p.level.totalXp);
  const xpToday = ctx.completions.filter((c) => c.day === ctx.today && c.status !== 'annulled').reduce((s, c) => s + c.xpAwarded, 0);
  const coinsToday = p.economy.dailyCoinsDay === ctx.today ? p.economy.dailyCoinsEarned : 0;
  return (
    <header className="sticky top-0 z-20 border-b border-steel bg-void/95 px-4 pb-2 pt-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <Link to="/character" className="flex items-center gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-sm ${rankClass(p.level.rank)}`}>{p.level.rank}</div>
          <div>
            <div className="text-xs text-mist">Nv. {lp.level} · {p.class?.name ?? 'Sin clase'}</div>
            <div className="bar mt-1 w-28">
              <div className="bg-arcane" style={{ width: `${Math.round(lp.fraction * 100)}%` }} />
            </div>
          </div>
        </Link>
        <Hearts current={p.hearts.current} max={p.hearts.max} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-mist">
        <span>
          <span className="text-arcane-glow">✦ {xpToday} XP</span> hoy
        </span>
        <span>
          <span className="text-gold">🪙 {coinsToday}</span> hoy · <span className="text-parchment">{p.economy.coins}</span> total
        </span>
        <span>
          🔥 <span className="text-parchment">{p.streak.current}</span> racha
        </span>
      </div>
    </header>
  );
}

export function rankClass(rank: string): string {
  return {
    D: 'border-mist text-mist',
    C: 'border-frost text-frost',
    B: 'border-life text-life',
    A: 'border-arcane-glow text-arcane-glow shadow-glow',
    S: 'border-gold text-gold shadow-gold',
  }[rank] ?? 'border-mist text-mist';
}
