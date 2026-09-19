import { describe, it, expect } from 'vitest';
import { anchorFromAnswers, fallbackCampaign } from '@/data/fallback/campaigns';
import { onboardingOutputSchema } from '@/shared/schemas/ai';
import { ONBOARDING } from '@/lib/game-balance';
import { quotaFor } from '@/core/missions/quota';
import { DEFAULT_EFFECTS } from '@/core/skills/effects';
import { createInitialPlayer } from '@/core/character/player';
import { buildMission } from '@/core/missions/factory';
import type { MissionTemplate } from '@/core/module';

const answers = { q1_goal: 'correr 10 km', q2_why: 'salud', q3_tried: [], q4_time: '30' as const, q5_moment: 'morning' as const, q6_demotivator: 'forget' as const, q7_anchors: '', q8_rewards: '' };

describe('ancla del set local', () => {
  it('usa la primera cosa diaria que escribió el jugador', () => {
    expect(anchorFromAnswers('Me lavo los dientes, tomo café', 'morning')).toBe('Después de me lavo los dientes');
    expect(anchorFromAnswers('tomar café y leer', 'evening')).toBe('Después de tomar café');
  });
  it('ignora anclas que no son diarias (día de la semana, partido, clase) y cae a la franja', () => {
    expect(anchorFromAnswers('Los domingos juego futbol 7vs 7', 'morning')).toBe('Después de lavarme los dientes por la mañana');
    expect(anchorFromAnswers('clase de inglés', 'evening')).toBe('Después de cenar');
    expect(anchorFromAnswers('', 'afternoon')).toBe('Después de almorzar');
  });
  it('rechaza anclas demasiado largas', () => {
    expect(anchorFromAnswers('a'.repeat(60), 'varies')).toBe('Después de mi primera pausa del día');
  });
  it('la campaña local nunca produce "Después de Los domingos…"', () => {
    const out = fallbackCampaign({ ...answers, q7_anchors: 'Los domingos juego futbol 7vs 7' });
    for (const d of out.misiones_diarias) expect(d.ancla).not.toMatch(/domingo/i);
    expect(out.misiones_diarias.length).toBe(ONBOARDING.dailyMissions.min);
  });
});

describe('la IA decide entre 3 y 5 diarias', () => {
  const base = fallbackCampaign(answers);
  const clone = (n: number) => ({ ...base, misiones_diarias: Array.from({ length: n }, (_, i) => ({ ...base.misiones_diarias[i % 3], nombre: `Misión ${i}` })) });
  it('acepta 3, 4 y 5', () => {
    for (const n of [3, 4, 5]) expect(onboardingOutputSchema.safeParse(clone(n)).success).toBe(true);
  });
  it('rechaza 2 y 6', () => {
    for (const n of [2, 6]) expect(onboardingOutputSchema.safeParse(clone(n)).success).toBe(false);
  });
  it('el cupo diario no marca como "pasado" un jugador con 5 diarias de la campaña', () => {
    const player = createInitialPlayer('u', 'Test', 'UTC', '2026-01-01');
    const tpl = (name: string): MissionTemplate => ({ moduleId: 'habits', name, description: name, attribute: 'disciplina', type: 'daily', difficulty: 'easy', schedule: { days: [0, 1, 2, 3, 4, 5, 6], window: 'allDay' }, estimatedMinutes: 5, minimalVersion: { name, description: name } });
    const missions = ['a', 'b', 'c', 'd', 'e'].map((n) => buildMission(tpl(n), 'onboarding', '2026-01-01'));
    const q = quotaFor('daily', player, missions, DEFAULT_EFFECTS);
    expect(q.max).toBe(5);
    expect(q.used).toBe(5);
    expect(q.allowed).toBe(false);
    // Creadas por el jugador no estiran el cupo.
    const own = ['a', 'b', 'c', 'd'].map((n) => buildMission(tpl(n), 'player', '2026-01-01'));
    expect(quotaFor('daily', player, own, DEFAULT_EFFECTS).max).toBe(3);
  });
});
