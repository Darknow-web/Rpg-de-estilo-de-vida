/**
 * Catálogo de equipamiento y presets por tipo de gimnasio.
 * El jugador ELIGE de una lista típica primero; agregar máquinas una por una es la última opción.
 */
export type GymType = 'barrio' | 'cadena' | 'casa';

export interface EquipmentDef {
  id: string;
  name: string;
  category: 'libre' | 'maquina' | 'cardio' | 'accesorio' | 'cuerpo';
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'bodyweight', name: 'Peso corporal (siempre disponible)', category: 'cuerpo' },
  { id: 'mat', name: 'Colchoneta', category: 'accesorio' },
  { id: 'dumbbells', name: 'Mancuernas', category: 'libre' },
  { id: 'barbell', name: 'Barra olímpica y discos', category: 'libre' },
  { id: 'ez_bar', name: 'Barra Z', category: 'libre' },
  { id: 'kettlebell', name: 'Kettlebell (pesa rusa)', category: 'libre' },
  { id: 'bench', name: 'Banco plano / inclinable', category: 'libre' },
  { id: 'rack', name: 'Rack o jaula de sentadillas', category: 'libre' },
  { id: 'smith', name: 'Máquina Smith', category: 'maquina' },
  { id: 'leg_press', name: 'Prensa de piernas', category: 'maquina' },
  { id: 'leg_extension', name: 'Extensión de cuádriceps', category: 'maquina' },
  { id: 'leg_curl', name: 'Curl femoral', category: 'maquina' },
  { id: 'lat_pulldown', name: 'Jalón al pecho (polea alta)', category: 'maquina' },
  { id: 'seated_row', name: 'Remo sentado (polea baja)', category: 'maquina' },
  { id: 'cable', name: 'Polea ajustable / crossover', category: 'maquina' },
  { id: 'chest_press', name: 'Press de pecho en máquina', category: 'maquina' },
  { id: 'shoulder_press', name: 'Press de hombro en máquina', category: 'maquina' },
  { id: 'pec_deck', name: 'Pec deck (aperturas)', category: 'maquina' },
  { id: 'assisted_pullup', name: 'Dominadas asistidas', category: 'maquina' },
  { id: 'pullup_bar', name: 'Barra de dominadas', category: 'accesorio' },
  { id: 'hip_thrust', name: 'Máquina de hip thrust / glúteo', category: 'maquina' },
  { id: 'abductor', name: 'Abductores / aductores', category: 'maquina' },
  { id: 'treadmill', name: 'Cinta de correr', category: 'cardio' },
  { id: 'bike', name: 'Bicicleta estática', category: 'cardio' },
  { id: 'elliptical', name: 'Elíptica', category: 'cardio' },
  { id: 'rower', name: 'Remo (ergómetro)', category: 'cardio' },
  { id: 'stairs', name: 'Escaladora', category: 'cardio' },
  { id: 'bands', name: 'Bandas elásticas', category: 'accesorio' },
  { id: 'jump_rope', name: 'Cuerda para saltar', category: 'accesorio' },
  { id: 'box', name: 'Cajón / step', category: 'accesorio' },
];

export const GYM_PRESETS: Record<GymType, { name: string; description: string; equipment: string[] }> = {
  barrio: {
    name: 'Gimnasio de barrio',
    description: 'Mancuernas, barras, algunas máquinas básicas y una o dos cintas.',
    equipment: ['bodyweight', 'mat', 'dumbbells', 'barbell', 'ez_bar', 'bench', 'rack', 'leg_press', 'leg_extension', 'leg_curl', 'lat_pulldown', 'seated_row', 'cable', 'pullup_bar', 'treadmill', 'bike'],
  },
  cadena: {
    name: 'Cadena grande',
    description: 'De todo: máquinas guiadas, zona de peso libre y cardio variado.',
    equipment: EQUIPMENT.map((e) => e.id),
  },
  casa: {
    name: 'Gimnasio en casa',
    description: 'Colchoneta, algún par de mancuernas o bandas, y tu cuerpo.',
    equipment: ['bodyweight', 'mat', 'dumbbells', 'bands', 'jump_rope'],
  },
};

export function equipmentName(id: string): string {
  return EQUIPMENT.find((e) => e.id === id)?.name ?? id;
}
