import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { useCalendar } from '../store';
import { calendarConfigured } from '../client';
import { groupEventsByDay } from '../selectors';
import { commitmentEligibility, findCommitment, markCommitment, unmarkCommitment, calendarMissionsOn, canAddCommitment, punctualityWindow } from '../commitments';
import type { CalendarEvent } from '../types';
import { formatDayHuman, zonedParts } from '@/lib/time';
import { PUNCTUALITY } from '@/lib/game-balance';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { ATTR_ICON, ATTR_VAR, Card, Chip, EmptyState, IconSquare, Label, Notice, PageHead, Row } from '@/components/ui/primitives';
import { PlanSheet } from './PlanSheet';
import { agendaData, isAgendaMission, removeAgendaMission } from '../tasks';
import { requestToken } from '../client';

/** Hora local del evento (Lima). */
export function eventTime(e: CalendarEvent, tz: string): string {
  if (e.allDay) return 'Todo el día';
  const p = zonedParts(new Date(e.start), tz);
  const q = zonedParts(new Date(e.end), tz);
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${f(p.minutesOfDay)} – ${f(q.minutesOfDay)}`;
}

/** Agenda: 14 días de Google Calendar, "Marcar como compromiso" y "Agregar pendientes" (planificador). Solo escribe lo que el jugador confirma. */
export function AgendaScreen({ embedded }: { embedded?: boolean } = {}) {
  const ctx = useGameContext();
  const cal = useCalendar();
  const [sel, setSel] = useState<CalendarEvent | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  useEffect(() => {
    if (cal.connected && !cal.loading) void cal.refresh(false);
  }, []);
  if (!ctx) return null;
  const configured = calendarConfigured();
  const groups = groupEventsByDay(cal.events, ctx.tz).filter((g) => g.day >= ctx.today);
  const agendaTasks = ctx.missions.filter((m) => m.active && isAgendaMission(m) && (m.schedule.once ?? '') >= ctx.today).sort((a, b) => `${a.schedule.once}${a.schedule.window !== 'allDay' ? a.schedule.window.start : ''}`.localeCompare(`${b.schedule.once}${b.schedule.window !== 'allDay' ? b.schedule.window.start : ''}`));

  const removeTask = async (id: string) => {
    const m = ctx.missions.find((x) => x.id === id);
    if (!m) return;
    const d = agendaData(m);
    const alsoCalendar = Boolean(d?.gcalEventId) && window.confirm('¿Borrar también el evento que la app creó en tu Google Calendar?');
    let token: string | undefined;
    if (alsoCalendar) {
      try {
        token = await requestToken({ interactive: false });
      } catch {
        token = undefined;
      }
    }
    const r = await removeAgendaMission(ctx, m, { token, deleteFromCalendar: alsoCalendar });
    setMsg(r.calendarError ? `Tarea quitada de la app. El evento del calendario no se pudo borrar: ${r.calendarError}` : 'Tarea quitada. Queda archivada en el historial.');
    if (alsoCalendar && !r.calendarError) void cal.refresh(false);
  };
  const selMission = sel ? findCommitment(ctx.missions, sel.id) : undefined;
  const selElig = sel ? commitmentEligibility(sel, ctx.now) : null;
  const selWindow = sel && !sel.allDay ? punctualityWindow(sel.start, ctx.tz) : null;
  const selCap = selWindow ? canAddCommitment(calendarMissionsOn(ctx.missions, selWindow.day)) : null;

  const toggleCommitment = async () => {
    if (!sel) return;
    if (selMission) {
      const r = await unmarkCommitment(ctx, sel.id);
      setMsg(r.ok ? 'Compromiso quitado. La misión queda archivada.' : r.error ?? '');
    } else {
      const r = await markCommitment(ctx, sel);
      setMsg(r.ok ? `Compromiso marcado. La misión abre ${PUNCTUALITY.windowMinutes} min antes; llega ${PUNCTUALITY.earlyMinutes} min antes y ganas +${Math.round(PUNCTUALITY.earlyBonus * 100)} % XP.` : r.error ?? '');
    }
    setSel(null);
  };

  const body = (
    <>
      <button type="button" className="card row" style={{ textAlign: 'left', cursor: 'pointer', borderColor: 'rgba(59,130,255,.35)' }} onClick={() => setPlanOpen(true)}>
        <IconSquare icon="plus" color="var(--color-system)" />
        <div className="grow">
          <div className="t">Agregar pendientes</div>
          <div className="s">Foto de tu lista o escríbelos. El Sistema los acomoda en tus huecos y cada uno da XP y oro al completarlo.</div>
        </div>
        <Icon id="chev" className="chev" />
      </button>
      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} />
      {agendaTasks.length > 0 && (
        <>
          <Label right={`${agendaTasks.length}`}>Tareas planificadas</Label>
          <Card tone="tight">
            <div className="list">
              {agendaTasks.map((m) => (
                <Row
                  key={m.id}
                  icon={ATTR_ICON[m.attribute]}
                  color={ATTR_VAR[m.attribute]}
                  title={m.name}
                  sub={`${m.schedule.once === ctx.today ? 'Hoy' : formatDayHuman(m.schedule.once ?? '')} · ${m.schedule.window !== 'allDay' ? `${m.schedule.window.start} – ${m.schedule.window.end}` : 'todo el día'} · +${m.xp} XP${agendaData(m)?.gcalEventId ? ' · en tu calendario' : ''}`}
                  to={`/missions/${m.id}`}
                  right={
                    <button
                      type="button"
                      className="chip ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        void removeTask(m.id);
                      }}
                    >
                      Quitar
                    </button>
                  }
                />
              ))}
            </div>
          </Card>
        </>
      )}
      {!configured && (
        <Notice tone="sys" icon="cal">
          Falta configurar el cliente de Google (VITE_GOOGLE_CLIENT_ID). Ver docs/DEPLOY.md, sección Google Calendar. Sin él, "Agregar pendientes" planifica igual usando solo tus misiones.
        </Notice>
      )}
      {configured && !cal.connected && (
        <EmptyState
          icon="cal"
          title="Conecta tu Google Calendar"
          body="Lee tus eventos para no chocar con ellos y escribe solo las tareas que confirmes. Nada pasa por nuestro servidor ni se guarda en la nube del juego."
          action={
            <button className="btn system sm auto" onClick={() => void cal.connect()} disabled={cal.loading}>
              <Icon id="google" />
              {cal.loading ? 'Conectando…' : 'Conectar'}
            </button>
          }
        />
      )}
      {cal.error && (
        <Notice tone="danger" icon="shield">
          {cal.error}{' '}
          <button className="underline" onClick={() => void cal.refresh(true)}>
            Reconectar
          </button>
        </Notice>
      )}
      {msg && (
        <Notice tone="xp" icon="check">
          <span onClick={() => setMsg(null)}>{msg}</span>
        </Notice>
      )}
      {cal.connected && (
        <>
          <Label
            right={
              <button className="chip ghost" onClick={() => void cal.refresh(false)} disabled={cal.loading}>
                <Icon id="history" />
                {cal.loading ? 'Actualizando…' : cal.fetchedAt ? `Actualizado ${new Date(cal.fetchedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : 'Actualizar'}
              </button>
            }
          >
            Próximos 14 días
          </Label>
          {groups.length === 0 && !cal.loading && <EmptyState icon="moon" title="Agenda despejada" body="Ningún evento en los próximos 14 días en los calendarios elegidos." />}
          {groups.map((g) => (
            <div key={g.day} className="flex flex-col gap-2">
              <Label right={g.day === ctx.today ? 'hoy' : undefined}>{formatDayHuman(g.day)}</Label>
              <Card tone="tight">
                <div className="list">
                  {g.events.map((e) => {
                    const committed = Boolean(findCommitment(ctx.missions, e.id));
                    const color = cal.calendars.find((c) => c.id === e.calendarId)?.backgroundColor ?? 'var(--color-system)';
                    return (
                      <button key={`${e.calendarId}:${e.id}`} type="button" className="row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }} onClick={() => setSel(e)}>
                        <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 99, background: color, minHeight: 34 }} />
                        <div className="grow">
                          <div className="t" style={{ fontSize: 14 }}>
                            {e.summary || '(sin título)'}
                          </div>
                          <div className="s">
                            {eventTime(e, ctx.tz)}
                            {e.location ? ` · ${e.location}` : ''}
                          </div>
                        </div>
                        {committed && (
                          <Chip color="var(--color-gold)" icon="timer">
                            compromiso
                          </Chip>
                        )}
                        <Icon id="chev" className="chev" />
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
          <div className="s text-center">
            Calendarios: {cal.calendars.filter((c) => cal.selectedCalendarIds.includes(c.id)).map((c) => c.summary).join(', ') || 'ninguno'} ·{' '}
            <Link to="/settings" className="underline">
              cambiar
            </Link>
          </div>
        </>
      )}
      <Sheet open={Boolean(sel)} onClose={() => setSel(null)} title={sel?.summary || 'Evento'}>
        {sel && (
          <div className="space-y-3 text-sm">
            <div className="row">
              <IconSquare icon="cal" color="var(--color-system)" size="sm" />
              <div className="grow">
                <div className="t" style={{ fontSize: 14 }}>
                  {eventTime(sel, ctx.tz)}
                </div>
                <div className="s">{sel.location ?? 'Sin lugar'}</div>
              </div>
            </div>
            {selMission ? (
              <Notice tone="gold" icon="timer">
                Marcado como compromiso. Ventana {selWindow?.start} – {selWindow?.end}: llega, toma la foto del lugar, listo. Si no llegas, no pierdes nada.
              </Notice>
            ) : selElig && !selElig.ok ? (
              <Notice tone="sys">{selElig.reason}</Notice>
            ) : (
              <Notice tone="sys" icon="spark">
                Marcarlo crea la misión "Llegar a tiempo" con ventana {selWindow?.start} – {selWindow?.end}. Llegar {PUNCTUALITY.earlyMinutes} min antes da +{Math.round(PUNCTUALITY.earlyBonus * 100)} % XP. Fallar no cuesta corazones ni racha.
                {selCap && !selCap.ok ? ` ${selCap.reason}` : ''}
              </Notice>
            )}
            <div className="flex gap-2">
              {selMission ? (
                <>
                  <Link to={`/missions/${selMission.id}`} className="btn ghost">
                    Ver misión
                  </Link>
                  <button className="btn ghost auto" onClick={toggleCommitment}>
                    Quitar
                  </button>
                </>
              ) : (
                <button className="btn gold" disabled={!selElig?.ok || (selCap ? !selCap.ok : false)} onClick={toggleCommitment}>
                  <Icon id="timer" />
                  Marcar como compromiso
                </button>
              )}
            </div>
            {sel.htmlLink && (
              <a href={sel.htmlLink} target="_blank" rel="noreferrer" className="block text-center text-xs text-mute underline">
                Abrir en Google Calendar
              </a>
            )}
          </div>
        )}
      </Sheet>
    </>
  );

  if (embedded) return <>{body}</>;
  return (
    <div className="screen" style={{ '--tint': 'var(--color-system)' } as CSSProperties}>
      <PageHead title="Agenda" />
      {body}
    </div>
  );
}
