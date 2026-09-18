import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { buildWeek } from '@/core/missions/schedule';
import { WEEKDAY_LABELS, weekdayOf, minutesToHuman } from '@/lib/time';

/** Semana: cuadrícula de 7 días con la carga de cada uno, para detectar días saturados. */
export function WeekScreen() {
  const ctx = useGameContext();
  if (!ctx) return null;
  const week = buildWeek(ctx.missions, ctx.completions, ctx.today);
  const maxMin = Math.max(30, ...week.map((d) => d.minutes));
  const declared = ctx.player.interview?.answers.q4_time;
  const budget = declared === '15' ? 15 : declared === '30' ? 30 : declared === '60' ? 60 : 90;
  return (
    <div className="space-y-4 animate-fadein">
      <div>
        <h1 className="font-display text-xl text-gold">Tu semana</h1>
        <p className="text-xs text-mist">Carga por día. Si un día se pasa de tu tiempo declarado ({budget} min), se marca antes de que te mate.</p>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {week.map((d) => {
          const over = d.minutes > budget;
          const isToday = d.day === ctx.today;
          return (
            <div key={d.day} className={`flex flex-col items-center rounded-xl border p-1.5 ${isToday ? 'border-gold' : 'border-steel'} bg-void`}>
              <div className="text-[10px] text-mist">{WEEKDAY_LABELS[weekdayOf(d.day)]}</div>
              <div className={`text-sm ${isToday ? 'text-gold' : 'text-parchment'}`}>{Number(d.day.slice(8))}</div>
              <div className="mt-1 flex h-16 w-3 items-end overflow-hidden rounded bg-steel">
                <div className={`w-full ${over ? 'bg-ember' : 'bg-arcane'}`} style={{ height: `${Math.round((d.minutes / maxMin) * 100)}%` }} />
              </div>
              <div className={`mt-1 text-[10px] ${over ? 'text-ember' : 'text-mist'}`}>{d.minutes}m</div>
              <div className="text-[10px] text-mist">{d.done}/{d.missions.length}</div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        {week.map((d) => (
          <div key={d.day} className="rounded-xl bg-void p-3">
            <div className="flex items-center justify-between text-xs text-mist">
              <span>{WEEKDAY_LABELS[weekdayOf(d.day)]} {d.day.slice(5)}</span>
              <span>{minutesToHuman(d.minutes)}</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-sm">
              {d.missions.map((m) => (
                <li key={m.id}>
                  <Link to={`/missions/${m.id}`} className="text-parchment">
                    {m.schedule.window === 'allDay' ? 'Todo el día' : m.schedule.window.start} · {m.name}
                  </Link>
                </li>
              ))}
              {d.missions.length === 0 && <li className="text-mist">Descanso</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
