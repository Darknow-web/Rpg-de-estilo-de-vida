import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameContext } from '@/state/game';
import { useGym, saveProfile, saveAvailability } from '../store';
import { EQUIPMENT, GYM_PRESETS, equipmentName, type GymType } from '../data/equipment';
import { EXERCISES, PATTERN_LABEL } from '../data/exercises';
import { proposeSessionsPerWeek } from '../routine/generator';
import { parseAvailability } from '../availability/parse';
import type { AvailabilityBlock, GymProfile } from '../types';
import { ensureWeeklyRoutine } from '../index';
import { WEEKDAY_LABELS, weekKey } from '@/lib/time';
import { nowIso } from '@/lib/ids';
import { Sheet } from '@/components/ui/Sheet';

/**
 * Módulo gimnasio: 1) tipo de gimnasio → equipamiento preseleccionado, 2) disponibilidad
 * (chips o texto libre con IA), 3) deportes, 4) rutina generada en los huecos con solo tu equipamiento.
 */
export function GymScreen() {
  const ctx = useGameContext();
  const g = useGym();
  const [step, setStep] = useState<'equipment' | 'availability' | 'sports' | 'routine'>('routine');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ctx) g.bind(ctx.uid, weekKey(ctx.today));
  }, [ctx?.uid, ctx?.today]);

  useEffect(() => {
    if (!g.loaded) return;
    if (!g.profile) setStep('equipment');
    else if (!g.availability) setStep('availability');
    else setStep('routine');
  }, [g.loaded, Boolean(g.profile), Boolean(g.availability)]);

  useEffect(() => {
    if (ctx && g.profile && g.availability && step === 'routine' && (!g.routine || g.routine.weekKey !== weekKey(ctx.today))) {
      void ensureWeeklyRoutine(ctx);
    }
  }, [ctx?.today, g.profile, g.availability, g.routine?.weekKey, step]);

  if (!ctx) return null;
  if (!g.loaded) return <p className="text-sm text-mist">Cargando gimnasio…</p>;

  return (
    <div className="space-y-4 animate-fadein">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl text-gold">Gimnasio</h1>
          <p className="text-xs text-mist">Rutina que cae en tus huecos y usa solo lo que tu gimnasio tiene.</p>
        </div>
        {g.profile && (
          <div className="flex gap-1 text-[11px]">
            <button className={`chip ${step === 'equipment' ? 'chip-active' : ''}`} onClick={() => setStep('equipment')}>
              Equipo
            </button>
            <button className={`chip ${step === 'availability' ? 'chip-active' : ''}`} onClick={() => setStep('availability')}>
              Horario
            </button>
            <button className={`chip ${step === 'routine' ? 'chip-active' : ''}`} onClick={() => setStep('routine')}>
              Rutina
            </button>
          </div>
        )}
      </div>
      {msg && (
        <div className="rounded-xl bg-void p-3 text-sm" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}
      {step === 'equipment' && (
        <EquipmentStep
          initial={g.profile}
          onSave={async (profile) => {
            setBusy(true);
            await saveProfile(ctx.uid, profile);
            setBusy(false);
            setStep(g.availability ? 'routine' : 'availability');
            if (g.availability) await ensureWeeklyRoutine(ctx, { force: true });
          }}
          busy={busy}
          timeAnswer={ctx.player.interview?.answers.q4_time}
          level={ctx.player.level.current}
        />
      )}
      {step === 'availability' && (
        <AvailabilityStep
          initial={g.availability?.template ?? []}
          onSave={async (template) => {
            setBusy(true);
            await saveAvailability(ctx.uid, { template, exceptions: g.availability?.exceptions ?? {}, updatedAt: nowIso() });
            setBusy(false);
            setStep('routine');
            await ensureWeeklyRoutine(ctx, { force: true });
          }}
          busy={busy}
        />
      )}
      {step === 'routine' && g.profile && g.availability && (
        <RoutineView
          onRegenerate={async () => {
            setBusy(true);
            await ensureWeeklyRoutine(ctx, { force: true });
            setBusy(false);
            setMsg('Rutina regenerada con tus bloques y equipamiento actuales.');
          }}
          busy={busy}
        />
      )}
    </div>
  );
}

