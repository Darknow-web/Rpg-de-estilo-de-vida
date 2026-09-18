/**
 * Ids del catálogo de equipamiento de gimnasio. Viven en `shared` porque los usan tanto el
 * catálogo del módulo (nombres, categorías) como los esquemas de IA (servidor + cliente):
 * el enum del escaneo de fotos no puede desviarse del catálogo.
 */
export const GYM_EQUIPMENT_IDS = [
  'bodyweight',
  'mat',
  'dumbbells',
  'barbell',
  'ez_bar',
  'kettlebell',
  'bench',
  'rack',
  'smith',
  'leg_press',
  'leg_extension',
  'leg_curl',
  'lat_pulldown',
  'seated_row',
  'cable',
  'chest_press',
  'shoulder_press',
  'pec_deck',
  'assisted_pullup',
  'pullup_bar',
  'hip_thrust',
  'abductor',
  'treadmill',
  'bike',
  'elliptical',
  'rower',
  'stairs',
  'bands',
  'jump_rope',
  'box',
] as const;

export type GymEquipmentId = (typeof GYM_EQUIPMENT_IDS)[number];
