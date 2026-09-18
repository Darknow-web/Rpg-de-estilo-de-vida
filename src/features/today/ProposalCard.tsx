import { useState } from 'react';
import { useGameContext } from '@/state/game';
import { suggestEscalation, suggestLowering, suggestNewMission, type MissionSuggestion, type Proposal } from '@/core/missions/proposals';
import { createMission, escalateMission, lowerToMinimal } from '@/core/missions/manage';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { DIFFICULTY_LABEL } from '@/core/missions/factory';
import { xpForDifficulty, coinsForDifficulty, MASTERY } from '@/lib/game-balance';
import { Icon } from '@/components/ui/Icon';
import { ATTR_ICON, ATTR_VAR, Chip, IconSquare } from '@/components/ui/primitives';
import { Typewriter } from '@/features/shop/RewardCreate';

/** El Sistema PROPONE; el jugador aprueba con un toque. Fila discreta que se despliega, con el razonamiento visible. */
export function ProposalCard({ proposal, onDismiss }: { proposal: Proposal; onDismiss: () => void }) {
  const ctx = useGameContext();
  const [open, setOpen] = useState(false);
  const [sug, setSug] = useState<MissionSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!ctx) return null;
  const target = proposal.missionId ? ctx.missions.find((m) => m.id === proposal.missionId) : undefined;

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (proposal.kind === 'new_mission') setSug(await suggestNewMission(ctx));
      else if ((proposal.kind === 'escalate' || proposal.kind === 'escalate_perfect') && target) setSug(await suggestEscalation(ctx, target));
      else if (proposal.kind === 'lower' && target) setSug(await suggestLowering(ctx, target));
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!sug) return;
    setBusy(true);
    try {
      if (proposal.kind === 'new_mission') {
        const r = await createMission(ctx, sug.template, sug.source === 'ai' ? 'ai-proposal' : 'fallback');
        if (!r.ok) setErr(r.error ?? 'No se pudo crear');
        else onDismiss();
      } else if ((proposal.kind === 'escalate' || proposal.kind === 'escalate_perfect') && target) {
        await escalateMission(ctx, target.id, { name: sug.template.name, description: sug.template.description, difficulty: sug.template.difficulty, anchor: sug.template.anchor, estimatedMinutes: sug.template.estimatedMinutes });
        onDismiss();
      } else if (proposal.kind === 'lower' && target) {
        await lowerToMinimal(ctx, target.id, { name: sug.template.name, description: sug.template.description });
        onDismiss();
      }
    } finally {
      setBusy(false);
    }
  };

  const t = sug?.template;
  const esc = target && (proposal.kind === 'escalate' || proposal.kind === 'escalate_perfect') ? target.escalationLevel + 1 : 0;
  const mult = Math.pow(MASTERY.escalationRewardMultiplier, esc);

  return (
    <div className="card sys" style={{ padding: open ? 18 : '14px 18px' }}>
      <button type="button" className="row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }} onClick={() => setOpen((v) => !v)}>
        <IconSquare icon="spark" color="var(--color-system)" size="sm" />
        <div className="grow">
          <div className="t" style={{ fontSize: 14 }}>
            El Sistema tiene una propuesta
          </div>
          {!open ? <Typewriter text={proposal.title} className="s italic" /> : <div className="s">{proposal.title}</div>}
        </div>
        <Icon id="chev" className="chev" style={{ transform: open ? 'rotate(90deg)' : undefined }} />
      </button>
      {open && (
        <div className="mt-3">
          <p className="s italic" style={{ color: 'var(--color-system)' }}>
            {proposal.body}
          </p>
          {!sug && (
            <div className="mt-3 flex gap-2">
              <button className="btn system sm" onClick={load} disabled={busy}>
                {busy ? 'Pensando…' : 'Ver propuesta'}
              </button>
              <button className="btn ghost sm auto" onClick={onDismiss}>
                Ahora no
              </button>
            </div>
          )}
          {sug && t && (
            <div className="mt-3 rounded-2xl bg-card-2 p-3">
              <div className="row" style={{ gap: 8 }}>
                <IconSquare icon={ATTR_ICON[t.attribute]} color={ATTR_VAR[t.attribute]} size="sm" />
                <div className="grow">
                  <div className="t" style={{ fontSize: 14 }}>
                    {t.name}
                  </div>
                  <div className="s">
                    {ATTRIBUTE_META[t.attribute].name} · {DIFFICULTY_LABEL[t.difficulty]} · {t.estimatedMinutes} min · {sug.source === 'ai' ? 'IA' : 'local'}
                  </div>
                </div>
                <Chip color="var(--color-xp)">+{Math.round(xpForDifficulty(t.difficulty) * mult)} XP</Chip>
              </div>
              <div className="s mt-2">{t.description}</div>
              <div className="s mt-2">
                <b style={{ color: 'var(--color-ink)' }}>Por qué:</b> {sug.reason}
              </div>
              {sug.whatChanges && (
                <div className="s mt-1">
                  <b style={{ color: 'var(--color-ink)' }}>Qué cambia:</b> {sug.whatChanges}
                </div>
              )}
              <div className="s mt-1 row" style={{ gap: 4 }}>
                <Icon id="coin" style={{ width: 12, height: 12, color: 'var(--color-gold)' }} />
                {Math.round(coinsForDifficulty(t.difficulty) * mult)} monedas
              </div>
              {err && <div className="s mt-2" style={{ color: 'var(--color-ember)' }}>{err}</div>}
              <div className="mt-3 flex gap-2">
                <button className="btn system sm" onClick={accept} disabled={busy}>
                  Aceptar
                </button>
                <button className="btn ghost sm auto" onClick={load} disabled={busy}>
                  Otra
                </button>
                <button className="btn ghost sm auto" onClick={onDismiss}>
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
