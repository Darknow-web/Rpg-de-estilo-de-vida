import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { useGym, saveSessionLog } from '../store';
import { EXERCISES } from '../data/exercises';
import { weekKey, weekdayOf, WEEKDAY_LABELS } from '@/lib/time';
import { CameraButton } from '@/components/ui/CameraButton';
import { completeMission } from '@/core/completion/complete';
import { newId, nowIso } from '@/lib/ids';
import type { SessionLog } from '../types';
import { Sheet } from '@/components/ui/Sheet';
import { ExerciseGuide } from './GymScreen';
import { Icon } from '@/components/ui/Icon';
import { Card, Notice, PageHead } from '@/components/ui/primitives';

/**
 * Ejecución de la sesión: ejercicios con series, repeticiones, descanso sugerido, temporizador,
 * registro del peso con el último peso al lado. Cerrar la sesión dispara el flujo normal (foto incluida).
 */
export function GymSession({ missionIdProp, onDone }: { missionIdProp?: string; onDone?: () => void } = {}) {
  const params = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const ctx = useGameContext();
  const g = useGym();
  const pushFeedback = useGame((s) => s.pushFeedback);
  const missionId = missionIdProp ?? params.missionId ?? '';
  const [err, setErr] = useState<string | null>(null);
  const [guide, setGuide] = useState<string | null>(null);

  useEffect(() => {
    if (ctx) g.bind(ctx.uid, weekKey(ctx.today));
  }, [ctx?.uid, ctx?.today]);

  const session = useMemo(() => {
    if (!g.routine || !ctx) return null;
    const idx = sp.get('s');
    if (idx !== null) return g.routine.sessions[Number(idx)] ?? null;
    return g.routine.sessions.find((s) => s.day === weekdayOf(ctx.today)) ?? g.routine.sessions[0] ?? null;
  }, [g.routine, ctx?.today, sp]);

  const lastWeights = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of g.logs) for (const e of log.exercises) for (const s of e.sets) if (s.weight && !map.has(e.exerciseId)) map.set(e.exerciseId, s.weight);
    return map;
  }, [g.logs]);

  const [sets, setSets] = useState<Record<string, { weight: string; reps: string; done: boolean }[]>>({});
  useEffect(() => {
    if (!session) return;
    const init: typeof sets = {};
    for (const e of session.exercises) init[e.exerciseId] = Array.from({ length: e.sets }).map(() => ({ weight: lastWeights.get(e.exerciseId)?.toString() ?? '', reps: '', done: false }));
    setSets(init);
  }, [session?.index, lastWeights]);

  if (!ctx) return null;
  if (!session)
    return (
      <div className="screen">
        <PageHead title="Sesión" onBack={() => (onDone ? onDone() : navigate(-1))} />
        <Notice tone="sys">No hay sesión programada para hoy. Revisa la rutina en Gimnasio.</Notice>
      </div>
    );
  const mission = ctx.missions.find((m) => m.id === missionId);
  const done = Object.values(sets).flat().filter((s) => s.done).length;
  const total = Object.values(sets).flat().length;

  const finish = async (file: File) => {
    setErr(null);
    const log: SessionLog = {
      id: newId('gs'),
      weekKey: weekKey(ctx.today),
      day: ctx.today,
      sessionIndex: session.index,
      exercises: session.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: (sets[e.exerciseId] ?? []).map((s) => ({ weight: s.weight ? Number(s.weight) : null, reps: s.reps ? Number(s.reps) : null, done: s.done })) })),
      completionId: null,
      createdAt: nowIso(),
    };
    const res = await completeMission(ctx, missionId, { file });
    if (!res.ok) {
      setErr(res.error ?? 'No se pudo completar');
      return;
    }
    log.completionId = res.completion?.id ?? null;
    await saveSessionLog(ctx.uid, log);
    pushFeedback(res.events);
    if (onDone) onDone();
    else navigate('/');
  };

  return (
    <div className="screen" style={{ '--tint': 'var(--color-fuerza)' } as CSSProperties}>
      <PageHead title={session.focus} onBack={() => (onDone ? onDone() : navigate(-1))} action={`${WEEKDAY_LABELS[session.day]} ${session.start}`} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="s" style={{ margin: 0 }}>
          {session.start} – {session.end} · {session.minutes} min
        </span>
        <span className="chip" style={{ '--c': 'var(--color-fuerza)' } as CSSProperties}>
          {done}/{total} series
        </span>
      </div>
      <RestTimer />
      <Notice tone="gold" icon="flame">
        Calentamiento: 5 min caminando o pedaleando suave, luego movilidad de hombros y cadera.
      </Notice>
      {session.exercises.map((e) => {
        const def = EXERCISES.find((x) => x.id === e.exerciseId);
        if (!def) return null;
        const rows = sets[e.exerciseId] ?? [];
        return (
          <Card key={e.exerciseId}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="grow">
                <div className="t">{def.name}</div>
                <div className="s">
                  {e.sets}×{e.reps} · {e.restSec} s{lastWeights.has(e.exerciseId) ? ` · último peso ${lastWeights.get(e.exerciseId)} kg` : ''}
                </div>
              </div>
              <button className="chev" aria-label="Guía" onClick={() => setGuide(e.exerciseId)} style={{ background: 'none', border: 0, color: 'var(--color-dim)' }}>
                <Icon id="eye" style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className="mt-2">
              {rows.map((s, i) => (
                <div key={i} className="set">
                  <span className="n num">{i + 1}</span>
                  {def.usesWeight ? <input inputMode="decimal" className="input" placeholder="kg" value={s.weight} onChange={(ev) => setSets((all) => ({ ...all, [e.exerciseId]: rows.map((r, j) => (j === i ? { ...r, weight: ev.target.value } : r)) }))} /> : <span className="s" style={{ margin: 0 }}>cuerpo</span>}
                  <input inputMode="numeric" className="input" placeholder="reps" value={s.reps} onChange={(ev) => setSets((all) => ({ ...all, [e.exerciseId]: rows.map((r, j) => (j === i ? { ...r, reps: ev.target.value } : r)) }))} />
                  <button className={`btn sm ${s.done ? '' : 'ghost'}`} style={{ minHeight: 36 }} onClick={() => setSets((all) => ({ ...all, [e.exerciseId]: rows.map((r, j) => (j === i ? { ...r, done: !r.done } : r)) }))}>
                    {s.done ? <Icon id="check" /> : null}
                    Hecha
                  </button>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
      {err && <Notice tone="danger">{err}</Notice>}
      <Card tone="active">
        <CameraButton onPhoto={finish} breathe>
          Cerrar sesión con foto
        </CameraButton>
        {mission?.evidenceHint && <div className="s mt-2 text-center">Prueba: {mission.evidenceHint}</div>}
      </Card>
      <Sheet open={Boolean(guide)} onClose={() => setGuide(null)} title={EXERCISES.find((x) => x.id === guide)?.name} tall>
        {guide && <ExerciseGuide ex={EXERCISES.find((x) => x.id === guide)!} />}
      </Sheet>
    </div>
  );
}

function RestTimer() {
  const [left, setLeft] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (left <= 0) {
      if (ref.current) clearInterval(ref.current);
      return;
    }
    ref.current = window.setInterval(() => setLeft((l) => l - 1), 1000);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [left > 0]);
  return (
    <div className="timer">
      <div className="tt num">{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Descanso'}</div>
      <div className="flex gap-1.5">
        {[45, 60, 90].map((s) => (
          <button key={s} className="btn ghost sm auto" style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setLeft(s)}>
            {s}s
          </button>
        ))}
        {left > 0 && (
          <button className="btn ghost sm auto" style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setLeft(0)}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
