import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '@/state/game';
import type { InterviewAnswers, ClassId } from '@/shared/types';
import type { OnboardingOutput } from '@/shared/schemas/ai';
import { generateCampaign, applyCampaign, type GeneratedCampaign } from '@/core/onboarding/onboarding';
import { CLASSES, CLASS_LIST, ATTRIBUTE_META } from '@/core/character/classes';
import { ONBOARDING } from '@/lib/game-balance';
import { VoiceInput } from './VoiceInput';
import { todayIn, deviceTimezone } from '@/lib/time';
import { Icon, type IconId } from '@/components/ui/Icon';
import { ATTR_ICON, ATTR_VAR, Bar, Card, Chip, CLASS_ICON, CLASS_VAR, ClassMedallion, IconSquare, Label, Notice } from '@/components/ui/primitives';
import { Typewriter } from '@/features/shop/RewardCreate';

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'generating' | 'review';

const TRIED = ['Apps de hábitos', 'Listas en papel', 'Gimnasio con plan', 'Pagar un curso', 'Prometerlo en año nuevo', 'Un compañero que me controle', 'Castigarme', 'Nada aún'];
const SYSLINES = ['Analizando tus objetivos…', 'Buscando el gancho de tu campaña…', 'Leyendo lo que no funcionó…', 'Midiendo tu tiempo real…', 'Detectando tu mejor momento…', 'Anticipando lo que te frena…', 'Localizando tus anclas…', 'Diseñando tu tienda…'];

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
  const [alertSeen, setAlertSeen] = useState(false);
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
    setAlertSeen(false);
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
      <Frame tint="var(--color-arcane)">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="hero-emblem" style={{ width: 150, height: 150, color: '#c9b6ff', filter: 'drop-shadow(0 0 30px rgba(139,92,246,.5))' }}>
            <svg viewBox="0 0 80 80" style={{ width: '100%', height: '100%' }} className="animate-pulse-slow">
              <use href="#emblem" />
            </svg>
          </div>
          <div className="mt-4 text-xl font-extrabold">Forjando tu personaje…</div>
          <Typewriter text="El Sistema lee tus respuestas y propone tu campaña." className="sysline mt-2" />
        </div>
      </Frame>
    );
  }

  if (step === 'review' && gen) {
    const risk = gen.output.riesgo_detectado;
    const cls = CLASSES[classId];
    const totalMin = daily.reduce((s, d) => s + d.duracion_minutos, 0);
    if (!alertSeen) {
      return (
        <Frame tint="var(--color-arcane)">
          <div className="flex flex-1 flex-col justify-center gap-4">
            <div className="sysalert">
              <div className="top">
                <span className="dots">
                  <i />
                  <i />
                  <i />
                </span>
                Alerta del Sistema
              </div>
              <div className="body">
                <div className="h">Jugador detectado</div>
                <div className="p">
                  Tu potencial fue reconocido.
                  <br />
                  Clase propuesta: <b style={{ color: CLASS_VAR[classId] }}>{cls.name}</b>.
                </div>
                <button className="btn system" onClick={() => setAlertSeen(true)}>
                  Ver mi campaña
                </button>
              </div>
            </div>
          </div>
        </Frame>
      );
    }
    return (
      <Frame tint={CLASS_VAR[classId]}>
        <div className="head center">
          <span className="title">Tu campaña</span>
          <span className="act">{gen.source === 'ai' ? 'IA' : 'local'}</span>
        </div>
        {gen.source !== 'ai' && <Notice tone="sys">La IA no estaba disponible: esta campaña sale del set local. Puedes regenerar más tarde.</Notice>}
        {risk && (
          <Notice tone="sys" icon="shield">
            Leímos algo que suena pesado. No vamos a generar misiones sobre eso. Si te está costando, hablar con un profesional de salud o una línea de ayuda de tu país es un paso valiente. Aquí solo hay conductas pequeñas de bienestar.
          </Notice>
        )}

        <Card style={{ textAlign: 'center' }}>
          <Label>Clase asignada</Label>
          <ClassMedallion classId={classId} />
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '.12em', textTransform: 'uppercase', color: CLASS_VAR[classId], marginTop: 10 }}>{cls.name}</div>
          <p className="s mt-2">{classId === gen.output.clase.id ? gen.output.clase.razon_de_asignacion : cls.description}</p>
          <div className="row mt-4" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            {CLASS_LIST.map((c) => (
              <button key={c.id} className={`chip ${classId === c.id ? '' : 'ghost'}`} style={{ '--c': CLASS_VAR[c.id] } as CSSProperties} onClick={() => setClassId(c.id)}>
                <Icon id={CLASS_ICON[c.id]} />
                {c.name}
              </button>
            ))}
          </div>
          <p className="s mt-3">Puedes elegir otra: una clase impuesta se siente ajena.</p>
        </Card>

        <Label right={`${totalMin} min en total`}>{daily.length} misiones diarias</Label>
        {daily.map((d, i) => (
          <Card key={i}>
            {editIdx === i ? (
              <div className="space-y-2">
                <input className="input" value={d.nombre} onChange={(e) => setDaily((ds) => ds.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
                <textarea className="input" rows={2} value={d.descripcion} onChange={(e) => setDaily((ds) => ds.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} />
                <input className="input" value={d.ancla} placeholder="Ancla" onChange={(e) => setDaily((ds) => ds.map((x, j) => (j === i ? { ...x, ancla: e.target.value } : x)))} />
                <button className="btn system sm" onClick={() => setEditIdx(null)}>
                  Listo
                </button>
              </div>
            ) : (
              <>
                <div className="row">
                  <IconSquare icon={ATTR_ICON[d.atributo]} color={ATTR_VAR[d.atributo]} />
                  <div className="grow">
                    <div className="t">{d.nombre}</div>
                    <div className="s">
                      {d.ancla ? `${d.ancla} · ` : ''}
                      {d.duracion_minutos} min · {d.ventana === 'todo_el_dia' ? 'todo el día' : `${d.ventana.inicio}–${d.ventana.fin}`}
                    </div>
                  </div>
                  <Chip color="var(--color-xp)">{ATTRIBUTE_META[d.atributo].name}</Chip>
                </div>
                <div className="s mt-3">{d.descripcion}</div>
                {gen.output.explicacion.por_mision.find((x) => x.nombre_mision === d.nombre) && (
                  <div className="s mt-2">
                    <b style={{ color: 'var(--color-ink)' }}>Por qué:</b> {gen.output.explicacion.por_mision.find((x) => x.nombre_mision === d.nombre)?.como_ayuda_a_tu_meta}
                  </div>
                )}
                <div className="row mt-3" style={{ gap: 8 }}>
                  <button className="chip ghost" onClick={() => setEditIdx(i)}>
                    <Icon id="edit" />
                    Editar
                  </button>
                  <button
                    className="chip ghost"
                    onClick={() => {
                      setRejectedNames((r) => [...r, d.nombre]);
                      const v = d.version_minima_viable;
                      setDaily((ds) => ds.map((x, j) => (j === i ? { ...x, nombre: v.nombre, descripcion: v.descripcion } : x)));
                    }}
                  >
                    Versión mínima
                  </button>
                </div>
              </>
            )}
          </Card>
        ))}

        <Label>Misión principal</Label>
        <Card>
          <div className="row">
            <IconSquare icon="flag" color="var(--color-gold)" />
            <div className="grow">
              <div className="t">{gen.output.mision_principal.nombre}</div>
              <div className="s">{gen.output.mision_principal.descripcion}</div>
            </div>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            {gen.output.mision_principal.hitos.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </Card>

        {weekly.length > 0 && (
          <>
            <Label>Semanales</Label>
            <Card tone="tight">
              <div className="list">
                {weekly.map((w, i) => (
                  <div key={i} className="row">
                    <div className="grow">
                      <div className="t" style={{ fontSize: 14 }}>
                        {w.nombre}
                      </div>
                      <div className="s">
                        {w.veces_por_semana}× por semana · {w.duracion_minutos} min
                      </div>
                    </div>
                    <button className="chip ghost" onClick={() => setWeekly((ws) => ws.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {rewards.length > 0 && (
          <>
            <Label right={`${rewards.length}`}>Tienda inicial</Label>
            <Card tone="tight">
              <div className="list">
                {rewards.map((r, i) => (
                  <div key={i} className="row">
                    <IconSquare icon="gem" color="var(--color-gold)" size="sm" />
                    <div className="grow">
                      <div className="t" style={{ fontSize: 14 }}>
                        {r.nombre}
                      </div>
                      <div className="s">
                        Nivel {r.nivel}
                        {r.es_gratuita ? ' · gratis' : ''} · {r.por_que_encaja}
                      </div>
                    </div>
                    <button className="chip ghost" onClick={() => setRewards((rs) => rs.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        <Card>
          <Label>Estrategia</Label>
          <p className="s mt-2">{gen.output.explicacion.estrategia_general}</p>
          <Label className="mt-4">Qué pasa después</Label>
          <p className="s mt-2">{gen.output.explicacion.que_pasa_despues}</p>
        </Card>

        <div className="space-y-2 pb-4">
          <button className="btn gold" onClick={accept} disabled={busy || daily.length !== 3}>
            {busy ? 'Guardando…' : redo ? 'Aceptar la nueva campaña' : 'Aceptar y empezar a jugar'}
          </button>
          <button className="btn ghost" disabled={regen >= ONBOARDING.maxRegenerations} onClick={() => run({ missions: [...rejectedNames, ...daily.map((d) => d.nombre)], class: classId !== gen.output.clase.id ? gen.output.clase.id : undefined })}>
            No me convence · regenerar ({ONBOARDING.maxRegenerations - regen} restantes)
          </button>
          <button className="w-full text-center text-xs text-mute underline" onClick={() => setStep(0)}>
            Cambiar mis respuestas
          </button>
        </div>
      </Frame>
    );
  }

  const stepNum = typeof step === 'number' ? step : 0;
  const pct = Math.round(((stepNum + 1) / 8) * 100);
  return (
    <Frame tint="var(--color-system)">
      <Label right={<span style={{ color: 'var(--color-system)' }}>{pct} %</span>}>
        <span style={{ color: 'var(--color-system)' }}>Creación de personaje</span>
      </Label>
      <Bar value={pct} color="var(--color-system)" thin />
      <Typewriter key={stepNum} text={SYSLINES[stepNum]} className="sysline" />
      <div className="flex-1 animate-fadein" key={`q${stepNum}`}>
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
                <button key={t} className={`chip ${a.q3_tried.includes(t) ? '' : 'ghost'}`} style={{ '--c': 'var(--color-system)', height: 34, fontSize: 13 } as CSSProperties} onClick={() => setA({ ...a, q3_tried: a.q3_tried.includes(t) ? a.q3_tried.filter((x) => x !== t) : [...a.q3_tried, t] })}>
                  {t}
                </button>
              ))}
            </div>
          </Q>
        )}
        {stepNum === 3 && (
          <Q title="¿Cuánto tiempo real tienes al día para esto?">
            <Options value={a.q4_time} onChange={(v) => setA({ ...a, q4_time: v as InterviewAnswers['q4_time'] })} options={[['15', '15 minutos', 'timer', 'Lo mínimo que cuenta'], ['30', '30 minutos', 'timer', 'El punto dulce'], ['60', '1 hora', 'timer', 'Con calma'], ['more', 'Más de 1 hora', 'zap', 'A fondo']]} />
          </Q>
        )}
        {stepNum === 4 && (
          <Q title="¿En qué momento del día eres más constante?">
            <Options value={a.q5_moment} onChange={(v) => setA({ ...a, q5_moment: v as InterviewAnswers['q5_moment'] })} options={[['morning', 'Mañana', 'flame', 'Antes de que el día mande'], ['afternoon', 'Tarde', 'zap', 'Con el motor caliente'], ['evening', 'Noche', 'moon', 'Cuando todo se calma'], ['varies', 'Varía', 'cal', 'Cada día distinto']]} />
          </Q>
        )}
        {stepNum === 5 && (
          <Q title="¿Qué te desmotiva más?">
            <Options value={a.q6_demotivator} onChange={(v) => setA({ ...a, q6_demotivator: v as InterviewAnswers['q6_demotivator'] })} options={[['boredom', 'Aburrirme', 'moon', 'Lo repetitivo'], ['no_results', 'No ver resultados', 'eye', 'Esfuerzo invisible'], ['too_hard', 'Que sea muy difícil', 'dumbbell', 'La cuesta'], ['forget', 'Olvidarme', 'cal', 'Se me va'], ['punishment', 'Los castigos', 'shield', 'La presión']]} />
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
      <div className="mt-2 flex gap-2 pb-4">
        {stepNum > 0 && (
          <button className="btn ghost auto" onClick={back}>
            Atrás
          </button>
        )}
        {stepNum < 7 ? (
          <button className="btn system" disabled={!canNext} onClick={next}>
            Continuar
          </button>
        ) : (
          <button className="btn gold" disabled={!canNext} onClick={() => run()}>
            Crear mi personaje
          </button>
        )}
      </div>
      <div className="s text-center" style={{ margin: 0 }}>
        {stepNum + 1}/8 · {Math.max(0, Math.round((Date.now() - startedAt) / 60000))} min
      </div>
    </Frame>
  );
}

function Frame({ children, tint }: { children: React.ReactNode; tint: string }) {
  return (
    <div className="tinted mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-6 pt-4" style={{ '--tint': tint } as CSSProperties}>
      <div className="screen flex-1">{children}</div>
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="syspanel">
      <h3>{title}</h3>
      {children}
      {hint && <p className="s mt-3 text-center">{hint}</p>}
    </div>
  );
}

function Options({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string, IconId, string][] }) {
  return (
    <div className="grid2">
      {options.map(([v, label, icon, sub]) => (
        <button key={v} type="button" className={`opt ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>
          <IconSquare icon={icon} color={value === v ? 'var(--color-system)' : 'var(--color-dim)'} size="lg" />
          <div className="t">{label}</div>
          <div className="s">{sub}</div>
        </button>
      ))}
    </div>
  );
}
