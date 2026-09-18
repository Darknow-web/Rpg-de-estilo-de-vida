import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconId } from './Icon';
import type { AttributeId, ClassId } from '@/shared/types';

export const ATTR_ICON: Record<AttributeId, IconId> = { fuerza: 'dumbbell', disciplina: 'shield', intelecto: 'book', riqueza: 'gem', vitalidad: 'vital' };
export const ATTR_VAR: Record<AttributeId, string> = { fuerza: 'var(--color-fuerza)', disciplina: 'var(--color-disciplina)', intelecto: 'var(--color-intelecto)', riqueza: 'var(--color-riqueza)', vitalidad: 'var(--color-vitalidad)' };
export const CLASS_ICON: Record<ClassId, IconId> = { guerrero: 'sword', erudito: 'book', asceta: 'flame', mercader: 'coin', sanador: 'vital', vagabundo: 'flag' };
export const CLASS_VAR: Record<ClassId, string> = { guerrero: 'var(--color-fuerza)', erudito: 'var(--color-intelecto)', asceta: 'var(--color-disciplina)', mercader: 'var(--color-riqueza)', sanador: 'var(--color-vitalidad)', vagabundo: '#c9cfdd' };
export const RANK_VAR: Record<string, string> = { D: 'var(--color-rank-d)', C: 'var(--color-rank-c)', B: 'var(--color-rank-b)', A: 'var(--color-rank-a)', S: 'var(--color-rank-s)' };

/** Ruta pública del arte generado (WebP en public/art). `null` mientras no exista: los componentes caen al SVG. */
export function artUrl(name: string): string {
  return `/art/${name}.webp`;
}

/** Imagen opcional con respaldo: si el archivo no existe, muestra el SVG hijo. */
export function ArtOrFallback({ name, alt, children, className }: { name: string; alt: string; children: ReactNode; className?: string }) {
  const [ok, setOk] = useState<boolean | null>(() => (typeof window !== 'undefined' && artCache.has(name) ? artCache.get(name)! : null));
  useEffect(() => {
    if (ok !== null) return;
    const img = new Image();
    img.onload = () => {
      artCache.set(name, true);
      setOk(true);
    };
    img.onerror = () => {
      artCache.set(name, false);
      setOk(false);
    };
    img.src = artUrl(name);
  }, [name, ok]);
  if (ok) return <img src={artUrl(name)} alt={alt} className={className} loading="lazy" />;
  return <>{children}</>;
}
const artCache = new Map<string, boolean>();

export function Card({ children, className = '', tone, onClick, style }: { children: ReactNode; className?: string; tone?: 'active' | 'danger' | 'sys' | 'gold' | 'tight'; onClick?: () => void; style?: CSSProperties }) {
  return (
    <div className={`card ${tone ?? ''} ${className}`} onClick={onClick} style={style} role={onClick ? 'button' : undefined}>
      {children}
    </div>
  );
}

export function Label({ children, right, className = '' }: { children: ReactNode; right?: ReactNode; className?: string }) {
  if (right === undefined) return <div className={`label ${className}`}>{children}</div>;
  return (
    <div className={`label row ${className}`}>
      <span>{children}</span>
      <span>{right}</span>
    </div>
  );
}

export function IconSquare({ icon, color, size, className = '' }: { icon: IconId; color: string; size?: 'sm' | 'lg'; className?: string }) {
  return (
    <div className={`isq ${size ?? ''} ${className}`} style={{ '--c': color } as CSSProperties}>
      <Icon id={icon} />
    </div>
  );
}

export function Pill({ children, tone = 'soft', icon, className = '' }: { children: ReactNode; tone?: 'gold' | 'xp' | 'soft'; icon?: IconId; className?: string }) {
  return (
    <span className={`pill ${tone} ${className}`}>
      {icon && <Icon id={icon} style={tone === 'soft' && icon === 'coin' ? { color: 'var(--color-gold)' } : undefined} />}
      {children}
    </span>
  );
}

