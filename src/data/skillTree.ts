/**
 * Textos de los nodos del árbol (los efectos numéricos viven en game-balance.ts).
 * Cada descripción dice QUÉ REGLA cambia.
 */
export const SKILL_TEXTS: Record<string, { name: string; effect: string; flavor: string }> = {
  corazon_extra_1: { name: 'Corazón extra', effect: '+1 corazón máximo.', flavor: 'Un latido más entre tú y el abismo.' },
  corazon_extra_2: { name: 'Corazón de hierro', effect: '+1 corazón máximo adicional.', flavor: 'Lo que no te mata te da otro corazón.' },
  segunda_oportunidad: { name: 'Segunda oportunidad', effect: '1 fallo perdonado por semana: no descuenta corazones.', flavor: 'Todos merecen una.' },
  bitacora_ampliada_1: { name: 'Bitácora ampliada', effect: '+1 de cupo de misiones diarias activas.', flavor: 'Más páginas para tu campaña.' },
  bitacora_ampliada_2: { name: 'Bitácora encuadernada', effect: '+1 de cupo de misiones diarias adicional.', flavor: 'El libro crece contigo.' },
  gracia_extendida: { name: 'Gracia extendida', effect: 'El margen de gracia pasa de 3 a 5 horas.', flavor: 'El tiempo también perdona.' },
  dia_imposible_extra: { name: 'Día imposible extra', effect: '3 días imposibles por mes en vez de 2.', flavor: 'La vida no pide permiso.' },

  madrugador: { name: 'Madrugador', effect: 'Misiones completadas antes de las 8:00 dan monedas dobles.', flavor: 'El sol te encuentra ya en marcha.' },
  resistencia: { name: 'Resistencia', effect: 'Un fallo de gimnasio por semana no rompe la racha.', flavor: 'El cuerpo aguanta más de lo que crees.' },
  deportista: { name: 'Deportista', effect: 'Tus actividades deportivas declaradas cuentan como misión de Fuerza (con foto).', flavor: 'Jugar también entrena.' },
  cuerpo_templado: { name: 'Cuerpo templado', effect: 'Fallar una misión de Fuerza cuesta 1 corazón menos (mínimo 1).', flavor: 'Las cicatrices son armadura.' },
  sesion_doble: { name: 'Sesión doble', effect: 'Completar 2 misiones de Fuerza el mismo día desbloquea una secundaria extra sin consumir cupo.', flavor: 'Cuando el fuego prende, alimenta.' },

  racha_de_hierro: { name: 'Racha de hierro', effect: 'La racha resiste 1 fallo por semana sin reiniciarse.', flavor: 'Un tropiezo no es una caída.' },
  cierre_del_dia: { name: 'Cierre del día', effect: 'Revisar el resumen del día otorga +15 XP de Disciplina.', flavor: 'Mirar atrás para avanzar.' },
  ventana_flexible: { name: 'Ventana flexible', effect: 'Puedes mover la ventana horaria de una misión el mismo día, una vez, sin penalización.', flavor: 'El plan se adapta; la meta no.' },
  cadena_maestra: { name: 'Cadena maestra', effect: 'Completar una cadena da una ráfaga del 40 % de nivel en vez del 25 %.', flavor: 'Eslabón a eslabón.' },
  planificador: { name: 'Planificador', effect: 'Puedes ver y aceptar las misiones de mañana la noche anterior.', flavor: 'La batalla se gana antes de empezar.' },

  sesion_profunda: { name: 'Sesión profunda', effect: 'Misiones de 60 minutos o más dan +50 % de XP.', flavor: 'La concentración es un músculo.' },
  estratega: { name: 'Estratega', effect: '+1 cupo de misiones BOSS y +1 de misiones principales.', flavor: 'Dos frentes a la vez.' },
  curiosidad: { name: 'Curiosidad', effect: 'Revela pistas de las misiones ocultas.', flavor: 'Los mapas tienen bordes.' },
  mentor: { name: 'Mentor', effect: 'Escalar una misión conserva la mitad de su barra de dominio.', flavor: 'Lo aprendido no se olvida.' },
  archivista: { name: 'Archivista', effect: 'Galería con comparativas y +30 XP por revisar tu semana.', flavor: 'La memoria es un arma.' },

  mercader: { name: 'Mercader', effect: '10 % de descuento permanente en la tienda.', flavor: 'Regatear es un arte.' },
  interes_compuesto: { name: 'Interés compuesto', effect: 'Las monedas no gastadas generan 2 % semanal (tope 200).', flavor: 'El oro llama al oro.' },
  tesorero: { name: 'Tesorero', effect: 'El tope diario de monedas sube 20.', flavor: 'Bolsillos más hondos.' },
  ahorrador: { name: 'Ahorrador', effect: 'Completar en gracia da 75 % de monedas en vez de 50 %.', flavor: 'Tarde, pero cobrando.' },
  inversionista: { name: 'Inversionista', effect: 'El tope del interés compuesto sube a 500.', flavor: 'Paciencia con dividendos.' },

  regeneracion: { name: 'Regeneración', effect: 'Recuperas 2 corazones por día limpio en vez de 1.', flavor: 'Dormir cura.' },
  descanso_sagrado: { name: 'Descanso sagrado', effect: 'Un día de descanso semanal (lo eliges) no cuenta como fallo.', flavor: 'Hasta los dioses descansan.' },
  piel_gruesa: { name: 'Piel gruesa', effect: 'Ninguna misión puede quitarte más de 2 corazones de golpe.', flavor: 'Los golpes ya no sorprenden.' },
  segundo_aire: { name: 'Segundo aire', effect: 'La misión de resurrección exige 2 días seguidos en vez de 3.', flavor: 'Volver es más fácil la segunda vez.' },
  sueno_reparador: { name: 'Sueño reparador', effect: 'El bonus de descanso se activa con 2 días de ausencia y cubre 8 misiones.', flavor: 'Regresas con más fuerza.' },
};

export const BRANCH_TEXTS: Record<string, { name: string; icon: string }> = {
  trunk: { name: 'Tronco', icon: '🌳' },
  fuerza: { name: 'Fuerza', icon: '💪' },
  disciplina: { name: 'Disciplina', icon: '🛡️' },
  intelecto: { name: 'Intelecto', icon: '📖' },
  riqueza: { name: 'Riqueza', icon: '💰' },
  vitalidad: { name: 'Vitalidad', icon: '❤️‍🔥' },
};
