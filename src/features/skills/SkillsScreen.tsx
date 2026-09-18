import { useState } from 'react';
import { useGameContext } from '@/state/game';
import { SKILL_TREE, type SkillNode } from '@/lib/game-balance';
import { SKILL_TEXTS, BRANCH_TEXTS } from '@/data/skillTree';
import { nodeStatus, unlockNode, resetTree } from '@/core/skills/unlock';
import { Sheet } from '@/components/ui/Sheet';
import { ATTRIBUTE_META } from '@/core/character/classes';
import type { AttributeId } from '@/shared/types';

const BRANCHES: (SkillNode['branch'])[] = ['trunk', 'fuerza', 'disciplina', 'intelecto', 'riqueza', 'vitalidad'];

/** Árbol de habilidades: todos los nodos visibles desde el inicio. Cada nodo cambia una regla. */
export function SkillsScreen() {
  const ctx = useGameContext();
  const [sel, setSel] = useState<SkillNode | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!ctx) return null;
  const p = ctx.player;
  const recommended = p.class ? (p.class.primaryAttribute ?? 'trunk') : 'trunk';
  const st = sel ? nodeStatus(ctx, sel) : null;

  const doUnlock = async () => {
    if (!sel) return;
    const r = await unlockNode(ctx, sel.id);
    setMsg(r.ok ? `Desbloqueado: ${SKILL_TEXTS[sel.id].effect}` : r.error ?? '');
    if (r.ok) setSel(null);
  };

  return (
    <div className="space-y-4 animate-fadein">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl text-gold">Árbol de habilidades</h1>
          <p className="text-xs text-mist">Cada nodo cambia una regla del juego. Nada decorativo.</p>
        </div>
        <div className="text-right text-xs">
          <div className="text-arcane-glow">{p.level.skillPointsAvailable} punto{p.level.skillPointsAvailable === 1 ? '' : 's'}</div>
          <div className="text-mist">{ctx.skills.length}/{SKILL_TREE.length} nodos</div>
        </div>
      </div>
      {msg && (
        <div className="rounded-xl bg-void p-3 text-sm text-parchment" onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}
      {BRANCHES.map((branch) => {
        const nodes = SKILL_TREE.filter((n) => n.branch === branch);
        const color = branch === 'trunk' ? 'var(--color-parchment)' : ATTRIBUTE_META[branch as AttributeId].color;
        return (
          <section key={branch} className="panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold" style={{ color }}>
                {BRANCH_TEXTS[branch].icon} {BRANCH_TEXTS[branch].name}
                {branch !== 'trunk' && <span className="ml-2 text-xs text-mist">Nv {p.attributes[branch as AttributeId].level}</span>}
              </div>
              {branch === recommended && <span className="chip chip-active">recomendada</span>}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {nodes.map((n) => {
                const s = nodeStatus(ctx, n);
                const t = SKILL_TEXTS[n.id];
                return (
                  <button
                    key={n.id}
                    onClick={() => setSel(n)}
                    className={`min-w-[132px] rounded-xl border p-2 text-left ${s.unlocked ? 'border-gold bg-gold/10' : s.available ? 'border-arcane bg-arcane/10 animate-pulse-slow' : 'border-steel bg-void opacity-70'}`}
                  >
                    <div className="text-xs font-semibold text-parchment">{t.name}</div>
                    <div className="mt-1 line-clamp-3 text-[11px] text-mist">{t.effect}</div>
                    <div className="mt-1 text-[10px] text-mist">
                      {s.unlocked ? '✓ activo' : `${n.cost} pt${n.cost > 1 ? 's' : ''}${n.minAttrLevel ? ` · nv ${n.minAttrLevel}` : ''}${n.minLevel ? ` · nivel ${n.minLevel}` : ''}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <div className="panel p-3 text-xs text-mist">
        Reinicios de árbol disponibles: {p.level.treeResetsAvailable} (uno por rango alcanzado). Los nodos son permanentes salvo que reinicies.
        {p.level.treeResetsAvailable > 0 && ctx.skills.length > 0 && (
          <button className="btn btn-ghost btn-sm mt-2 w-full" onClick={() => resetTree(ctx).then((r) => setMsg(r.ok ? 'Árbol reiniciado. Todos tus puntos volvieron.' : r.error ?? ''))}>
            Reiniciar árbol
          </button>
        )}
      </div>

      <Sheet open={Boolean(sel)} onClose={() => setSel(null)} title={sel ? SKILL_TEXTS[sel.id].name : ''}>
        {sel && st && (
          <div className="space-y-3 text-sm">
            <p className="text-parchment">{SKILL_TEXTS[sel.id].effect}</p>
            <p className="italic text-mist">"{SKILL_TEXTS[sel.id].flavor}"</p>
            <div className="text-xs text-mist">
              Costo: {sel.cost} punto{sel.cost > 1 ? 's' : ''}
              {sel.requires?.length ? ` · Requiere: ${sel.requires.map((r) => SKILL_TEXTS[r].name).join(', ')}` : ''}
              {sel.minAttrLevel ? ` · ${BRANCH_TEXTS[sel.branch].name} nivel ${sel.minAttrLevel}` : ''}
              {sel.minLevel ? ` · Nivel general ${sel.minLevel}` : ''}
            </div>
            {st.unlocked ? (
              <div className="text-gold">Ya está activo.</div>
            ) : st.available ? (
              <button className="btn btn-primary w-full" onClick={doUnlock}>
                Desbloquear
              </button>
            ) : (
              <ul className="list-disc pl-5 text-xs text-ember">
                {st.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
