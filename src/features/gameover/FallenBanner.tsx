import { useGameContext } from '@/state/game';
import { daysBetween } from '@/lib/time';

/** Estado caído: pantalla de derrota clara y seria, nunca humillante. Siempre con salida visible. */
export function FallenBanner() {
  const ctx = useGameContext();
  if (!ctx || ctx.player.status !== 'fallen') return null;
  const q = ctx.resurrection;
  const daysLeft = q ? Math.max(0, daysBetween(ctx.today, q.deadline)) : 0;
  const why = ctx.player.interview?.answers.q2_why;
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-blood/60 bg-blood/10 p-4">
      <div className="font-display text-lg text-blood">Has caído</div>
      <p className="mt-1 text-sm text-parchment">Sin corazones no ganas XP ni monedas y la tienda está cerrada. Pero hay una salida, y es corta.</p>
      {q && (
        <div className="mt-3 rounded-xl bg-void p-3">
          <div className="text-xs uppercase tracking-widest text-mist">Misión de resurrección</div>
          <div className="mt-1 font-semibold">{q.missionName}</div>
          <div className="mt-1 text-sm text-mist">Cúmplela {q.daysRequired} días seguidos con foto. Progreso: <span className="text-gold">{q.daysDone}/{q.daysRequired}</span> · Plazo: {daysLeft} día{daysLeft === 1 ? '' : 's'}.</div>
          <div className="bar mt-2">
            <div className="bg-life" style={{ width: `${Math.round((q.daysDone / q.daysRequired) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-mist">Si el plazo vence, revives igual perdiendo la mitad de tus monedas. Nunca tu XP, tus habilidades ni tu historial.</p>
        </div>
      )}
      {why && <p className="mt-3 text-xs italic text-mist">Dijiste que esto importaba porque: "{why}"</p>}
    </div>
  );
}
