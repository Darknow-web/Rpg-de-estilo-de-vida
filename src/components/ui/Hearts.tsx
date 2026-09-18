/** Corazones SVG: llenos en rojo, vacíos en el color de la pista. */
export function Hearts({ current, max, size = 'md', beat }: { current: number; max: number; size?: 'md' | 'lg'; beat?: boolean }) {
  return (
    <div className={`hearts ${size === 'lg' ? 'lg' : ''}`} aria-label={`${current} de ${max} corazones`} role="img">
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} className={beat && i >= current ? 'beat' : undefined} style={{ color: i < current ? 'var(--color-hp)' : 'var(--color-track)' }}>
          <use href="#heart" />
        </svg>
      ))}
    </div>
  );
}
