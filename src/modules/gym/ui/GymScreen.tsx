import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { scanGymPhotos, GymScanUnavailable, GYM_SCAN, type GymScanResult } from '../scan';
import { Icon, type IconId } from '@/components/ui/Icon';
import { Card, Chip, IconSquare, Label, Notice, PageHead } from '@/components/ui/primitives';
import { HowItWorks } from './HowItWorks';

/**
 * Módulo gimnasio: 1) tipo de gimnasio → equipamiento (chips o fotos reconocidas por IA), 2) disponibilidad
 * (chips o texto libre con IA), 3) deportes, 4) rutina generada en los huecos con solo tu equipamiento.
 */
export function GymScreen() {
  const ctx = useGameContext();
  const g = useGym();
  const [step, setStep] = useState<'equipment' | 'availability' | 'routine'>('routine');
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
  if (!g.loaded)
    return (
      <div className="screen">
        <PageHead title="Gimnasio" back={false} />
        <p className="s">Cargando gimnasio…</p>
      </div>
    );

  return (
    <div className="screen" style={{ '--tint': 'var(--color-fuerza)' } as CSSProperties}>
      <div className="head center">
        <span className="title">Gimnasio</span>
      </div>
      <HowItWorks defaultOpen={!g.profile} />
      {g.profile && (
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['equipment', 'Equipo', 'dumbbell'],
              ['availability', 'Horario', 'cal'],
              ['routine', 'Rutina', 'flag'],
            ] as [typeof step, string, IconId][]
          ).map(([k, label, icon]) => (
            <button key={k} className={`chip ${step === k ? '' : 'ghost'}`} style={{ '--c': 'var(--color-fuerza)', height: 36, justifyContent: 'center' } as CSSProperties} onClick={() => setStep(k)}>
              <Icon id={icon} />
              {label}
            </button>
          ))}
        </div>
      )}
      {msg && (
        <Notice tone="xp" icon="check">
          <span onClick={() => setMsg(null)}>{msg}</span>
        </Notice>
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

const GYM_TYPE_ICON: Record<GymType, IconId> = { barrio: 'dumbbell', cadena: 'store', casa: 'home' };

function EquipmentStep({ initial, onSave, busy, timeAnswer, level }: { initial: GymProfile | null; onSave: (p: GymProfile) => Promise<void>; busy: boolean; timeAnswer?: string; level: number }) {
  const [gymType, setGymType] = useState<GymType | null>(initial?.gymType ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.equipment.map((e) => e.id) ?? []));
  const [showAll, setShowAll] = useState(false);
  const [sports, setSports] = useState(initial?.sports ?? []);
  const [sportName, setSportName] = useState('');
  const [sportDays, setSportDays] = useState<number[]>([]);
  const [scan, setScan] = useState<GymScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const proposal = proposeSessionsPerWeek(timeAnswer, level);
  const pick = (t: GymType) => {
    setGymType(t);
    setSelected(new Set(GYM_PRESETS[t].equipment));
  };
  const toggle = (id: string) =>
    setSelected((s) => {
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

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    setPhotos((ps) => [...ps, ...Array.from(list)].slice(0, GYM_SCAN.maxPhotos));
    if (fileRef.current) fileRef.current.value = '';
  };

  const runScan = async () => {
    if (!photos.length) return;
    setScanning(true);
    setScanErr(null);
    try {
      const r = await scanGymPhotos(photos);
      setScan(r);
      setSelected((s) => {
        const n = new Set(s);
        n.add('bodyweight');
        for (const e of r.equipos) if (e.confianza !== 'baja') n.add(e.id);
        return n;
      });
      if (!gymType) setGymType('barrio');
      setShowAll(true);
    } catch (e) {
      setScanErr(e instanceof GymScanUnavailable ? e.message : 'No se pudo analizar las fotos. Marca el equipo a mano.');
    } finally {
      setScanning(false);
    }
  };

  const nameOf = (id: string) => EQUIPMENT.find((e) => e.id === id)?.name ?? id;

  return (
    <>
      <Label>1. ¿Qué tipo de gimnasio es?</Label>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(GYM_PRESETS) as GymType[]).map((t) => (
          <button key={t} type="button" className={`opt ${gymType === t ? 'on' : ''}`} style={{ padding: '14px 8px 12px' }} onClick={() => pick(t)}>
            <IconSquare icon={GYM_TYPE_ICON[t]} color={gymType === t ? 'var(--color-system)' : 'var(--color-dim)'} />
            <div className="t">{GYM_PRESETS[t].name}</div>
            <div className="s" style={{ fontSize: 11 }}>
              {GYM_PRESETS[t].description}
            </div>
          </button>
        ))}
      </div>

      <Label right={`${photos.length}/${GYM_SCAN.maxPhotos} fotos`}>2. Fotografía tu gimnasio (opcional)</Label>
      <Card tone="sys">
        <div className="row">
          <IconSquare icon="camera" color="var(--color-system)" />
          <div className="grow s" style={{ margin: 0 }}>
            No necesitas saber cómo se llama cada máquina: toma hasta {GYM_SCAN.maxPhotos} fotos de las máquinas y los espacios, y el Sistema reconoce el equipamiento. Las fotos no se guardan.
          </div>
        </div>
        {photos.length > 0 && (
          <div className="row mt-3" style={{ gap: 6, flexWrap: 'wrap' }}>
            {photos.map((_photo, i) => (
              <button key={i} className="chip ghost" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} title="Quitar">
                <Icon id="camera" />
                Foto {i + 1} ×
              </button>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
        <div className="mt-3 flex gap-2">
          <button className="btn ghost sm" disabled={scanning || photos.length >= GYM_SCAN.maxPhotos} onClick={() => fileRef.current?.click()}>
            <Icon id="camera" />
            {photos.length ? 'Otra foto' : 'Tomar foto'}
          </button>
          <button className="btn system sm" disabled={scanning || photos.length === 0} onClick={runScan}>
            <Icon id="eye" />
            {scanning ? 'Reconociendo…' : 'Reconocer equipo'}
          </button>
        </div>
        {scanErr && <div className="s mt-3" style={{ color: 'var(--color-ember)' }}>{scanErr}</div>}
        {scan && (
          <div className="mt-4 rounded-2xl bg-card-2 p-3">
            <Label right={`${scan.equipos.length} detectados`}>Resultado</Label>
            <div className="row mt-3" style={{ gap: 6, flexWrap: 'wrap' }}>
              {scan.equipos.map((e) => (
                <button key={e.id} className={`chip ${selected.has(e.id) ? '' : 'ghost'}`} style={{ '--c': e.confianza === 'alta' ? 'var(--color-xp)' : e.confianza === 'media' ? 'var(--color-system)' : 'var(--color-dim)' } as CSSProperties} onClick={() => toggle(e.id)} title={e.detalle ?? e.confianza}>
                  {selected.has(e.id) ? <Icon id="check" /> : null}
                  {e.name}
                  {e.confianza === 'baja' ? ' ¿?' : ''}
                </button>
              ))}
            </div>
            {scan.noReconocido.length > 0 && <div className="s mt-3">No reconocido: {scan.noReconocido.join(', ')}. Si está en el catálogo, márcalo abajo.</div>}
            {scan.espacioLibre && <div className="s mt-1">Hay espacio libre para trabajo con el peso del cuerpo.</div>}
            <div className="s mt-2">Los de confianza baja quedan sin marcar: tócalos si de verdad están.</div>
          </div>
        )}
      </Card>

      {(gymType || scan) && (
        <>
          <Label right={`${selected.size}`}>3. Confirma lo que hay</Label>
          <Card>
            <p className="s" style={{ margin: 0 }}>
              Quita lo que no tenga tu gimnasio. Solo se usarán ejercicios con este equipamiento.
            </p>
            <div className="row mt-3" style={{ gap: 6, flexWrap: 'wrap' }}>
              {EQUIPMENT.filter((e) => showAll || selected.has(e.id) || (gymType ? GYM_PRESETS[gymType].equipment.includes(e.id) : false)).map((e) => (
                <button key={e.id} className={`chip ${selected.has(e.id) ? '' : 'ghost'}`} style={{ '--c': 'var(--color-fuerza)', height: 30 } as CSSProperties} onClick={() => toggle(e.id)}>
                  {e.name}
                </button>
              ))}
            </div>
            {!showAll && (
              <button className="chip ghost mt-3" onClick={() => setShowAll(true)}>
                <Icon id="plus" />
                Ver todo el catálogo
              </button>
            )}
            <div className="divider" />
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {coveredPatterns.map((c) => (
                <Chip key={c.p} color={c.ok ? 'var(--color-xp)' : 'var(--color-ember)'} icon={c.ok ? 'check' : 'lock'}>
                  {PATTERN_LABEL[c.p as keyof typeof PATTERN_LABEL]}
                </Chip>
              ))}
            </div>
          </Card>

          <Label>4. ¿Haces algún deporte fijo?</Label>
          <Card>
            <p className="s" style={{ margin: 0 }}>
              Esos días no se programa gimnasio: ya son carga de entrenamiento.
            </p>
            {sports.length > 0 && (
              <div className="list mt-2">
                {sports.map((s, i) => (
                  <div key={i} className="row">
                    <IconSquare icon="body" color="var(--color-fuerza)" size="sm" />
                    <div className="grow">
                      <div className="t" style={{ fontSize: 14 }}>
                        {s.name}
                      </div>
                      <div className="s">{s.days.map((d) => WEEKDAY_LABELS[d]).join(', ')}</div>
                    </div>
                    <button className="chip ghost" onClick={() => setSports((x) => x.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input className="input mt-3" placeholder="Fútbol, correr, natación…" value={sportName} onChange={(e) => setSportName(e.target.value)} />
            <div className="row mt-2" style={{ gap: 6, flexWrap: 'wrap' }}>
              {WEEKDAY_LABELS.map((l, d) => (
                <button key={d} className={`chip ${sportDays.includes(d) ? '' : 'ghost'}`} style={{ '--c': 'var(--color-fuerza)' } as CSSProperties} onClick={() => setSportDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))}>
                  {l}
                </button>
              ))}
              <button
                className="chip"
                style={{ '--c': 'var(--color-xp)' } as CSSProperties}
                disabled={!sportName.trim() || !sportDays.length}
                onClick={() => {
                  setSports((s) => [...s, { name: sportName.trim(), days: sportDays }]);
                  setSportName('');
                  setSportDays([]);
                }}
              >
                <Icon id="plus" />
                Agregar
              </button>
            </div>
          </Card>

          <Label>5. Sesiones por semana</Label>
          <Card>
            <div className="row">
              <IconSquare icon="timer" color="var(--color-fuerza)" />
              <div className="grow">
                <div className="t">
                  {proposal.sessions} sesiones de hasta {proposal.maxMinutes} min
                </div>
                <div className="s">{proposal.reason}</div>
              </div>
            </div>
            <button
              className="btn ember mt-4"
              disabled={busy}
              onClick={() =>
                onSave({
                  gymType: gymType ?? 'barrio',
                  equipment: [...selected].map((id) => ({ id, name: nameOf(id) || equipmentName(id) })),
                  sports,
                  sessionsPerWeek: initial?.sessionsPerWeek ?? proposal.sessions,
                  maxSessionMinutes: initial?.maxSessionMinutes ?? proposal.maxMinutes,
                  createdAt: initial?.createdAt ?? nowIso(),
                  updatedAt: nowIso(),
                })
              }
            >
              <Icon id="dumbbell" />
              Guardar mi gimnasio
            </button>
          </Card>
        </>
      )}
    </>
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
    <>
      <Label right={`${blocks.length}`}>Bloques libres de la semana</Label>
      <Card>
        <p className="s" style={{ margin: 0 }}>
          Tu horario cambia cada semana: esta es la base. Las excepciones se editan desde la rutina.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {blocks.map((b, i) => (
            <div key={i} className="block">
              <span className="d">{WEEKDAY_LABELS[b.day]}</span>
              <span className="grow num">
                {b.start} – {b.end}
              </span>
              <button className="chip ghost" onClick={() => setBlocks((x) => x.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </div>
          ))}
          {blocks.length === 0 && <p className="s">Sin bloques todavía.</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="input" style={{ width: 'auto' }} value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {WEEKDAY_LABELS.map((l, d) => (
              <option key={d} value={d}>
                {l}
              </option>
            ))}
          </select>
          <input type="time" className="input" style={{ width: 'auto' }} value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="time" className="input" style={{ width: 'auto' }} value={end} onChange={(e) => setEnd(e.target.value)} />
          <button className="btn ghost sm auto" onClick={() => setBlocks((b) => [...b, { day, start, end }])}>
            <Icon id="plus" />
            Bloque
          </button>
        </div>
      </Card>
      <Label>O dilo en tus palabras</Label>
      <Card tone="sys">
        <textarea className="input" rows={2} placeholder='"lunes temprano antes de las 9, martes desde las 8 de la noche, sábado de 10 a 12"' value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn system sm mt-3" disabled={parsing || text.trim().length < 3} onClick={parse}>
          <Icon id="spark" />
          {parsing ? 'Interpretando…' : 'Convertir a bloques'}
        </button>
        {ambiguities.length > 0 && (
          <div className="mt-3">
            <Notice tone="gold">
              <b>No quisimos adivinar:</b> {ambiguities.join(' · ')}
            </Notice>
          </div>
        )}
        <p className="s mt-3">¿Usas Google Calendar? Conéctalo en Ajustes y verás tus compromisos en la Agenda.</p>
      </Card>
      <button className="btn ember" disabled={busy || blocks.length === 0} onClick={() => onSave(blocks)}>
        Guardar horario y generar rutina
      </button>
    </>
  );
}

function RoutineView({ onRegenerate, busy }: { onRegenerate: () => Promise<void>; busy: boolean }) {
  const g = useGym();
  const r = g.routine;
  const [open, setOpen] = useState<string | null>(null);
  if (!r) return <p className="s">Generando rutina…</p>;
  const ex = open ? EXERCISES.find((e) => e.id === open) : null;
  return (
    <>
      {r.notes.map((n, i) => (
        <Notice key={i} tone="gold" icon="spark">
          {n}
        </Notice>
      ))}
      {r.sessions.length === 0 && (
        <Notice tone="danger" icon="timer">
          No hay bloques suficientes para una sesión de 25+ min. Agrega bloques en Horario.
        </Notice>
      )}
      <Label right={`${r.sessions.length} sesiones`}>Esta semana</Label>
      <p className="s" style={{ margin: '-6px 4px 0' }}>
        Cada sesión es tu misión de gimnasio del día: ábrela a su hora, registra series y peso, y cierra con foto. Al consolidarla, el Sistema propondrá subir series o peso.
      </p>
      {r.sessions.map((s) => (
        <Card key={s.index}>
          <div className="row">
            <IconSquare icon="dumbbell" color="var(--color-fuerza)" />
            <div className="grow">
              <div className="t">{s.focus}</div>
              <div className="s">
                {WEEKDAY_LABELS[s.day]} {s.start} – {s.end} · {s.minutes} min
              </div>
            </div>
            {r.missionId && (
              <Link to={`/gym/session/${r.missionId}?s=${s.index}`} className="chip" style={{ '--c': 'var(--color-fuerza)' } as CSSProperties}>
                Ver sesión
              </Link>
            )}
          </div>
          <div className="list mt-2">
            <div className="row">
              <div className="grow s" style={{ margin: 0 }}>
                Calentamiento 5 min (caminar, movilidad)
              </div>
            </div>
            {s.exercises.map((e, i) => {
              const def = EXERCISES.find((x) => x.id === e.exerciseId);
              return (
                <button key={i} type="button" className="row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }} onClick={() => setOpen(e.exerciseId)}>
                  <span className="grow" style={{ fontWeight: 600, fontSize: 14 }}>
                    {def?.name ?? e.exerciseId}
                  </span>
                  <span className="s num" style={{ margin: 0 }}>
                    {e.sets}×{e.reps}
                  </span>
                  <Icon id="eye" className="chev" />
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      <button className="btn ghost" disabled={busy} onClick={onRegenerate}>
        Regenerar rutina de esta semana
      </button>
      {r.uncoveredPatterns.length > 0 && <p className="s" style={{ color: 'var(--color-ember)' }}>Patrones sin cubrir: {r.uncoveredPatterns.join(', ')}.</p>}
      <Sheet open={Boolean(ex)} onClose={() => setOpen(null)} title={ex?.name} tall>
        {ex && <ExerciseGuide ex={ex} />}
      </Sheet>
    </>
  );
}

export function ExerciseGuide({ ex }: { ex: (typeof EXERCISES)[number] }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <Chip color="var(--color-fuerza)">{PATTERN_LABEL[ex.pattern]}</Chip>
        <Chip color="var(--color-dim)">
          {ex.sets}×{ex.reps}
        </Chip>
        <Chip color="var(--color-dim)" icon="timer">
          {ex.restSec}s
        </Chip>
      </div>
      <div className="s">{ex.muscles.join(', ')}</div>
      <GuideRow k="Cómo ajustar" v={ex.guide.setup} />
      <GuideRow k="Cómo colocarse" v={ex.guide.position} />
      <GuideRow k="Respiración" v={ex.guide.breathing} />
      <GuideRow k="Ritmo" v={ex.guide.tempo} />
      <GuideRow k="Errores típicos" v={ex.guide.mistakes} />
      <GuideRow k="Peso inicial" v={ex.guide.startingWeight} />
    </div>
  );
}
function GuideRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <Label>{k}</Label>
      <div className="mt-1">{v}</div>
    </div>
  );
}
