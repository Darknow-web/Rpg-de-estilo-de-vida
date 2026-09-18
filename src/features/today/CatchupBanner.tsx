import type { CatchupSummary } from '@/core/catchup/catchup';
import { Sheet } from '@/components/ui/Sheet';

/** Resumen de lo que pasó mientras no abrías la app. Claro, sin culpa. */
export function CatchupBanner({ summary, onClose }: { summary: CatchupSummary; onClose: () => void }) {
  const lost = summary.failuresApplied.filter((f) => f.heartsLost > 0);
  const forgiven = summary.failuresApplied.filter((f) => f.heartsLost === 0);
  return (
    <Sheet open onClose={onClose} title={summary.daysAway >= 3 ? 'Bienvenido de vuelta' : 'Mientras no estabas'}>
      <div className="space-y-3 text-sm">
        {summary.restBonusActivated && (
          <div className="rounded-xl border border-life/50 bg-life/10 p-3">
            <div className="font-semibold text-life">Bonus de descanso activo</div>
            <div className="text-mist">Tus próximas misiones dan +50 % de XP. Volver ya es la primera victoria.</div>
          </div>
        )}
        {lost.length > 0 && (
          <div>
            <div className="font-semibold text-parchment">Ventanas vencidas: −{summary.heartsLost} ♥</div>
            <ul className="mt-1 space-y-0.5 text-mist">
              {lost.slice(0, 8).map((f, i) => (
                <li key={i}>
                  {f.day.slice(5)} · {f.missionName} (−{f.heartsLost})
                </li>
              ))}
              {lost.length > 8 && <li>… y {lost.length - 8} más</li>}
            </ul>
          </div>
        )}
        {forgiven.length > 0 && <div className="text-mist">{forgiven.length} falla{forgiven.length > 1 ? 's' : ''} sin daño (día imposible, descanso, misión dominada o segunda oportunidad).</div>}
        {summary.heartsRegenerated > 0 && <div className="text-life">+{summary.heartsRegenerated} ♥ regenerado{summary.heartsRegenerated > 1 ? 's' : ''} por días limpios.</div>}
        {summary.streakBroken && <div className="text-mist">La racha se reinició. Empieza una nueva hoy: la primera misión cuenta.</div>}
        {summary.interestEarned > 0 && <div className="text-gold">🪙 +{summary.interestEarned} por interés compuesto.</div>}
        {summary.died && <div className="text-blood">Te quedaste sin corazones. Tu misión de resurrección está en Hoy.</div>}
        {summary.revivedByExpiry && <div className="text-life">La resurrección venció: revives con la mitad de corazones y la mitad de monedas. Todo lo demás sigue intacto.</div>}
        <button className="btn btn-primary mt-2 w-full" onClick={onClose}>
          Seguir jugando
        </button>
      </div>
    </Sheet>
  );
}