export function Chip({ children, color = 'var(--color-system)', icon, ghost, className = '' }: { children: ReactNode; color?: string; icon?: IconId; ghost?: boolean; className?: string }) {
  return (
    <span className={`chip ${ghost ? 'ghost' : ''} ${className}`} style={{ '--c': color } as CSSProperties}>
      {icon && <Icon id={icon} />}
      {children}
    </span>
  );
}

/** Barra con etiqueta a la izquierda, porcentaje a la derecha y min/max debajo. */
export function Bar({ value, max = 100, color, thin, label, right, minmax, className = '' }: { value: number; max?: number; color?: string; thin?: boolean; label?: ReactNode; right?: ReactNode; minmax?: [ReactNode, ReactNode]; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  return (
    <div className={className}>
      {(label !== undefined || right !== undefined) && (
        <div className="meta" style={{ marginBottom: 8 }}>
          <span>{label}</span>
          <b className="num">{right ?? `${pct} %`}</b>
        </div>
      )}
      <div className={`bar ${thin ? 'thin' : ''}`} style={color ? ({ '--c': color } as CSSProperties) : undefined}>
        <i style={{ width: `${w}%` }} />
      </div>
      {minmax && (
        <div className="meta mm num">
          <span>{minmax[0]}</span>
          <span>{minmax[1]}</span>
        </div>
      )}
    </div>
  );
}

export function RankSquare({ rank, size, lock, glow, className = '' }: { rank: string; size?: 'lg' | 'xl'; lock?: boolean; glow?: boolean; className?: string }) {
  return (
    <ArtOrFallback name={`rank-${rank.toLowerCase()}`} alt={`Rango ${rank}`} className={`rank ${size ?? ''} ${lock ? 'lock' : ''} ${className}`}>
      <span className={`rank ${size ?? ''} ${lock ? 'lock' : ''} ${glow ? 'glow' : ''} ${className}`} style={{ '--c': RANK_VAR[rank] ?? RANK_VAR.D } as CSSProperties}>
        {rank}
      </span>
    </ArtOrFallback>
  );
}

export function RankLadder({ current }: { current: string }) {
  const ranks = ['D', 'C', 'B', 'A', 'S'];
  return (
    <div className="ladder">
      {ranks.map((r, i) => (
        <span key={r} style={{ display: 'contents' }}>
          {i > 0 && <span className="sep" />}
          <span className={`rank ${r === current ? 'now' : ''}`} style={{ '--c': RANK_VAR[r] } as CSSProperties}>
            {r}
          </span>
        </span>
      ))}
    </div>
  );
}

export type MedalMetal = 'bronze' | 'silver' | 'gold' | 'C' | 'B' | 'A' | 'S';
const METAL_FILL: Record<MedalMetal, string> = { bronze: 'url(#gBronze)', silver: 'url(#gSilver)', gold: 'url(#gGold)', C: 'url(#gC)', B: 'url(#gB)', A: 'url(#gA)', S: 'url(#gGold)' };
const GLYPH_INK: Record<MedalMetal, string> = { bronze: '#3a1c08', silver: '#2a2f3d', gold: '#5a3a00', C: '#0b1f4d', B: '#2a1259', A: '#4d1a05', S: '#5a3a00' };

/** Escudo de medalla con símbolo del set; `art` es el nombre del PNG generado si existe. */
export function MedalShield({ metal, glyph, letter, lock, art, className = '' }: { metal: MedalMetal; glyph?: IconId; letter?: string; lock?: boolean; art?: string; className?: string }) {
  const ink = GLYPH_INK[metal];
  const inner = (
    <svg viewBox="0 0 44 50" className={className}>
      <use href="#shield" fill={METAL_FILL[metal]} />
      {letter ? (
        <text x="22" y="32" textAnchor="middle" fontSize="20" fontWeight="800" fill={ink} fontFamily="inherit">
          {letter}
        </text>
      ) : glyph ? (
        <g transform="translate(12 13) scale(0.85)" color={ink}>
          <use href={`#i-${glyph}`} width="24" height="24" />
        </g>
      ) : null}
    </svg>
  );
  if (!art || lock) return inner;
  return (
    <ArtOrFallback name={art} alt="" className={className}>
      {inner}
    </ArtOrFallback>
  );
}

export function ClassMedallion({ classId, size, className = '' }: { classId: ClassId | null; size?: 'lg'; className?: string }) {
  const color = classId ? CLASS_VAR[classId] : 'var(--color-arcane)';
  return (
    <div className={`medallion ${size ?? ''} ${className}`} style={{ '--c': color } as CSSProperties}>
      <span className="ring2" />
      <span className="ring" />
      <div className="core">
        {classId ? (
          <ArtOrFallback name={`class-${classId}`} alt="">
            <svg viewBox="0 0 80 80">
              <use href="#emblem" />
            </svg>
          </ArtOrFallback>
        ) : (
          <svg viewBox="0 0 80 80">
            <use href="#emblem" />
          </svg>
        )}
      </div>
    </div>
  );
}

/** Número que cuenta desde el valor anterior hasta el nuevo (600 ms). */
export function CountUp({ value, format, className = '' }: { value: number; format?: (v: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const dur = 600 / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur')) || 1);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`num ${className}`}>{format ? format(shown) : shown.toLocaleString('es')}</span>;
}

/** Cabecera centrada con botón atrás y acción opcional a la derecha. */
export function PageHead({ title, action, back = true, onBack }: { title: string; action?: ReactNode; back?: boolean; onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="head center">
      {back && (
        <button className="back" aria-label="Volver" onClick={onBack ?? (() => (window.history.length > 1 ? navigate(-1) : navigate('/')))}>
          <Icon id="back" />
        </button>
      )}
      <span className="title">{title}</span>
      {action && <span className="act">{action}</span>}
    </div>
  );
}

/** Fila compacta: icono tintado, título, subtítulo, valor a la derecha. */
export function Row({ icon, color, title, sub, right, to, onClick, chevron, strike }: { icon?: IconId; color?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; to?: string; onClick?: () => void; chevron?: boolean; strike?: boolean }) {
  const inner = (
    <>
      {icon && <IconSquare icon={icon} color={color ?? 'var(--color-system)'} size="sm" />}
      <div className="grow">
        <div className="t" style={{ fontSize: 14, color: strike ? 'var(--color-dim)' : undefined, textDecoration: strike ? 'line-through' : undefined }}>
          {title}
        </div>
        {sub && <div className="s">{sub}</div>}
      </div>
      {right}
      {chevron && <Icon id="chev" className="chev" />}
    </>
  );
  if (to) return <Link to={to} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>{inner}</Link>;
  if (onClick)
    return (
      <button type="button" className="row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', padding: 0, cursor: 'pointer' }} onClick={onClick}>
        {inner}
      </button>
    );
  return <div className="row">{inner}</div>;
}

export function Notice({ children, tone = 'sys', icon }: { children: ReactNode; tone?: 'sys' | 'danger' | 'gold' | 'xp'; icon?: IconId }) {
  const color = { sys: 'var(--color-system)', danger: 'var(--color-hp)', gold: 'var(--color-gold)', xp: 'var(--color-xp)' }[tone];
  return (
    <div className="card row" style={{ padding: '12px 16px', borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}>
      {icon && <IconSquare icon={icon} color={color} size="sm" />}
      <div className="grow s" style={{ margin: 0 }}>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconId; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '28px 18px' }}>
      <IconSquare icon={icon} color="var(--color-dim)" size="lg" className="mx-auto" />
      <div className="t" style={{ marginTop: 12 }}>
        {title}
      </div>
      {body && <div className="s" style={{ marginTop: 4 }}>{body}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
