import { useMemo, useState, type CSSProperties } from 'react';
import { useGame, useGameContext } from '@/state/game';
import { useCalendar } from '../store';
import { requestToken } from '../client';
import { AGENDA } from '@/lib/game-balance';
import { formatDayHuman, parseHHmm } from '@/lib/time';
import { ATTRIBUTE_META } from '@/core/character/classes';
import type { AttributeId } from '@/shared/types';
import type { PlanWeekOutput } from '@/shared/schemas/ai';
import { Sheet } from '@/components/ui/Sheet';
import { CameraButton } from '@/components/ui/CameraButton';
import { Icon } from '@/components/ui/Icon';
import { ATTR_ICON, ATTR_VAR, Card, Chip, IconSquare, Label, Notice } from '@/components/ui/primitives';
import { AgendaAiUnavailable, applyPlan, freeSlots, manualTask, nowHHmm, planTasks, scanTasksPhoto, type PendingTask } from '../tasks';
import { syncNotifications } from '@/features/settings/notificationsSync';
import type { CalendarEvent } from '../types';
import { eventDay } from '../selectors';

type Stage = 'input' | 'planning' | 'plan' | 'applying' | 'done';
const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const ATTRS: AttributeId[] = ['fuerza', 'disciplina', 'intelecto', 'riqueza', 'vitalidad'];

/**
 * "Agregar pendientes": foto o texto → lista editable → plan de la IA en los huecos libres → preguntas → confirmar.
 * Nada se escribe (misiones ni Google Calendar) hasta "Confirmar plan".
 */
