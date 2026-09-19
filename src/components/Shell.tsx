import { NavLink, Outlet } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { FallenBanner } from '@/features/gameover/FallenBanner';
import { Icon, type IconId } from './ui/Icon';

/** Pestañas que el jugador puede ocultar desde Ajustes. Hoy, Personaje y Tienda siempre se ven. */
export const OPTIONAL_VIEWS = [
  { id: 'week', label: 'Semana y Agenda' },
  { id: 'skills', label: 'Árbol de habilidades' },
  { id: 'gym', label: 'Gimnasio' },
] as const;

export function isViewHidden(hidden: string[] | undefined, id: string): boolean {
  return Boolean(hidden?.includes(id));
}

/** Marco de la app: contenido + dock inferior de iconos (sin etiquetas, punto bajo el activo). Las 6 pestañas se ven desde el primer día. */
export function Shell() {
  const ctx = useGameContext();
  const online = useGame((s) => s.online);
  if (!ctx) return null;
  const p = ctx.player;
  const hidden = p.flags.hiddenViews;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col tinted">
      {!online && <div className="px-4 py-1 text-center text-[11px] text-dim">Sin conexión: tus misiones y fotos se guardan y se sincronizan al volver.</div>}
      {p.status === 'fallen' && <FallenBanner />}
      <main className="flex-1 px-4 safe-bottom">
        <Outlet />
      </main>
      <nav className="dock" aria-label="Navegación">
        <Tab to="/" icon="home" label="Hoy" />
        {!isViewHidden(hidden, 'week') && <Tab to="/week" icon="cal" label="Semana" />}
        <Tab to="/character" icon="user" label="Personaje" />
        {!isViewHidden(hidden, 'skills') && <Tab to="/skills" icon="tree" label="Árbol" badge={p.level.skillPointsAvailable} />}
        {!isViewHidden(hidden, 'gym') && <Tab to="/gym" icon="dumbbell" label="Gimnasio" />}
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
