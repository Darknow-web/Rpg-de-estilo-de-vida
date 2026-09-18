import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '@/state/game';
import type { InterviewAnswers, ClassId } from '@/shared/types';
import type { OnboardingOutput } from '@/shared/schemas/ai';
import { generateCampaign, applyCampaign, type GeneratedCampaign } from '@/core/onboarding/onboarding';
import { CLASSES, CLASS_LIST, ATTRIBUTE_META } from '@/core/character/classes';
import { ONBOARDING } from '@/lib/game-balance';
import { VoiceInput } from './VoiceInput';
import { todayIn, deviceTimezone } from '@/lib/time';

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'generating' | 'review';

const TRIED = ['Apps de hábitos', 'Listas en papel', 'Gimnasio con plan', 'Pagar un curso', 'Prometerlo en año nuevo', 'Un compañero que me controle', 'Castigarme', 'Nada aún'];

const EMPTY: InterviewAnswers = { q1_goal: '', q2_why: '', q3_tried: [], q4_time: '30', q5_moment: 'morning', q6_demotivator: 'no_results', q7_anchors: '', q8_rewards: '' };

/**
 * Creación de personaje: 8 preguntas en menos de 3 minutos, opciones tocables, un texto libre con dictado.
 * La IA PROPONE; el jugador APRUEBA o edita. Nada se guarda sin confirmar.
 */
