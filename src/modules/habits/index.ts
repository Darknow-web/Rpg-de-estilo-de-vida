/**
 * Módulo de hábitos: misiones genéricas sin lógica especial. Usa el flujo genérico foto → completar.
 */
import type { Module } from '@/core/module';

export const habitsModule: Module = {
  id: 'habits',
  displayName: 'Hábitos',
  description: 'Misiones genéricas: cualquier acción real con foto de prueba.',
  icon: '📓',
  async proposeMissions() {
    // Las misiones de hábitos las crea el jugador (o la IA) directamente; el módulo no propone por sí mismo.
    return [];
  },
  view: null,
  executionView: null,
};