function EquipmentStep({ initial, onSave, busy, timeAnswer, level }: { initial: GymProfile | null; onSave: (p: GymProfile) => Promise<void>; busy: boolean; timeAnswer?: string; level: number }) {
  const [gymType, setGymType] = useState<GymType | null>(initial?.gymType ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.equipment.map((e) => e.id) ?? []));
  const [showAll, setShowAll] = useState(false);
  const [sports, setSports] = useState(initial?.sports ?? []);
  const [sportName, setSportName] = useState('');
  const [sportDays, setSportDays] = useState<number[]>([]);
  const proposal = proposeSessionsPerWeek(timeAnswer, level);
  const pick = (t: GymType) => {
    setGymType(t);
    setSelected(new Set(GYM_PRESETS[t].equipment));
  };
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const coveredPatterns = useMemo(() => {
    const eq = new Set(selected);
    eq.add('bodyweight');
    return Object.keys(PATTERN_LABEL).map((p) => ({ p, ok: EXERCISES.some((e) => e.pattern === p && e.equipmentOptions.some((o) => o.every((id) => eq.has(id)))) }));
  }, [selected]);

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">1. ¿Qué tipo de gimnasio es?</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(Object.keys(GYM_PRESETS) as GymType[]).map((t) => (
            <button key={t} className={`rounded-xl border p-3 text-left text-sm ${gymType === t ? 'border-arcane bg-arcane/10' : 'border-steel bg-void'}`} onClick={() => pick(t)}>
              <div className="font-semibold text-parchment">{GYM_PRESETS[t].name}</div>
              <div className="mt-1 text-[11px] text-mist">{GYM_PRESETS[t].description}</div>
            </button>
          ))}
        </div>
      </section>
      {gymType && (
        <section className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">2. Confirma lo que hay ({selected.size})</div>
          <p className="text-[11px] text-mist">Quita lo que no tenga tu gimnasio. Solo se usarán ejercicios con este equipamiento.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {EQUIPMENT.filter((e) => showAll || selected.has(e.id) || GYM_PRESETS[gymType].equipment.includes(e.id)).map((e) => (
              <button key={e.id} className={`chip ${selected.has(e.id) ? 'chip-active' : ''}`} onClick={() => toggle(e.id)}>
                {e.name}
              </button>
            ))}
          </div>
          {!showAll && (
            <button className="mt-2 text-xs text-mist underline" onClick={() => setShowAll(true)}>
              Agregar máquinas una por una
            </button>
          )}
          <div className="mt-3 flex flex-wrap gap-1 text-[11px]">
            {coveredPatterns.map((c) => (
              <span key={c.p} className={`chip ${c.ok ? 'text-life' : 'text-ember'}`}>
                {c.ok ? '✓' : '✗'} {PATTERN_LABEL[c.p as keyof typeof PATTERN_LABEL]}
              </span>
            ))}
          </div>
        </section>
      )}
      {gymType && (
        <section className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">3. ¿Haces algún deporte fijo?</div>
          <p className="text-[11px] text-mist">Esos días no se programa gimnasio: ya son carga de entrenamiento.</p>
          {sports.map((s, i) => (
            <div key={i} className="mt-2 flex items-center justify-between rounded-xl bg-void px-3 py-2 text-sm">
              <span>
                {s.name} · {s.days.map((d) => WEEKDAY_LABELS[d]).join(', ')}
              </span>
              <button className="text-xs text-mist underline" onClick={() => setSports((x) => x.filter((_, j) => j !== i))}>
                quitar
              </button>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <input className="input" placeholder="Fútbol, correr, natación…" value={sportName} onChange={(e) => setSportName(e.target.value)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {WEEKDAY_LABELS.map((l, d) => (
              <button key={d} className={`chip ${sportDays.includes(d) ? 'chip-active' : ''}`} onClick={() => setSportDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))}>
                {l}
              </button>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              disabled={!sportName.trim() || !sportDays.length}
              onClick={() => {
                setSports((s) => [...s, { name: sportName.trim(), days: sportDays }]);
                setSportName('');
                setSportDays([]);
              }}
            >
              Agregar
            </button>
          </div>
        </section>
      )}
      {gymType && (
        <section className="panel p-4 text-sm">
          <div className="text-xs uppercase tracking-widest text-mist">4. Sesiones por semana (propuesta)</div>
          <p className="mt-1 text-parchment">
            {proposal.sessions} sesiones de hasta {proposal.maxMinutes} min.
          </p>
          <p className="text-[11px] text-mist">{proposal.reason}</p>
          <button
            className="btn btn-primary mt-3 w-full"
            disabled={busy}
            onClick={() =>
              onSave({
                gymType,
                equipment: [...selected].map((id) => ({ id, name: equipmentName(id) })),
                sports,
                sessionsPerWeek: initial?.sessionsPerWeek ?? proposal.sessions,
                maxSessionMinutes: initial?.maxSessionMinutes ?? proposal.maxMinutes,
                createdAt: initial?.createdAt ?? nowIso(),
                updatedAt: nowIso(),
              })
            }
          >
            Guardar mi gimnasio
          </button>
        </section>
      )}
    </div>
  );
}

function AvailabilityStep({ initial, onSave, busy }: { initial: AvailabilityBlock[]; onSave: (t: AvailabilityBlock[]) => Promise<void>; busy: boolean }) {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>(initial);
  const [text, setText] = useState('');
  const [ambiguities, setAmbiguities] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('19:30');
  const [icsOpen, setIcsOpen] = useState(false);

  const parse = async () => {
    setParsing(true);
    try {
      const r = await parseAvailability(text);
      setBlocks((b) => [...b, ...r.blocks]);
      setAmbiguities(r.ambiguities);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">Bloques libres de la semana (plantilla)</div>
        <p className="text-[11px] text-mist">Tu horario cambia cada semana: esta es la base. Las excepciones se editan desde la rutina.</p>
        <div className="mt-2 space-y-1">
          {blocks.map((b, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-void px-3 py-2 text-sm">
              <span>
                {WEEKDAY_LABELS[b.day]} {b.start}–{b.end}
              </span>
              <button className="text-xs text-mist underline" onClick={() => setBlocks((x) => x.filter((_, j) => j !== i))}>
                quitar
              </button>
            </div>
          ))}
          {blocks.length === 0 && <p className="text-sm text-mist">Sin bloques todavía.</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {WEEKDAY_LABELS.map((l, d) => (
              <option key={d} value={d}>
                {l}
              </option>
            ))}
          </select>
          <input type="time" className="input w-auto" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="time" className="input w-auto" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button className="btn btn-ghost btn-sm" onClick={() => setBlocks((b) => [...b, { day, start, end }])}>
            + Bloque
          </button>
        </div>
      </section>
      <section className="panel p-4">
        <div className="text-xs uppercase tracking-widest text-mist">O dícelo en tus palabras</div>
        <textarea className="input mt-2" rows={2} placeholder='"lunes temprano antes de las 9, martes desde las 8 de la noche, sábado de 10 a 12"' value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-ghost btn-sm mt-2" disabled={parsing || text.trim().length < 3} onClick={parse}>
          {parsing ? 'Interpretando…' : 'Convertir a bloques'}
        </button>
        {ambiguities.length > 0 && (
          <div className="mt-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs text-parchment">
            <div className="font-semibold text-gold">No quisimos adivinar:</div>
            <ul className="mt-1 list-disc pl-4">
              {ambiguities.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        <button className="mt-2 block text-xs text-mist underline" onClick={() => setIcsOpen(true)}>
          Importar desde calendario (.ics)
        </button>
      </section>
      <button className="btn btn-primary w-full" disabled={busy || blocks.length === 0} onClick={() => onSave(blocks)}>
        Guardar horario y generar rutina
      </button>
      <Sheet open={icsOpen} onClose={() => setIcsOpen(false)} title="Importar .ics">
        <p className="text-sm text-mist">El adaptador de calendario está preparado (interfaz + stub) pero todavía no lee eventos. Por ahora, pega tu disponibilidad en texto o agrega bloques a mano.</p>
        <button className="btn btn-ghost mt-3 w-full" onClick={() => setIcsOpen(false)}>
          Entendido
        </button>
      </Sheet>
    </div>
  );
}

function RoutineView({ onRegenerate, busy }: { onRegenerate: () => Promise<void>; busy: boolean }) {
  const g = useGym();
  const r = g.routine;
  const [open, setOpen] = useState<string | null>(null);
  if (!r) return <p className="text-sm text-mist">Generando rutina…</p>;
  const ex = open ? EXERCISES.find((e) => e.id === open) : null;
  return (
    <div className="space-y-3">
      {r.notes.map((n, i) => (
        <div key={i} className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs text-parchment">
          {n}
        </div>
      ))}
      {r.sessions.length === 0 && <div className="panel p-4 text-sm text-mist">No hay bloques suficientes para una sesión de 25+ min. Agrega bloques en Horario.</div>}
      {r.sessions.map((s) => (
        <div key={s.index} className="panel p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-mist">
                {WEEKDAY_LABELS[s.day]} {s.start}–{s.end} · {s.minutes} min
              </div>
              <div className="font-semibold text-parchment">{s.focus}</div>
            </div>
            {r.missionId && (
              <Link to={`/gym/session/${r.missionId}?s=${s.index}`} className="btn btn-ghost btn-sm">
                Ver sesión
              </Link>
            )}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="text-mist">Calentamiento 5 min (caminar, movilidad)</li>
            {s.exercises.map((e, i) => {
              const def = EXERCISES.find((x) => x.id === e.exerciseId);
              return (
                <li key={i} className="flex items-center justify-between">
                  <button className="text-left text-parchment underline decoration-steel" onClick={() => setOpen(e.exerciseId)}>
                    {def?.name ?? e.exerciseId}
                  </button>
                  <span className="text-xs text-mist">
                    {e.sets}×{e.reps}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <button className="btn btn-ghost w-full" disabled={busy} onClick={onRegenerate}>
        Regenerar rutina de esta semana
      </button>
      {r.uncoveredPatterns.length > 0 && <p className="text-xs text-ember">Patrones sin cubrir: {r.uncoveredPatterns.join(', ')}.</p>}
      <Sheet open={Boolean(ex)} onClose={() => setOpen(null)} title={ex?.name} tall>
        {ex && <ExerciseGuide ex={ex} />}
      </Sheet>
    </div>
  );
}

export function ExerciseGuide({ ex }: { ex: (typeof EXERCISES)[number] }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="text-xs text-mist">
        {PATTERN_LABEL[ex.pattern]} · {ex.muscles.join(', ')} · {ex.sets}×{ex.reps} · descanso {ex.restSec}s
      </div>
      <Row k="Cómo ajustar" v={ex.guide.setup} />
      <Row k="Cómo colocarse" v={ex.guide.position} />
      <Row k="Respiración" v={ex.guide.breathing} />
      <Row k="Ritmo" v={ex.guide.tempo} />
      <Row k="Errores típicos" v={ex.guide.mistakes} />
      <Row k="Peso inicial" v={ex.guide.startingWeight} />
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-mist">{k}</div>
      <div className="text-parchment">{v}</div>
    </div>
  );
}
