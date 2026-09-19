import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '@/state/game';
import { batch, commitSoon, playerRef, clean } from '@/core/repo';
import { Icon, type IconId } from '@/components/ui/Icon';
import { IconSquare } from '@/components/ui/primitives';
import { STREAK, MASTERY, HEARTS, QUOTAS } from '@/lib/game-balance';

interface Slide {
  icon: IconId;
  color: string;
  kicker: string;
  title: string;
  lines: string[];
}

const SLIDES: Slide[] = [
  {
    icon: 'home',
    color: 'var(--color-xp)',
    kicker: 'Pestaña Hoy',
    title: 'Para hoy',
    lines: [
      'Tus misiones del día, cada una con su hora. El anillo del icono es el tiempo que queda; se pone dorado en la última media hora.',
      'Se completa con una foto. Si la ventana cierra sin foto, pierdes un corazón (hay unas horas de gracia a mitad de XP).',
      `Con ${HEARTS.MAX_DEFAULT} corazones empiezas; a 0 caes y una misión de resurrección te trae de vuelta. Nunca se borra tu progreso.`,
    ],
  },
  {
    icon: 'cal',
    color: 'var(--color-system)',
    kicker: 'Pestaña Semana',
    title: 'Semana y Agenda',
    lines: [
      'Carga: cuántos minutos de misiones tiene cada día de la semana, para no saturarte.',
      'Agenda: conecta tu Google Calendar y verás tus compromisos aquí. Marca uno y gana XP por llegar a tiempo.',
      'Agregar pendientes: foto de tu lista o escríbelos; el Sistema los acomoda en tus huecos, te pregunta lo que falte y, cuando confirmes, van a tu calendario.',
    ],
  },
  {
    icon: 'user',
    color: 'var(--color-arcane)',
    kicker: 'Pestañas Personaje y Árbol',
    title: 'Nivel, rango y árbol',
    lines: [
      'Cada misión da XP: sube tu nivel general y el atributo de esa área (Fuerza, Disciplina, Intelecto, Riqueza, Vitalidad).',
      'Rangos D → C → B → A → S por nivel. Cada rango abre un cupo más de misiones y tipos nuevos.',
      'Árbol: 1 punto por nivel. Cada rama pide un nivel mínimo de su atributo. Cada nodo cambia una regla real del juego.',
    ],
  },
  {
    icon: 'dumbbell',
    color: 'var(--color-fuerza)',
    kicker: 'Pestaña Gimnasio',
    title: 'Rutina con tu equipo',
    lines: [
      'Dices qué gimnasio tienes (o le tomas fotos a las máquinas), marcas tus huecos libres y la app arma la rutina de la semana.',
      'Cada sesión se hace desde la app: series, peso, descansos, guía del ejercicio. Cierras con foto y cuenta como misión del día.',
      `A los ${MASTERY.consolidated.days} días el Sistema propone subir series o peso. Si no vas al gimnasio, oculta la pestaña en Ajustes.`,
    ],
  },
  {
    icon: 'store',
    color: 'var(--color-gold)',
    kicker: 'Pestaña Tienda',
    title: 'Monedas y premios',
    lines: [
      'Cada misión da monedas. Los premios los pones tú (una siesta, unas zapatillas, un viaje) y el Tasador les pone precio según el esfuerzo.',
      'Canjeas cuando alcanzas el precio. Los precios nunca bajan solos y tu monedero nunca se borra.',
      'Al subir de rango se abren escalones de premios más grandes.',
    ],
  },
  {
    icon: 'flame',
    color: 'var(--color-ember)',
    kicker: 'Racha',
    title: 'Racha y días imposibles',
    lines: [
      'Un día limpio (todo hecho, nada vencido) suma racha y regenera un corazón.',
      `Tienes ${STREAK.impossibleDaysPerMonth} días imposibles al mes: tócalos desde la tarjeta de racha y ese día no cuenta ni castiga.`,
      `Medallas de racha a los ${STREAK.medalDays.join(', ')} días. Empiezas con ${QUOTAS.daily.start} a 5 misiones; el cupo crece dominándolas.`,
    ],
  },
];

