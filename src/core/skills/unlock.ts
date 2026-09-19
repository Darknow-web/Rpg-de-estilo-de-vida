import type { GameContext } from '@/core/context';
import { SKILL_TREE, type SkillNode } from '@/lib/game-balance';
import { batch, commitSoon, playerRef, subDoc, clean } from '@/core/repo';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import { nowIso } from '@/lib/ids';
import { SKILL_TEXTS, BRANCH_TEXTS } from '@/data/skillTree';

export interface NodeStatus {
  node: SkillNode;
  unlocked: boolean;
  available: boolean;
  reasons: string[];
}

export function nodeStatus(ctx: GameContext, node: SkillNode): NodeStatus {
  const unlocked = ctx.skills.includes(node.id);
  const reasons: string[] = [];
  if (!unlocked) {
    if (ctx.player.level.skillPointsAvailable < node.cost) reasons.push(`Necesitas ${node.cost} punto${node.cost > 1 ? 's' : ''} de habilidad`);
    if (node.minLevel && ctx.player.level.current < node.minLevel) reasons.push(`Nivel general ${node.minLevel}`);
    if (node.minAttrLevel && node.branch !== 'trunk' && ctx.player.attributes[node.branch].level < node.minAttrLevel) reasons.push(`Requiere ${BRANCH_TEXTS[node.branch].name} nivel ${node.minAttrLevel} (vas en ${ctx.player.attributes[node.branch].level})`);
    for (const req of node.requires ?? []) if (!ctx.skills.includes(req)) reasons.push(`Requiere "${SKILL_TEXTS[req]?.name ?? req}"`);
  }
  return { node, unlocked, available: !unlocked && reasons.length === 0, reasons };
}

/** Los documentos de skills son inmutables (reglas). Cada desbloqueo lleva la generación del árbol. */
export function skillDocId(nodeId: string, generation: number): string {
  return generation === 0 ? nodeId : `${nodeId}__g${generation}`;
}

export async function unlockNode(ctx: GameContext, nodeId: string): Promise<{ ok: boolean; error?: string }> {
  const node = SKILL_TREE.find((n) => n.id === nodeId);
  if (!node) return { ok: false, error: 'Nodo desconocido' };
  const st = nodeStatus(ctx, node);
  if (st.unlocked) return { ok: false, error: 'Ya desbloqueado' };
  if (!st.available) return { ok: false, error: st.reasons.join(' · ') };
  const p = structuredClone(ctx.player);
  p.level.skillPointsAvailable -= node.cost;
  const gen = p.level.treeGeneration ?? 0;
  const b = batch();
  b.set(subDoc(ctx.uid, 'skills', skillDocId(nodeId, gen)), { nodeId, unlockedAt: nowIso(), resetGeneration: gen });
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('skill_unlocked', `Desbloqueaste "${SKILL_TEXTS[nodeId]?.name ?? nodeId}": ${SKILL_TEXTS[nodeId]?.effect ?? ''}`));
  await commitSoon(b, 'unlockNode');
  return { ok: true };
}

/** Reinicio del árbol: uno por rango alcanzado. Devuelve todos los puntos. Los nodos viejos quedan en el historial pero dejan de contar. */
export async function resetTree(ctx: GameContext): Promise<{ ok: boolean; error?: string }> {
  if (ctx.player.level.treeResetsAvailable <= 0) return { ok: false, error: 'No tienes reinicios disponibles. Ganas uno por cada rango alcanzado.' };
  const p = structuredClone(ctx.player);
  p.level.treeResetsAvailable -= 1;
  p.level.skillPointsAvailable = p.level.skillPointsEarned;
  p.level.treeGeneration = (p.level.treeGeneration ?? 0) + 1;
  const b = batch();
  b.set(playerRef(ctx.uid), clean(p));
  logInBatch(b, ctx.uid, buildLogEntry('tree_reset', `Reiniciaste el árbol de habilidades. Recuperas ${p.level.skillPointsEarned} puntos. Te quedan ${p.level.treeResetsAvailable} reinicios.`));
  await commitSoon(b, 'resetTree');
  return { ok: true };
}
