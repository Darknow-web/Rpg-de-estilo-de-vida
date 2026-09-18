/**
 * Campañas de respaldo por arquetipo. Se usan cuando la IA falla, se agota la cuota o la
 * respuesta no valida. NO contienen datos de ninguna persona: anclas y horas son genéricas
 * y se ajustan a la franja horaria que el jugador declaró.
 */
import type { OnboardingOutput, OnboardingInput } from '@/shared/schemas/ai';
import type { ClassId } from '@/shared/types';

type Moment = OnboardingInput['answers']['q5_moment'];

const WINDOWS: Record<Moment, { inicio: string; fin: string } | 'todo_el_dia'> = {
  morning: { inicio: '06:30', fin: '10:00' },
  afternoon: { inicio: '13:00', fin: '18:00' },
  evening: { inicio: '19:00', fin: '22:30' },
  varies: 'todo_el_dia',
};

const ANCHOR_BY_MOMENT: Record<Moment, string> = {
  morning: 'Después de lavarme los dientes por la mañana',
  afternoon: 'Después de almorzar',
  evening: 'Después de cenar',
  varies: 'Después de mi primera pausa del día',
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

interface ArchetypeSpec {
  clase: OnboardingOutput['clase'];
  principal: (goal: string) => OnboardingOutput['mision_principal'];
  diarias: (anchor: string) => Omit<OnboardingOutput['misiones_diarias'][number], 'dias' | 'ventana'>[];
  semanales: OnboardingOutput['misiones_semanales'];
  recompensas: OnboardingOutput['recompensas_sugeridas'];
}

const ARCHETYPES: Record<ClassId, ArchetypeSpec> = {
  guerrero: {
    clase: { id: 'guerrero', nombre: 'Guerrero', descripcion: 'Tu campaña es física. El cuerpo es tu arma y cada entrenamiento la afila.', frase_identidad: 'Lo que no se entrena, se oxida.', atributo_principal: 'fuerza', razon_de_asignacion: 'Tu meta habla de tu cuerpo y de moverte más: esa es la marca del Guerrero.' },
    principal: (goal) => ({ nombre: 'Campaña del cuerpo', descripcion: `Tu meta: "${goal}". Se conquista por hitos, no de un golpe.`, atributo: 'fuerza', hitos: ['Completar 10 sesiones de entrenamiento con foto', 'Cuatro semanas seguidas con al menos 2 sesiones', 'Superar tu primera marca personal (peso, distancia o tiempo)', 'Doce semanas de constancia acumulada'], plazo_estimado_semanas: 24 }),
    diarias: (anchor) => [
      { nombre: 'Ponerme la ropa de entrenar', descripcion: `${anchor}, me pongo la ropa de entrenar. Si después entreno, mejor; si no, ya cumplí.`, atributo: 'fuerza', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Ponerme la ropa de entrenar', duracion_minutos: 5, evidencia_sugerida: 'Foto con la ropa puesta', version_minima_viable: { nombre: 'Sacar la ropa de entrenar', descripcion: 'Dejar la ropa de entrenar a la vista. Foto.' } },
      { nombre: '10 sentadillas', descripcion: `${anchor}, hago 10 sentadillas. Solo 10.`, atributo: 'fuerza', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Hacer 10 sentadillas', duracion_minutos: 3, evidencia_sugerida: 'Foto del lugar donde las hiciste o de tu reloj', version_minima_viable: { nombre: '5 sentadillas', descripcion: 'Cinco sentadillas. Foto.' } },
      { nombre: 'Vaso de agua al despertar', descripcion: 'Al despertar, tomo un vaso de agua antes que cualquier otra cosa.', atributo: 'vitalidad', dificultad: 'easy', ancla: 'Al despertar', comportamiento_minimo: 'Tomar un vaso de agua', duracion_minutos: 2, evidencia_sugerida: 'Foto del vaso', version_minima_viable: { nombre: 'Un sorbo de agua', descripcion: 'Un sorbo de agua al despertar. Foto.' } },
    ],
    semanales: [{ nombre: 'Caminata larga', descripcion: 'Una caminata de 30 minutos, el día que mejor te venga.', atributo: 'fuerza', dificultad: 'medium', veces_por_semana: 2, duracion_minutos: 30, evidencia_sugerida: 'Foto del recorrido o del lugar', version_minima_viable: { nombre: 'Caminata de 10 minutos', descripcion: 'Diez minutos caminando. Foto.' } }],
    recompensas: [
      { nombre: 'Tarde de sofá sin culpa', nivel: 1, es_gratuita: true, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Descansar sin remordimiento es parte del entrenamiento.' },
      { nombre: 'Postre favorito', nivel: 1, es_gratuita: false, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Un gusto pequeño con límite sano.' },
      { nombre: 'Ropa deportiva nueva', nivel: 3, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Refuerza tu campaña: equipa al Guerrero.' },
      { nombre: 'Masaje o día de spa', nivel: 3, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Recuperación merecida tras semanas de esfuerzo.' },
      { nombre: 'Escapada de fin de semana', nivel: 4, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'La zanahoria de largo plazo, conectada con tu meta de 6 meses.' },
    ],
  },
  erudito: {
    clase: { id: 'erudito', nombre: 'Erudito', descripcion: 'Tu campaña es de estudio o de oficio. Aprender es tu forma de conquistar.', frase_identidad: 'Cada página leída es una puerta abierta.', atributo_principal: 'intelecto', razon_de_asignacion: 'Tu meta habla de aprender, estudiar o crecer en tu trabajo: es la marca del Erudito.' },
    principal: (goal) => ({ nombre: 'Campaña del conocimiento', descripcion: `Tu meta: "${goal}". Se conquista por hitos.`, atributo: 'intelecto', hitos: ['Definir el plan de estudio en una página (foto)', 'Completar el primer bloque o capítulo', 'Terminar la mitad del material', 'Presentar, entregar o aplicar lo aprendido'], plazo_estimado_semanas: 24 }),
    diarias: (anchor) => [
      { nombre: 'Leer 2 páginas', descripcion: `${anchor}, leo 2 páginas de lo que estoy estudiando.`, atributo: 'intelecto', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Leer 2 páginas', duracion_minutos: 5, evidencia_sugerida: 'Foto de la página', version_minima_viable: { nombre: 'Abrir el libro', descripcion: 'Abrir el libro en la página donde quedaste. Foto.' } },
      { nombre: 'Una nota de lo aprendido', descripcion: `${anchor}, escribo una línea con algo que aprendí hoy.`, atributo: 'intelecto', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Escribir una línea', duracion_minutos: 3, evidencia_sugerida: 'Foto de la nota', version_minima_viable: { nombre: 'Una palabra clave', descripcion: 'Anotar una palabra clave del día. Foto.' } },
      { nombre: 'Escritorio despejado', descripcion: 'Antes de dormir, dejo el escritorio listo para mañana.', atributo: 'disciplina', dificultad: 'easy', ancla: 'Antes de dormir', comportamiento_minimo: 'Despejar el escritorio', duracion_minutos: 5, evidencia_sugerida: 'Foto del escritorio', version_minima_viable: { nombre: 'Quitar una cosa del escritorio', descripcion: 'Retirar un objeto que no va. Foto.' } },
    ],
    semanales: [{ nombre: 'Sesión de estudio profunda', descripcion: 'Una sesión de 45 minutos sin teléfono.', atributo: 'intelecto', dificultad: 'medium', veces_por_semana: 2, duracion_minutos: 45, evidencia_sugerida: 'Foto de tus apuntes', version_minima_viable: { nombre: 'Sesión de 15 minutos', descripcion: 'Quince minutos sin teléfono. Foto.' } }],
    recompensas: [
      { nombre: 'Un capítulo de tu serie', nivel: 1, es_gratuita: true, limite_de_frecuencia: '1 por día', por_que_encaja: 'Placer pequeño y gratuito que no compite con estudiar.' },
      { nombre: 'Café en tu lugar favorito', nivel: 1, es_gratuita: false, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Un gusto barato y frecuente.' },
      { nombre: 'Libro nuevo', nivel: 2, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Refuerza tu campaña: baja un escalón por coherencia.' },
      { nombre: 'Audífonos para concentrarte', nivel: 3, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Herramienta que sirve a la meta.' },
      { nombre: 'Curso o viaje de estudio', nivel: 4, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Zanahoria de largo plazo ligada a tu meta.' },
    ],
  },
  asceta: {
    clase: { id: 'asceta', nombre: 'Asceta', descripcion: 'Tu campaña es de orden y constancia. No buscas un gran salto: buscas no fallar.', frase_identidad: 'La rutina es la armadura del que persiste.', atributo_principal: 'disciplina', razon_de_asignacion: 'Tu meta habla de orden, constancia o rutina: es la marca del Asceta.' },
    principal: (goal) => ({ nombre: 'Campaña del orden', descripcion: `Tu meta: "${goal}".`, atributo: 'disciplina', hitos: ['Siete días seguidos con la bitácora completa', 'Primera misión Consolidada', 'Primera misión Dominada', 'Un mes con racha ininterrumpida'], plazo_estimado_semanas: 20 }),
    diarias: (anchor) => [
      { nombre: 'Hacer la cama', descripcion: 'Al levantarme, hago la cama. La primera victoria del día.', atributo: 'disciplina', dificultad: 'easy', ancla: 'Al levantarme', comportamiento_minimo: 'Hacer la cama', duracion_minutos: 2, evidencia_sugerida: 'Foto de la cama', version_minima_viable: { nombre: 'Estirar la sábana', descripcion: 'Estirar la sábana. Foto.' } },
      { nombre: 'Plan de 3 cosas', descripcion: `${anchor}, anoto las 3 cosas que haré hoy.`, atributo: 'disciplina', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Anotar 3 cosas', duracion_minutos: 3, evidencia_sugerida: 'Foto de la lista', version_minima_viable: { nombre: 'Anotar 1 cosa', descripcion: 'Anotar una sola cosa. Foto.' } },
      { nombre: 'Dos minutos de orden', descripcion: 'Antes de dormir, ordeno algo durante 2 minutos.', atributo: 'disciplina', dificultad: 'easy', ancla: 'Antes de dormir', comportamiento_minimo: 'Ordenar 2 minutos', duracion_minutos: 2, evidencia_sugerida: 'Foto del espacio ordenado', version_minima_viable: { nombre: 'Guardar una cosa', descripcion: 'Guardar un objeto en su sitio. Foto.' } },
    ],
    semanales: [{ nombre: 'Revisión semanal', descripcion: 'Quince minutos revisando la semana y planeando la siguiente.', atributo: 'disciplina', dificultad: 'medium', veces_por_semana: 1, duracion_minutos: 15, evidencia_sugerida: 'Foto del plan', version_minima_viable: { nombre: 'Revisión de 5 minutos', descripcion: 'Cinco minutos de revisión. Foto.' } }],
    recompensas: [
      { nombre: 'Mañana sin alarma', nivel: 1, es_gratuita: true, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Descanso gratuito y merecido.' },
      { nombre: 'Comida favorita', nivel: 1, es_gratuita: false, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Un gusto con límite sano.' },
      { nombre: 'Salida con amigos', nivel: 2, es_gratuita: false, limite_de_frecuencia: '1 por mes', por_que_encaja: 'Celebrar la constancia.' },
      { nombre: 'Algo para tu espacio (lámpara, planta, cuadro)', nivel: 3, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Refuerza el orden que estás construyendo.' },
      { nombre: 'Viaje corto', nivel: 4, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'La gran recompensa de 6 meses.' },
    ],
  },
  mercader: {
    clase: { id: 'mercader', nombre: 'Mercader', descripcion: 'Tu campaña es financiera. Cada moneda contada es terreno ganado.', frase_identidad: 'El oro obedece a quien lo cuenta.', atributo_principal: 'riqueza', razon_de_asignacion: 'Tu meta habla de dinero, ahorro o ingresos: es la marca del Mercader.' },
    principal: (goal) => ({ nombre: 'Campaña del tesoro', descripcion: `Tu meta: "${goal}".`, atributo: 'riqueza', hitos: ['Registrar todos los gastos durante una semana', 'Definir el monto de ahorro mensual', 'Primer mes con la meta de ahorro cumplida', 'Tres meses seguidos ahorrando'], plazo_estimado_semanas: 24 }),
    diarias: (anchor) => [
      { nombre: 'Anotar un gasto', descripcion: `${anchor}, anoto el último gasto que hice.`, atributo: 'riqueza', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Anotar un gasto', duracion_minutos: 2, evidencia_sugerida: 'Foto del registro', version_minima_viable: { nombre: 'Guardar un recibo', descripcion: 'Guardar un recibo del día. Foto.' } },
      { nombre: 'Revisar el saldo', descripcion: 'Antes de dormir, miro mi saldo sin juzgarme.', atributo: 'riqueza', dificultad: 'easy', ancla: 'Antes de dormir', comportamiento_minimo: 'Mirar el saldo', duracion_minutos: 2, evidencia_sugerida: 'Foto de tu cuaderno o pantalla (sin datos sensibles)', version_minima_viable: { nombre: 'Abrir la app del banco', descripcion: 'Abrir la app. Foto de la pantalla de inicio.' } },
      { nombre: 'Café de casa', descripcion: 'Por la mañana, preparo el café en casa en vez de comprarlo.', atributo: 'disciplina', dificultad: 'easy', ancla: 'Por la mañana', comportamiento_minimo: 'Preparar café en casa', duracion_minutos: 5, evidencia_sugerida: 'Foto de la taza', version_minima_viable: { nombre: 'Un vaso de agua en vez de comprar', descripcion: 'Un vaso de agua en casa. Foto.' } },
    ],
    semanales: [{ nombre: 'Cierre semanal de cuentas', descripcion: 'Sumar los gastos de la semana y compararlos con la anterior.', atributo: 'riqueza', dificultad: 'medium', veces_por_semana: 1, duracion_minutos: 20, evidencia_sugerida: 'Foto del resumen', version_minima_viable: { nombre: 'Sumar los gastos de un día', descripcion: 'Sumar un solo día. Foto.' } }],
    recompensas: [
      { nombre: 'Tarde libre sin gastar', nivel: 1, es_gratuita: true, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Gratis y coherente con tu meta.' },
      { nombre: 'Un antojo pequeño', nivel: 1, es_gratuita: false, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Un gusto con límite para que no se vuelva fuga.' },
      { nombre: 'Cena fuera', nivel: 2, es_gratuita: false, limite_de_frecuencia: '1 por mes', por_que_encaja: 'Celebrar sin romper el presupuesto.' },
      { nombre: 'Aporte extra a tu fondo', nivel: 3, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Refuerza la meta: el premio es el propio ahorro.' },
      { nombre: 'La compra grande que planeas', nivel: 5, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Tu zanahoria de 6 meses, pagada con orden.' },
    ],
  },
  sanador: {
    clase: { id: 'sanador', nombre: 'Sanador', descripcion: 'Tu campaña es de salud, sueño y recuperación. Cuidarte es tu primera misión.', frase_identidad: 'Nadie gana la guerra sin dormir.', atributo_principal: 'vitalidad', razon_de_asignacion: 'Tu meta habla de descansar, dormir o cuidar tu salud: es la marca del Sanador.' },
    principal: (goal) => ({ nombre: 'Campaña de la vitalidad', descripcion: `Tu meta: "${goal}". Conductas, no cifras.`, atributo: 'vitalidad', hitos: ['Siete noches seguidas acostándote a la hora fijada', 'Dos semanas con la rutina de sueño', 'Un mes de conductas de cuidado sostenidas', 'Doce semanas de constancia'], plazo_estimado_semanas: 20 }),
    diarias: (anchor) => [
      { nombre: 'Pantallas fuera 30 min antes', descripcion: 'Media hora antes de dormir, dejo el teléfono fuera del alcance.', atributo: 'vitalidad', dificultad: 'easy', ancla: 'Media hora antes de dormir', comportamiento_minimo: 'Dejar el teléfono lejos', duracion_minutos: 1, evidencia_sugerida: 'Foto del teléfono en su sitio (con otra cámara o al despertar)', version_minima_viable: { nombre: 'Modo no molestar', descripcion: 'Activar no molestar antes de dormir. Foto al despertar.' } },
      { nombre: 'Vaso de agua al despertar', descripcion: 'Al despertar, un vaso de agua.', atributo: 'vitalidad', dificultad: 'easy', ancla: 'Al despertar', comportamiento_minimo: 'Tomar un vaso de agua', duracion_minutos: 2, evidencia_sugerida: 'Foto del vaso', version_minima_viable: { nombre: 'Un sorbo de agua', descripcion: 'Un sorbo. Foto.' } },
      { nombre: 'Cinco respiraciones', descripcion: `${anchor}, hago cinco respiraciones lentas.`, atributo: 'vitalidad', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Cinco respiraciones', duracion_minutos: 2, evidencia_sugerida: 'Foto del lugar donde te sentaste', version_minima_viable: { nombre: 'Una respiración profunda', descripcion: 'Una respiración. Foto.' } },
    ],
    semanales: [{ nombre: 'Paseo al aire libre', descripcion: 'Veinte minutos al aire libre, sin prisa.', atributo: 'vitalidad', dificultad: 'medium', veces_por_semana: 2, duracion_minutos: 20, evidencia_sugerida: 'Foto del lugar', version_minima_viable: { nombre: 'Cinco minutos afuera', descripcion: 'Cinco minutos afuera. Foto.' } }],
    recompensas: [
      { nombre: 'Siesta sin culpa', nivel: 1, es_gratuita: true, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Gratis y alineada con tu meta.' },
      { nombre: 'Baño largo con música', nivel: 1, es_gratuita: true, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Recuperación barata.' },
      { nombre: 'Masaje', nivel: 2, es_gratuita: false, limite_de_frecuencia: '1 por mes', por_que_encaja: 'Refuerza la recuperación.' },
      { nombre: 'Almohada o sábanas nuevas', nivel: 3, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Herramienta para dormir mejor: coherente con la meta.' },
      { nombre: 'Escapada de descanso', nivel: 4, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Zanahoria de 6 meses.' },
    ],
  },
  vagabundo: {
    clase: { id: 'vagabundo', nombre: 'Vagabundo', descripcion: 'Tu campaña todavía no tiene un solo camino. Explorar también es avanzar.', frase_identidad: 'No todos los que vagan están perdidos.', atributo_principal: 'disciplina', razon_de_asignacion: 'Tu meta mezcla varios frentes o aún no está clara: el Vagabundo explora antes de elegir.' },
    principal: (goal) => ({ nombre: 'Campaña de exploración', descripcion: `Tu meta: "${goal}". Primero descubrimos qué camino te llama.`, atributo: 'disciplina', hitos: ['Una semana con la bitácora completa', 'Probar una misión de cada atributo', 'Elegir un atributo principal', 'Primera misión Consolidada'], plazo_estimado_semanas: 12 }),
    diarias: (anchor) => [
      { nombre: 'Diez minutos de movimiento', descripcion: `${anchor}, me muevo 10 minutos: caminar, estirar, subir escaleras.`, atributo: 'fuerza', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Moverme 10 minutos', duracion_minutos: 10, evidencia_sugerida: 'Foto del lugar', version_minima_viable: { nombre: 'Tres minutos de movimiento', descripcion: 'Tres minutos. Foto.' } },
      { nombre: 'Leer 2 páginas', descripcion: `${anchor}, leo 2 páginas de cualquier libro.`, atributo: 'intelecto', dificultad: 'easy', ancla: anchor, comportamiento_minimo: 'Leer 2 páginas', duracion_minutos: 5, evidencia_sugerida: 'Foto de la página', version_minima_viable: { nombre: 'Abrir el libro', descripcion: 'Abrir el libro. Foto.' } },
      { nombre: 'Hacer la cama', descripcion: 'Al levantarme, hago la cama.', atributo: 'disciplina', dificultad: 'easy', ancla: 'Al levantarme', comportamiento_minimo: 'Hacer la cama', duracion_minutos: 2, evidencia_sugerida: 'Foto de la cama', version_minima_viable: { nombre: 'Estirar la sábana', descripcion: 'Estirar la sábana. Foto.' } },
    ],
    semanales: [{ nombre: 'Explorar algo nuevo', descripcion: 'Probar una actividad que no hayas hecho este mes.', atributo: 'vitalidad', dificultad: 'medium', veces_por_semana: 1, duracion_minutos: 30, evidencia_sugerida: 'Foto de la actividad', version_minima_viable: { nombre: 'Buscar una actividad nueva', descripcion: 'Anotar una idea. Foto.' } }],
    recompensas: [
      { nombre: 'Tarde libre sin culpa', nivel: 1, es_gratuita: true, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Descanso gratuito.' },
      { nombre: 'Tu comida favorita', nivel: 1, es_gratuita: false, limite_de_frecuencia: '1 por semana', por_que_encaja: 'Un gusto pequeño con límite.' },
      { nombre: 'Cine o salida', nivel: 2, es_gratuita: false, limite_de_frecuencia: '1 por mes', por_que_encaja: 'Celebrar una semana completa.' },
      { nombre: 'Algo que llevas tiempo queriendo (barato)', nivel: 3, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Premio mediano para un mes de constancia.' },
      { nombre: 'Viaje o experiencia grande', nivel: 4, es_gratuita: false, limite_de_frecuencia: null, por_que_encaja: 'Zanahoria de largo plazo.' },
    ],
  },
};

const CLASS_KEYWORDS: { id: ClassId; words: RegExp }[] = [
  { id: 'guerrero', words: /gimnasio|entrenar|correr|maratón|músculo|fuerza|peso|físic|deporte|bici|nadar|ejercicio|cuerpo|abdomen|adelgazar|bajar/i },
  { id: 'erudito', words: /estudi|examen|carrera|universidad|leer|libro|idioma|inglés|curso|tesis|aprender|trabajo|ascenso|proyecto|programar|certifica/i },
  { id: 'mercader', words: /ahorr|deuda|dinero|plata|finanz|ingreso|negocio|emprend|vender|invertir|presupuesto/i },
  { id: 'sanador', words: /dormir|sueño|descans|ansiedad|estrés|salud|meditar|comer mejor|alimentaci|energía|cansancio/i },
  { id: 'asceta', words: /orden|constancia|rutina|hábito|disciplina|procrastin|organiz|puntual|dejar de/i },
];

export function pickArchetype(goal: string): ClassId {
  const hits = CLASS_KEYWORDS.map((c) => ({ id: c.id, n: (goal.match(new RegExp(c.words.source, 'gi')) ?? []).length })).filter((h) => h.n > 0);
  if (!hits.length) return 'vagabundo';
  hits.sort((a, b) => b.n - a.n);
  if (hits.length > 1 && hits[0].n === hits[1].n) return 'vagabundo';
  return hits[0].id;
}

export function fallbackCampaign(answers: OnboardingInput['answers'], forcedClass?: ClassId): OnboardingOutput {
  const classId = forcedClass ?? pickArchetype(answers.q1_goal);
  const spec = ARCHETYPES[classId];
  const anchorFromPlayer = answers.q7_anchors.trim();
  const anchor = anchorFromPlayer ? `Después de ${anchorFromPlayer.replace(/^después de\s*/i, '').split(/[,.;]/)[0].trim()}` : ANCHOR_BY_MOMENT[answers.q5_moment];
  const ventana = WINDOWS[answers.q5_moment];
  const diarias = spec.diarias(anchor).map((d) => ({ ...d, dias: ALL_DAYS, ventana }));
  return {
    riesgo_detectado: false,
    clase: spec.clase,
    mision_principal: spec.principal(answers.q1_goal),
    misiones_diarias: diarias as OnboardingOutput['misiones_diarias'],
    misiones_semanales: spec.semanales,
    recompensas_sugeridas: spec.recompensas,
    explicacion: {
      por_clase: `${spec.clase.razon_de_asignacion} Dijiste: "${answers.q1_goal}". Puedes cambiar de clase si no te representa.`,
      por_mision: diarias.map((d) => ({ nombre_mision: d.nombre, que_dijiste: `Tu meta: "${answers.q1_goal}"`, atributo: d.atributo, como_ayuda_a_tu_meta: `Es la versión más pequeña posible de un paso hacia tu meta; el juego la irá subiendo cuando la domines.` })),
      estrategia_general: `Empezamos con 3 misiones diarias mínimas (no 10): la regla validada es 3 a 5 al inicio, y el cupo se amplía jugando. Las misiones van ${answers.q5_moment === 'varies' ? 'a cualquier hora del día' : `en tu franja de ${answers.q5_moment === 'morning' ? 'mañana' : answers.q5_moment === 'afternoon' ? 'tarde' : 'noche'}`}, que es cuando dijiste ser más constante. Esta campaña se generó con el set local de respaldo porque la IA no estaba disponible; puedes regenerarla desde Ajustes cuando quieras.`,
      que_pasa_despues: 'Cuando una misión llegue a Consolidada (14 días) te ofreceremos subirla. Al Dominarla (30 días) libera un cupo y te propondremos la siguiente. Subir de rango también amplía tu bitácora.',
    },
  };
}
