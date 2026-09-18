import { describe, it, expect } from 'vitest';
import { gymScanInputSchema, gymScanOutputSchema } from '@/shared/schemas/ai';
import { GYM_EQUIPMENT_IDS } from '@/shared/gymEquipmentIds';
import { EQUIPMENT } from '@/modules/gym/data/equipment';
import { mergeScanIntoEquipment } from '@/modules/gym/scan';

const b64 = (n = 200) => 'A'.repeat(n);

describe('esquemas del escaneo de gimnasio', () => {
  it('el enum de ids coincide exactamente con el catálogo EQUIPMENT (sin desviación)', () => {
    expect([...GYM_EQUIPMENT_IDS].sort()).toEqual(EQUIPMENT.map((e) => e.id).sort());
    expect(GYM_EQUIPMENT_IDS.length).toBe(30);
  });
  it('rechaza un id que no está en el catálogo', () => {
    const r = gymScanOutputSchema.safeParse({ equipos: [{ id: 'trx', confianza: 'alta' }], noReconocido: [], espacioLibre: true });
    expect(r.success).toBe(false);
  });
  it('acepta una salida válida y admite detalle opcional', () => {
    const r = gymScanOutputSchema.safeParse({
      equipos: [{ id: 'smith', confianza: 'alta', detalle: 'con rieles' }, { id: 'dumbbells', confianza: 'media' }],
      noReconocido: ['balón medicinal'],
      espacioLibre: false,
    });
    expect(r.success).toBe(true);
  });
  it('rechaza una confianza fuera de alta/media/baja', () => {
    const r = gymScanOutputSchema.safeParse({ equipos: [{ id: 'smith', confianza: 'segura' }], noReconocido: [], espacioLibre: true });
    expect(r.success).toBe(false);
  });
  it('entrada: rechaza más de 4 imágenes, ninguna, o una demasiado grande', () => {
    expect(gymScanInputSchema.safeParse({ images: [b64(), b64(), b64(), b64(), b64()] }).success).toBe(false);
    expect(gymScanInputSchema.safeParse({ images: [] }).success).toBe(false);
    expect(gymScanInputSchema.safeParse({ images: [b64(300_001)] }).success).toBe(false);
    expect(gymScanInputSchema.safeParse({ images: [b64(50)] }).success).toBe(false);
  });
  it('entrada: acepta de 1 a 4 imágenes de tamaño razonable', () => {
    expect(gymScanInputSchema.safeParse({ images: [b64()] }).success).toBe(true);
    expect(gymScanInputSchema.safeParse({ images: [b64(), b64(), b64(), b64(300_000)] }).success).toBe(true);
  });
});

describe('mergeScanIntoEquipment', () => {
  const current = [{ id: 'bodyweight', name: 'Peso corporal (siempre disponible)' }, { id: 'dumbbells', name: 'Mancuernas', locationNote: 'al fondo' }];
  it('agrega alta y media con nombre del catálogo, ignora baja y no duplica', () => {
    const merged = mergeScanIntoEquipment(current, {
      equipos: [
        { id: 'dumbbells', confianza: 'alta' },
        { id: 'smith', confianza: 'alta', detalle: 'dos unidades' },
        { id: 'bench', confianza: 'media' },
        { id: 'rower', confianza: 'baja' },
        { id: 'smith', confianza: 'media' },
      ],
    });
    expect(merged.map((e) => e.id)).toEqual(['bodyweight', 'dumbbells', 'smith', 'bench']);
    expect(merged.find((e) => e.id === 'smith')).toEqual({ id: 'smith', name: 'Máquina Smith', locationNote: 'dos unidades' });
    expect(merged.find((e) => e.id === 'bench')?.name).toBe('Banco plano / inclinable');
    // No toca lo que ya había.
    expect(merged[1]).toEqual(current[1]);
  });
  it('no muta la lista original y devuelve la misma si no hay nada nuevo', () => {
    const merged = mergeScanIntoEquipment(current, { equipos: [{ id: 'dumbbells', confianza: 'alta' }, { id: 'box', confianza: 'baja' }] });
    expect(merged).toEqual(current);
    expect(merged).not.toBe(current);
    expect(current.length).toBe(2);
  });
});
