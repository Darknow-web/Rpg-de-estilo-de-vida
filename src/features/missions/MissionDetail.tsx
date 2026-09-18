import { useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { DIFFICULTY_LABEL, TYPE_LABEL, MASTERY_LABEL } from '@/core/missions/factory';
import { masteryBar } from '@/core/mastery/mastery';
import { archiveMission, updateMission, moveWindowToday } from '@/core/missions/manage';
import { annulCompletion } from '@/core/completion/complete';
import { WEEKDAY_LABELS } from '@/lib/time';
import { Sheet } from '@/components/ui/Sheet';
import { MASTERY } from '@/lib/game-balance';
import type { Difficulty, Mission } from '@/shared/types';
import { Icon } from '@/components/ui/Icon';
import { ATTR_ICON, ATTR_VAR, Bar, Card, Chip, IconSquare, Label, Notice, PageHead, Row } from '@/components/ui/primitives';

export function MissionDetail() {
  const { id } = useParams();
  const ctx = useGameContext();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const m = ctx?.missions.find((x) => x.id === id);
  if (!ctx || !m)
    return (
      <div className="screen">
        <PageHead title="Misión" />
        <Notice tone="danger">Misión no encontrada.</Notice>
      </div>
    );
  const meta = ATTRIBUTE_META[m.attribute];
  const bar = masteryBar(m.mastery);
  const comps = ctx.completions.filter((c) => c.missionId === m.id).sort((a, b) => (a.day < b.day ? 1 : -1));
  const fails = ctx.failures.filter((f) => f.missionId === m.id).length;
  const adv = ctx.player.flags.advancedMode;
  const history = m.mastery.history.slice(-30).padStart(30, ' ').split('');

  return (
    <div className="screen" style={{ '--tint': ATTR_VAR[m.attribute] } as CSSProperties}>
      <PageHead title={TYPE_LABEL[m.type]} action={!m.active ? <span style={{ color: 'var(--color-ember)' }}>archivada</span> : undefined} />
      <Card>
        <div className="row">
          <IconSquare icon={m.moduleId === 'gym' ? 'dumbbell' : ATTR_ICON[m.attribute]} color={ATTR_VAR[m.attribute]} />
          <div className="grow">
            <div className="t" style={{ fontSize: 17 }}>
              {m.name}
            </div>
            <div className="s">
              {meta.name} · {DIFFICULTY_LABEL[m.difficulty]}
              {m.escalationLevel > 0 ? ` · escalada ×${m.escalationLevel}` : ''}
            </div>
          </div>
        </div>
        <p className="s mt-3">{m.description}</p>
        {m.anchor && <p className="s mt-1">Ancla: {m.anchor}</p>}
        <div className="row mt-4" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Chip color="var(--color-xp)" icon="zap">
            +{m.xp} XP
          </Chip>
          <Chip color="var(--color-gold)" icon="coin">
            {m.coins}
          </Chip>
          {m.stakes === 'none' ? (
            <Chip color="var(--color-dim)">sin castigo</Chip>
          ) : (
            <Chip color="var(--color-hp)" icon="vital">
              −{m.heartsOnFail} al fallar
            </Chip>
          )}
          <Chip color="var(--color-dim)" icon="timer">
            {m.estimatedMinutes} min
          </Chip>
        </div>
      </Card>

      <Card tone="tight">
        <div className="list">
          <div className="row">
            <div className="grow s" style={{ margin: 0 }}>
              Ventana
            </div>
            <span style={{ fontWeight: 600 }}>
              {m.schedule.window === 'allDay' ? 'Todo el día' : `${m.schedule.window.start} – ${m.schedule.window.end}`}
              {m.schedule.windowsByDay && <span className="s"> (varía por día)</span>}
            </span>
          </div>
          {m.type === 'daily' && (
            <div className="row">
              <div className="grow s" style={{ margin: 0 }}>
                Días
              </div>
              <span style={{ fontWeight: 600 }}>{m.schedule.days.length === 7 ? 'Todos' : m.schedule.days.map((d) => WEEKDAY_LABELS[d]).join(', ')}</span>
            </div>
          )}
          {m.type === 'weekly' && (
            <div className="row">
              <div className="grow s" style={{ margin: 0 }}>
                Veces por semana
              </div>
              <span style={{ fontWeight: 600 }}>{m.schedule.timesPerWeek}</span>
            </div>
          )}
          {m.schedule.once && (
            <div className="row">
              <div className="grow s" style={{ margin: 0 }}>
                Fecha
              </div>
              <span style={{ fontWeight: 600 }}>{m.schedule.once}</span>
            </div>
          )}
          {m.evidenceHint && (
            <div className="row">
              <div className="grow s" style={{ margin: 0 }}>
                Prueba sugerida
              </div>
              <span style={{ fontWeight: 600, textAlign: 'right' }}>{m.evidenceHint}</span>
            </div>
          )}
        </div>
      </Card>

      {m.type === 'daily' && (
        <Card>
          <Label right={bar.label}>Dominio · {MASTERY_LABEL[m.mastery.state]}</Label>
          <Bar className="mt-3" value={bar.current} max={Math.max(1, bar.target)} color="var(--color-arcane)" minmax={[`${bar.current}/${bar.target} días`, bar.failsLeft !== null ? `${bar.failsLeft} fallas de margen` : '']} />
          <div className="dots30 mt-4" aria-label="Últimos 30 días">
            {history.map((c, i) => (
              <i key={i} className={c === '1' ? 'ok' : c === '0' ? 'no' : ''} />
            ))}
          </div>
          <div className="s mt-3">
            {m.mastery.state === 'mastered'
              ? `Dominada: ya no descuenta corazones, XP a la mitad. Faltan ${Math.max(0, MASTERY.automated.cumulativeDays - m.mastery.cumulativeDays)} días acumulados para Automatizada.`
              : `Consolidada a los ${MASTERY.consolidated.days} días (≤${MASTERY.consolidated.maxFails} fallas), Dominada a los ${MASTERY.mastered.days} (≤${MASTERY.mastered.maxFails}), Automatizada a los ${MASTERY.automated.cumulativeDays} acumulados.`}
          </div>
          <div className="s mt-1">Formar un hábito real toma en promedio 66 días, con un rango de {MASTERY.automated.rangeText}. Tardar más es completamente normal.</div>
        </Card>
      )}

      <Card tone="tight">
        <div className="list">
          <Row icon="camera" color="var(--color-xp)" title="Galería de evidencias" sub={`${comps.filter((c) => c.evidenceId).length} fotos`} to={`/missions/${m.id}/gallery`} chevron />
        </div>
      </Card>

      {m.mastery.state !== 'new' && m.minimalVersion && m.escalationLevel > 0 && <Notice tone="sys">Versión mínima viable guardada: {m.minimalVersion.name}</Notice>}

      <Label right={`${comps.length} hechas · ${fails} fallas`}>Historial reciente</Label>
      <Card tone="tight">
        <div className="list">
          {comps.length === 0 && (
            <div className="row">
              <div className="grow s" style={{ margin: 0 }}>
                Todavía sin completaciones.
              </div>
            </div>
          )}
          {comps.slice(0, 10).map((c) => (
            <div key={c.id} className="row">
              <div className="grow">
                <div className="t" style={{ fontSize: 14, color: c.status === 'annulled' ? 'var(--color-dim)' : undefined, textDecoration: c.status === 'annulled' ? 'line-through' : undefined }}>
                  {c.day}
                </div>
                <div className="s">
                  {c.status === 'grace' ? 'En gracia' : c.status === 'annulled' ? 'Anulada' : 'A tiempo'} · +{c.xpAwarded} XP
                </div>
              </div>
              {c.status !== 'annulled' && (
                <button className="chip ghost" onClick={() => annulCompletion(ctx, c.id, 'anulada por el jugador').then(() => setMsg('Completación anulada. Queda anotada en el historial.'))}>
                  Anular
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {msg && (
        <Notice tone="sys">
          <span onClick={() => setMsg(null)}>{msg}</span>
        </Notice>
      )}

      <div className="flex gap-2">
        {ctx.effects.moveWindowOncePerDay && m.schedule.window !== 'allDay' && (
          <button
            className="btn ghost sm"
            onClick={() => {
              const start = prompt('Nueva hora de inicio (HH:mm)', (m.schedule.window as { start: string }).start);
              const end = prompt('Nueva hora límite (HH:mm)', (m.schedule.window as { end: string }).end);
              if (start && end) void moveWindowToday(ctx, m.id, { start, end }).then((r) => setMsg(r.ok ? 'Ventana movida por hoy.' : r.error ?? ''));
            }}
          >
            <Icon id="timer" />
            Mover hoy
          </button>
        )}
        <button className="btn ghost sm" onClick={() => setEditOpen(true)}>
          <Icon id="edit" />
          Editar
        </button>
        {m.active && (
          <button className="btn ghost sm" style={{ color: 'var(--color-hp)' }} onClick={() => archiveMission(ctx, m.id, 'archivada por el jugador').then(() => navigate('/'))}>
            <Icon id="archive" />
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

function EditForm({ initial, advanced, onSave }: { initial: Mission; advanced: boolean; onSave: (patch: Partial<Mission>) => Promise<void> }) {
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
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((l, d) => (
            <button key={d} className={`chip ${days.includes(d) ? '' : 'ghost'}`} style={{ '--c': 'var(--color-xp)' } as CSSProperties} onClick={() => toggleDay(d)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <label className="row text-xs text-dim" style={{ gap: 8 }}>
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
          <label className="block text-xs text-dim">
            Dificultad (recalcula XP, monedas y corazones desde el balance)
            <select className="input mt-1" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {(['easy', 'medium', 'hard', 'epic'] as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-dim">
            Duración estimada (min)
            <input type="number" className="input mt-1" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </label>
        </>
      )}
      <button
        className="btn system"
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
