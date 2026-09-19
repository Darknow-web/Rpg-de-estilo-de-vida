import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { useUi } from '@/state/ui';
import { buildToday, type TodayItem } from '@/core/missions/schedule';
import { completeMission } from '@/core/completion/complete';
import { CameraButton } from '@/components/ui/CameraButton';
import { zonedParts } from '@/lib/time';
import { pendingProposals } from '@/core/missions/proposals';
import { ProposalCard } from './ProposalCard';
import { declareImpossibleDay, impossibleDaysLeft } from '@/core/streaks/streaks';
import { Sheet } from '@/components/ui/Sheet';
import { getModule } from '@/core/module';
import { quotaFor } from '@/core/missions/quota';
import { syncNotifications } from '@/features/settings/notificationsSync';
import { closeDay, dayClosedToday } from '@/core/streaks/dayClose';
import { levelProgress } from '@/core/character/player';
import { Icon } from '@/components/ui/Icon';
import { Hearts } from '@/components/ui/Hearts';
import { ATTR_ICON, ATTR_VAR, Bar, Chip, CountUp, IconSquare, Label, Pill, Notice, EmptyState, Row, TimeRing } from '@/components/ui/primitives';
import { CLASS_ICON } from '@/components/ui/primitives';
import { NextEventCard } from '@/modules/calendar/ui/NextEventCard';
import { ringFor, whatToDo, windowText } from './timeRing';

const STATE_ORDER: Record<TodayItem['state'], number> = { grace: 0, active: 1, allDay: 2, upcoming: 3, expired: 4, failed: 5, done: 6 };

/**
 * HOY: ¿cómo voy? (héroe y racha) · PARA HOY (lo que hay que cumplir antes de dormir, la activa arriba con su cronómetro)
 * · ESTA SEMANA (semanales) · CAMPAÑA (principal y boss).
 */
