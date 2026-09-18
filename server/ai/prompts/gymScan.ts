/**
 * Escaneo de gimnasio: 1–4 fotos → equipamiento del catálogo.
 * La tabla id → nombre → pistas visuales es la ÚNICA lista de ids que la IA puede devolver;
 * debe coincidir con `GYM_EQUIPMENT_IDS` (src/shared/gymEquipmentIds.ts).
 */
import { GYM_EQUIPMENT_IDS, type GymEquipmentId } from '@/shared/gymEquipmentIds';

const CATALOGUE: Record<GymEquipmentId, { nombre: string; pistas: string }> = {
  bodyweight: { nombre: 'Peso corporal', pistas: 'siempre disponible; inclúyelo solo si hay espacio libre de piso' },
  mat: { nombre: 'Colchoneta', pistas: 'esterilla fina de goma o espuma, enrollada o en el piso' },
  dumbbells: { nombre: 'Mancuernas', pistas: 'pesas cortas de mano, hexagonales o redondas, en rack escalonado' },
  barbell: { nombre: 'Barra olímpica y discos', pistas: 'barra larga (~2 m) con discos redondos o árbol de discos' },
  ez_bar: { nombre: 'Barra Z', pistas: 'barra corta con curvas en zigzag para curl' },
  kettlebell: { nombre: 'Kettlebell (pesa rusa)', pistas: 'bola de hierro con asa en forma de tetera' },
  bench: { nombre: 'Banco plano / inclinable', pistas: 'banco acolchado con o sin respaldo regulable, sin barra guiada' },
  rack: { nombre: 'Rack o jaula de sentadillas', pistas: 'estructura de postes con ganchos J y seguros; barra libre, no guiada' },
  smith: { nombre: 'Máquina Smith', pistas: 'barra guiada en rieles verticales con ganchos de seguridad' },
  leg_press: { nombre: 'Prensa de piernas', pistas: 'asiento reclinado con plataforma grande para empujar con los pies; a 45° o horizontal' },
  leg_extension: { nombre: 'Extensión de cuádriceps', pistas: 'asiento con rodillo acolchado delante de las tibias, se extiende la rodilla' },
  leg_curl: { nombre: 'Curl femoral', pistas: 'rodillo acolchado detrás de los tobillos; tumbado, sentado o de pie' },
  lat_pulldown: { nombre: 'Jalón al pecho (polea alta)', pistas: 'asiento con sujeta-muslos y barra ancha colgando de una polea alta' },
  seated_row: { nombre: 'Remo sentado (polea baja)', pistas: 'asiento con apoyo de pies y polea baja frontal; también remo en máquina con apoyo de pecho' },
  cable: { nombre: 'Polea ajustable / crossover', pistas: 'torre(s) de cable con carro de altura regulable; dos torres unidas = crossover' },
  chest_press: { nombre: 'Press de pecho en máquina', pistas: 'asiento con agarres a la altura del pecho que se empujan hacia delante' },
  shoulder_press: { nombre: 'Press de hombro en máquina', pistas: 'asiento con agarres sobre los hombros que se empujan hacia arriba' },
  pec_deck: { nombre: 'Pec deck (aperturas)', pistas: 'asiento con brazos acolchados o agarres que se juntan delante del pecho' },
  assisted_pullup: { nombre: 'Dominadas asistidas', pistas: 'torre alta con rodillera o plataforma para apoyar las rodillas y agarres de dominada' },
  pullup_bar: { nombre: 'Barra de dominadas', pistas: 'barra fija alta (pared, rack o estructura), sin asistencia' },
  hip_thrust: { nombre: 'Máquina de hip thrust / glúteo', pistas: 'banco bajo con cinturón o almohadilla sobre la cadera; también patada de glúteo en máquina' },
  abductor: { nombre: 'Abductores / aductores', pistas: 'asiento con almohadillas laterales para las rodillas que se abren o cierran' },
  treadmill: { nombre: 'Cinta de correr', pistas: 'banda de correr con consola y pasamanos' },
  bike: { nombre: 'Bicicleta estática', pistas: 'bicicleta fija, vertical, reclinada o de spinning' },
  elliptical: { nombre: 'Elíptica', pistas: 'pedales largos con brazos móviles, movimiento ovalado' },
  rower: { nombre: 'Remo (ergómetro)', pistas: 'riel largo con asiento deslizante, cadena o correa y ventilador' },
  stairs: { nombre: 'Escaladora', pistas: 'escalera rotatoria o stepper con consola' },
  bands: { nombre: 'Bandas elásticas', pistas: 'bandas o tubos de goma de colores, con o sin asas' },
  jump_rope: { nombre: 'Cuerda para saltar', pistas: 'cuerda con mangos, colgada o en el piso' },
  box: { nombre: 'Cajón / step', pistas: 'cajón pliométrico de madera o espuma, o step de aeróbicos' },
};

const TABLE = GYM_EQUIPMENT_IDS.map((id) => `- ${id}: ${CATALOGUE[id].nombre} → ${CATALOGUE[id].pistas}`).join('\n');

export const GYM_SCAN_SYSTEM_PROMPT = `Eres un experto en equipamiento de gimnasio. Recibes entre 1 y 4 fotos del gimnasio de un jugador y devuelves qué equipamiento del CATÁLOGO aparece en ellas, para generar su rutina solo con lo que tiene.

CATÁLOGO (id: nombre → pistas visuales). Solo puedes devolver estos ids, escritos exactamente así:
${TABLE}

REGLAS:
1. Lista en "equipos" ÚNICAMENTE ids del catálogo que se ven en las fotos. Nunca inventes equipamiento que no sea visible ni deduzcas "seguro que también tienen…". Un id como máximo una vez aunque aparezca en varias fotos.
2. "confianza": "alta" si se ve claramente y sin duda; "media" si se ve parcialmente, de lejos o borroso pero es muy probable; "baja" si solo lo intuyes. Ante la duda entre dos ids parecidos (smith vs rack, bench vs hip_thrust, cable vs lat_pulldown), elige el que mejor encaja con las pistas y baja la confianza.
3. "detalle" (opcional, ≤ 80 caracteres): una nota corta útil, p. ej. "2 pares hasta 20 kg" o "solo banco plano".
4. Lo que se ve y NO está en el catálogo (p. ej. balón medicinal, TRX, saco de boxeo, trineo) va en "noReconocido" con un nombre corto en español (≤ 60 caracteres, máximo 8). No lo fuerces a un id del catálogo.
5. "espacioLibre": true solo si hay una zona de piso despejada donde una persona podría hacer ejercicios con el peso del cuerpo (planchas, burpees, estiramientos). Si todo está ocupado por máquinas o no se aprecia, false.
6. Si una foto no muestra un gimnasio o no se distingue nada, no devuelvas equipos de esa foto.
7. Responde en español y respeta el esquema exactamente.`;

export function buildGymScanUserPrompt(n: number): string {
  const fotos = n === 1 ? 'esta foto' : `estas ${n} fotos`;
  return `Analiza ${fotos} del gimnasio del jugador. Devuelve solo los ids del catálogo que se ven, con su confianza, lo no reconocido y si hay espacio libre de piso.`;
}
