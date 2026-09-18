import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { completeMilestone, toggleBossItem, completeBoss } from '@/core/missions/main';
import { CameraButton } from '@/components/ui/CameraButton';
import { ATTRIBUTE_META } from '@/core/character/classes';

/** Misiones PRINCIPALES (hitos con foto) y BOSS (checklist + foto final, una oportunidad). */
export function LongTermScreen() {
  const ctx = useGameContext();
  const pushFeedback = useGame((s) => s.pushFeedback);
  const [err, setErr] = useState<string | null>(null);
  if (!ctx) return null;
  const mains = ctx.missions.filter((m) => m.active && m.type === 'main');
  const bosses = ctx.missions.filter((m) => m.active && m.type === 'boss');
  const hidden = ctx.missions.filter((m) => m.type === 'hidden' && !m.revealed);

  return (
    <div className="space-y-4 animate-fadein">
      <h1 className="font-display text-xl text-gold">Campaña</h1>
      {err && (
        <div className="rounded-xl border border-ember/40 p-3 text-sm" onClick={() => setErr(null)}>
          {err}
        </div>
      )}
      {mains.length === 0 && bosses.length === 0 && (
        <div className="panel p-4 text-sm text-mist">
          Sin misión principal activa. <Link to="/missions/new" className="text-arcane-glow underline">Crear una</Link>.
        </div>
      )}
      {mains.map((m) => (
        <div key={m.id} className="panel p-4">
          <div className="text-[11px]" style={{ color: ATTRIBUTE_META[m.attribute].color }}>
            🏔 Principal · {ATTRIBUTE_META[m.attribute].name}
          </div>
          <div className="font-display text-lg text-parchment">{m.name}</div>
          <p className="text-sm text-mist">{m.description}</p>
          <ul className="mt-3 space-y-2">
            {(m.milestones ?? []).map((h, i) => (
              <li key={i} className={`rounded-xl p-3 ${h.done ? 'bg-life/10' : 'bg-void'}`}>
                <div className="flex items-start justify-between gap-2 text-sm">
                  <span className={h.done ? 'text-mist line-through' : 'text-parchment'}>
                    {i + 1}. {h.title}
                  </span>
                  {h.done && <span className="text-xs text-life">✓ {h.doneAt?.slice(0, 10)}</span>}
                </div>
                {!h.done && (m.milestones ?? []).slice(0, i).every((x) => x.done) && (
                  <div className="mt-2">
                    <CameraButton
                      className="btn btn-ember btn-sm w-full"
                      onPhoto={async (f) => {
                        const r = await completeMilestone(ctx, m.id, i, f);
                        if (!r.ok) setErr(r.error ?? '');
                        else pushFeedback(r.events);
                      }}
                    >
                      📸 Hito cumplido
                    </CameraButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {bosses.map((m) => {
        const all = (m.checklist ?? []).every((c) => c.done);
        return (
          <div key={m.id} className="panel p-4" style={{ borderColor: 'rgba(215,38,61,0.5)' }}>
            <div className="text-[11px] text-blood">👹 BOSS · una sola oportunidad{m.schedule.once ? ` · hasta ${m.schedule.once}` : ''}</div>
            <div className="font-display text-lg text-parchment">{m.name}</div>
            <p className="text-sm text-mist">{m.description}</p>
            <ul className="mt-3 space-y-1">
              {(m.checklist ?? []).map((c, i) => (
                <li key={i}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={c.done} onChange={() => toggleBossItem(ctx, m.id, i)} />
                    <span className={c.done ? 'text-mist line-through' : 'text-parchment'}>{c.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <CameraButton
                className="btn btn-ember w-full"
                disabled={!all}
                onPhoto={async (f) => {
                  const r = await completeBoss(ctx, m.id, f);
                  if (!r.ok) setErr(r.error ?? '');
                  else pushFeedback(r.events);
                }}
              >
                {all ? '📸 Enfrentar al boss' : 'Completa la lista primero'}
              </CameraButton>
            </div>
          </div>
        );
      })}
      {hidden.length > 0 && (
        <div className="panel p-4">
          <div className="text-xs uppercase tracking-widest text-mist">Misiones ocultas: {hidden.length}</div>
          <p className="text-xs text-mist">Se revelan al cumplir condiciones que no conoces.</p>
          {ctx.effects.revealHiddenHints && (
            <ul className="mt-2 space-y-1 text-xs text-arcane-glow">
              {hidden.map((h) => (
                <li key={h.id}>✦ {String(h.hiddenCondition?.params.hint ?? '…')}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