export function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ctx = useGameContext();
  const cal = useCalendar();
  const pushFeedback = useGame((s) => s.pushFeedback);
  const [stage, setStage] = useState<Stage>('input');
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [text, setText] = useState('');
  const [nota, setNota] = useState('');
  const [unrecognized, setUnrecognized] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanWeekOutput | null>(null);
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [acceptedMoves, setAcceptedMoves] = useState<Set<number>>(new Set());
  const [writeToCalendar, setWriteToCalendar] = useState(true);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const targetCalendar = useMemo(() => cal.calendars.find((c) => c.primary) ?? cal.calendars.find((c) => cal.selectedCalendarIds.includes(c.id)) ?? cal.calendars[0], [cal.calendars, cal.selectedCalendarIds]);

  if (!ctx) return null;

  const reset = () => {
    setStage('input');
    setTasks([]);
    setText('');
    setNota('');
    setUnrecognized([]);
    setError(null);
    setPlan(null);
    setRound(0);
    setAnswers({});
    setAcceptedMoves(new Set());
    setResult(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const onPhoto = async (file: File) => {
    setError(null);
    try {
      const r = await scanTasksPhoto(file, ctx.today, nota);
      setTasks((ts) => [...ts, ...r.tareas]);
      setUnrecognized(r.noReconocido);
      if (!r.tareas.length) setError('No encontré tareas en la foto. Prueba con más luz o escríbelas abajo.');
    } catch (err) {
      setError(err instanceof AgendaAiUnavailable ? err.message : (err as Error).message);
    }
  };

  const addText = () => {
    const lines = text
      .split(/\n|;|,(?=\s*[A-ZÁÉÍÓÚa-z])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (!lines.length) return;
    setTasks((ts) => [...ts, ...lines.map((l) => manualTask(l))]);
    setText('');
  };

  const update = (id: string, patch: Partial<PendingTask>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const runPlan = async (withAnswers?: Record<string, string>) => {
    if (!tasks.length) return;
    setStage('planning');
    setError(null);
    const slots = freeSlots({ today: ctx.today, now: ctx.now, tz: ctx.tz, events: cal.connected ? cal.events : [], missions: ctx.missions });
    const nextRound = withAnswers ? round + 1 : 0;
    try {
      const out = await planTasks({
        hoy: ctx.today,
        ahora: nowHHmm(ctx.now, ctx.tz),
        tareas: tasks.map(({ id: _id, ...t }) => t),
        huecos: slots.huecos,
        ocupado: slots.ocupado,
        momento_preferido: ctx.player.interview?.answers.q5_moment ?? 'varies',
        ...(withAnswers ? { respuestas: Object.entries(withAnswers).map(([id, respuesta]) => ({ id, respuesta })) } : {}),
        ronda: nextRound,
      });
      setPlan(out);
      setRound(nextRound);
      setAnswers({});
      setAcceptedMoves(new Set());
      setStage('plan');
    } catch (err) {
      setError(err instanceof AgendaAiUnavailable ? err.message : (err as Error).message);
      setStage('input');
    }
  };

  const findEvent = (mv: PlanWeekOutput['movimientos_sugeridos'][number]): CalendarEvent | undefined =>
    cal.events.find((e) => !e.allDay && e.summary.trim().toLowerCase() === mv.que.trim().toLowerCase() && eventDay(e, ctx.tz) === mv.de.dia);

  const confirm = async () => {
    if (!plan) return;
    setStage('applying');
    setError(null);
    let calendar: { token: string; calendarId: string } | undefined;
    const errors: string[] = [];
    if (writeToCalendar && cal.connected && targetCalendar) {
      try {
        const token = await requestToken({ interactive: false });
        calendar = { token, calendarId: targetCalendar.id };
      } catch (err) {
        errors.push(`No se pudo escribir en Google Calendar (${(err as Error).message}). Las tareas quedan solo en la app.`);
      }
    }
    const moves = [...acceptedMoves]
      .map((i) => plan.movimientos_sugeridos[i])
      .filter(Boolean)
      .map((mv) => ({ event: findEvent(mv), to: mv.a }))
      .filter((m): m is { event: CalendarEvent; to: { dia: string; inicio: string; fin: string } } => Boolean(m.event));
    const r = await applyPlan(ctx, tasks, plan, { calendar, moves });
    setResult({ created: r.created.length, errors: [...errors, ...r.calendarErrors] });
    setStage('done');
    void syncNotifications();
    if (calendar) void cal.refresh(false);
    if (r.created.length) pushFeedback([{ kind: 'info', title: `${r.created.length} tarea${r.created.length === 1 ? '' : 's'} en tu agenda`, body: 'Aparecen en "Para hoy" el día que tocan.' }]);
  };

  const byDay = plan
    ? plan.asignaciones.reduce<Record<string, PlanWeekOutput['asignaciones']>>((acc, a) => {
        (acc[a.dia] ??= []).push(a);
        return acc;
      }, {})
    : {};
  const unanswered = plan ? plan.preguntas.filter((q) => !answers[q.id]) : [];
  const canAskMore = round < AGENDA.maxRounds;

  return (
    <Sheet open={open} onClose={close} title="Agregar pendientes" tall>
      {error && (
        <Notice tone="danger" icon="shield">
          <span onClick={() => setError(null)}>{error}</span>
        </Notice>
      )}

      {stage === 'input' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="s" style={{ margin: 0 }}>
            Foto de tu lista (papel, pizarra o captura) o escríbelas. Luego el Sistema las acomoda en tus huecos libres de los próximos {AGENDA.daysAhead} días. La foto no se guarda.
          </p>
          <div className="flex gap-2">
            <CameraButton onPhoto={onPhoto} className="btn system sm">
              <Icon id="camera" />
              Foto de la lista
            </CameraButton>
          </div>
          <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="O escribe una tarea por línea: Comprar pilas · Llamar al banco…" />
          <button className="btn ghost sm" onClick={addText} disabled={!text.trim()}>
            <Icon id="plus" />
            Agregar a la lista
          </button>
          {unrecognized.length > 0 && <div className="s">No entendí: {unrecognized.join(' · ')}. Si eran tareas, escríbelas arriba.</div>}

          {tasks.length > 0 && (
            <>
              <Label right={`${tasks.length} · ${tasks.reduce((s, t) => s + t.duracion_minutos, 0)} min`}>Tu lista</Label>
              <Card tone="tight">
                <div className="list">
                  {tasks.map((t) => (
                    <div key={t.id} className="row" style={{ alignItems: 'flex-start' }}>
                      <IconSquare icon={ATTR_ICON[t.atributo]} color={ATTR_VAR[t.atributo]} size="sm" />
                      <div className="grow">
                        {editing === t.id ? (
                          <input className="input" style={{ minHeight: 38 }} value={t.nombre} autoFocus onChange={(e) => update(t.id, { nombre: e.target.value.slice(0, 80) })} onBlur={() => setEditing(null)} />
                        ) : (
                          <button type="button" className="t" style={{ fontSize: 14, background: 'none', border: 0, padding: 0, color: 'inherit', textAlign: 'left', cursor: 'text' }} onClick={() => setEditing(t.id)}>
                            {t.nombre}
                          </button>
                        )}
                        <div className="row mt-2" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <select className="input" style={{ minHeight: 30, width: 'auto', padding: '0 8px', fontSize: 12 }} value={t.duracion_minutos} onChange={(e) => update(t.id, { duracion_minutos: Number(e.target.value) })} aria-label="Duración">
                            {[...new Set([...DURATIONS, t.duracion_minutos])].sort((a, b) => a - b).map((d) => (
                              <option key={d} value={d}>
                                {d} min
                              </option>
                            ))}
                          </select>
                          <select className="input" style={{ minHeight: 30, width: 'auto', padding: '0 8px', fontSize: 12 }} value={t.atributo} onChange={(e) => update(t.id, { atributo: e.target.value as AttributeId })} aria-label="Área">
                            {ATTRS.map((a) => (
                              <option key={a} value={a}>
                                {ATTRIBUTE_META[a].name}
                              </option>
                            ))}
                          </select>
                          <button type="button" className={`chip ${t.prioridad === 'alta' ? '' : 'ghost'}`} style={{ '--c': 'var(--color-ember)' } as CSSProperties} onClick={() => update(t.id, { prioridad: t.prioridad === 'alta' ? 'media' : 'alta' })}>
                            {t.prioridad === 'alta' ? 'urgente' : 'normal'}
                          </button>
                          <input type="date" className="input" style={{ minHeight: 30, width: 'auto', padding: '0 8px', fontSize: 12 }} min={ctx.today} value={t.fecha_limite ?? ''} onChange={(e) => update(t.id, { fecha_limite: e.target.value || undefined })} aria-label="Fecha límite" />
                        </div>
                      </div>
                      <button type="button" className="chip ghost" onClick={() => setTasks((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Quitar">
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
              {!cal.connected && <div className="s">Sin Google Calendar conectado: planifico solo con tus misiones y horas de sueño ({AGENDA.sleepStart}–{AGENDA.sleepEnd}).</div>}
              <button className="btn gold" onClick={() => void runPlan()}>
                <Icon id="spark" />
                Planificar en mis huecos
              </button>
            </>
          )}
          <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota para la IA (opcional): 'todo antes del viernes', 'las compras son urgentes'…" />
        </div>
      )}

      {(stage === 'planning' || stage === 'applying') && (
        <div className="py-8 text-center">
          <div className="sysline animate-pulse-slow">{stage === 'planning' ? 'Buscando huecos en tu semana…' : 'Creando misiones y eventos…'}</div>
        </div>
      )}

      {stage === 'plan' && plan && (
        <div className="flex flex-col gap-3 text-sm">
          <Notice tone="sys" icon="spark">
            {plan.resumen}
          </Notice>
          {Object.keys(byDay)
            .sort()
            .map((day) => (
              <div key={day}>
                <Label right={day === ctx.today ? 'hoy' : undefined}>{formatDayHuman(day)}</Label>
                <Card tone="tight" className="mt-2">
                  <div className="list">
                    {byDay[day]
                      .sort((a, b) => parseHHmm(a.inicio) - parseHHmm(b.inicio))
                      .map((a) => {
                        const t = tasks[a.tarea_index];
                        return (
                          <div key={`${a.tarea_index}`} className="row">
                            <IconSquare icon={ATTR_ICON[t.atributo]} color={ATTR_VAR[t.atributo]} size="sm" />
                            <div className="grow">
                              <div className="t" style={{ fontSize: 14 }}>
                                {t.nombre}
                              </div>
                              <div className="s">
                                {a.inicio} – {a.fin} · {a.razon}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              </div>
            ))}
          {plan.sin_lugar.length > 0 && (
            <Notice tone="gold" icon="timer">
              Sin lugar:{' '}
              {plan.sin_lugar
                .map((s) => `${tasks[s.tarea_index]?.nombre ?? '?'} (${s.motivo})`)
                .join(' · ')}
            </Notice>
          )}
          {plan.preguntas.length > 0 && (
            <>
              <Label>El Sistema necesita decidir contigo</Label>
              {plan.preguntas.map((q) => (
                <Card key={q.id}>
                  <div className="t" style={{ fontSize: 14 }}>
                    {q.texto}
                  </div>
                  <div className="row mt-3" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {q.opciones.map((o) => (
                      <button key={o} type="button" className={`chip ${answers[q.id] === o ? '' : 'ghost'}`} style={{ '--c': 'var(--color-system)', height: 32 } as CSSProperties} onClick={() => setAnswers((an) => ({ ...an, [q.id]: o }))}>
                        {o}
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
              {canAskMore ? (
                <button className="btn system" disabled={unanswered.length > 0} onClick={() => void runPlan(answers)}>
                  Responder y volver a planificar ({AGENDA.maxRounds - round} rondas más)
                </button>
              ) : (
                <div className="s">Se agotaron las rondas de preguntas. Confirma lo que cabe y ajusta el resto a mano desde la misión.</div>
              )}
            </>
          )}
          {plan.movimientos_sugeridos.length > 0 && (
            <>
              <Label>Movimientos sugeridos (no se aplican sin tu OK)</Label>
              {plan.movimientos_sugeridos.map((mv, i) => {
                const ev = findEvent(mv);
                const on = acceptedMoves.has(i);
                return (
                  <Card key={i} tone="tight">
                    <div className="row" style={{ padding: '10px 0' }}>
                      <div className="grow">
                        <div className="t" style={{ fontSize: 14 }}>
                          {mv.que}
                        </div>
                        <div className="s">
                          {mv.de.dia} {mv.de.inicio} → {mv.a.dia} {mv.a.inicio}–{mv.a.fin} · {mv.motivo}
                          {!ev && ' · no encontré este evento en tu calendario: no se moverá'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`chip ${on ? '' : 'ghost'}`}
                        style={{ '--c': 'var(--color-gold)' } as CSSProperties}
                        disabled={!ev}
                        onClick={() =>
                          setAcceptedMoves((s) => {
                            const n = new Set(s);
                            if (n.has(i)) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                      >
                        {on ? 'Se moverá' : 'No mover'}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
          {cal.connected && targetCalendar && (
            <label className="row" style={{ gap: 10 }}>
              <input type="checkbox" checked={writeToCalendar} onChange={(e) => setWriteToCalendar(e.target.checked)} />
              <span className="grow">
                Crear también en Google Calendar ({targetCalendar.summary}) con el prefijo "{AGENDA.eventPrefix.trim()}"
              </span>
            </label>
          )}
          <div className="s">Cada tarea será una misión con foto obligatoria: da XP y monedas y sube el área elegida. Si vence sin foto, cuesta un corazón.</div>
          <div className="flex gap-2">
            <button className="btn gold" disabled={plan.asignaciones.length === 0} onClick={() => void confirm()}>
              <Icon id="check" />
              Confirmar plan ({plan.asignaciones.length})
            </button>
            <button className="btn ghost auto" onClick={() => setStage('input')}>
              Editar lista
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="flex flex-col gap-3 text-sm">
          <Notice tone="xp" icon="check">
            {result.created} tarea{result.created === 1 ? '' : 's'} planificada{result.created === 1 ? '' : 's'}. Las verás en "Para hoy" el día que tocan y aquí en la agenda.
          </Notice>
          {result.errors.map((e) => (
            <Notice key={e} tone="danger" icon="shield">
              {e}
            </Notice>
          ))}
          <button className="btn system" onClick={close}>
            Listo
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function TaskAttrChip({ attr }: { attr: AttributeId }) {
  return (
    <Chip color={ATTR_VAR[attr]} icon={ATTR_ICON[attr]}>
      {ATTRIBUTE_META[attr].name}
    </Chip>
  );
}
