import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { DIFFICULTY_LABEL, TYPE_LABEL, MASTERY_LABEL } from '@/core/missions/factory';
import { masteryBar } from '@/core/mastery/mastery';
import { archiveMission, updateMission, moveWindowToday } from '@/core/missions/manage';
import { annulCompletion } from '@/core/completion/complete';
import { WEEKDAY_LABELS } from '@/lib/time';
import { Sheet } from '@/components/ui/Sheet';
import { MASTERY } from '@/lib/game-balance';
import type { Difficulty } from '@/shared/types';

export function MissionDetail() {
  const { id } = useParams();
  const ctx = useGameContext();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const m = ctx?.missions.find((x) => x.id === id);
  if (!ctx || !m) return <div className="text-sm text-mist">Misión no encontrada.</div>;
  const meta = ATTRIBUTE_META[m.attribute];
  const bar = masteryBar(m.mastery);
  const comps = ctx.completions.filter((c) => c.missionId === m.id).sort((a, b) => (a.day < b.day ? 1 : -1));
  const fails = ctx.failures.filter((f) => f.missionId === m.id).length;
  const adv = ctx.player.flags.advancedMode;

  return (
    <div className="space-y-4 animate-fadein">
      <div>
        <button className="text-xs text-mist" onClick={() => navigate(-1)}>
          ← Volver
        </button>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-mist">
          <span style={{ color: meta.color }}>{meta.icon} {meta.name}</span>
          <span>· {TYPE_LABEL[m.type]}</span>
          <span>· {DIFFICULTY_LABEL[m.difficulty]}</span>
          {m.escalationLevel > 0 && <span>· escalada ×{m.escalationLevel}</span>}
          {!m.active && <span className="text-ember">· archivada</span>}
        </div>
        <h1 className="font-display text-xl text-gold">{m.name}</h1>
        <p className="text-sm text-parchment">{m.description}</p>
        {m.anchor && <p className="mt-1 text-xs text-mist">Ancla: {m.anchor}</p>}
      </div>

      <div className="panel p-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs text-mist">
          <div>XP: <span className="text-arcane-glow">{m.xp}</span></div>
          <div>Monedas: <span className="text-gold">{m.coins}</span></div>
          <div>Fallar cuesta: <span className="text-blood">{'♥'.repeat(m.heartsOnFail)}</span></div>
          <div>Duración: <span className="text-parchment">{m.estimatedMinutes} min</span></div>
          <div className="col-span-2">
            Ventana: <span className="text-parchment">{m.schedule.window === 'allDay' ? 'todo el día' : `${m.schedule.window.start}–${m.schedule.window.end}`}</span>
            {m.schedule.windowsByDay && <span className="text-mist"> (varía por día)</span>}
          </div>
          {m.type === 'daily' && (
            <div className="col-span-2">
              Días: <span className="text-parchment">{m.schedule.days.length === 7 ? 'todos' : m.schedule.days.map((d) => WEEKDAY_LABELS[d]).join(', ')}</span>
            </div>
          )}
          {m.type === 'weekly' && (
            <div className="col-span-2">
              Veces por semana: <span className="text-parchment">{m.schedule.timesPerWeek}</span>
            </div>
          )}
          {m.evidenceHint && <div className="col-span-2">Prueba sugerida: <span className="text-parchment">{m.evidenceHint}</span></div>}
        </div>
      </div>

      {m.type === 'daily' && (
        <div className="panel p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-widest text-mist">Dominio · {MASTERY_LABEL[m.mastery.state]}</span>
            <span className="text-mist">{bar.label}</span>
          </div>
          <div className="bar mt-2">
            <div className="bg-arcane" style={{ width: `${Math.min(100, Math.round((bar.current / Math.max(1, bar.target)) * 100))}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-mist">
            <span>
              {bar.current}/{bar.target} días
            </span>
            {bar.failsLeft !== null && <span>{bar.failsLeft} fallas de margen</span>}
          </div>
          <div className="mt-2 text-[11px] text-mist">
            {m.mastery.state === 'mastered' ? `Dominada: ya no descuenta corazones, XP a la mitad. Faltan ${Math.max(0, MASTERY.automated.cumulativeDays - m.mastery.cumulativeDays)} días acumulados para Automatizada.` : `Consolidada a los ${MASTERY.consolidated.days} días (≤${MASTERY.consolidated.maxFails} fallas), Dominada a los ${MASTERY.mastered.days} (≤${MASTERY.mastered.maxFails}), Automatizada a los ${MASTERY.automated.cumulativeDays} acumulados.`}
          </div>
          <div className="mt-1 text-[11px] text-mist">Formar un hábito real toma en promedio 66 días, con un rango de {MASTERY.automated.rangeText}. Tardar más es completamente normal.</div>
          <div className="mt-2 flex gap-0.5">
            {m.mastery.history
              .slice(-30)
              .split('')
              .map((c, i) => (
                <div key={i} className={`h-3 flex-1 rounded-sm ${c === '1' ? 'bg-life' : 'bg-blood/60'}`} />
              ))}
          </div>
        </div>
      )}

      <Link to={`/missions/${m.id}/gallery`} className="btn btn-ghost w-full">
        🖼 Galería de evidencias ({comps.filter((c) => c.evidenceId).length})
      </Link>

      {m.mastery.state !== 'new' && m.minimalVersion && m.escalationLevel > 0 && (
        <div className="panel p-3 text-xs text-mist">
          Versión mínima viable guardada: <span className="text-parchment">{m.minimalVersion.name}</span>
        </div>
      )}

      <div className="panel p-3">
        <div className="text-xs uppercase tracking-widest text-mist">Historial reciente</div>
        <div className="mt-1 text-[11px] text-mist">
          {comps.length} completaciones · {fails} fallas (últimos 45 días)
        </div>
        <ul className="mt-2 space-y-1 text-xs">
          {comps.slice(0, 10).map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span className={c.status === 'annulled' ? 'text-mist line-through' : 'text-parchment'}>
                {c.day} · {c.status === 'grace' ? 'en gracia' : c.status === 'annulled' ? 'anulada' : 'a tiempo'} · +{c.xpAwarded} XP
              </span>
              {c.status !== 'annulled' && (
                <button className="text-mist underline" onClick={() => annulCompletion(ctx, c.id, 'anulada por el jugador').then(() => setMsg('Completación anulada. Queda anotada en el historial.'))}>
                  anular
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {msg && (
        <div className="rounded-xl bg-void p-3 text-sm" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}

      <div className="flex gap-2">
        {ctx.effects.moveWindowOncePerDay && m.schedule.window !== 'allDay' && (
          <button
            className="btn btn-ghost btn-sm flex-1"
            onClick={() => {
              const start = prompt('Nueva hora de inicio (HH:mm)', (m.schedule.window as { start: string }).start);
              const end = prompt('Nueva hora límite (HH:mm)', (m.schedule.window as { end: string }).end);
              if (start && end) void moveWindowToday(ctx, m.id, { start, end }).then((r) => setMsg(r.ok ? 'Ventana movida por hoy.' : r.error ?? ''));
            }}
          >
            Mover ventana hoy
          </button>
        )}
        <button className="btn btn-ghost btn-sm flex-1" onClick={() => setEditOpen(true)}>
          Editar
        </button>
        {m.active && (
          <button className="btn btn-danger btn-sm" onClick={() => archiveMission(ctx, m.id, 'archivada por el jugador').then(() => navigate('/'))}>
            Archivar
          </button>
        )}
      </div>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Editar misión" tall>
        <EditForm
          initial={m}
          advanced={adv}
          onSave={async (patch) => {
            await updateMission(ctx, m.id, patch, 'edición manual');
            setEditOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}

function EditForm({ initial, advanced, onSave }: { initial: ReturnType<typeof Object>['constructor'] extends never ? never : import('@/shared/types').Mission; advanced: boolean; onSave: (patch: Partial<import('@/shared/types').Mission>) => Promise<void> }) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [anchor, setAnchor] = useState(initial.anchor ?? '');
  const [days, setDays] = useState<number[]>(initial.schedule.days);
  const [allDay, setAllDay] = useState(initial.schedule.window === 'allDay');
  const [start, setStart] = useState(initial.schedule.window === 'allDay' ? '08:00' : initial.schedule.window.start);
  const [end, setEnd] = useState(initial.schedule.window === 'allDay' ? '10:00' : initial.schedule.window.end);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const [minutes, setMinutes] = useState(initial.estimatedMinutes);
  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));
  return (
    <div className="space-y-3 text-sm">
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
      <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" />
      <input className="input" value={anchor} onChange={(e) => setAnchor(e.target.value)} placeholder="Ancla: después de…" />
      {initial.type === 'daily' && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAY_LABELS.map((l, d) => (
            <button key={d} className={`chip ${days.includes(d) ? 'chip-active' : ''}`} onClick={() => toggleDay(d)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-mist">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Todo el día
      </label>
      {!allDay && (
        <div className="flex gap-2">
          <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      )}
      {advanced && (
        <>
          <label className="block text-xs text-mist">
            Dificultad (recalcula XP, monedas y corazones desde el balance)
            <select className="input mt-1" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {(['easy', 'medium', 'hard', 'epic'] as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-mist">
            Duración estimada (min)
            <input type="number" className="input mt-1" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </label>
        </>
      )}
      <button
        className="btn btn-primary w-full"
        onClick={() =>
          onSave({
            name,
            description,
            anchor: anchor || undefined,
            schedule: { ...initial.schedule, days: initial.type === 'daily' ? (days.length ? days : initial.schedule.days) : initial.schedule.days, window: allDay ? 'allDay' : { start, end } },
            difficulty,
            estimatedMinutes: minutes,
          })
        }
      >
        Guardar
      </button>
    </div>
  );
}