/** Tutorial de bienvenida: 6 tarjetas deslizables, se muestra una vez tras aceptar la campaña y se puede reabrir desde Ajustes. */
export function Tutorial() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const first = params.get('first') === '1';
  const player = useGame((s) => s.player);
  const uid = useGame((s) => s.uid);
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const last = i === SLIDES.length - 1;

  const go = (n: number) => {
    const k = Math.max(0, Math.min(SLIDES.length - 1, n));
    setI(k);
    track.current?.scrollTo({ left: k * track.current.clientWidth, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let t = 0;
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))), 80);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const finish = async () => {
    if (uid && player && !player.flags.tutorialDone) {
      const next = structuredClone(player);
      next.flags.tutorialDone = true;
      const b = batch();
      b.set(playerRef(uid), clean(next));
      await commitSoon(b, 'tutorialDone');
    }
    navigate('/', { replace: true });
  };

  const s = SLIDES[i];
  return (
    <div className="tinted mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-6 pt-4" style={{ '--tint': s.color } as CSSProperties}>
      <div className="head center">
        <span className="title">{first ? 'Antes de empezar' : 'Tutorial'}</span>
        <button className="act" style={{ background: 'none', border: 0, color: 'var(--color-dim)', cursor: 'pointer' }} onClick={() => void finish()}>
          Saltar
        </button>
      </div>
      <div className="tut" ref={track} aria-live="polite">
        {SLIDES.map((sl, k) => (
          <section key={sl.title} className="tut-slide" aria-hidden={k !== i}>
            <div className="sysalert" style={{ '--c': sl.color, borderColor: `color-mix(in srgb, ${sl.color} 55%, transparent)`, boxShadow: `0 0 40px color-mix(in srgb, ${sl.color} 16%, transparent)` } as CSSProperties}>
              <div className="top" style={{ color: sl.color, borderColor: `color-mix(in srgb, ${sl.color} 30%, transparent)` }}>
                <span className="dots">
                  <i style={{ background: sl.color }} />
                  <i style={{ background: sl.color }} />
                  <i style={{ background: sl.color }} />
                </span>
                {sl.kicker}
              </div>
              <div className="body" style={{ textAlign: 'left' }}>
                <IconSquare icon={sl.icon} color={sl.color} size="lg" className="mx-auto" />
                <div className="h mt-3 text-center" style={{ letterSpacing: '.06em', fontSize: 18 }}>
                  {sl.title}
                </div>
                <ul className="mt-3 flex flex-col gap-3" style={{ margin: '12px 0 0', padding: 0, listStyle: 'none' }}>
                  {sl.lines.map((l) => (
                    <li key={l} className="row" style={{ alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.45 }}>
                      <Icon id="check" style={{ width: 16, height: 16, flex: 'none', marginTop: 3, color: sl.color }} />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>
      <div className="row mt-4" style={{ justifyContent: 'center', gap: 6 }} aria-label={`Tarjeta ${i + 1} de ${SLIDES.length}`}>
        {SLIDES.map((sl, k) => (
          <button key={sl.title} type="button" className="tut-dot" style={{ background: k === i ? s.color : 'var(--color-track)', width: k === i ? 18 : 6 }} onClick={() => go(k)} aria-label={sl.title} />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        {i > 0 && (
          <button className="btn ghost auto" onClick={() => go(i - 1)}>
            Atrás
          </button>
        )}
        {last ? (
          <button className="btn gold" onClick={() => void finish()}>
            {first ? 'Empezar a jugar' : 'Listo'}
          </button>
        ) : (
          <button className="btn system" onClick={() => go(i + 1)}>
            Siguiente
          </button>
        )}
      </div>
      <div className="s text-center mt-3" style={{ margin: 0 }}>
        Lo puedes volver a ver en Ajustes → Ayuda.
      </div>
    </div>
  );
}