export function TodayScreen() {
  const ctx = useGameContext();
  const pushFeedback = useGame((s) => s.pushFeedback);
  const dismissed = useUi((s) => s.dismissedProposals);
  const dismiss = useUi((s) => s.dismissProposal);
  const [error, setError] = useState<string | null>(null);
  const [impossibleOpen, setImpossibleOpen] = useState(false);
  const navigate = useNavigate();

  const view = useMemo(() => {
    if (!ctx) return null;
    const failedToday = new Set(ctx.failures.map((f) => `${f.missionId}:${f.day}`));
    return buildToday(ctx.missions, ctx.completions, failedToday, ctx.now, ctx.tz, ctx.today, ctx.effects.graceHours);
  }, [ctx]);

  if (!ctx || !view) return null;
  const proposals = pendingProposals(ctx, dismissed).slice(0, 1);
  const dailyQuota = quotaFor('daily', ctx.player, ctx.missions, ctx.effects);
  const p = ctx.player;
  const lp = levelProgress(p.level.totalXp);
  const active = view.timed.find((t) => t.state === 'grace') ?? view.timed.find((t) => t.state === 'active') ?? view.allDay.find((t) => t.state === 'allDay');
  const forToday = [...view.timed, ...view.allDay].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.sortKey - b.sortKey);
  const pendingToday = forToday.filter((t) => t.state !== 'done' && t.state !== 'failed' && t.state !== 'expired').length;
  const allDone = forToday.length > 0 && forToday.every((t) => t.state === 'done' || t.state === 'failed');
  const rows = forToday.filter((t) => t !== active);
  const hour = zonedParts(ctx.now, ctx.tz).hour;
  const greeting = hour < 12 ? 'Buenos días,' : hour < 19 ? 'Buenas tardes,' : 'Buenas noches,';
  const impossibleLeft = impossibleDaysLeft(ctx);
  const weeklyPending = view.weekly.filter((t) => t.state !== 'done').length;

  const onPhoto = async (item: TodayItem, file: File) => {
    setError(null);
    const res = await completeMission(ctx, item.mission.id, { file }, { day: item.day });
    if (!res.ok) {
      setError(res.error ?? 'No se pudo completar');
      return;
    }
    pushFeedback(res.events);
    void syncNotifications();
  };

  const impossible = async (day: string) => {
    const r = await declareImpossibleDay(ctx, day);
    if (!r.ok) setError(r.error ?? '');
    setImpossibleOpen(false);
  };

  return (
    <div className="screen" style={{ '--tint': 'var(--color-gold)' } as CSSProperties}>
      <div className="head">
        <div>
          <div className="hi">{greeting}</div>
          <div className="name">
            <span className="truncate" style={{ maxWidth: 200 }}>
              {p.profile.displayName}
            </span>
            {p.class && (
              <Chip color="var(--color-arcane)" icon={CLASS_ICON[p.class.id]}>
                {p.class.name}
              </Chip>
            )}
          </div>
        </div>
        <Link to="/settings" className="avatar" aria-label="Ajustes">
          <Icon id="user" />
        </Link>
      </div>

      {/* Héroe */}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Pill tone="gold" icon="star">
            NV <CountUp value={lp.level} />
          </Pill>
          <Pill tone="xp" icon="zap">
            <CountUp value={p.level.totalXp} /> XP
          </Pill>
        </div>
        <Bar className="mt-4" value={lp.xpIntoLevel} max={lp.xpForLevel || 1} label={lp.xpForLevel ? `Progreso a nivel ${lp.level + 1}` : 'Nivel máximo'} minmax={[`${lp.xpIntoLevel} XP`, `${lp.xpForLevel} XP`]} />
        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8 }}>
            <Hearts current={p.hearts.current} max={p.hearts.max} />
            <span className="s num" style={{ margin: 0 }}>
              {p.hearts.current} / {p.hearts.max}
            </span>
          </div>
          <Link to="/wallet" className="pill soft" aria-label="Monedero">
            <Icon id="coin" style={{ color: 'var(--color-gold)' }} />
            <CountUp value={p.economy.coins} />
          </Link>
        </div>
      </div>

      {/* Racha */}
      <button type="button" className="card row" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setImpossibleOpen(true)}>
        <IconSquare icon="flame" color="var(--color-ember)" />
        <div className="grow">
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="big">
              <CountUp value={p.streak.current} />
            </span>
            <span className="s" style={{ margin: 0 }}>
              día{p.streak.current === 1 ? '' : 's'} de racha
            </span>
          </div>
          <div className="s" style={{ color: 'var(--color-ember)' }}>
            {p.status === 'paused' ? `En pausa hasta el ${p.pause?.until}` : p.streak.current > 0 ? 'En marcha' : 'Empieza hoy'} · {impossibleLeft} día{impossibleLeft === 1 ? '' : 's'} imposible{impossibleLeft === 1 ? '' : 's'} disponible{impossibleLeft === 1 ? '' : 's'}
          </div>
        </div>
        <Icon id="chev" className="chev" />
      </button>

      <NextEventCard />

      {error && (
        <Notice tone="danger" icon="shield">
          <span onClick={() => setError(null)}>{error}</span>
        </Notice>
      )}
      {p.restBonus.remainingMissions > 0 && (
        <Notice tone="xp" icon="spark">
          Bonus de descanso: +50 % XP en tus próximas {p.restBonus.remainingMissions} misiones.
        </Notice>
      )}

      {/* Para hoy */}
      <Label right={forToday.length ? <span className="num">{pendingToday === 0 ? 'todo hecho' : `${pendingToday} pendiente${pendingToday === 1 ? '' : 's'}`}</span> : undefined}>Para hoy</Label>
      {forToday.length === 0 ? (
        <EmptyState
          icon="moon"
          title={view.restToday ? 'Día de descanso' : 'Sin misiones hoy'}
          body={view.restToday ? 'Hoy no hay misiones programadas. Cuenta como día limpio.' : 'Agrega una misión o revisa tu semana.'}
          action={
            dailyQuota.allowed ? (
              <Link to="/missions/new" className="btn ghost sm auto">
                Agregar misión
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {active && <ActiveMission item={active} onPhoto={(f) => onPhoto(active, f)} fallen={p.status === 'fallen'} resurrectionId={ctx.resurrection?.missionId} />}
          {rows.length > 0 && (
            <div className="card tight list">
              {rows.map((t) => (
                <MissionRow key={`${t.mission.id}:${t.day}`} item={t} onPhoto={(f) => onPhoto(t, f)} />
              ))}
            </div>
          )}
          {!active && pendingToday > 0 && <div className="s" style={{ margin: '-6px 4px 0' }}>Cada misión abre a su hora. El anillo del icono es el tiempo que queda antes de perder un corazón.</div>}
        </>
      )}

      {/* Esta semana */}
      {view.weekly.length > 0 && (
        <>
          <Label right={<span className="num">{weeklyPending === 0 ? 'completas' : `${weeklyPending} por cumplir`}</span>}>Esta semana</Label>
          <div className="card tight list">
            {view.weekly.map((t) => (
              <MissionRow key={t.mission.id} item={t} onPhoto={(f) => onPhoto(t, f)} weekly />
            ))}
          </div>
        </>
      )}

      {view.longTerm.length > 0 && (
        <>
          <Label
            right={
              <Link to="/missions/long-term" style={{ color: 'var(--color-system)' }}>
                Ver todo
              </Link>
            }
          >
            Campaña
          </Label>
          <div className="card tight list">
            {view.longTerm.slice(0, 2).map((m) => {
              const items = m.type === 'main' ? m.milestones ?? [] : m.checklist ?? [];
              const done = items.filter((i) => i.done).length;
              return (
                <Link key={m.id} to="/missions/long-term" className="row" style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
                  <div className="row">
                    <IconSquare icon={m.type === 'boss' ? 'skull' : 'flag'} color={m.type === 'boss' ? 'var(--color-hp)' : 'var(--color-gold)'} size="sm" />
                    <div className="grow">
                      <div className="t" style={{ fontSize: 14 }}>
                        {m.name}
                      </div>
                      <Bar className="mt-2" value={done} max={items.length || 1} color="var(--color-gold)" thin />
                    </div>
                    <span className="s num" style={{ margin: 0 }}>
                      {done}/{items.length}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {proposals.map((pr) => (
        <ProposalCard key={pr.id} proposal={pr} onDismiss={() => dismiss(pr.id)} />
      ))}

      {allDone && !dayClosedToday(ctx) && (
        <div className="card active" style={{ textAlign: 'center' }}>
          <div className="t">Bitácora completa. Bien jugado.</div>
          <button className="btn sm mt-3" onClick={() => void closeDay(ctx).then((ev) => pushFeedback(ev))}>
            <Icon id="check" />
            Cerrar el día{ctx.effects.dayCloseXp ? ' · +15 XP' : ''}
          </button>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="s" style={{ margin: 0 }}>
          Cupo diario {dailyQuota.used}/{dailyQuota.max}
        </span>
        <button className="chip ghost" onClick={() => navigate('/missions/new')}>
          <Icon id="plus" />
          {dailyQuota.allowed ? 'Agregar misión' : '¿Cómo ampliar?'}
        </button>
      </div>

      <Sheet open={impossibleOpen} onClose={() => setImpossibleOpen(false)} title="Racha y día imposible">
        <div className="row" style={{ marginBottom: 12 }}>
          <IconSquare icon="flame" color="var(--color-ember)" />
          <div className="grow">
            <div className="t">
              {p.streak.current} día{p.streak.current === 1 ? '' : 's'} seguidos
            </div>
            <div className="s">Mejor racha: {p.streak.best}</div>
          </div>
        </div>
        <p className="s">Hay días en que la vida no deja jugar. Declara este día sin justificar nada: sin pérdida de corazones, y la racha se conserva. Te quedan {impossibleLeft} este mes.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn system" disabled={impossibleLeft <= 0} onClick={() => impossible(ctx.today)}>
            Hoy es imposible
          </button>
          <button className="btn ghost auto" onClick={() => setImpossibleOpen(false)}>
            Cancelar
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function missionIcon(m: TodayItem['mission']) {
  return m.moduleId === 'gym' ? ('dumbbell' as const) : ATTR_ICON[m.attribute];
}

function ActiveMission({ item, onPhoto, fallen, resurrectionId }: { item: TodayItem; onPhoto: (f: File) => Promise<void>; fallen?: boolean; resurrectionId?: string }) {
  const m = item.mission;
  const mod = getModule(m.moduleId);
  const isRes = fallen && resurrectionId === m.id;
  const ring = ringFor(item);
  const what = whatToDo(m);
  const tone = ring.tone === 'mute' ? 'var(--color-dim)' : ring.tone === 'xp' ? 'var(--color-xp)' : ring.tone === 'gold' ? 'var(--color-gold)' : 'var(--color-hp)';
  return (
    <div className="card active">
      <div className="row">
        <TimeRing fraction={ring.fraction} tone={ring.tone} label={ring.long}>
          <IconSquare icon={missionIcon(m)} color={ATTR_VAR[m.attribute]} />
        </TimeRing>
        <div className="grow">
          <Link to={`/missions/${m.id}`} className="t" style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
            {m.name}
          </Link>
          <div className="s" style={{ color: tone }}>
            <span className="tleft">{ring.long}</span>
            {isRes && ' · resurrección'}
          </div>
        </div>
        <Chip color="var(--color-xp)">+{m.xp} XP</Chip>
      </div>
      {what && <div className="what mt-3">{what}</div>}
      <div className="s mt-1">
        {m.anchor ? `${m.anchor} · ` : ''}
        {windowText(item.window.window)}
        {m.evidenceHint ? ` · Prueba: ${m.evidenceHint}` : ''}
        {m.origin === 'agenda' ? ' · Agenda' : ''}
      </div>
      <div className="mt-4">
        {mod?.executionView && m.moduleId === 'gym' ? (
          <Link to={`/gym/session/${m.id}`} className="btn ember breathe">
            <Icon id="dumbbell" />
            Empezar sesión
          </Link>
        ) : (
          <CameraButton onPhoto={onPhoto} breathe>
            Foto y completar
          </CameraButton>
        )}
      </div>
    </div>
  );
}

function MissionRow({ item, onPhoto, weekly }: { item: TodayItem; onPhoto: (f: File) => Promise<void>; weekly?: boolean }) {
  const m = item.mission;
  const ring = ringFor(item);
  const what = whatToDo(m, 80);
  const inactive = item.state === 'expired' || item.state === 'failed';
  const toneVar = ring.tone === 'xp' ? 'var(--color-xp)' : ring.tone === 'gold' ? 'var(--color-gold)' : ring.tone === 'hp' ? 'var(--color-hp)' : 'var(--color-dim)';
  // Adelantarse cuenta como a tiempo (el core lo permite): las próximas también se pueden completar.
  const canComplete = item.state === 'active' || item.state === 'grace' || item.state === 'allDay' || item.state === 'upcoming';
  const right =
    item.state === 'done' ? (
      <Chip color="var(--color-xp)" icon="check">
        Hecha
      </Chip>
    ) : canComplete ? (
      <CameraButton onPhoto={onPhoto} allowGallery={false} className="btn sm auto">
        Foto y completar
      </CameraButton>
    ) : (
      <span className="s num" style={{ margin: 0 }}>
        +{m.xp} XP
      </span>
    );
  const schedule = weekly && item.weeklyProgress ? `${item.weeklyProgress.done}/${item.weeklyProgress.target} esta semana · cuando quieras` : windowText(item.window.window);
  const icon = <IconSquare icon={missionIcon(m)} color={inactive ? 'var(--color-mute)' : ATTR_VAR[m.attribute]} size="sm" />;
  return (
    <Row
      leading={
        !weekly && ring.show ? (
          <TimeRing fraction={ring.fraction} tone={ring.tone} label={ring.long}>
            {icon}
          </TimeRing>
        ) : (
          icon
        )
      }
      title={
        <span className="row" style={{ gap: 6 }}>
          <span className="truncate">{m.name}</span>
          {m.origin === 'agenda' && <Chip color="var(--color-system)">Agenda</Chip>}
        </span>
      }
      strike={item.state === 'done'}
      sub={
        <>
          {what && item.state !== 'done' && <div className="what">{what}</div>}
          <div>
            <span style={{ color: item.state === 'done' ? undefined : toneVar }}>{weekly && item.state !== 'done' ? '' : ring.text}</span>
            {weekly && item.state !== 'done' ? schedule : ` · ${schedule}`}
            {m.evidenceHint && item.state !== 'done' ? ` · Prueba: ${m.evidenceHint}` : ''}
          </div>
        </>
      }
      right={right}
      to={`/missions/${m.id}`}
    />
  );
}
