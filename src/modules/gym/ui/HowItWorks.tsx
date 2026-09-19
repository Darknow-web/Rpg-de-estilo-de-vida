import { useState, type CSSProperties } from 'react';
import { Icon, type IconId } from '@/components/ui/Icon';
import { Card, IconSquare } from '@/components/ui/primitives';
import { MASTERY } from '@/lib/game-balance';

const STEPS: { icon: IconId; title: string; body: string }[] = [
  { icon: 'store', title: 'Dices qué gimnasio tienes', body: 'De barrio, cadena o en casa. Marcas el equipo en la lista o le tomas fotos a las máquinas y el espacio: la IA reconoce lo que hay y tú confirmas. Las fotos no se guardan.' },
  { icon: 'cal', title: 'Marcas tus huecos libres', body: 'Bloques de la semana en los que sí puedes ir. El deporte fijo que ya haces (fútbol, natación…) también cuenta y se respeta.' },
  { icon: 'flag', title: 'La app arma la rutina de la semana', body: 'Coloca sesiones de 25 a 60 min en tus huecos, usando solo tu equipo, y reparte empuje, tracción, pierna, core y cardio. Sin IA: es un generador local, gratis y sin internet.' },
  { icon: 'dumbbell', title: 'Cada sesión se hace en la app', body: 'Series, repeticiones y peso (recuerda el último), temporizador de descanso y guía de cada ejercicio. Al terminar, foto y listo: es tu misión de gimnasio del día.' },
  { icon: 'star', title: 'Progresas como con cualquier misión', body: `Cumplir sube Fuerza y tu nivel general. A los ${MASTERY.consolidated.days} días la sesión se consolida y el Sistema te propone más series o más peso. Fallar cuesta un corazón, igual que las demás.` },
];

/** Tarjeta plegable que explica el módulo de gimnasio en 5 pasos. */
export function HowItWorks({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card tone={open ? undefined : 'tight'} style={{ '--c': 'var(--color-fuerza)' } as CSSProperties}>
      <button type="button" className="row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', padding: open ? 0 : '10px 0', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <IconSquare icon="book" color="var(--color-fuerza)" size="sm" />
        <div className="grow">
          <div className="t" style={{ fontSize: 14 }}>
            Cómo funciona el gimnasio
          </div>
          <div className="s">5 pasos · 1 minuto</div>
        </div>
        <Icon id="chev" className="chev" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .2s' }} />
      </button>
      {open && (
        <ol className="mt-3 flex flex-col gap-3" style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
          {STEPS.map((s, i) => (
            <li key={s.title} className="row" style={{ alignItems: 'flex-start' }}>
              <span className="rank" style={{ '--c': 'var(--color-fuerza)', width: 26, height: 26, fontSize: 12 } as CSSProperties}>
                {i + 1}
              </span>
              <div className="grow">
                <div className="row" style={{ gap: 6, fontWeight: 700, fontSize: 14 }}>
                  <Icon id={s.icon} style={{ width: 14, height: 14, color: 'var(--color-fuerza)' }} />
                  {s.title}
                </div>
                <div className="s">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
