import type { AttributeId } from '@/shared/types';
import { ATTRIBUTE_IDS } from '@/shared/types';
import { ATTRIBUTE_META } from '@/core/character/classes';

/** Radar de atributos: muestra de un vistazo si el personaje está desbalanceado. */
export function Radar({ levels, size = 220 }: { levels: Record<AttributeId, number>; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 28;
  const max = Math.max(5, ...ATTRIBUTE_IDS.map((a) => levels[a]));
  const n = ATTRIBUTE_IDS.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => [cx + Math.cos(angle(i)) * r * v, cy + Math.sin(angle(i)) * r * v] as const;
  const rings = [0.25, 0.5, 0.75, 1];
  const poly = ATTRIBUTE_IDS.map((a, i) => point(i, Math.max(0.06, levels[a] / max)).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar de atributos">
      {rings.map((k) => (
        <polygon key={k} points={ATTRIBUTE_IDS.map((_, i) => point(i, k).join(',')).join(' ')} fill="none" stroke="var(--color-steel)" strokeWidth={1} />
      ))}
      {ATTRIBUTE_IDS.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-steel)" strokeWidth={1} />;
      })}
      <polygon points={poly} fill="rgba(124,92,255,0.28)" stroke="var(--color-arcane-glow)" strokeWidth={2} />
      {ATTRIBUTE_IDS.map((a, i) => {
        const [x, y] = point(i, Math.max(0.06, levels[a] / max));
        return <circle key={a} cx={x} cy={y} r={4} fill={ATTRIBUTE_META[a].color} />;
      })}
      {ATTRIBUTE_IDS.map((a, i) => {
        const [x, y] = point(i, 1.22);
        return (
          <text key={a} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={ATTRIBUTE_META[a].color} fontWeight={600}>
            {ATTRIBUTE_META[a].name} {levels[a]}
          </text>
        );
      })}
    </svg>
  );
}
