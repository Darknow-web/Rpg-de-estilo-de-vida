import { useEffect, useState, type CSSProperties } from 'react';
import { useGame } from '@/state/game';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { playSound } from '@/lib/sound';
import { Icon } from './ui/Icon';
import { ATTR_ICON, ATTR_VAR, Chip, CountUp, IconSquare, Label, MedalShield, RANK_VAR } from './ui/primitives';
import type { FeedbackEvent } from '@/core/context';

const DURATION: Record<FeedbackEvent['kind'], number> = { reward: 1700, levelUp: 3400, rankUp: 3400, medal: 2800, mastery: 2200, chain: 2200, heartsLost: 1800, fallen: 2800, revived: 2600, hidden: 2400, info: 2000 };

/** Cola de feedback: recompensa, subida de nivel, rango, medalla… Una a la vez, en intensidad media. */
export function FeedbackOverlay() {
  const ev = useGame((s) => s.feedback[0]);
  const shift = useGame((s) => s.shiftFeedback);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (!ev) return;
    setOut(false);
    const sound = ev.kind === 'levelUp' || ev.kind === 'rankUp' ? 'levelup' : ev.kind === 'reward' || ev.kind === 'chain' || ev.kind === 'medal' ? 'reward' : ev.kind === 'heartsLost' || ev.kind === 'fallen' ? 'hurt' : 'soft';
    playSound(sound);
    const dur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur')) || 1;
    const ms = DURATION[ev.kind] / dur;
    const t1 = setTimeout(() => setOut(true), ms);
    const t2 = setTimeout(shift, ms + 320 / dur);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ev, shift]);

  if (!ev) return null;
  const full = ev.kind === 'levelUp' || ev.kind === 'rankUp' || ev.kind === 'medal' || ev.kind === 'fallen' || ev.kind === 'revived';
  return (
    <div className={`ov ${out ? 'out' : ''}`} onClick={() => setOut(true)} role="status" aria-live="polite">
      {full && <div className="dim" />}
      {ev.kind === 'heartsLost' && <div className="vignette" />}
      {ev.kind === 'fallen' && <div className="vignette hold" />}
      {(ev.kind === 'levelUp' || ev.kind === 'rankUp' || ev.kind === 'medal') && <Particles color={ev.kind === 'rankUp' ? RANK_VAR[ev.rank] : 'var(--color-gold)'} />}

      {ev.kind === 'reward' && (
        <div className="mid">
          <div className="card active pop" style={{ textAlign: 'center' }}>
            <Label className="text-xp!">
              <span style={{ color: 'var(--color-xp)' }}>Misión completada</span>
            </Label>
            <div className="gain">
              <div className="g xp">
                <div className="big">
                  +<CountUp value={ev.xp} />
                </div>
                <div className="label">XP · {ATTRIBUTE_META[ev.attribute].name}</div>
              </div>
              <div className="g gold">
                <div className="big">
                  +<CountUp value={ev.coins} />
                </div>
                <div className="label">Monedas</div>
              </div>
            </div>
            {ev.capped > 0 && <div className="s" style={{ marginTop: 10 }}>Tope diario alcanzado: {ev.capped} monedas no entraron. Mañana se reinicia.</div>}
            {ev.bonuses.length > 0 && (
              <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                {ev.bonuses.map((b) => (
                  <Chip key={b} color={b === 'con adelanto' ? 'var(--color-gold)' : 'var(--color-xp)'}>
                    {b}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {(ev.kind === 'levelUp' || ev.kind === 'rankUp') && (
        <div className="lvup" style={{ '--c': ev.kind === 'rankUp' ? RANK_VAR[ev.rank] : 'var(--color-gold)' } as CSSProperties}>
          <div className="ringwrap">
            <svg viewBox="0 0 170 170">
              <circle cx="85" cy="85" r="80" fill="none" stroke="var(--color-track)" strokeWidth="3" />
              <circle className="p" cx="85" cy="85" r="80" fill="none" stroke="var(--c)" strokeWidth="3" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px var(--c))' }} />
            </svg>
            {ev.kind === 'levelUp' ? (
              <div className="n">
                <CountUp value={ev.level} />
              </div>
            ) : (
              <div className="n" style={{ color: 'var(--c)' }}>
                {ev.rank}
              </div>
            )}
          </div>
          <div className="words">
            {ev.kind === 'levelUp' ? (
              <>
                <span>Nivel</span>
                <span>{ev.level}</span>
              </>
            ) : (
              <>
                <span>Rango</span>
                <span>{ev.rank}</span>
              </>
            )}
          </div>
          <div className="sub">{ev.kind === 'levelUp' ? (ev.skillPoints > 0 ? `+${ev.skillPoints} punto${ev.skillPoints > 1 ? 's' : ''} de habilidad` : 'Sigue así.') : `${ev.title} · +1 cupo · +1 punto de habilidad · +1 reinicio de árbol`}</div>
          <div className="flare" />
        </div>
      )}

      {ev.kind === 'medal' && (
        <div className="mid">
          <div className="medal-pop pop">
            <div className="shine">
              <div className="art">
                <MedalShield metal="gold" glyph="check" />
              </div>
            </div>
            <Label>
              <span style={{ color: 'var(--color-gold)' }}>Nueva medalla</span>
            </Label>
            <div className="t" style={{ fontSize: 20 }}>
              {ev.title}
            </div>
          </div>
        </div>
      )}

      {ev.kind === 'mastery' && (
        <div className="mid">
          <div className="card pop" style={{ textAlign: 'center', borderColor: 'rgba(56,242,215,.35)' }}>
            <Label>Dominio</Label>
            <div className="t" style={{ fontSize: 20, marginTop: 6, color: 'var(--color-xp)' }}>
              {{ new: 'Nueva', progress: 'En progreso', consolidated: 'Consolidada', mastered: 'Dominada', automated: 'Automatizada' }[ev.state]}
            </div>
            <div className="s">{ev.missionName}</div>
          </div>
        </div>
      )}

      {ev.kind === 'chain' && (
        <div className="mid">
          <div className="card gold pop" style={{ textAlign: 'center' }}>
            <Label>Ráfaga de hito</Label>
            <div className="big" style={{ color: 'var(--color-gold)', marginTop: 8 }}>
              +<CountUp value={ev.xp} /> XP
            </div>
            <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 6, color: 'var(--color-gold)', fontWeight: 700 }}>
              <Icon id="coin" style={{ width: 16, height: 16 }} /> +{ev.coins}
            </div>
          </div>
        </div>
      )}

      {ev.kind === 'heartsLost' && (
        <div className="mid">
          <div className="card danger pop row">
            <IconSquare icon="vital" color="var(--color-hp)" />
            <div className="grow">
              <div className="t">−{ev.amount} corazón{ev.amount > 1 ? 'es' : ''}</div>
              <div className="s">"{ev.missionName}" venció.</div>
            </div>
          </div>
        </div>
      )}

      {ev.kind === 'fallen' && (
        <div className="mid">
          <div className="card danger pop" style={{ textAlign: 'center' }}>
            <div className="sysalert" style={{ boxShadow: 'none', border: 0 }}>
              <div className="top" style={{ color: 'var(--color-hp)', borderColor: 'rgba(255,59,92,.3)' }}>
                <span className="dots">
                  <i style={{ background: 'var(--color-hp)' }} />
                  <i style={{ background: 'var(--color-hp)' }} />
                  <i style={{ background: 'var(--color-hp)' }} />
                </span>
                Alerta del Sistema
              </div>
              <div className="body">
                <div className="h" style={{ color: 'var(--color-hp)' }}>
                  Has caído
                </div>
                <div className="p">Sin corazones. La resurrección te espera en Hoy.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {ev.kind === 'revived' && (
        <div className="lvup" style={{ '--c': 'var(--color-xp)' } as CSSProperties}>
          <div className="ringwrap">
            <svg viewBox="0 0 170 170">
              <circle cx="85" cy="85" r="80" fill="none" stroke="var(--color-track)" strokeWidth="3" />
              <circle className="p" cx="85" cy="85" r="80" fill="none" stroke="var(--c)" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <Icon id="phoenix" style={{ width: 72, height: 72, color: 'var(--color-xp)' }} />
          </div>
          <div className="words">
            <span>Renaces</span>
          </div>
          <div className="sub">{ev.hearts} corazones. El juego sigue.</div>
          <div className="flare" />
        </div>
      )}

      {ev.kind === 'hidden' && (
        <div className="mid">
          <div className="card active pop" style={{ textAlign: 'center' }}>
            <Label>Misión oculta revelada</Label>
            <div className="t reveal" style={{ fontSize: 20, marginTop: 6 }}>
              {ev.missionName}
            </div>
          </div>
        </div>
      )}

      {ev.kind === 'info' && (
        <div className="mid" style={{ top: 24, transform: 'none' }}>
          <div className="card sys pop row">
            <IconSquare icon="spark" color="var(--color-system)" size="sm" />
            <div className="grow">
              <div className="t" style={{ fontSize: 14 }}>
                {ev.title}
              </div>
              <div className="s">{ev.body}</div>
            </div>
          </div>
        </div>
      )}

      {ev.kind === 'reward' && (
        <span className="sr-only">
          {ev.xp} XP, {ev.coins} monedas, {ATTRIBUTE_META[ev.attribute].name}
          <Icon id={ATTR_ICON[ev.attribute]} style={{ color: ATTR_VAR[ev.attribute] }} />
        </span>
      )}
    </div>
  );
}

function Particles({ color }: { color: string }) {
  const seeds = [10, 22, 35, 48, 60, 72, 85, 30, 66, 52, 15, 90];
  return (
    <div className="parts" style={{ '--c': color } as CSSProperties} aria-hidden="true">
      {seeds.map((left, i) => (
        <span key={i} style={{ left: `${left}%`, '--sx': `${((i % 5) - 2) * 10}px`, animationDelay: `${(i * 0.17) % 2}s` } as CSSProperties} />
      ))}
    </div>
  );
}
