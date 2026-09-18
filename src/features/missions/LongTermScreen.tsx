import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useGame, useGameContext } from '@/state/game';
import { completeMilestone, toggleBossItem, completeBoss } from '@/core/missions/main';
import { CameraButton } from '@/components/ui/CameraButton';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { Icon } from '@/components/ui/Icon';
import { ATTR_VAR, Bar, Card, Chip, EmptyState, IconSquare, Label, Notice, PageHead } from '@/components/ui/primitives';

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
    <div className="screen" style={{ '--tint': 'var(--color-gold)' } as CSSProperties}>
      <PageHead title="Campaña" />
      {err && (
        <Notice tone="danger">
          <span onClick={() => setErr(null)}>{err}</span>
        </Notice>
      )}
      {mains.length === 0 && bosses.length === 0 && (
        <EmptyState
          icon="flag"
          title="Sin misión principal activa"
          action={
            <Link to="/missions/new" className="btn system sm auto">
              Crear una
            </Link>
          }
        />
      )}
      {mains.map((m) => {
        const items = m.milestones ?? [];
        const done = items.filter((h) => h.done).length;
        return (
          <Card key={m.id}>
            <div className="row">
              <IconSquare icon="flag" color="var(--color-gold)" />
              <div className="grow">
                <div className="t">{m.name}</div>
                <div className="s">
                  Principal · {ATTRIBUTE_META[m.attribute].name}
                </div>
              </div>
              <Chip color={ATTR_VAR[m.attribute]}>
                {done}/{items.length}
              </Chip>
            </div>
            <p className="s mt-3">{m.description}</p>
            <Bar className="mt-3" value={done} max={items.length || 1} color="var(--color-gold)" thin />
            <div className="mt-4 flex flex-col gap-2">
              {items.map((h, i) => {
                const next = !h.done && items.slice(0, i).every((x) => x.done);
                return (
                  <div key={i} className="rounded-2xl bg-card-2 p-3" style={{ border: next ? '1px solid rgba(255,201,74,.35)' : '1px solid transparent' }}>
                    <div className="row">
                      <span className={`node ${h.done ? 'on' : next ? 'av' : ''}`} style={{ width: 30, height: 30, '--c': 'var(--color-gold)' } as CSSProperties}>
                        {h.done ? <Icon id="check" style={{ width: 14, height: 14 }} /> : <span className="num" style={{ fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
                      </span>
                      <div className="grow">
                        <div className="t" style={{ fontSize: 14, color: h.done ? 'var(--color-dim)' : undefined, textDecoration: h.done ? 'line-through' : undefined }}>
                          {h.title}
                        </div>
                        {h.done && <div className="s">{h.doneAt?.slice(0, 10)}</div>}
                      </div>
                    </div>
                    {next && (
                      <div className="mt-3">
                        <CameraButton
                          className="btn gold sm"
                          onPhoto={async (f) => {
                            const r = await completeMilestone(ctx, m.id, i, f);
                            if (!r.ok) setErr(r.error ?? '');
                            else pushFeedback(r.events);
                          }}
                        >
                          Hito cumplido
                        </CameraButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {bosses.map((m) => {
        const all = (m.checklist ?? []).every((c) => c.done);
        return (
          <Card key={m.id} tone="danger">
            <div className="row">
              <IconSquare icon="skull" color="var(--color-hp)" />
              <div className="grow">
                <div className="t">{m.name}</div>
                <div className="s">Boss · una sola oportunidad{m.schedule.once ? ` · hasta ${m.schedule.once}` : ''}</div>
              </div>
            </div>
            <p className="s mt-3">{m.description}</p>
            <div className="mt-3 flex flex-col gap-1">
              {(m.checklist ?? []).map((c, i) => (
                <label key={i} className="row" style={{ padding: '8px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={c.done} onChange={() => toggleBossItem(ctx, m.id, i)} />
                  <span style={{ color: c.done ? 'var(--color-dim)' : undefined, textDecoration: c.done ? 'line-through' : undefined }}>{c.title}</span>
                </label>
              ))}
            </div>
            <div className="mt-3">
              <CameraButton
                className="btn danger"
                disabled={!all}
                onPhoto={async (f) => {
                  const r = await completeBoss(ctx, m.id, f);
                  if (!r.ok) setErr(r.error ?? '');
                  else pushFeedback(r.events);
                }}
              >
                {all ? 'Enfrentar al boss' : 'Completa la lista primero'}
              </CameraButton>
            </div>
          </Card>
        );
      })}
      {hidden.length > 0 && (
        <Card>
          <Label right={`${hidden.length}`}>Misiones ocultas</Label>
          <p className="s mt-2">Se revelan al cumplir condiciones que no conoces.</p>
          {ctx.effects.revealHiddenHints && (
            <ul className="mt-3 space-y-1 text-xs" style={{ color: 'var(--color-arcane)' }}>
              {hidden.map((h) => (
                <li key={h.id} className="row" style={{ gap: 6 }}>
                  <Icon id="eye" style={{ width: 12, height: 12 }} />
                  {String(h.hiddenCondition?.params.hint ?? '…')}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
