import { useState } from 'react';
import { useGameContext } from '@/state/game';
import { suggestEscalation, suggestLowering, suggestNewMission, type MissionSuggestion, type Proposal } from '@/core/missions/proposals';
import { createMission, escalateMission, lowerToMinimal } from '@/core/missions/manage';
import { ATTRIBUTE_META } from '@/core/character/classes';
import { DIFFICULTY_LABEL } from '@/core/missions/factory';
import { xpForDifficulty, coinsForDifficulty, MASTERY } from '@/lib/game-balance';

/** La app PROPONE; el jugador aprueba con un toque. Siempre con su razonamiento visible. */
export function ProposalCard({ proposal, onDismiss }: { proposal: Proposal; onDismiss: () => void }) {
  const ctx = useGameContext();
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
    <div className="panel panel-glow p-4 animate-fadein">
      <div className="text-[11px] uppercase tracking-widest text-arcane-glow">Propuesta del Maestro de Juego</div>
      <div className="mt-1 font-semibold text-parchment">{proposal.title}</div>
      <p className="mt-1 text-sm text-mist">{proposal.body}</p>
      {!sug && (
        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary btn-sm flex-1" onClick={load} disabled={busy}>
            {busy ? 'Pensando…' : 'Ver propuesta'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onDismiss}>
            Ahora no
          </button>
        </div>
      )}
      {sug && t && (
        <div className="mt-3 rounded-xl bg-void p-3">
          <div className="flex items-center gap-2 text-[11px] text-mist">
            <span style={{ color: ATTRIBUTE_META[t.attribute].color }}>{ATTRIBUTE_META[t.attribute].icon} {ATTRIBUTE_META[t.attribute].name}</span>
            <span>· {DIFFICULTY_LABEL[t.difficulty]}</span>
            <span>· {t.estimatedMinutes} min</span>
            <span className="ml-auto">{sug.source === 'ai' ? 'IA' : 'local'}</span>
          </div>
          <div className="mt-1 font-semibold text-parchment">{t.name}</div>
          <div className="text-sm text-mist">{t.description}</div>
          <div className="mt-2 text-xs text-arcane-glow">
            +{Math.round(xpForDifficulty(t.difficulty) * mult)} XP · 🪙 {Math.round(coinsForDifficulty(t.difficulty) * mult)}
          </div>
          <div className="mt-2 text-xs text-parchment">
            <span className="text-mist">Por qué: </span>
            {sug.reason}
          </div>
          {sug.whatChanges && (
            <div className="mt-1 text-xs text-parchment">
              <span className="text-mist">Qué cambia: </span>
              {sug.whatChanges}
            </div>
          )}
          {err && <div className="mt-2 text-xs text-ember">{err}</div>}
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary btn-sm flex-1" onClick={accept} disabled={busy}>
              Aceptar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={load} disabled={busy}>
              Otra
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onDismiss}>
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
