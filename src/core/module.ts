/**
 * Interfaz Module: cómo un módulo (gimnasio, hábitos, y los futuros) se conecta al core.
 * Ningún módulo escribe XP, monedas ni corazones. Todo pasa por completeMission() y awardRewards().
 */
import type { LazyExoticComponent, ComponentType } from 'react';
import type { AttributeId, Difficulty, MissionSchedule, MissionStakes, MissionType, ModuleId, MinimalVersion, Mission, Player } from '@/shared/types';

export interface MissionTemplate {
  moduleId: ModuleId;
  name: string;
  description: string;
  attribute: AttributeId;
  type: MissionType;
  difficulty: Difficulty;
  schedule: MissionSchedule;
  estimatedMinutes: number;
  minimalVersion: MinimalVersion;
  anchor?: string;
  evidenceHint?: string;
  /** Ausente = 'normal'. 'none' para compromisos de agenda (fallar no quita corazones). */
  stakes?: MissionStakes;
  moduleData?: Record<string, unknown>;
  /** Identidad estable para que el módulo pueda actualizar en vez de duplicar. */
  externalKey?: string;
  chainId?: string;
  chainOrder?: number;
  milestones?: string[];
  checklist?: string[];
}

export interface PlayerContext {
  uid: string;
  player: Player;
  missions: Mission[];
  today: string;
  timezone: string;
}

export interface CompletionContext {
  missionId: string;
  completionId: string;
  day: string;
  status: 'onTime' | 'grace';
  evidenceId: string | null;
  mission: Mission;
}

export interface OnboardingStep {
  id: string;
  title: string;
  component: LazyExoticComponent<ComponentType<{ onDone: () => void }>>;
}

export interface Module {
  id: ModuleId;
  displayName: string;
  description: string;
  icon: string;
  /** Misiones que el módulo quiere activas ahora. El core aplica el cupo y las crea o actualiza. */
  proposeMissions(ctx: PlayerContext): Promise<MissionTemplate[]>;
  /** Vista propia (ruta + componente). null si no tiene. */
  view: { path: string; label: string; component: LazyExoticComponent<ComponentType> } | null;
  /** Vista de ejecución al tocar una misión de este módulo. null = flujo genérico foto → completar. */
  executionView: LazyExoticComponent<ComponentType<{ missionId: string; onDone: () => void }>> | null;
  /** El core avisa DESPUÉS de completar o fallar. */
  onMissionCompleted?(ctx: CompletionContext): Promise<void>;
  onMissionFailed?(missionId: string, day: string): Promise<void>;
  onboardingSteps?: OnboardingStep[];
}

const registry = new Map<ModuleId, Module>();

export function registerModule(mod: Module) {
  registry.set(mod.id, mod);
}
export function getModule(id: ModuleId): Module | undefined {
  return registry.get(id);
}
export function allModules(): Module[] {
  return [...registry.values()];
}
