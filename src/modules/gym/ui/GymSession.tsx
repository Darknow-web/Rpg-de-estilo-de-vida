import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { useGym, saveSessionLog } from '../store';
import { EXERCISES } from '../data/exercises';
import { weekKey, weekdayOf } from '@/lib/time';
import { CameraButton } from '@/components/ui/CameraButton';
import { completeMission } from '@/core/completion/complete';
import { newId, nowIso } from '@/lib/ids';
import type { SessionLog } from '../types';
import { Sheet } from '@/components/ui/Sheet';
import { ExerciseGuide } from './GymScreen';

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
  if (!session) return <p className="text-sm text-mist">No hay sesión programada para hoy. Revisa la rutina en Gym.</p>;
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
    <div className="space-y-3 animate-fadein">
      <div>
        <button className="text-xs text-mist" onClick={() => (onDone ? onDone() : navigate(-1))}>
          ← Volver
        </button>
        <h1 className="font-display text-xl text-gold">{session.focus}</h1>
        <p className="text-xs text-mist">
          {session.start}–{session.end} · {session.minutes} min · {done}/{total} series
        </p>
      </div>
      <RestTimer />
      <div className="rounded-xl bg-void p-3 text-sm text-mist">Calentamiento: 5 min caminando o pedaleando suave, luego movilidad de hombros y cadera.</div>
      {session.exercises.map((e) => {
        const def = EXERCISES.find((x) => x.id === e.exerciseId);
        if (!def) return null;
        const rows = sets[e.exerciseId] ?? [];
        return (
          <div key={e.exerciseId} className="panel p-3">
            <div className="flex items-center justify-between">
              <button className="text-left font-semibold text-parchment" onClick={() => setGuide(e.exerciseId)}>
                {def.name} <span className="text-xs text-mist">ⓘ</span>
              </button>
              <span className="text-xs text-mist">
                {e.sets}×{e.reps} · {e.restSec}s
              </span>
            </div>
            {lastWeights.has(e.exerciseId) && <div className="text-[11px] text-mist">Último peso: {lastWeights.get(e.exerciseId)} kg</div>}
            <div className="mt-2 space-y-1">
              {rows.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-mist">{i + 1}</span>
                  {def.usesWeight ? <input inputMode="decimal" className="input w-20 py-1" style={{ minHeight: 36 }} placeholder="kg" value={s.weight} onChange={(ev) => setSets((all) => ({ ...all, [e.exerciseId]: rows.map((r, j) => (j === i ? { ...r, weight: ev.target.value } : r)) }))} /> : <span className="w-20 text-xs text-mist">peso corporal</span>}
                  <input inputMode="numeric" className="input w-20 py-1" style={{ minHeight: 36 }} placeholder="reps" value={s.reps} onChange={(ev) => setSets((all) => ({ ...all, [e.exerciseId]: rows.map((r, j) => (j === i ? { ...r, reps: ev.target.value } : r)) }))} />
                  <button className={`btn btn-sm flex-1 ${s.done ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSets((all) => ({ ...all, [e.exerciseId]: rows.map((r, j) => (j === i ? { ...r, done: !r.done } : r)) }))}>
                    {s.done ? '✓' : 'Hecha'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {err && <div className="rounded-xl border border-ember/40 p-3 text-sm">{err}</div>}
      <div className="panel p-3">
        <CameraButton onPhoto={finish}>📸 Cerrar sesión con foto</CameraButton>
        {mission?.evidenceHint && <div className="mt-1 text-center text-[11px] text-mist">Prueba: {mission.evidenceHint}</div>}
      </div>
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
    <div className="flex items-center justify-between rounded-xl bg-void p-3">
      <div className="font-display text-2xl text-parchment">{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Descanso'}</div>
      <div className="flex gap-1">
        {[45, 60, 90].map((s) => (
          <button key={s} className="btn btn-ghost btn-sm" onClick={() => setLeft(s)}>
            {s}s
          </button>
        ))}
        {left > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setLeft(0)}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
