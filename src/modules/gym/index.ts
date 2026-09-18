/**
 * Módulo gimnasio. Aporta UNA misión diaria "Sesión de gimnasio" con los días y ventanas de la
 * rutina semanal. El core aplica cupo, corazones y recompensas; el módulo solo guarda sus registros.
 */
import { lazy } from 'react';
import type { Module, MissionTemplate, PlayerContext } from '@/core/module';
import { useGym, saveRoutine, loadRoutine } from './store';
import { generateRoutine } from './routine/generator';
import { weekKey, startOfWeek, addDays } from '@/lib/time';
import type { AvailabilityBlock, WeeklyRoutine } from './types';
import { createMission, updateMission } from '@/core/missions/manage';
import type { GameContext } from '@/core/context';
import { logSystem } from '@/lib/systemLog';
import { GymScreen } from './ui/GymScreen';
import { GymSessionEmbedded } from './ui/GymSessionEmbedded';

export const GYM_MISSION_KEY = 'gym-session';

export function blocksForWeek(template: AvailabilityBlock[], exceptions: Record<string, AvailabilityBlock[]>, wk: string): AvailabilityBlock[] {
  return exceptions[wk] ?? template;
}

export function routineToTemplate(routine: WeeklyRoutine): MissionTemplate | null {
  if (!routine.sessions.length) return null;
  const days = routine.sessions.map((s) => s.day);
  const windowsByDay: Record<string, { start: string; end: string }> = {};
  for (const s of routine.sessions) windowsByDay[String(s.day)] = { start: s.start, end: s.end };
  const first = routine.sessions[0];
  return {
    moduleId: 'gym',
    externalKey: GYM_MISSION_KEY,
    name: 'Sesión de gimnasio',
    description: `${routine.sessions.length} sesiones esta semana, solo con tu equipamiento. Al terminar, foto y listo.`,
    attribute: 'fuerza',
    type: 'daily',
    difficulty: 'medium',
    schedule: { days, window: { start: first.start, end: first.end }, windowsByDay },
    estimatedMinutes: Math.round(routine.sessions.reduce((s, x) => s + x.minutes, 0) / routine.sessions.length),
    minimalVersion: { name: 'Ir al gimnasio y hacer un ejercicio', description: 'Entrar, hacer una serie de cualquier ejercicio, foto.' },
    anchor: 'En mi bloque libre',
    evidenceHint: 'Foto en el gimnasio (máquina, pesas o espejo)',
  };
}

/** Regenera la rutina de la semana (si no existe) y sincroniza la misión. Se llama al abrir el módulo y cada semana. */
export async function ensureWeeklyRoutine(ctx: GameContext, opts: { force?: boolean } = {}): Promise<WeeklyRoutine | null> {
  const g = useGym.getState();
  if (!g.profile || !g.availability) return null;
  const wk = weekKey(ctx.today);
  let routine = opts.force ? null : (g.routine?.weekKey === wk ? g.routine : await loadRoutine(ctx.uid, wk));
  const existing = ctx.missions.find((m) => m.moduleId === 'gym' && m.moduleData?.externalKey === GYM_MISSION_KEY);
  if (!routine) {
    routine = generateRoutine(g.profile, blocksForWeek(g.availability.template, g.availability.exceptions, wk), wk);
    routine.missionId = existing?.id ?? null;
    await saveRoutine(ctx.uid, routine);
    await logSystem(ctx.uid, 'gym_routine', `Rutina de la semana ${wk} generada: ${routine.sessions.length} sesiones en tus bloques libres, usando solo tu equipamiento.${routine.notes.length ? ' ' + routine.notes.join(' ') : ''}`, { reversible: false });
  }
  const template = routineToTemplate(routine);
  if (!template) return routine;
  if (existing) {
    if (existing.active && (JSON.stringify(existing.schedule) !== JSON.stringify(template.schedule) || existing.estimatedMinutes !== template.estimatedMinutes)) {
      await updateMission(ctx, existing.id, { schedule: template.schedule, estimatedMinutes: template.estimatedMinutes, description: template.description }, 'rutina semanal regenerada');
    }
    if (routine.missionId !== existing.id) {
      routine.missionId = existing.id;
      await saveRoutine(ctx.uid, routine);
    }
  } else {
    const r = await createMission(ctx, template, 'gym');
    if (r.ok && r.mission) {
      routine.missionId = r.mission.id;
      await saveRoutine(ctx.uid, routine);
    } else {
      routine.notes = [...routine.notes, `No se pudo crear la misión de gimnasio: ${r.error ?? 'sin cupo'}. ${r.nextUnlock ?? ''}`];
      await saveRoutine(ctx.uid, routine);
    }
  }
  return routine;
}

export function nextWeekKey(today: string): string {
  return weekKey(addDays(startOfWeek(today), 7));
}

export const gymModule: Module = {
  id: 'gym',
  displayName: 'Gimnasio',
  description: 'Rutina semanal que cae sola en tus huecos libres y usa solo el equipamiento de TU gimnasio.',
  icon: '🏋️',
  async proposeMissions(ctx: PlayerContext) {
    const g = useGym.getState();
    if (!g.routine || g.routine.weekKey !== weekKey(ctx.today)) return [];
    const t = routineToTemplate(g.routine);
    return t ? [t] : [];
  },
  view: { path: '/gym', label: 'Gym', component: lazy(async () => ({ default: GymScreen })) },
  executionView: lazy(async () => ({ default: GymSessionEmbedded })),
  async onMissionCompleted() {
    // El registro de la sesión (pesos, series) lo guarda la vista de sesión antes de completar.
  },
};
