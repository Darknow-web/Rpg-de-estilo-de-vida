import type { CSSProperties } from 'react';
import { useGame, useGameContext } from '@/state/game';
import { undoImpossibleDay } from '@/core/streaks/streaks';
import { markUndone } from '@/lib/systemLog';
import { applyRepricing } from '@/core/shop/shop';
import { restoreMission } from '@/core/missions/manage';
import { batch, commitSoon, subDoc, clean } from '@/core/repo';
import type { Mission } from '@/shared/types';
import { Card, EmptyState, IconSquare, PageHead } from '@/components/ui/primitives';

/** "Qué hizo el sistema y por qué": toda acción automática es auditable y, cuando se puede, reversible. */
export function SystemLogScreen() {
  const ctx = useGameContext();
  const log = useGame((s) => s.systemLog);
  if (!ctx) return null;

  const undo = async (id: string, action: string, payload?: Record<string, unknown>) => {
    if (!payload) return;
    try {
      if (action === 'impossible_day') await undoImpossibleDay(ctx, payload.day as string);
      else if (action === 'shop_repriced') await applyRepricing(ctx, (payload.items as { rewardId: string; price: number }[]).map((i) => ({ rewardId: i.rewardId, to: i.price })));
      else if (action === 'mission_archived') await restoreMission(ctx, payload.missionId as string);
      else if (action === 'mission_escalated' || action === 'mission_lowered') {
        const prev = payload.previous as Mission;
        const b = batch();
        b.set(subDoc(ctx.uid, 'missions', prev.id), clean(prev));
        await commitSoon(b, 'undoMission');
      }
      await markUndone(ctx.uid, id);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="screen" style={{ '--tint': 'var(--color-system)' } as CSSProperties}>
      <PageHead title="Historial del sistema" />
      <p className="s" style={{ margin: 0 }}>
        Todo lo que la app hizo sola, con su razón. Lo reversible se puede deshacer aquí.
      </p>
      {log.length === 0 && <EmptyState icon="history" title="Aún no hay acciones automáticas" />}
      {log.map((e) => (
        <Card key={e.id}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <IconSquare icon="spark" color="var(--color-system)" size="sm" />
            <div className="grow">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="t" style={{ fontSize: 14 }}>
                  {ACTION_LABEL[e.action] ?? e.action}
                </span>
                <span className="s num" style={{ margin: 0 }}>
                  {new Date(e.at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="s">{e.reason}</div>
              {e.reversible && !e.undoneAt && (
                <button className="btn ghost sm auto mt-3" onClick={() => undo(e.id, e.action, e.undoPayload)}>
                  Deshacer
                </button>
              )}
              {e.undoneAt && <div className="s mt-1">Deshecho</div>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  catchup: 'Puesta al día',
  rest_bonus: 'Bonus de descanso',
  game_over: 'Game over',
  revived: 'Resurrección',
  revived_expired: 'Resurrección vencida',
  resurrection_reset: 'Resurrección reiniciada',
  impossible_day: 'Día imposible',
  impossible_day_undone: 'Día imposible (deshecho)',
  pause: 'Pausa',
  pause_ended: 'Fin de pausa',
  resume: 'Reanudar',
  rest_day: 'Descanso sagrado',
  streak_shield: 'Racha protegida',
  streak_broken: 'Racha reiniciada',
  mastery_change: 'Dominio',
  mission_consolidated: 'Consolidada',
  mission_mastered: 'Dominada',
  mission_automated: 'Automatizada',
  chain_unlock: 'Cadena',
  rank_up: 'Rango',
  skill_unlocked: 'Habilidad',
  tree_reset: 'Árbol reiniciado',
  reward_created: 'Recompensa creada',
  reward_redeemed: 'Canje',
  reward_adjusted: 'Recompensa ajustada',
  shop_repriced: 'Re-tasación',
  mission_edited: 'Misión editada',
  mission_archived: 'Misión archivada',
  mission_restored: 'Misión restaurada',
  mission_escalated: 'Escalado',
  mission_lowered: 'Bajada a mínima',
  mission_created: 'Misión creada',
  window_moved: 'Ventana movida',
  completion_annulled: 'Completación anulada',
  campaign_created: 'Campaña',
  campaign_redone: 'Campaña rehecha',
  hidden_revealed: 'Misión oculta',
  interest: 'Interés',
  main_completed: 'Misión principal',
  boss_defeated: 'Boss',
  boss_expired: 'Boss vencido',
  gym_routine: 'Rutina de gimnasio',
  evidence_archived: 'Evidencias archivadas',
  day_close: 'Cierre del día',
  commitment_missed: 'Compromiso no registrado',
  medal_punctual: 'Medalla Puntual',
  medal_streak: 'Medalla de racha',
  agenda_planned: 'Pendientes planificados',
};
