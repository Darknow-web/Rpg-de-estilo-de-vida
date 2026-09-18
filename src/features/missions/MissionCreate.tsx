import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { quotaFor } from '@/core/missions/quota';
import { createMission } from '@/core/missions/manage';
import { suggestNewMission, type MissionSuggestion } from '@/core/missions/proposals';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { ATTRIBUTE_IDS, type AttributeId, type Difficulty, type MissionType } from '@/shared/types';
import { WEEKDAY_LABELS } from '@/lib/time';
import { DIFFICULTY_LABEL, TYPE_LABEL } from '@/core/missions/factory';
import { rankForLevel } from '@/lib/game-balance';
import { Icon } from '@/components/ui/Icon';
import { ATTR_ICON, ATTR_VAR, Card, IconSquare, Label, Notice, PageHead } from '@/components/ui/primitives';

/**
 * Crear misión: primero la PROPUESTA (un toque). El formulario manual está detrás de "modo avanzado"
 * o del botón "prefiero escribirla yo". Cupo explicado en lenguaje de juego, nunca un error seco.
 */
export function MissionCreate() {
  const ctx = useGameContext();
  const navigate = useNavigate();
  const [type, setType] = useState<MissionType>('daily');
  const [sug, setSug] = useState<MissionSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!ctx) return null;
  const quota = quotaFor(type, ctx.player, ctx.missions, ctx.effects);
  const rank = rankForLevel(ctx.player.level.current);
  const unlockedTypes: MissionType[] = (['daily', 'weekly', 'main', 'side', 'boss'] as MissionType[]).filter((t) => {
    const needed = { daily: 'D', weekly: 'D', main: 'D', side: 'C', boss: 'B', hidden: 'A' }[t];
    return ['D', 'C', 'B', 'A', 'S'].indexOf(rank.id) >= ['D', 'C', 'B', 'A', 'S'].indexOf(needed);
  });

  const propose = async () => {
    setBusy(true);
    try {
      setSug(await suggestNewMission(ctx));
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!sug) return;
    const r = await createMission(ctx, sug.template, sug.source === 'ai' ? 'ai-proposal' : 'fallback');
    if (!r.ok) setErr(r.error ?? '');
    else navigate('/');
  };

  return (
    <div className="screen" style={{ '--tint': 'var(--color-system)' } as CSSProperties}>
      <PageHead title="Nueva misión" />
      <div className="flex flex-wrap gap-1.5">
        {unlockedTypes.map((t) => (
          <button key={t} className={`chip ${type === t ? '' : 'ghost'}`} style={{ '--c': 'var(--color-system)', height: 32, fontSize: 12.5 } as CSSProperties} onClick={() => setType(t)}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <Label right={`${quota.used}/${quota.max}`}>Cupo {TYPE_LABEL[type].toLowerCase()}</Label>
      {!quota.allowed && (
        <Card>
          <div className="row">
            <IconSquare icon="book" color="var(--color-dim)" />
            <div className="grow">
              <div className="t">Bitácora llena</div>
              <div className="s">{quota.reason}</div>
            </div>
          </div>
          {quota.nextUnlock && <div className="s mt-3" style={{ color: 'var(--color-system)' }}>{quota.nextUnlock}</div>}
          <div className="s mt-2">Empezar pequeño es obligatorio: 3 a 5 misiones al inicio. El cupo se gana jugando, no configurando.</div>
        </Card>
      )}
      {quota.allowed && type === 'daily' && !manual && (
        <Card tone="sys">
          <div className="row">
            <IconSquare icon="spark" color="var(--color-system)" />
            <div className="grow s" style={{ margin: 0 }}>
              Deja que el Sistema proponga la siguiente misión a partir de tu meta y lo que ya dominas.
            </div>
          </div>
          {!sug ? (
            <button className="btn system mt-4" onClick={propose} disabled={busy}>
              {busy ? 'Pensando…' : 'Proponme una misión'}
            </button>
          ) : (
            <div className="mt-4 rounded-2xl bg-card-2 p-3">
              <div className="row">
                <IconSquare icon={ATTR_ICON[sug.template.attribute]} color={ATTR_VAR[sug.template.attribute]} size="sm" />
                <div className="grow">
                  <div className="t" style={{ fontSize: 14 }}>
                    {sug.template.name}
                  </div>
                  <div className="s">
                    {ATTRIBUTE_META[sug.template.attribute].name} · {DIFFICULTY_LABEL[sug.template.difficulty]} · {sug.template.estimatedMinutes} min
                  </div>
                </div>
              </div>
              <div className="s mt-2">{sug.template.description}</div>
              <div className="s mt-2">
                <b style={{ color: 'var(--color-ink)' }}>Por qué:</b> {sug.reason}
              </div>
              {err && <div className="s mt-2" style={{ color: 'var(--color-ember)' }}>{err}</div>}
              <div className="mt-3 flex gap-2">
                <button className="btn system sm" onClick={accept}>
                  Aceptar
                </button>
                <button className="btn ghost sm auto" onClick={propose} disabled={busy}>
                  Otra
                </button>
              </div>
            </div>
          )}
          <button className="mt-3 w-full text-center text-xs text-mute underline" onClick={() => setManual(true)}>
            Prefiero escribirla yo
          </button>
        </Card>
      )}
      {quota.allowed && (manual || type !== 'daily') && <ManualForm type={type} onDone={() => navigate('/')} />}
    </div>
  );
}

function ManualForm({ type, onDone }: { type: MissionType; onDone: () => void }) {
  const ctx = useGameContext();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [anchor, setAnchor] = useState('');
  const [attribute, setAttribute] = useState<AttributeId>('disciplina');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('10:00');
  const [minutes, setMinutes] = useState(10);
  const [times, setTimes] = useState(2);
  const [items, setItems] = useState('');
  const [once, setOnce] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  if (!ctx) return null;
  const adv = ctx.player.flags.advancedMode;
  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));

  const save = async () => {
    if (name.trim().length < 3) return setErr('Ponle un nombre.');
    const list = items.split('\n').map((s) => s.trim()).filter(Boolean);
    if (type === 'boss' && (list.length < 3 || list.length > 10)) return setErr('Un boss necesita entre 3 y 10 subtareas.');
    if (type === 'main' && (list.length < 3 || list.length > 5)) return setErr('Una misión principal necesita entre 3 y 5 hitos.');
    const r = await createMission(
      ctx,
      {
        moduleId: 'habits',
        name: name.trim(),
        description: description.trim() || name.trim(),
        attribute,
        type,
        difficulty: type === 'boss' ? 'epic' : type === 'main' ? 'hard' : difficulty,
        schedule: type === 'weekly' ? { days: [], timesPerWeek: times, window: 'allDay' } : type === 'side' || type === 'boss' ? { days: [], window: 'allDay', once: once || undefined } : type === 'main' ? { days: [], window: 'allDay' } : { days, window: allDay ? 'allDay' : { start, end } },
        estimatedMinutes: minutes,
        minimalVersion: { name: `${name.trim()} (mínimo)`, description: 'La versión más pequeña que aún cuenta.' },
        anchor: anchor || undefined,
        milestones: type === 'main' ? list : undefined,
        checklist: type === 'boss' ? list : undefined,
      },
      'player',
    );
    if (!r.ok) return setErr(r.error ?? '');
    if (r.overlapsWith?.length) setWarn(`Se solapa con: ${r.overlapsWith.join(', ')}. Tú decides.`);
    onDone();
  };

  return (
    <Card className="space-y-3 text-sm">
      <input className="input" placeholder="Nombre (mínimo viable: 'leer 2 páginas', no 'leer 30 min')" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="input" rows={2} placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      {(type === 'daily' || type === 'weekly') && <input className="input" placeholder="Ancla: después de… (algo que ya haces todos los días)" value={anchor} onChange={(e) => setAnchor(e.target.value)} />}
      <div className="flex flex-wrap gap-1.5">
        {ATTRIBUTE_IDS.map((a) => (
          <button key={a} className={`chip ${attribute === a ? '' : 'ghost'}`} style={{ '--c': ATTR_VAR[a], height: 32 } as CSSProperties} onClick={() => setAttribute(a)}>
            <Icon id={ATTR_ICON[a]} />
            {ATTRIBUTE_META[a].name}
          </button>
        ))}
      </div>
      {type === 'daily' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((l, d) => (
              <button key={d} className={`chip ${days.includes(d) ? '' : 'ghost'}`} style={{ '--c': 'var(--color-xp)' } as CSSProperties} onClick={() => toggleDay(d)}>
                {l}
              </button>
            ))}
          </div>
          <label className="row text-xs text-dim" style={{ gap: 8 }}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Todo el día
          </label>
          {!allDay && (
            <div className="flex gap-2">
              <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
              <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          )}
        </>
      )}
      {type === 'weekly' && (
        <label className="block text-xs text-dim">
          Veces por semana
          <input type="number" min={1} max={6} className="input mt-1" value={times} onChange={(e) => setTimes(Number(e.target.value))} />
        </label>
      )}
      {(type === 'main' || type === 'boss') && <textarea className="input" rows={4} placeholder={type === 'main' ? 'Hitos (uno por línea, 3 a 5)' : 'Subtareas (una por línea, 3 a 10). Una sola oportunidad.'} value={items} onChange={(e) => setItems(e.target.value)} />}
      {(type === 'side' || type === 'boss') && (
        <label className="block text-xs text-dim">
          Fecha límite (opcional)
          <input type="date" className="input mt-1" value={once} onChange={(e) => setOnce(e.target.value)} />
        </label>
      )}
      {(adv || type === 'side') && type !== 'boss' && type !== 'main' && (
        <label className="block text-xs text-dim">
          Dificultad
          <select className="input mt-1" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {(['easy', 'medium', 'hard', 'epic'] as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-xs text-dim">
        Duración estimada (min)
        <input type="number" min={1} className="input mt-1" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
      </label>
      {err && <Notice tone="danger">{err}</Notice>}
      {warn && <Notice tone="gold">{warn}</Notice>}
      <button className="btn system" onClick={save}>
        <Icon id="plus" />
        Crear
      </button>
    </Card>
  );
}
