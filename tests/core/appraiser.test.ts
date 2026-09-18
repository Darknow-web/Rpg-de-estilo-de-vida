import { describe, it, expect } from 'vitest';
import { fallbackAppraise, finalizeAppraisal } from '@/core/shop/appraiser';
import type { AppraisalInput } from '@/shared/schemas/ai';

const base: AppraisalInput = { rewardName: '', playerGoal: 'correr 10 km', why: 'salud', rewardWishes: '', rank: 'D', level: 1, estimatedCoinsPerDay: 24, recentCheapRewards: 0, existingRewards: [] };

describe('tasador local', () => {
  it('lo gratuito va abajo con límite de frecuencia', () => {
    const r = fallbackAppraise({ ...base, rewardName: 'Siesta sin culpa' });
    expect(r.nivel_sugerido).toBe(1);
    expect(r.limite_de_frecuencia).toBeTruthy();
  });
  it('conflicto con la meta: sube un escalón, límite y nota, NUNCA bloquea', () => {
    const r = fallbackAppraise({ ...base, rewardName: 'Pizza y cerveza' });
    expect(r.conflicto_con_meta).toBe(true);
    expect(r.nivel_sugerido).toBe(2);
    expect(r.limite_de_frecuencia).toBeTruthy();
    expect(r.nota_de_conflicto).toMatch(/nadie la prohíbe/i);
  });
  it('coherencia con la campaña baja un escalón', () => {
    const r = fallbackAppraise({ ...base, rewardName: 'Zapatillas para correr' });
    expect(r.refuerza_meta).toBe(true);
    expect(r.nivel_sugerido).toBe(2);
  });
  it('anti-abuso sube el piso y lo dice', () => {
    const r = fallbackAppraise({ ...base, rewardName: 'Helado', recentCheapRewards: 3 });
    expect(r.nivel_sugerido).toBeGreaterThanOrEqual(2);
    expect(r.razonamiento).toMatch(/piso/i);
  });
  it('precio = días × monedas/día y requisito del escalón', () => {
    const a = finalizeAppraisal(fallbackAppraise({ ...base, rewardName: 'Viaje a la playa' }), 24, 'fallback');
    expect(a.nivel_sugerido).toBe(4);
    expect(a.precio_en_monedas).toBe(Math.round(60 * 24));
    expect(a.nivel_o_rango_minimo).toEqual({ rank: 'A', level: 32 });
  });
});
