import { useEffect } from 'react';
import { useGame } from '@/state/game';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { playSound } from '@/lib/sound';

/** Cola de feedback: recompensa, subida de nivel, rango, medalla… Una a la vez, con animación y sonido. */
export function FeedbackOverlay() {
  const ev = useGame((s) => s.feedback[0]);
  const shift = useGame((s) => s.shiftFeedback);

  useEffect(() => {
    if (!ev) return;
    const sound = ev.kind === 'levelUp' || ev.kind === 'rankUp' ? 'levelup' : ev.kind === 'reward' || ev.kind === 'chain' || ev.kind === 'medal' ? 'reward' : ev.kind === 'heartsLost' || ev.kind === 'fallen' ? 'hurt' : 'soft';
    playSound(sound);
    const ms = ev.kind === 'reward' ? 1700 : ev.kind === 'levelUp' || ev.kind === 'rankUp' ? 2600 : 2200;
    const t = setTimeout(shift, ms);
    return () => clearTimeout(t);
  }, [ev, shift]);

  if (!ev) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" onClick={shift}>
      <div className="pointer-events-auto mx-6 w-full max-w-sm">
        {ev.kind === 'reward' && (
          <div className="panel panel-glow p-5 text-center animate-pop">
            <div className="font-display text-2xl text-gold">+{ev.xp} XP</div>
            <div className="mt-1 text-sm" style={{ color: ATTRIBUTE_META[ev.attribute].color }}>
              {ATTRIBUTE_META[ev.attribute].icon} {ATTRIBUTE_META[ev.attribute].name}
            </div>
            <div className="mt-2 text-lg text-gold">🪙 +{ev.coins}</div>
            {ev.capped > 0 && <div className="mt-1 text-xs text-mist">Tope diario alcanzado: {ev.capped} monedas no entraron. Mañana se reinicia.</div>}
            {ev.bonuses.length > 0 && <div className="mt-2 flex flex-wrap justify-center gap-1">{ev.bonuses.map((b) => <span key={b} className="chip chip-active">{b}</span>)}</div>}
          </div>
        )}
        {ev.kind === 'levelUp' && (
          <div className="panel p-6 text-center animate-levelup" style={{ borderColor: 'var(--color-gold)', boxShadow: 'var(--shadow-gold)' }}>
            <div className="text-xs uppercase tracking-[0.3em] text-mist">Subiste de nivel</div>
            <div className="font-display mt-2 text-6xl text-gold">{ev.level}</div>
            {ev.skillPoints > 0 && <div className="mt-2 text-sm text-arcane-glow">+{ev.skillPoints} punto{ev.skillPoints > 1 ? 's' : ''} de habilidad</div>}
          </div>
        )}
        {ev.kind === 'rankUp' && (
          <div className="panel p-6 text-center animate-levelup" style={{ borderColor: 'var(--color-gold)', boxShadow: 'var(--shadow-gold)' }}>
            <div className="text-xs uppercase tracking-[0.3em] text-mist">Nuevo rango</div>
            <div className="font-display mt-2 text-7xl text-gold">{ev.rank}</div>
            <div className="mt-1 text-sm text-parchment">{ev.title}</div>
            <div className="mt-2 text-xs text-mist">+1 cupo · +1 punto de habilidad · nuevas categorías · +1 reinicio de árbol</div>
          </div>
        )}
        {ev.kind === 'medal' && (
          <div className="panel p-5 text-center animate-pop" style={{ borderColor: 'var(--color-gold)' }}>
            <div className="text-4xl">🏅</div>
            <div className="font-display mt-1 text-lg text-gold">{ev.title}</div>
          </div>
        )}
        {ev.kind === 'mastery' && (
          <div className="panel panel-glow p-5 text-center animate-pop">
            <div className="text-xs uppercase tracking-widest text-mist">Dominio</div>
            <div className="font-display mt-1 text-xl text-arcane-glow">{{ new: 'Nueva', progress: 'En progreso', consolidated: 'Consolidada', mastered: 'Dominada', automated: 'Automatizada' }[ev.state]}</div>
            <div className="mt-1 text-sm text-parchment">{ev.missionName}</div>
          </div>
        )}
        {ev.kind === 'chain' && (
          <div className="panel p-5 text-center animate-levelup" style={{ borderColor: 'var(--color-gold)' }}>
            <div className="text-xs uppercase tracking-widest text-mist">Ráfaga de hito</div>
            <div className="font-display mt-1 text-3xl text-gold">+{ev.xp} XP</div>
            <div className="text-gold">🪙 +{ev.coins}</div>
          </div>
        )}
        {ev.kind === 'heartsLost' && (
          <div className="panel p-5 text-center animate-shake" style={{ borderColor: 'var(--color-blood)' }}>
            <div className="text-3xl text-blood">{'♥'.repeat(ev.amount)}</div>
            <div className="mt-1 text-sm text-parchment">−{ev.amount} por "{ev.missionName}"</div>
          </div>
        )}
        {ev.kind === 'fallen' && (
          <div className="panel p-6 text-center animate-pop" style={{ borderColor: 'var(--color-blood)' }}>
            <div className="font-display text-3xl text-blood">HAS CAÍDO</div>
            <div className="mt-2 text-sm text-mist">Sin corazones. La resurrección te espera en Hoy.</div>
          </div>
        )}
        {ev.kind === 'revived' && (
          <div className="panel p-6 text-center animate-levelup" style={{ borderColor: 'var(--color-life)' }}>
            <div className="font-display text-3xl text-life">RENACES</div>
            <div className="mt-2 text-sm text-parchment">{ev.hearts} corazones. El juego sigue.</div>
          </div>
        )}
        {ev.kind === 'hidden' && (
          <div className="panel panel-glow p-5 text-center animate-pop">
            <div className="text-xs uppercase tracking-widest text-mist">Misión oculta revelada</div>
            <div className="font-display mt-1 text-lg text-arcane-glow">{ev.missionName}</div>
          </div>
        )}
        {ev.kind === 'info' && (
          <div className="panel p-4 text-center animate-fadein">
            <div className="text-sm font-semibold text-gold">{ev.title}</div>
            <div className="mt-1 text-sm text-parchment">{ev.body}</div>
          </div>
        )}
      </div>
    </div>
  );
}
