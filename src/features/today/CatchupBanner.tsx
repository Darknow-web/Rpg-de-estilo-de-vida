import type { CatchupSummary } from '@/core/catchup/catchup';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';

/** Resumen de lo que pasó mientras no abrías la app. Claro, sin culpa. */
export function CatchupBanner({ summary, onClose }: { summary: CatchupSummary; onClose: () => void }) {
  const lost = summary.failuresApplied.filter((f) => f.heartsLost > 0);
  const forgiven = summary.failuresApplied.filter((f) => f.heartsLost === 0);
  return (
    <Sheet open onClose={onClose} title={summary.daysAway >= 3 ? 'Bienvenido de vuelta' : 'Mientras no estabas'}>
      <div className="space-y-3 text-sm">
        {summary.restBonusActivated && (
          <div className="card active" style={{ padding: 14 }}>
            <div className="t" style={{ color: 'var(--color-xp)', fontSize: 14 }}>
              Bonus de descanso activo
            </div>
            <div className="s">Tus próximas misiones dan +50 % de XP. Volver ya es la primera victoria.</div>
          </div>
        )}
        {lost.length > 0 && (
          <div className="card danger" style={{ padding: 14 }}>
            <div className="t row" style={{ fontSize: 14, gap: 6 }}>
              Ventanas vencidas: −{summary.heartsLost}
              <Icon id="vital" style={{ width: 14, height: 14, color: 'var(--color-hp)' }} />
            </div>
            <ul className="s mt-1 space-y-0.5">
              {lost.slice(0, 8).map((f, i) => (
                <li key={i}>
                  {f.day.slice(5)} · {f.missionName} (−{f.heartsLost})
                </li>
              ))}
              {lost.length > 8 && <li>… y {lost.length - 8} más</li>}
            </ul>
          </div>
        )}
        {forgiven.length > 0 && <div className="s">{forgiven.length} falla{forgiven.length > 1 ? 's' : ''} sin daño (día imposible, descanso, misión dominada o segunda oportunidad).</div>}
        {summary.commitmentsMissed.length > 0 && <div className="s">{summary.commitmentsMissed.length === 1 ? `Un compromiso sin registrar (${summary.commitmentsMissed[0].missionName.replace('Llegar a tiempo: ', '')}). Sin daño: solo no sumó.` : `${summary.commitmentsMissed.length} compromisos sin registrar. Sin daño: solo no sumaron.`}</div>}
        {summary.heartsRegenerated > 0 && <div style={{ color: 'var(--color-xp)' }}>+{summary.heartsRegenerated} corazón{summary.heartsRegenerated > 1 ? 'es' : ''} regenerado{summary.heartsRegenerated > 1 ? 's' : ''} por días limpios.</div>}
        {summary.streakBroken && <div className="s">La racha se reinició. Empieza una nueva hoy: la primera misión cuenta.</div>}
        {summary.interestEarned > 0 && <div style={{ color: 'var(--color-gold)' }}>+{summary.interestEarned} monedas por interés compuesto.</div>}
        {summary.died && <div style={{ color: 'var(--color-hp)' }}>Te quedaste sin corazones. Tu misión de resurrección está en Hoy.</div>}
        {summary.revivedByExpiry && <div style={{ color: 'var(--color-xp)' }}>La resurrección venció: revives con la mitad de corazones y la mitad de monedas. Todo lo demás sigue intacto.</div>}
        <button className="btn mt-2" onClick={onClose}>
          Seguir jugando
        </button>
      </div>
    </Sheet>
  );
}
