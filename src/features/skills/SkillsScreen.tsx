import { useState, type CSSProperties } from 'react';
import { useGameContext } from '@/state/game';
import { SKILL_TREE, type SkillNode } from '@/lib/game-balance';
import { SKILL_TEXTS, BRANCH_TEXTS } from '@/data/skillTree';
import { nodeStatus, unlockNode, resetTree } from '@/core/skills/unlock';
import { Sheet } from '@/components/ui/Sheet';
import type { AttributeId } from '@/shared/types';
import { Icon, type IconId } from '@/components/ui/Icon';
import { ATTR_ICON, ATTR_VAR, Card, Chip, Label, Notice, Pill } from '@/components/ui/primitives';

const BRANCHES: SkillNode['branch'][] = ['trunk', 'fuerza', 'disciplina', 'intelecto', 'riqueza', 'vitalidad'];

/** Icono por nodo: por nombre clave, con respaldo por rama. */
const NODE_ICON: Record<string, IconId> = {
  corazon_extra_1: 'vital',
  corazon_extra_2: 'vital',
  segunda_oportunidad: 'shield',
  bitacora_ampliada_1: 'book',
  bitacora_ampliada_2: 'book',
  gracia_extendida: 'timer',
  dia_imposible_extra: 'cal',
  madrugador: 'flame',
  resistencia: 'shield',
  deportista: 'body',
  cuerpo_templado: 'dumbbell',
  sesion_doble: 'zap',
  racha_de_hierro: 'flame',
  cierre_del_dia: 'check',
  ventana_flexible: 'timer',
  cadena_maestra: 'link',
  planificador: 'cal',
  sesion_profunda: 'timer',
  estratega: 'flag',
  curiosidad: 'eye',
  mentor: 'book',
  archivista: 'archive',
  mercader: 'store',
  interes_compuesto: 'coin',
  tesorero: 'wallet',
  ahorrador: 'gem',
  inversionista: 'gem',
  regeneracion: 'vital',
  descanso_sagrado: 'moon',
  piel_gruesa: 'shield',
};

