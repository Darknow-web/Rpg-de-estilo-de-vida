import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { buildWeek } from '@/core/missions/schedule';
import { WEEKDAY_LABELS, weekdayOf, minutesToHuman } from '@/lib/time';
import { Card, Label, Notice, Row, ATTR_ICON, ATTR_VAR } from '@/components/ui/primitives';
import { AgendaScreen } from '@/modules/calendar/ui/AgendaScreen';
import { Icon } from '@/components/ui/Icon';

/** Semana: pestañas Carga (7 columnas, día saturado) y Agenda (Google Calendar). */
export function WeekScreen() {
  const ctx = useGameContext();
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'carga' | 'agenda'>('carga');
  if (!ctx) return null;
  if (tab === 'agenda')
    return (
      <div className="screen" style={{ '--tint': 'var(--color-system)' } as CSSProperties}>
        <div className="head center">
          <span className="title">Semana</span>
        </div>
        <Tabs tab={tab} setTab={setTab} />
        <AgendaScreen embedded />
      </div>
    );
  const week = buildWeek(ctx.missions, ctx.completions, ctx.today);
  const maxMin = Math.max(30, ...week.map((d) => d.minutes));
  const declared = ctx.player.interview?.answers.q4_time;
  const budget = declared === '15' ? 15 : declared === '30' ? 30 : declared === '60' ? 60 : 90;
  const over = week.filter((d) => d.minutes > budget);
  const selected = week.find((d) => d.day === (sel ?? ctx.today)) ?? week[0];
  return (
    <div className="screen" style={{ '--tint': 'var(--color-xp)' } as CSSProperties}>
      <div className="head center">
        <span className="title">Semana</span>
      </div>
      <Tabs tab={tab} setTab={setTab} />
      <Label right={`Tu tiempo: ${budget} min/día`}>Carga por día</Label>
      <Card>
        <div className="weekbars">
          {week.map((d) => {
            const isOver = d.minutes > budget;
            const isToday = d.day === ctx.today;
            return (
              <button key={d.day} type="button" className={`wb ${isToday ? 'today' : ''} ${isOver ? 'over' : ''}`} style={{ outline: selected.day === d.day && !isToday ? '1px solid var(--color-track)' : undefined }} onClick={() => setSel(d.day)}>
                <span className="d">{WEEKDAY_LABELS[weekdayOf(d.day)].slice(0, 2)}</span>
                <span className="col">
                  <i style={{ height: `${Math.round((d.minutes / maxMin) * 100)}%` }} />
                </span>
                <span className="m num">{d.minutes}′</span>
                <span className="s num" style={{ margin: 0, fontSize: 10 }}>
                  {d.done}/{d.missions.length}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      {over.length > 0 && (
        <Notice tone="danger" icon="timer">
          {over.length === 1 ? `El ${WEEKDAY_LABELS[weekdayOf(over[0].day)]} se pasa de tu tiempo declarado (${over[0].minutes} de ${budget} min).` : `${over.length} días se pasan de tu tiempo declarado.`} Mueve o baja una misión antes de que te mate.
        </Notice>
      )}
      <Label right={minutesToHuman(selected.minutes)}>
        {WEEKDAY_LABELS[weekdayOf(selected.day)]} {selected.day.slice(8)}
        {selected.day === ctx.today ? ' · hoy' : ''}
      </Label>
      <Card tone="tight">
        <div className="list">
          {selected.missions.map((m) => (
            <Row key={m.id} icon={m.moduleId === 'gym' ? 'dumbbell' : ATTR_ICON[m.attribute]} color={ATTR_VAR[m.attribute]} title={m.name} sub={m.schedule.window === 'allDay' ? 'Todo el día' : `${m.schedule.window.start} – ${m.schedule.window.end} · ${m.estimatedMinutes} min`} to={`/missions/${m.id}`} chevron />
          ))}
          {selected.missions.length === 0 && (
            <div className="row">
              <div className="grow s" style={{ margin: 0 }}>
                Descanso. Cuenta como día limpio.
              </div>
            </div>
          )}
        </div>
      </Card>
      <Link to="/missions/new" className="chip ghost self-end">
        Agregar misión
      </Link>
    </div>
  );
}

function Tabs({ tab, setTab }: { tab: 'carga' | 'agenda'; setTab: (t: 'carga' | 'agenda') => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <button className={`chip ${tab === 'carga' ? '' : 'ghost'}`} style={{ '--c': 'var(--color-xp)', height: 36, justifyContent: 'center' } as CSSProperties} onClick={() => setTab('carga')}>
        <Icon id="cal" />
        Carga
      </button>
      <button className={`chip ${tab === 'agenda' ? '' : 'ghost'}`} style={{ '--c': 'var(--color-system)', height: 36, justifyContent: 'center' } as CSSProperties} onClick={() => setTab('agenda')}>
        <Icon id="timer" />
        Agenda
      </button>
    </div>
  );
}
