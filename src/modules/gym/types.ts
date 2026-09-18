import type { GymType } from './data/equipment';

export interface EquipmentItem {
  id: string;
  name: string;
  locationNote?: string;
}

export interface SportActivity {
  name: string;
  days: number[];
}

export interface GymProfile {
  gymType: GymType | null;
  equipment: EquipmentItem[];
  sports: SportActivity[];
  /** Sesiones semanales objetivo (propuesto por el sistema; sube por escalado, nunca por calendario). */
  sessionsPerWeek: number;
  /** Duración máxima de sesión propuesta (min). */
  maxSessionMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityBlock {
  day: number; // 0 domingo … 6 sábado
  start: string; // HH:mm
  end: string;
}

export interface GymAvailability {
  template: AvailabilityBlock[];
  /** Excepciones por semana ("YYYY-Www" → bloques que reemplazan la plantilla esa semana). */
  exceptions: Record<string, AvailabilityBlock[]>;
  updatedAt: string;
}

export interface SessionExercise {
  exerciseId: string;
  sets: number;
  reps: string;
  restSec: number;
}

export interface RoutineSession {
  index: number;
  day: number;
  start: string;
  end: string;
  minutes: number;
  focus: string;
  exercises: SessionExercise[];
}

export interface WeeklyRoutine {
  weekKey: string;
  sessions: RoutineSession[];
  uncoveredPatterns: string[];
  notes: string[];
  missionId: string | null;
  generatedAt: string;
}

export interface SessionLog {
  id: string;
  weekKey: string;
  day: string;
  sessionIndex: number;
  exercises: { exerciseId: string; sets: { weight: number | null; reps: number | null; done: boolean }[] }[];
  completionId: string | null;
  createdAt: string;
}
