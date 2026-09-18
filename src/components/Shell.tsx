import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { FallenBanner } from '@/features/gameover/FallenBanner';
import { rankIndex } from '@/lib/game-balance';
import { Icon, type IconId } from './ui/Icon';

/** Marco de la app: contenido + dock inferior de iconos (sin etiquetas, punto bajo el activo). */
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
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col tinted">
      {!online && <div className="px-4 py-1 text-center text-[11px] text-dim">Sin conexión: tus misiones y fotos se guardan y se sincronizan al volver.</div>}
      {p.status === 'fallen' && <FallenBanner />}
      <main className="flex-1 px-4 safe-bottom">
        <Outlet />
      </main>
      <nav className="dock" aria-label="Navegación">
        <Tab to="/" icon="home" label="Hoy" />
        {showWeek && <Tab to="/week" icon="cal" label="Semana" />}
        <Tab to="/character" icon="user" label="Personaje" />
        {showSkills && <Tab to="/skills" icon="tree" label="Árbol" badge={p.level.skillPointsAvailable} />}
        {showGym && <Tab to="/gym" icon="dumbbell" label="Gimnasio" />}
        <Tab to="/shop" icon="store" label="Tienda" />
      </nav>
    </div>
  );
}

function Tab({ to, icon, label, badge }: { to: string; icon: IconId; label: string; badge?: number }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'on' : '')} aria-label={label} title={label}>
      <Icon id={icon} />
      {badge ? <span className="n" aria-label={`${badge} pendientes`} /> : null}
    </NavLink>
  );
}
