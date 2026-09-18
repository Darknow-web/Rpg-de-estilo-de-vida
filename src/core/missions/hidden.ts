/**
 * Misiones OCULTAS: se revelan al cumplirse una condición que el jugador no conoce.
 * Catálogo local (sin datos de nadie). Se crean inactivas en el onboarding.
 */
import type { WriteBatch } from 'firebase/firestore';
import type { Mission } from '@/shared/types';
import type { MissionTemplate } from '@/core/module';
import type { GameContext } from '@/core/context';
import { subDoc } from '@/core/repo';
import { buildLogEntry, logInBatch } from '@/lib/systemLog';
import { zonedParts } from '@/lib/time';

export interface HiddenDef {
  key: string;
  template: MissionTemplate;
  condition: { kind: 'streak' | 'completions' | 'earlyCompletions' | 'level' | 'allAttributesLevel'; value: number };
  hint: string;
}

export const HIDDEN_CATALOG: HiddenDef[] = [
  {
    key: 'hidden_streak_7',
    hint: 'Algo se revela a quien no falla una semana entera.',
    condition: { kind: 'streak', value: 7 },
    template: {
      moduleId: 'habits',
      name: 'Carta a tu yo futuro',
      description: 'Escribe a mano una carta breve a la persona que serás en 6 meses. Foto de la carta (puede estar doblada).',
      attribute: 'disciplina',
      type: 'hidden',
      difficulty: 'medium',
      schedule: { days: [], window: 'allDay' },
      estimatedMinutes: 15,
      minimalVersion: { name: 'Tres líneas a tu yo futuro', description: 'Tres líneas en un papel. Foto.' },
      evidenceHint: 'La carta escrita',
    },
  },
  {
    key: 'hidden_early_5',
    hint: 'Los que madrugan encuentran cosas que otros no ven.',
    condition: { kind: 'earlyCompletions', value: 5 },
    template: {
      moduleId: 'habits',
      name: 'Amanecer',
      description: 'Sal a ver salir el sol, sin teléfono en la mano salvo para la foto.',
      attribute: 'vitalidad',
      type: 'hidden',
      difficulty: 'easy',
      schedule: { days: [], window: 'allDay' },
      estimatedMinutes: 20,
      minimalVersion: { name: 'Ver el cielo al despertar', description: 'Asómate a la ventana al despertar. Foto del cielo.' },
      evidenceHint: 'El cielo del amanecer',
    },
  },
  {
    key: 'hidden_completions_50',
    hint: 'Cincuenta pruebas abren una puerta.',
    condition: { kind: 'completions', value: 50 },
    template: {
      moduleId: 'habits',
      name: 'Galería del progreso',
      description: 'Revisa tus 50 fotos de evidencia y elige la que más te enorgullece. Vuelve a recrearla hoy.',
      attribute: 'disciplina',
      type: 'hidden',
      difficulty: 'medium',
      schedule: { days: [], window: 'allDay' },
      estimatedMinutes: 20,
      minimalVersion: { name: 'Elige tu mejor foto', description: 'Elige una foto y recréala.' },
      evidenceHint: 'La foto recreada',
    },
  },
  {
    key: 'hidden_balanced_3',
    hint: 'El equilibrio tiene premio.',
    condition: { kind: 'allAttributesLevel', value: 3 },
    template: {
      moduleId: 'habits',
      name: 'Día de los cinco caminos',
      description: 'En un solo día haz algo pequeño por cada atributo: mover el cuerpo, ordenar algo, leer algo, anotar un gasto, dormir a tiempo. Foto de tu lista tachada.',
      attribute: 'disciplina',
      type: 'hidden',
      difficulty: 'hard',
      schedule: { days: [], window: 'allDay' },
      estimatedMinutes: 60,
      minimalVersion: { name: 'Tres de los cinco caminos', description: 'Tres cosas pequeñas de tres atributos distintos.' },
      evidenceHint: 'Tu lista tachada',
    },
  },
];

/** Evalúa condiciones y revela las que se cumplan (escribe en el batch). Devuelve las reveladas. */
export function checkHiddenMissions(ctx: GameContext, b: WriteBatch): Mission[] {
  const revealed: Mission[] = [];
  for (const m of ctx.missions) {
    if (m.type !== 'hidden' || m.revealed || !m.hiddenCondition) continue;
    const cond = m.hiddenCondition;
    const value = Number(cond.params.value ?? 0);
    let met = false;
    switch (cond.kind) {
      case 'streak':
        met = ctx.player.streak.current >= value;
        break;
      case 'completions':
        met = ctx.player.stats.missionsCompleted >= value;
        break;
      case 'level':
        met = ctx.player.level.current >= value;
        break;
      case 'allAttributesLevel':
        met = Object.values(ctx.player.attributes).every((a) => a.level >= value);
        break;
      case 'earlyCompletions': {
        const early = ctx.completions.filter((c) => c.status !== 'annulled' && zonedParts(new Date(c.completedAt), ctx.tz).hour < 8).length;
        met = early >= value;
        break;
      }
    }
    if (met) {
      b.update(subDoc(ctx.uid, 'missions', m.id), { revealed: true, active: true, schedule: { ...m.schedule, once: ctx.today } });
      logInBatch(b, ctx.uid, buildLogEntry('hidden_revealed', `Se reveló la misión oculta "${m.name}". Condición cumplida: ${cond.kind} ≥ ${value}.`));
      revealed.push(m);
    }
  }
  return revealed;
}
