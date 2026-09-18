import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { TopBar } from './TopBar';
import { FallenBanner } from '@/features/gameover/FallenBanner';
import { rankIndex } from '@/lib/game-balance';

export function Shell() {
  const ctx = useGameContext();
  const online = useGame((s) => s.online);
  const location = useLocation();
  if (!ctx) return null;
  const p = ctx.player;
  const showSkills = p.level.skillPointsEarned > 0 || p.flags.unlockedViews.includes('skills') || p.flags.advancedMode;
  const showWeek = rankIndex(p.level.rank) >= 1 || p.flags.unlockedViews.includes('week') || p.flags.advancedMode || p.stats.missionsCompleted >= 5;
  const showGym = p.flags.unlockedViews.includes('gym') || location.pathname.startsWith('/gym');

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col">
      <TopBar />
      {!online && <div className="bg-steel px-4 py-1 text-center text-[11px] text-mist">Sin conexión: tus misiones y fotos se guardan y se sincronizan al volver.</div>}
      {p.status === 'fallen' && <FallenBanner />}
      <main className="flex-1 px-4 pt-3 safe-bottom">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-lg items-stretch justify-around border-t border-steel bg-void/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Tab to="/" icon="🗡️" label="Hoy" />
        {showWeek && <Tab to="/week" icon="📅" label="Semana" />}
        <Tab to="/character" icon="🧬" label="Personaje" />
        {showSkills && <Tab to="/skills" icon="🌳" label="Árbol" badge={p.level.skillPointsAvailable} />}
        {showGym && <Tab to="/gym" icon="🏋️" label="Gym" />}
        <Tab to="/shop" icon="🏪" label="Tienda" />
      </nav>
    </div>
  );
}

function Tab({ to, icon, label, badge }: { to: string; icon: string; label: string; badge?: number }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `relative flex min-w-[56px] flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-gold' : 'text-mist'}`}>
      <span className="text-xl leading-none">{icon}</span>
      <span>{label}</span>
      {badge ? <span className="absolute right-2 top-1 rounded-full bg-ember px-1.5 text-[10px] font-bold text-white">{badge}</span> : null}
    </NavLink>
  );
}