export function Onboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redo = params.get('redo') === '1';
  const player = useGame((s) => s.player);
  const uid = useGame((s) => s.uid);
  const missions = useGame((s) => s.missions);
  const [step, setStep] = useState<Step>(0);
  const [a, setA] = useState<InterviewAnswers>(player?.interview?.answers && redo ? player.interview.answers : EMPTY);
  const [gen, setGen] = useState<GeneratedCampaign | null>(null);
  const [regen, setRegen] = useState(0);
  const [classId, setClassId] = useState<ClassId>('vagabundo');
  const [daily, setDaily] = useState<OnboardingOutput['misiones_diarias']>([]);
  const [weekly, setWeekly] = useState<OnboardingOutput['misiones_semanales']>([]);
  const [rewards, setRewards] = useState<OnboardingOutput['recompensas_sugeridas']>([]);
  const [rejectedNames, setRejectedNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (player?.flags.onboardingDone && !redo) navigate('/', { replace: true });
  }, [player?.flags.onboardingDone, redo, navigate]);

  const run = async (rejected?: { missions: string[]; class?: string }) => {
    setStep('generating');
    const g = await generateCampaign(a, rejected ? regen + 1 : 0, rejected);
    if (rejected) setRegen((r) => r + 1);
    setGen(g);
    setClassId(g.output.clase.id);
    setDaily(g.output.misiones_diarias);
    setWeekly(g.output.misiones_semanales);
    setRewards(g.output.recompensas_sugeridas);
    setStep('review');
  };

  const accept = async () => {
    if (!gen || !uid || !player) return;
    setBusy(true);
    try {
      const tz = player.profile.timezone || deviceTimezone();
      await applyCampaign(uid, player, missions, todayIn(tz), {
        answers: a,
        output: gen.output,
        source: gen.source,
        classId,
        daily: daily.slice(0, ONBOARDING.dailyMissions),
        weekly,
        main: gen.output.mision_principal,
        rewards,
        regenerationsUsed: regen,
        redo,
      });
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const next = () => setStep((s) => (typeof s === 'number' ? ((s + 1) as Step) : s));
  const back = () => setStep((s) => (typeof s === 'number' && s > 0 ? ((s - 1) as Step) : s));
  const canNext = typeof step === 'number' ? [a.q1_goal.trim().length >= 5, a.q2_why.trim().length >= 3, true, true, true, true, true, true][step] : false;

  if (step === 'generating') {
    return (
      <Center>
        <div className="font-display text-2xl text-gold animate-pulse-slow">Forjando tu personaje…</div>
        <p className="mt-2 text-sm text-mist">El Maestro de Juego lee tus respuestas y propone tu campaña.</p>
      </Center>
    );
  }

  if (step === 'review' && gen) {
    const risk = gen.output.riesgo_detectado;
    const cls = CLASSES[classId];
    const totalMin = daily.reduce((s, d) => s + d.duracion_minutos, 0);
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6 animate-fadein">
        <div>
          <div className="text-xs uppercase tracking-widest text-mist">Tu campaña · {gen.source === 'ai' ? 'propuesta por IA' : 'set local (la IA no estaba disponible)'}</div>
          <h1 className="font-display text-2xl text-gold">Esto es lo que proponemos</h1>
          <p className="text-xs text-mist">Es una propuesta: edita, reemplaza o descarta lo que quieras antes de aceptar.</p>
        </div>

        {risk && (
          <div className="rounded-xl border border-frost/50 bg-frost/10 p-3 text-sm text-parchment">
            Leímos algo que suena pesado. No vamos a generar misiones sobre eso. Si te está costando, hablar con un profesional de salud o una línea de ayuda de tu país es un paso valiente. Aquí solo hay conductas pequeñas de bienestar.
          </div>
        )}

        <section className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">Clase</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-3xl">{cls.icon}</span>
            <div>
              <div className="font-display text-lg text-parchment">{cls.name}</div>
              <div className="text-xs italic text-mist">"{cls.identityPhrase}"</div>
            </div>
          </div>
          <p className="mt-2 text-sm text-mist">{classId === gen.output.clase.id ? gen.output.clase.razon_de_asignacion : cls.description}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {CLASS_LIST.map((c) => (
              <button key={c.id} className={`chip ${classId === c.id ? 'chip-active' : ''}`} onClick={() => setClassId(c.id)}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-mist">Puedes rechazarla y elegir otra. Una clase impuesta se siente ajena.</p>
        </section>

        <section className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">Misión principal</div>
          <div className="font-semibold text-parchment">{gen.output.mision_principal.nombre}</div>
          <p className="text-sm text-mist">{gen.output.mision_principal.descripcion}</p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-parchment">
            {gen.output.mision_principal.hitos.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </section>

        <section className="panel p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-mist">3 misiones diarias · {totalMin} min en total</div>
          </div>
          <div className="mt-2 space-y-2">
            {daily.map((d, i) => (
              <div key={i} className="rounded-xl bg-void p-3 text-sm">
                {editIdx === i ? (
                  <div className="space-y-2">
                    <input className="input" value={d.nombre} onChange={(e) => setDaily((ds) => ds.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
                    <textarea className="input" rows={2} value={d.descripcion} onChange={(e) => setDaily((ds) => ds.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} />
                    <input className="input" value={d.ancla} placeholder="Ancla" onChange={(e) => setDaily((ds) => ds.map((x, j) => (j === i ? { ...x, ancla: e.target.value } : x)))} />
                    <button className="btn btn-primary btn-sm" onClick={() => setEditIdx(null)}>
                      Listo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-[11px]" style={{ color: ATTRIBUTE_META[d.atributo].color }}>
                      {ATTRIBUTE_META[d.atributo].icon} {ATTRIBUTE_META[d.atributo].name} · {d.duracion_minutos} min · {d.ventana === 'todo_el_dia' ? 'todo el día' : `${d.ventana.inicio}–${d.ventana.fin}`}
                    </div>
                    <div className="font-semibold text-parchment">{d.nombre}</div>
                    <div className="text-mist">{d.descripcion}</div>
                    {gen.output.explicacion.por_mision.find((x) => x.nombre_mision === d.nombre) && (
                      <div className="mt-1 text-xs text-mist">
                        <span className="text-parchment">Por qué:</span> {gen.output.explicacion.por_mision.find((x) => x.nombre_mision === d.nombre)?.como_ayuda_a_tu_meta}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2 text-xs">
                      <button className="text-arcane-glow underline" onClick={() => setEditIdx(i)}>
                        editar
                      </button>
                      <button
                        className="text-mist underline"
                        onClick={() => {
                          setRejectedNames((r) => [...r, d.nombre]);
                          const v = d.version_minima_viable;
                          setDaily((ds) => ds.map((x, j) => (j === i ? { ...x, nombre: v.nombre, descripcion: v.descripcion } : x)));
                        }}
                      >
                        usar versión mínima
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">Semanales</div>
          {weekly.map((w, i) => (
            <div key={i} className="mt-2 flex items-start justify-between rounded-xl bg-void p-3 text-sm">
              <div>
                <div className="font-semibold text-parchment">{w.nombre}</div>
                <div className="text-xs text-mist">
                  {w.veces_por_semana}× por semana · {w.duracion_minutos} min
                </div>
              </div>
              <button className="text-xs text-mist underline" onClick={() => setWeekly((ws) => ws.filter((_, j) => j !== i))}>
                quitar
              </button>
            </div>
          ))}
        </section>

        <section className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">Tienda inicial ({rewards.length})</div>
          {rewards.map((r, i) => (
            <div key={i} className="mt-2 flex items-start justify-between rounded-xl bg-void p-3 text-sm">
              <div>
                <div className="font-semibold text-parchment">
                  {r.nombre} <span className="text-xs text-mist">· nivel {r.nivel}{r.es_gratuita ? ' · gratis' : ''}</span>
                </div>
                <div className="text-xs text-mist">{r.por_que_encaja}</div>
              </div>
              <button className="text-xs text-mist underline" onClick={() => setRewards((rs) => rs.filter((_, j) => j !== i))}>
                quitar
              </button>
            </div>
          ))}
        </section>

        <section className="panel p-4 text-sm">
          <div className="text-xs uppercase tracking-widest text-mist">Estrategia</div>
          <p className="mt-1 text-parchment">{gen.output.explicacion.estrategia_general}</p>
          <div className="mt-3 text-xs uppercase tracking-widest text-mist">Qué pasa después</div>
          <p className="mt-1 text-parchment">{gen.output.explicacion.que_pasa_despues}</p>
        </section>

        <div className="space-y-2">
          <button className="btn btn-gold w-full" onClick={accept} disabled={busy || daily.length !== 3}>
            {busy ? 'Guardando…' : redo ? 'Aceptar la nueva campaña' : 'Aceptar y empezar a jugar'}
          </button>
          <button className="btn btn-ghost w-full" disabled={regen >= ONBOARDING.maxRegenerations} onClick={() => run({ missions: [...rejectedNames, ...daily.map((d) => d.nombre)], class: classId !== gen.output.clase.id ? gen.output.clase.id : undefined })}>
            No me convence · regenerar ({ONBOARDING.maxRegenerations - regen} restantes)
          </button>
          <button className="w-full text-center text-xs text-mist underline" onClick={() => setStep(0)}>
            Cambiar mis respuestas
          </button>
        </div>
      </div>
    );
  }

  const stepNum = typeof step === 'number' ? step : 0;
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-6">
      <div className="mb-4 flex items-center justify-between text-xs text-mist">
        <span>Creación de personaje</span>
        <span>
          {stepNum + 1}/8 · {Math.max(0, Math.round((Date.now() - startedAt) / 60000))} min
        </span>
      </div>
      <div className="bar mb-6">
        <div className="bg-gold" style={{ width: `${((stepNum + 1) / 8) * 100}%` }} />
      </div>
      <div className="flex-1 animate-fadein" key={stepNum}>
        {stepNum === 0 && (
          <Q title="¿Qué quieres lograr en los próximos 6 meses?" hint="La pregunta central. Escribe o dicta.">
            <VoiceInput value={a.q1_goal} onChange={(v) => setA({ ...a, q1_goal: v })} placeholder="Ej.: correr 10 km sin parar / aprobar el examen de… / ahorrar para…" />
          </Q>
        )}
        {stepNum === 1 && (
          <Q title="¿Por qué eso importa para ti?" hint="Corto. Es el gancho de tu campaña: lo volverás a leer cuando quieras rendirte.">
            <VoiceInput value={a.q2_why} onChange={(v) => setA({ ...a, q2_why: v })} placeholder="Ej.: porque quiero…" rows={2} />
          </Q>
        )}
        {stepNum === 2 && (
          <Q title="¿Qué has intentado antes y no funcionó?" hint="Toca todas las que apliquen.">
            <div className="flex flex-wrap gap-2">
              {TRIED.map((t) => (
                <button key={t} className={`chip ${a.q3_tried.includes(t) ? 'chip-active' : ''}`} onClick={() => setA({ ...a, q3_tried: a.q3_tried.includes(t) ? a.q3_tried.filter((x) => x !== t) : [...a.q3_tried, t] })}>
                  {t}
                </button>
              ))}
            </div>
          </Q>
        )}
        {stepNum === 3 && (
          <Q title="¿Cuánto tiempo real tienes al día para esto?">
            <Options value={a.q4_time} onChange={(v) => setA({ ...a, q4_time: v as InterviewAnswers['q4_time'] })} options={[['15', '15 minutos'], ['30', '30 minutos'], ['60', '1 hora'], ['more', 'Más de 1 hora']]} />
          </Q>
        )}
        {stepNum === 4 && (
          <Q title="¿En qué momento del día eres más constante?">
            <Options value={a.q5_moment} onChange={(v) => setA({ ...a, q5_moment: v as InterviewAnswers['q5_moment'] })} options={[['morning', 'Mañana'], ['afternoon', 'Tarde'], ['evening', 'Noche'], ['varies', 'Varía']]} />
          </Q>
        )}
        {stepNum === 5 && (
          <Q title="¿Qué te desmotiva más?">
            <Options value={a.q6_demotivator} onChange={(v) => setA({ ...a, q6_demotivator: v as InterviewAnswers['q6_demotivator'] })} options={[['boredom', 'Aburrirme'], ['no_results', 'No ver resultados'], ['too_hard', 'Que sea muy difícil'], ['forget', 'Olvidarme'], ['punishment', 'Los castigos']]} />
          </Q>
        )}
        {stepNum === 6 && (
          <Q title="¿Qué haces ya todos los días sin falta?" hint="Son las anclas para enganchar hábitos nuevos: 'lavarme los dientes', 'tomar café', 'llegar del trabajo'…">
            <VoiceInput value={a.q7_anchors} onChange={(v) => setA({ ...a, q7_anchors: v })} placeholder="Ej.: me lavo los dientes, tomo café, ceno a las 8…" rows={2} />
          </Q>
        )}
        {stepNum === 7 && (
          <Q title="¿Qué te gustaría poder canjear como premio?" hint="Alimenta tu tienda. Vale lo gratis (una siesta) y lo caro (un viaje).">
            <VoiceInput value={a.q8_rewards} onChange={(v) => setA({ ...a, q8_rewards: v })} placeholder="Ej.: una tarde libre, unas zapatillas, un viaje…" rows={2} />
          </Q>
        )}
      </div>
      <div className="mt-6 flex gap-2">
        {stepNum > 0 && (
          <button className="btn btn-ghost" onClick={back}>
            Atrás
          </button>
        )}
        {stepNum < 7 ? (
          <button className="btn btn-primary flex-1" disabled={!canNext} onClick={next}>
            Siguiente
          </button>
        ) : (
          <button className="btn btn-gold flex-1" disabled={!canNext} onClick={() => run()}>
            Crear mi personaje
          </button>
        )}
      </div>
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl text-gold">{title}</h2>
      {hint && <p className="mt-1 text-xs text-mist">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Options({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(([v, label]) => (
        <button key={v} className={`btn ${value === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">{children}</div>;
}
