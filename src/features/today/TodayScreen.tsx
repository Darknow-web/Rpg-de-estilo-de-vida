import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { useUi } from '@/state/ui';
import { buildToday, type TodayItem } from '@/core/missions/schedule';
import { completeMission } from '@/core/completion/complete';
import { CameraButton } from '@/components/ui/CameraButton';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { minutesToHuman, formatDayHuman, windowFor, weekdayOf } from '@/lib/time';
import { pendingProposals } from '@/core/missions/proposals';
import { ProposalCard } from './ProposalCard';
import { declareImpossibleDay, impossibleDaysLeft } from '@/core/streaks/streaks';
import { Sheet } from '@/components/ui/Sheet';
import { getModule } from '@/core/module';
import { quotaFor } from '@/core/missions/quota';
import { syncNotifications } from '@/features/settings/notificationsSync';
import { closeDay, dayClosedToday } from '@/core/streaks/dayClose';

/** Vista HOY: línea de tiempo del día, misión activa destacada, estados visibles. Tres toques para completar. */
export function TodayScreen() {
  const ctx = useGameContext();
  const pushFeedback = useGame((s) => s.pushFeedback);
  const dismissed = useUi((s) => s.dismissedProposals);
  const dismiss = useUi((s) => s.dismissProposal);
  const [error, setError] = useState<string | null>(null);
  const [impossibleOpen, setImpossibleOpen] = useState(false);
  const navigate = useNavigate();

  const view = useMemo(() => {
    if (!ctx) return null;
    const failedToday = new Set(ctx.failures.map((f) => `${f.missionId}:${f.day}`));
    return buildToday(ctx.missions, ctx.completions, failedToday, ctx.now, ctx.tz, ctx.today, ctx.effects.graceHours);
  }, [ctx]);

  if (!ctx || !view) return null;
  const proposals = pendingProposals(ctx, dismissed).slice(0, 1);
  const dailyQuota = quotaFor('daily', ctx.player, ctx.missions, ctx.effects);
  const p = ctx.player;
  const active = view.timed.find((t) => t.state === 'active') ?? view.timed.find((t) => t.state === 'grace');
  const allDone = [...view.timed, ...view.allDay].length > 0 && [...view.timed, ...view.allDay].every((t) => t.state === 'done' || t.state === 'failed');

  const onPhoto = async (item: TodayItem, file: File) => {
    setError(null);
    const res = await completeMission(ctx, item.mission.id, { file }, { day: item.day });
    if (!res.ok) {
      setError(res.error ?? 'No se pudo completar');
      return;
    }
    pushFeedback(res.events);
    void syncNotifications();
  };

  const impossible = async (day: string) => {
    const r = await declareImpossibleDay(ctx, day);
    if (!r.ok) setError(r.error ?? '');
    setImpossibleOpen(false);
  };

  return (
    <div className="space-y-4 animate-fadein">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-mist">{formatDayHuman(ctx.today)}</div>
          <h1 className="font-display text-xl text-gold">Bitácora de hoy</h1>
        </div>
        <button className="chip" onClick={() => setImpossibleOpen(true)} title="Día imposible">
          🛡 {impossibleDaysLeft(ctx)}
        </button>
      </div>

      {p.status === 'paused' && (
        <div className="panel p-4 text-sm">
          <div className="font-semibold text-frost">Juego en pausa</div>
          <div className="text-mist">Hasta el {p.pause?.until}. Sin daño, sin rachas rotas. Reanuda desde Ajustes cuando quieras.</div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-ember/50 bg-ember/10 p-3 text-sm text-parchment" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {p.restBonus.remainingMissions > 0 && <div className="rounded-xl border border-life/40 bg-life/10 px-3 py-2 text-xs text-life">Bonus de descanso: +50 % XP en tus próximas {p.restBonus.remainingMissions} misiones.</div>}

      {proposals.map((pr) => (
        <ProposalCard key={pr.id} proposal={pr} onDismiss={() => dismiss(pr.id)} />
      ))}

      {active && (
        <MissionCard item={active} highlight onPhoto={(f) => onPhoto(active, f)} fallen={p.status === 'fallen'} resurrectionId={ctx.resurrection?.missionId} />
      )}

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-widest text-mist">Línea de tiempo</h2>
        {view.timed.length === 0 && view.allDay.length === 0 && (
          <div className="panel p-4 text-sm text-mist">
            {view.restToday ? 'Hoy no hay misiones programadas. Día de descanso: cuenta como día limpio.' : 'Sin misiones.'}
            {dailyQuota.allowed && (
              <div className="mt-2">
                <Link to="/missions/new" className="btn btn-ghost btn-sm">
                  Agregar misión
                </Link>
              </div>
            )}
          </div>
        )}
        <div className="space-y-2">
          {view.timed
            .filter((t) => t !== active)
            .map((t) => (
              <MissionCard key={`${t.mission.id}:${t.day}`} item={t} onPhoto={(f) => onPhoto(t, f)} fallen={p.status === 'fallen'} resurrectionId={ctx.resurrection?.missionId} />
            ))}
        </div>
      </section>

      {view.allDay.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-widest text-mist">Todo el día</h2>
          <div className="space-y-2">
            {view.allDay.map((t) => (
              <MissionCard key={t.mission.id} item={t} onPhoto={(f) => onPhoto(t, f)} fallen={p.status === 'fallen'} resurrectionId={ctx.resurrection?.missionId} />
            ))}
          </div>
        </section>
      )}

      {view.weekly.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs uppercase tracking-widest text-mist">Semanales</h2>
          <div className="space-y-2">
            {view.weekly.map((t) => (
              <MissionCard key={t.mission.id} item={t} onPhoto={(f) => onPhoto(t, f)} fallen={p.status === 'fallen'} />
            ))}
          </div>
        </section>
      )}

      {view.longTerm.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-mist">Campaña</h2>
            <Link to="/missions/long-term" className="text-xs text-arcane-glow">
              Ver todo
            </Link>
          </div>
          {view.longTerm.slice(0, 2).map((m) => {
            const items = m.type === 'main' ? m.milestones ?? [] : m.checklist ?? [];
            const done = items.filter((i) => i.done).length;
            return (
              <Link key={m.id} to="/missions/long-term" className="mb-2 block rounded-xl bg-void p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-parchment">{m.type === 'boss' ? '👹 ' : '🏔 '}{m.name}</span>
                  <span className="text-xs text-mist">{done}/{items.length}</span>
                </div>
                <div className="bar mt-2">
                  <div className="bg-gold" style={{ width: `${items.length ? Math.round((done / items.length) * 100) : 0}%` }} />
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {allDone && !dayClosedToday(ctx) && (
        <div className="panel p-4 text-center">
          <div className="text-sm text-parchment">Bitácora completa. Bien jugado.</div>
          <button className="btn btn-ghost btn-sm mt-2" onClick={() => void closeDay(ctx).then((ev) => pushFeedback(ev))}>
            Cerrar el día{ctx.effects.dayCloseXp ? ' (+15 XP)' : ''}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 text-xs text-mist">
        <span>
          Cupo diario {dailyQuota.used}/{dailyQuota.max}
        </span>
        <button className="underline" onClick={() => navigate('/missions/new')}>
          {dailyQuota.allowed ? 'Agregar misión' : '¿Cómo ampliar?'}
        </button>
      </div>

      <Sheet open={impossibleOpen} onClose={() => setImpossibleOpen(false)} title="Día imposible">
        <p className="text-sm text-mist">Hay días en que la vida no deja jugar. Declara este día sin justificar nada: sin pérdida de corazones, y la racha se conserva. Te quedan {impossibleDaysLeft(ctx)} este mes.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary flex-1" disabled={impossibleDaysLeft(ctx) <= 0} onClick={() => impossible(ctx.today)}>
            Hoy es imposible
          </button>
          <button className="btn btn-ghost" onClick={() => setImpossibleOpen(false)}>
            Cancelar
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function MissionCard({ item, highlight, onPhoto, fallen, resurrectionId }: { item: TodayItem; highlight?: boolean; onPhoto: (f: File) => Promise<void>; fallen?: boolean; resurrectionId?: string }) {
  const m = item.mission;
  const meta = ATTRIBUTE_META[m.attribute];
  const w = windowFor(m.schedule, weekdayOf(item.day));
  const mod = getModule(m.moduleId);
  const isRes = fallen && resurrectionId === m.id;
  const stateLabel = {
    done: 'Hecha',
    upcoming: `Abre en ${item.window.minutesUntilOpen !== null ? minutesToHuman(item.window.minutesUntilOpen) : ''}`,
    active: `Quedan ${item.window.minutesLeft !== null ? minutesToHuman(item.window.minutesLeft) : ''}`,
    grace: `En gracia · ${item.window.minutesLeft !== null ? minutesToHuman(item.window.minutesLeft) : ''} (50 % XP, sin daño)`,
    expired: 'Vencida',
    allDay: 'Todo el día',
    failed: 'Vencida · corazón descontado',
  }[item.state];
  const canComplete = (item.state === 'active' || item.state === 'grace' || item.state === 'allDay' || item.state === 'upcoming') && !(fallen && !isRes && false);
  const border = item.state === 'done' ? 'border-life/50' : item.state === 'grace' ? 'border-gold/60' : item.state === 'expired' || item.state === 'failed' ? 'border-blood/40 opacity-70' : highlight ? 'border-arcane panel-glow' : 'border-steel';
  return (
    <div className={`panel border p-3 ${border} ${highlight ? 'animate-fadein' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/missions/${m.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-mist">
            <span style={{ color: meta.color }}>{meta.icon} {meta.name}</span>
            <span>·</span>
            <span>{w === 'allDay' ? 'Todo el día' : `${w.start}–${w.end}`}</span>
            {item.day !== undefined && item.state === 'grace' && <span className="text-gold">ayer</span>}
            {isRes && <span className="text-life">resurrección</span>}
          </div>
          <div className={`mt-0.5 font-semibold ${item.state === 'done' ? 'text-mist line-through' : 'text-parchment'}`}>{m.name}</div>
          {m.anchor && <div className="text-xs text-mist">{m.anchor}</div>}
          {item.weeklyProgress && (
            <div className="mt-1 text-xs text-mist">
              {item.weeklyProgress.done}/{item.weeklyProgress.target} esta semana
            </div>
          )}
        </Link>
        <div className="text-right text-[11px]">
          <div className="text-arcane-glow">+{m.xp} XP</div>
          <div className="text-gold">🪙 {m.coins}</div>
        </div>
      </div>
      {!item.weeklyProgress && <div className={`mt-2 text-xs ${item.state === 'active' ? 'text-frost' : item.state === 'grace' ? 'text-gold' : 'text-mist'}`}>{stateLabel}</div>}
      {canComplete && item.state !== 'done' && (
        <div className="mt-3">
          {mod?.executionView && m.moduleId === 'gym' ? (
            <Link to={`/gym/session/${m.id}`} className="btn btn-ember w-full">
              🏋️ Empezar sesión
            </Link>
          ) : (
            <CameraButton onPhoto={onPhoto}>📸 Foto y completar</CameraButton>
          )}
          {m.evidenceHint && <div className="mt-1 text-center text-[11px] text-mist">Prueba: {m.evidenceHint}</div>}
        </div>
      )}
    </div>
  );
}
