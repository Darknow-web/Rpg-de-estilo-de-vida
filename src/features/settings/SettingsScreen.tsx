import { useEffect, useState } from 'react';
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

export function SettingsScreen() {
  const ctx = useGameContext();
  const navigate = useNavigate();
  const [perm, setPerm] = useState(permissionState());
  const [muted, setMutedState] = useState(isMuted());
  const [pauseUntil, setPauseUntil] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; model: string } | null>(null);
  const [busy, setBusy] = useState(false);
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

  const usedFraction = p.stats.evidenceBytes / EVIDENCE.quotaBytes;

  return (
    <div className="space-y-4 animate-fadein">
      <h1 className="font-display text-xl text-gold">Ajustes</h1>
      {msg && (
        <div className="rounded-xl bg-void p-3 text-sm" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}

      <section className="panel space-y-3 p-4 text-sm">
        <div className="text-xs uppercase tracking-widest text-mist">Juego</div>
        <label className="flex items-center justify-between">
          <span>Modo avanzado (ajuste fino: dificultad, duración, formularios)</span>
          <input type="checkbox" checked={p.flags.advancedMode} onChange={(e) => patch((pl) => (pl.flags.advancedMode = e.target.checked))} />
        </label>
        <label className="flex items-center justify-between">
          <span>Sonido</span>
          <input
            type="checkbox"
            checked={!muted}
            onChange={(e) => {
              setMuted(!e.target.checked);
              setMutedState(!e.target.checked);
            }}
          />
        </label>
        <div className="flex items-center justify-between">
          <span>Zona horaria del juego</span>
          <span className="text-xs text-mist">{p.profile.timezone}</span>
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
      </section>

      <section className="panel space-y-3 p-4 text-sm">
        <div className="text-xs uppercase tracking-widest text-mist">Pausa / viaje</div>
        {p.status === 'paused' ? (
          <>
            <p className="text-mist">
              En pausa hasta el {p.pause?.until}. Sin daño, sin rachas rotas.
            </p>
            <button className="btn btn-primary w-full" onClick={() => resumeGame(ctx).then(() => setMsg('Juego reanudado.'))}>
              Reanudar ahora
            </button>
          </>
        ) : (
          <>
            <p className="text-mist">Congela el juego por completo el tiempo que indiques. Los días en pausa no cuentan.</p>
            <input type="date" className="input" min={ctx.today} value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} />
            <button className="btn btn-ghost w-full" disabled={!pauseUntil} onClick={() => pauseGame(ctx, ctx.today, pauseUntil).then((r) => setMsg(r.ok ? 'Pausa activada.' : r.error ?? ''))}>
              Pausar hasta esa fecha
            </button>
            <button className="text-xs text-mist underline" onClick={() => setPauseUntil(addDays(ctx.today, 7))}>
              una semana
            </button>
          </>
        )}
      </section>

      <section className="panel space-y-3 p-4 text-sm">
        <div className="text-xs uppercase tracking-widest text-mist">Notificaciones (máx. 4 al día)</div>
        <p className="text-mist">Aviso al abrirse la ventana y 30 min antes de cerrar. Si lo niegas, todo funciona igual.</p>
        <div className="flex items-center justify-between">
          <span>Estado: {perm}</span>
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button
              className="btn btn-ghost btn-sm"
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
      </section>

      <section className="panel space-y-2 p-4 text-sm">
        <div className="text-xs uppercase tracking-widest text-mist">Módulos</div>
        <label className="flex items-center justify-between">
          <span>🏋️ Gimnasio (rutina que usa solo tu equipamiento)</span>
          <input type="checkbox" checked={p.flags.unlockedViews.includes('gym')} onChange={(e) => patch((pl) => (pl.flags.unlockedViews = e.target.checked ? [...pl.flags.unlockedViews, 'gym'] : pl.flags.unlockedViews.filter((v) => v !== 'gym')))} />
        </label>
        <label className="flex items-center justify-between">
          <span>📅 Vista Semana</span>
          <input type="checkbox" checked={p.flags.unlockedViews.includes('week')} onChange={(e) => patch((pl) => (pl.flags.unlockedViews = e.target.checked ? [...pl.flags.unlockedViews, 'week'] : pl.flags.unlockedViews.filter((v) => v !== 'week')))} />
        </label>
        <label className="flex items-center justify-between">
          <span>🌳 Árbol de habilidades</span>
          <input type="checkbox" checked={p.flags.unlockedViews.includes('skills')} onChange={(e) => patch((pl) => (pl.flags.unlockedViews = e.target.checked ? [...pl.flags.unlockedViews, 'skills'] : pl.flags.unlockedViews.filter((v) => v !== 'skills')))} />
        </label>
      </section>

      <section className="panel space-y-2 p-4 text-sm">
        <div className="text-xs uppercase tracking-widest text-mist">Fotos de evidencia</div>
        <p className="text-mist">
          Backend: {EVIDENCE_BACKEND === 'firestore-bytes' ? 'Firestore (sin facturación)' : 'Cloud Storage'} · usadas {humanBytes(p.stats.evidenceBytes)} de {humanBytes(EVIDENCE.quotaBytes)} compartidos
        </p>
        <div className="bar">
          <div className={usedFraction > EVIDENCE.warnAtQuotaFraction ? 'bg-ember' : 'bg-arcane'} style={{ width: `${Math.min(100, Math.round(usedFraction * 100))}%` }} />
        </div>
        {usedFraction > EVIDENCE.warnAtQuotaFraction && <p className="text-xs text-ember">Cerca del límite. Archiva evidencias antiguas (se conserva la miniatura).</p>}
        <button
          className="btn btn-ghost btn-sm w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const n = await archiveOldEvidence(ctx, 60);
            setBusy(false);
            setMsg(`Archivadas ${n} fotos de más de 60 días (miniaturas conservadas).`);
          }}
        >
          Archivar fotos de más de 60 días
        </button>
      </section>

      <section className="panel space-y-2 p-4 text-sm">
        <div className="text-xs uppercase tracking-widest text-mist">Campaña</div>
        <p className="text-mist">Rehacer la entrevista genera una campaña nueva. Tu nivel, monedas, medallas e historial NUNCA se pierden.</p>
        <Link to="/onboarding?redo=1" className="btn btn-ghost w-full">
          Rehacer la entrevista
        </Link>
        <p className="text-xs text-mist">IA: {aiStatus ? (aiStatus.available ? `activa (${aiStatus.model})` : 'no disponible: se usa el set local') : '…'}</p>
      </section>

      <section className="panel space-y-2 p-4 text-sm">
        <div className="text-xs uppercase tracking-widest text-mist">Cuenta</div>
        <p className="text-mist">{useGame.getState().user?.email ?? p.profile.displayName}</p>
        <button
          className="btn btn-danger w-full"
          onClick={async () => {
            await signOut(auth());
            navigate('/');
          }}
        >
          Cerrar sesión
        </button>
        <p className="text-[11px] text-mist">Al entrar con otra cuenta no verás nada de esta. Las reglas de Firestore lo garantizan.</p>
      </section>

      <Link to="/log" className="btn btn-ghost w-full">
        🧾 Qué hizo el sistema y por qué
      </Link>
    </div>
  );
}
