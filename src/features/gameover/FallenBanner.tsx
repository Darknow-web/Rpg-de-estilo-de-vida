import { useGameContext } from '@/state/game';
import { daysBetween } from '@/lib/time';
import { Bar, IconSquare, Label } from '@/components/ui/primitives';

/** Estado caído: pantalla de derrota clara y seria, nunca humillante. Siempre con salida visible. */
export function FallenBanner() {
  const ctx = useGameContext();
  if (!ctx || ctx.player.status !== 'fallen') return null;
  const q = ctx.resurrection;
  const daysLeft = q ? Math.max(0, daysBetween(ctx.today, q.deadline)) : 0;
  const why = ctx.player.interview?.answers.q2_why;
  return (
    <div className="mx-4 mt-4 card danger">
      <div className="row">
        <IconSquare icon="skull" color="var(--color-hp)" />
        <div className="grow">
          <div className="t" style={{ color: 'var(--color-hp)' }}>
            Has caído
          </div>
          <div className="s">Sin corazones no ganas XP ni monedas y la tienda está cerrada. Hay una salida, y es corta.</div>
        </div>
      </div>
      {q && (
        <div className="mt-4 rounded-2xl bg-card-2 p-3">
          <Label right={`${daysLeft} día${daysLeft === 1 ? '' : 's'} de plazo`}>Misión de resurrección</Label>
          <div className="t mt-2" style={{ fontSize: 14 }}>
            {q.missionName}
          </div>
          <Bar className="mt-3" value={q.daysDone} max={q.daysRequired} color="var(--color-xp)" label={`${q.daysRequired} días seguidos con foto`} right={`${q.daysDone}/${q.daysRequired}`} />
          <p className="s mt-3">Si el plazo vence, revives igual perdiendo la mitad de tus monedas. Nunca tu XP, tus habilidades ni tu historial.</p>
        </div>
      )}
      {why && <p className="s mt-3 italic">Dijiste que esto importaba porque: "{why}"</p>}
    </div>
  );
}