/** Árbol de habilidades: tronco + 5 ramas como filas de nodos unidos; cada nodo cambia una regla. */
export function SkillsScreen() {
  const ctx = useGameContext();
  const [sel, setSel] = useState<SkillNode | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!ctx) return null;
  const p = ctx.player;
  const recommended = p.class ? (p.class.primaryAttribute ?? 'trunk') : 'trunk';
  const st = sel ? nodeStatus(ctx, sel) : null;
  const pts = p.level.skillPointsAvailable;

  const doUnlock = async () => {
    if (!sel) return;
    const r = await unlockNode(ctx, sel.id);
    setMsg(r.ok ? `Desbloqueado: ${SKILL_TEXTS[sel.id].effect}` : r.error ?? '');
    if (r.ok) setSel(null);
  };

  return (
    <div className="screen" style={{ '--tint': 'var(--color-arcane)' } as CSSProperties}>
      <div className="head center">
        <span className="title">Árbol de habilidades</span>
        <span className="act num">
          {ctx.skills.length}/{SKILL_TREE.length}
        </span>
      </div>
      <Card className="row">
        <Pill tone={pts > 0 ? 'gold' : 'soft'} icon="star">
          {pts} punto{pts === 1 ? '' : 's'}
        </Pill>
        <div className="grow s" style={{ margin: 0 }}>
          Cada nodo cambia una regla del juego. Nada decorativo.
        </div>
      </Card>
      {msg && (
        <Notice tone="xp" icon="spark">
          <span onClick={() => setMsg(null)}>{msg}</span>
        </Notice>
      )}
      {BRANCHES.map((branch) => {
        const nodes = SKILL_TREE.filter((n) => n.branch === branch);
        const color = branch === 'trunk' ? 'var(--color-ink)' : ATTR_VAR[branch as AttributeId];
        const icon: IconId = branch === 'trunk' ? 'shield' : ATTR_ICON[branch as AttributeId];
        const available = nodes.filter((n) => nodeStatus(ctx, n).available && pts > 0);
        return (
          <Card key={branch} style={{ '--c': color } as CSSProperties}>
            <Label
              right={
                <span className="row" style={{ gap: 6 }}>
                  {branch === recommended && <Chip color="var(--color-xp)">recomendada</Chip>}
                  {branch !== 'trunk' && <span>Nv {p.attributes[branch as AttributeId].level}</span>}
                </span>
              }
            >
              <span className="row" style={{ gap: 8, color }}>
                <Icon id={icon} />
                {BRANCH_TEXTS[branch].name}
              </span>
            </Label>
            <div className="branch" style={{ marginTop: 8 }}>
              {nodes.map((n, k) => {
                const s = nodeStatus(ctx, n);
                const cls = s.unlocked ? 'on' : s.available && pts > 0 ? 'av' : '';
                return (
                  <span key={n.id} style={{ display: 'contents' }}>
                    {k > 0 && <span className={`link ${s.unlocked ? 'on' : ''}`} />}
                    <button type="button" className={`node ${cls} ${sel?.id === n.id ? 'sel' : ''}`} title={SKILL_TEXTS[n.id].name} onClick={() => setSel(n)}>
                      <Icon id={NODE_ICON[n.id] ?? icon} />
                      {!s.unlocked && <span className="cost num">{n.cost}</span>}
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="s" style={{ marginTop: 8 }}>
              {available.length > 0 ? (
                available.slice(0, 2).map((n) => (
                  <div key={n.id}>
                    <b style={{ color: 'var(--color-ink)' }}>{SKILL_TEXTS[n.id].name}</b>: {SKILL_TEXTS[n.id].effect}
                  </div>
                ))
              ) : nodes.every((n) => nodeStatus(ctx, n).unlocked) ? (
                'Rama completa.'
              ) : pts === 0 ? (
                'Sube de nivel para ganar puntos.'
              ) : (
                'Sube este atributo o desbloquea el nodo anterior.'
              )}
            </div>
          </Card>
        );
      })}
      <Card tone="tight">
        <div className="row" style={{ padding: '10px 0' }}>
          <div className="grow s" style={{ margin: 0 }}>
            Reinicios de árbol disponibles: {p.level.treeResetsAvailable} (uno por rango alcanzado). Los nodos son permanentes salvo que reinicies.
          </div>
          {p.level.treeResetsAvailable > 0 && ctx.skills.length > 0 && (
            <button className="btn ghost sm auto" onClick={() => resetTree(ctx).then((r) => setMsg(r.ok ? 'Árbol reiniciado. Todos tus puntos volvieron.' : r.error ?? ''))}>
              Reiniciar
            </button>
          )}
        </div>
      </Card>

      <Sheet open={Boolean(sel)} onClose={() => setSel(null)} title={sel ? SKILL_TEXTS[sel.id].name : ''}>
        {sel && st && (
          <div className="space-y-3 text-sm">
            <p>{SKILL_TEXTS[sel.id].effect}</p>
            <p className="s italic">"{SKILL_TEXTS[sel.id].flavor}"</p>
            <div className="s">
              Costo: {sel.cost} punto{sel.cost > 1 ? 's' : ''}
              {sel.requires?.length ? ` · Requiere: ${sel.requires.map((r) => SKILL_TEXTS[r].name).join(', ')}` : ''}
              {sel.minAttrLevel ? ` · ${BRANCH_TEXTS[sel.branch].name} nivel ${sel.minAttrLevel}` : ''}
              {sel.minLevel ? ` · Nivel general ${sel.minLevel}` : ''}
            </div>
            {st.unlocked ? (
              <Chip color="var(--color-gold)" icon="check">
                Activo
              </Chip>
            ) : st.available ? (
              <button className="btn gold" onClick={doUnlock} disabled={pts <= 0}>
                {pts > 0 ? 'Desbloquear' : 'Sin puntos disponibles'}
              </button>
            ) : (
              <ul className="list-disc pl-5 text-xs" style={{ color: 'var(--color-ember)' }}>
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
