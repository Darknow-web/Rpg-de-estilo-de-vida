export function Hearts({ current, max, size = 'md' }: { current: number; max: number; size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-2xl' : 'text-base';
  return (
    <div className={`flex items-center gap-0.5 ${cls}`} aria-label={`${current} de ${max} corazones`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < current ? 'text-blood drop-shadow-[0_0_6px_rgba(215,38,61,0.7)]' : 'text-ash'}>
          {i < current ? '♥' : '♡'}
        </span>
      ))}
    </div>
  );
}
