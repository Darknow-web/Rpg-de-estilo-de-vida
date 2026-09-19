import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useGame, useGameContext } from '@/state/game';
import { batch, commitSoon, playerRef, clean } from '@/core/repo';
import { pauseGame, resumeGame, setRestDay } from '@/core/streaks/streaks';
import { permissionState, requestPermission } from '@/lib/notifications';
import { syncNotifications } from './notificationsSync';
import { isMuted, setMuted } from '@/lib/sound';
import { WEEKDAY_LABELS, addDays } from '@/lib/time';
import { EVIDENCE } from '@/lib/game-balance';
import { humanBytes } from '@/lib/image';
import { archiveOldEvidence } from '@/core/evidence/archive';
import { EVIDENCE_BACKEND } from '@/lib/storage';
import { apiGet } from '@/lib/api';
import { useCalendar } from '@/modules/calendar/store';
import { calendarConfigured } from '@/modules/calendar/client';
import { Icon } from '@/components/ui/Icon';
import { Bar, Card, Label, Notice, PageHead, Row } from '@/components/ui/primitives';
import { OPTIONAL_VIEWS, isViewHidden } from '@/components/Shell';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span className="grow">{label}</span>
      <button type="button" role="switch" aria-checked={on} className={`tog ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />
    </div>
  );
}

export function SettingsScreen() {
  const ctx = useGameContext();
  const navigate = useNavigate();
  const cal = useCalendar();
  const [perm, setPerm] = useState(permissionState());
  const [muted, setMutedState] = useState(isMuted());
  const [pauseUntil, setPauseUntil] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; model: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [motionLow, setMotionLow] = useState(() => localStorage.getItem('lq-motion') === 'low');
  useEffect(() => {
    void apiGet<{ available: boolean; model: string }>('/api/ai/status').then(setAiStatus);
  }, []);
  if (!ctx) return null;
  const p = ctx.player;

  const patch = async (fn: (pl: typeof p) => void, log?: string) => {
    const next = structuredClone(p);
    fn(next);
    const b = batch();
    b.set(playerRef(ctx.uid), clean(next));
    await commitSoon(b, log ?? 'settings');
  };
  const setViewVisible = (view: string, visible: boolean) =>
    patch((pl) => {
      const hidden = pl.flags.hiddenViews ?? [];
      pl.flags.hiddenViews = visible ? hidden.filter((v) => v !== view) : [...new Set([...hidden, view])];
    }, 'settings:views');

  const usedFraction = p.stats.evidenceBytes / EVIDENCE.quotaBytes;

  return (
    <div className="screen" style={{ '--tint': 'var(--color-dim)' } as CSSProperties}>
      <PageHead title="Ajustes" />
      {msg && (
        <Notice tone="xp" icon="check">
          <span onClick={() => setMsg(null)}>{msg}</span>
        </Notice>
      )}

      <Label>Juego</Label>
      <Card className="flex flex-col gap-4 text-sm">
        <Toggle on={p.flags.advancedMode} onChange={(v) => patch((pl) => (pl.flags.advancedMode = v))} label="Modo avanzado (dificultad, duración, formularios)" />
        <Toggle
          on={!muted}
          onChange={(v) => {
            setMuted(!v);
            setMutedState(!v);
          }}
          label="Sonido"
        />
        <Toggle
          on={motionLow}
          onChange={(v) => {
            setMotionLow(v);
            localStorage.setItem('lq-motion', v ? 'low' : 'media');
            if (v) document.documentElement.setAttribute('data-motion', 'low');
            else document.documentElement.removeAttribute('data-motion');
          }}
          label="Animaciones reducidas"
        />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>Zona horaria del juego</span>
          <span className="s" style={{ margin: 0 }}>
            {p.profile.timezone}
          </span>
        </div>
        {ctx.effects.weeklyRestDay && (
          <label className="block">
            Descanso sagrado (día que no cuenta como fallo)
            <select className="input mt-1" value={p.streak.restDay ?? ''} onChange={(e) => setRestDay(ctx, e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Ninguno</option>
              {WEEKDAY_LABELS.map((l, i) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
      </Card>

      <Label>Agenda · Google Calendar</Label>
      <Card className="flex flex-col gap-3 text-sm">
        {!calendarConfigured() ? (
          <div className="s">Falta VITE_GOOGLE_CLIENT_ID. Los pasos (gratis, 5 minutos) están en docs/DEPLOY.md, sección Google Calendar.</div>
        ) : cal.connected ? (
          <>
            <div className="s">Los eventos se leen directo desde tu navegador y no pasan por el servidor ni por Firestore. La app solo escribe las tareas de tu lista que confirmes en la Agenda (prefijo "[LQ]"); nunca las misiones diarias.</div>
            <div className="flex flex-col gap-2">
              {cal.calendars.map((c) => (
                <Toggle
                  key={c.id}
                  on={cal.selectedCalendarIds.includes(c.id)}
                  onChange={() => void cal.toggleCalendar(c.id)}
                  label={
                    <span className="row" style={{ gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 99, background: c.backgroundColor ?? 'var(--color-system)' }} />
                      {c.summary}
                      {c.primary ? <span className="s" style={{ margin: 0 }}>principal</span> : null}
                    </span>
                  }
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Link to="/agenda" className="btn ghost sm">
                Ver agenda
              </Link>
              <button className="btn ghost sm auto" onClick={() => void cal.disconnect().then(() => setMsg('Agenda desconectada.'))}>
                Desconectar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="s">Ve tus horarios dentro del juego, marca compromisos para ganar XP por llegar a tiempo y deja que el Sistema acomode tus pendientes en los huecos libres. Se pide permiso de leer y crear eventos; la app solo escribe lo que tú confirmes.</div>
            <button className="btn system sm" onClick={() => void cal.connect()} disabled={cal.loading}>
              <Icon id="google" />
              {cal.loading ? 'Conectando…' : 'Conectar Google Calendar'}
            </button>
            {cal.error && <div className="s" style={{ color: 'var(--color-ember)' }}>{cal.error}</div>}
          </>
        )}
      </Card>

      <Label>Pausa · viaje</Label>
      <Card className="flex flex-col gap-3 text-sm">
        {p.status === 'paused' ? (
          <>
            <p className="s">En pausa hasta el {p.pause?.until}. Sin daño, sin rachas rotas.</p>
            <button className="btn system" onClick={() => resumeGame(ctx).then(() => setMsg('Juego reanudado.'))}>
              Reanudar ahora
            </button>
          </>
        ) : (
          <>
            <p className="s">Congela el juego por completo el tiempo que indiques. Los días en pausa no cuentan.</p>
            <input type="date" className="input" min={ctx.today} value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn ghost sm" disabled={!pauseUntil} onClick={() => pauseGame(ctx, ctx.today, pauseUntil).then((r) => setMsg(r.ok ? 'Pausa activada.' : r.error ?? ''))}>
                Pausar hasta esa fecha
              </button>
              <button className="chip ghost" onClick={() => setPauseUntil(addDays(ctx.today, 7))}>
                una semana
              </button>
            </div>
          </>
        )}
      </Card>

      <Label>Notificaciones · máx. 4 al día</Label>
      <Card className="text-sm">
        <p className="s">Aviso al abrirse la ventana y 30 min antes de cerrar. Si lo niegas, todo funciona igual.</p>
        <div className="row mt-3" style={{ justifyContent: 'space-between' }}>
          <span>Estado: {perm}</span>
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button
              className="btn ghost sm auto"
              onClick={async () => {
                const r = await requestPermission();
                setPerm(r);
                if (r === 'granted') await syncNotifications();
              }}
            >
              Activar
            </button>
          )}
        </div>
      </Card>

      <Label>Pestañas visibles</Label>
      <Card className="flex flex-col gap-4 text-sm">
        <p className="s" style={{ margin: 0 }}>
          Hoy, Personaje y Tienda siempre se ven. Las demás las puedes ocultar del menú inferior; nada se borra.
        </p>
        {OPTIONAL_VIEWS.map((v) => (
          <Toggle key={v.id} on={!isViewHidden(p.flags.hiddenViews, v.id)} onChange={(on) => setViewVisible(v.id, on)} label={v.label} />
        ))}
      </Card>

      <Label>Ayuda</Label>
      <Card tone="tight">
        <div className="list">
          <Row icon="book" color="var(--color-arcane)" title="Ver el tutorial" sub="Las 6 pantallas en un minuto" to="/tutorial" chevron />
        </div>
      </Card>

      <Label>Fotos de evidencia</Label>
      <Card className="text-sm">
        <Bar value={usedFraction * 100} color={usedFraction > EVIDENCE.warnAtQuotaFraction ? 'var(--color-ember)' : 'var(--color-xp)'} label={EVIDENCE_BACKEND === 'firestore-bytes' ? 'Firestore (sin facturación)' : 'Cloud Storage'} right={`${humanBytes(p.stats.evidenceBytes)} / ${humanBytes(EVIDENCE.quotaBytes)}`} />
        {usedFraction > EVIDENCE.warnAtQuotaFraction && <p className="s mt-2" style={{ color: 'var(--color-ember)' }}>Cerca del límite. Archiva evidencias antiguas (se conserva la miniatura).</p>}
        <button
          className="btn ghost sm mt-3"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const n = await archiveOldEvidence(ctx, 60);
            setBusy(false);
            setMsg(`Archivadas ${n} fotos de más de 60 días (miniaturas conservadas).`);
          }}
        >
          <Icon id="archive" />
          Archivar fotos de más de 60 días
        </button>
      </Card>

      <Label>Campaña</Label>
      <Card className="text-sm">
        <p className="s">Rehacer la entrevista genera una campaña nueva. Tu nivel, monedas, medallas e historial NUNCA se pierden.</p>
        <Link to="/onboarding?redo=1" className="btn ghost sm mt-3">
          Rehacer la entrevista
        </Link>
        <p className="s mt-3">IA: {aiStatus ? (aiStatus.available ? 'activa' : 'no disponible: se usa el set local') : '…'}</p>
      </Card>

      <Label>Cuenta</Label>
      <Card className="text-sm">
        <p className="s">{useGame.getState().user?.email ?? p.profile.displayName}</p>
        <button
          className="btn ghost sm mt-3"
          style={{ color: 'var(--color-hp)' }}
          onClick={async () => {
            await signOut(auth());
            navigate('/');
          }}
        >
          Cerrar sesión
        </button>
        <p className="s mt-3">Al entrar con otra cuenta no verás nada de esta. Las reglas de Firestore lo garantizan.</p>
      </Card>

      <Card tone="tight">
        <div className="list">
          <Row icon="history" color="var(--color-system)" title="Qué hizo el sistema y por qué" to="/log" chevron />
        </div>
      </Card>
    </div>
  );
}
