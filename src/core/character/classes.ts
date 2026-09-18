import type { AttributeId, ClassId } from '@/shared/types';
import { CLASS_PRIMARY } from '@/lib/game-balance';

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  identityPhrase: string;
  primaryAttribute: AttributeId | null;
  recommendedBranch: 'trunk' | AttributeId;
  icon: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  guerrero: {
    id: 'guerrero',
    name: 'Guerrero',
    description: 'Tu campaña es física. El cuerpo es tu arma y cada entrenamiento la afila.',
    identityPhrase: 'Lo que no se entrena, se oxida.',
    primaryAttribute: 'fuerza',
    recommendedBranch: 'fuerza',
    icon: '⚔️',
  },
  erudito: {
    id: 'erudito',
    name: 'Erudito',
    description: 'Tu campaña es de estudio o de oficio. Aprender es tu forma de conquistar.',
    identityPhrase: 'Cada página leída es una puerta abierta.',
    primaryAttribute: 'intelecto',
    recommendedBranch: 'intelecto',
    icon: '📜',
  },
  asceta: {
    id: 'asceta',
    name: 'Asceta',
    description: 'Tu campaña es de orden y constancia. No buscas un gran salto: buscas no fallar.',
    identityPhrase: 'La rutina es la armadura del que persiste.',
    primaryAttribute: 'disciplina',
    recommendedBranch: 'disciplina',
    icon: '🕯️',
  },
  mercader: {
    id: 'mercader',
    name: 'Mercader',
    description: 'Tu campaña es financiera. Cada moneda contada es terreno ganado.',
    identityPhrase: 'El oro obedece a quien lo cuenta.',
    primaryAttribute: 'riqueza',
    recommendedBranch: 'riqueza',
    icon: '🪙',
  },
  sanador: {
    id: 'sanador',
    name: 'Sanador',
    description: 'Tu campaña es de salud, sueño y recuperación. Cuidarte es tu primera misión.',
    identityPhrase: 'Nadie gana la guerra sin dormir.',
    primaryAttribute: 'vitalidad',
    recommendedBranch: 'vitalidad',
    icon: '🌿',
  },
  vagabundo: {
    id: 'vagabundo',
    name: 'Vagabundo',
    description: 'Tu campaña todavía no tiene un solo camino. Explorar también es avanzar.',
    identityPhrase: 'No todos los que vagan están perdidos.',
    primaryAttribute: null,
    recommendedBranch: 'trunk',
    icon: '🧭',
  },
};

export const CLASS_LIST = Object.values(CLASSES);

export function classPrimary(id: ClassId): AttributeId | null {
  return CLASS_PRIMARY[id] ?? null;
}

export const ATTRIBUTE_META: Record<AttributeId, { name: string; description: string; color: string; icon: string }> = {
  fuerza: { name: 'Fuerza', description: 'Entrenamiento físico, deporte, movimiento', color: 'var(--color-fuerza)', icon: '💪' },
  disciplina: { name: 'Disciplina', description: 'Constancia, rutina, orden, cumplir lo planeado', color: 'var(--color-disciplina)', icon: '🛡️' },
  intelecto: { name: 'Intelecto', description: 'Estudio, lectura, trabajo, aprendizaje', color: 'var(--color-intelecto)', icon: '📖' },
  riqueza: { name: 'Riqueza', description: 'Ahorro, control de gastos, ingresos', color: 'var(--color-riqueza)', icon: '💰' },
  vitalidad: { name: 'Vitalidad', description: 'Sueño, alimentación, descanso, salud', color: 'var(--color-vitalidad)', icon: '❤️‍🔥' },
};
