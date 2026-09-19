/**
 * Esquemas Zod de las salidas de IA. Se usan en el servidor (responseJsonSchema + validación)
 * y en el cliente (tipos). Si la IA no cumple el esquema, se usa el fallback local.
 */
import { z } from 'zod';
import { GYM_EQUIPMENT_IDS } from '../gymEquipmentIds';

export const attributeSchema = z.enum(['fuerza', 'disciplina', 'intelecto', 'riqueza', 'vitalidad']);
export const classIdSchema = z.enum(['guerrero', 'erudito', 'asceta', 'mercader', 'sanador', 'vagabundo']);
export const easyMediumSchema = z.enum(['easy', 'medium']);
export const difficultySchema = z.enum(['easy', 'medium', 'hard', 'epic']);

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm');

export const windowSchema = z.union([
  z.object({ inicio: hhmm, fin: hhmm }),
  z.literal('todo_el_dia'),
]);

export const minimalVersionSchema = z.object({
  nombre: z.string().min(3).max(80),
  descripcion: z.string().min(3).max(300),
});

export const dailyMissionSchema = z.object({
  nombre: z.string().min(3).max(80),
  descripcion: z.string().min(3).max(300),
  atributo: attributeSchema,
  dificultad: easyMediumSchema,
  ancla: z.string().max(120),
  comportamiento_minimo: z.string().min(3).max(200),
  dias: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  ventana: windowSchema,
  duracion_minutos: z.number().int().min(1).max(180),
  evidencia_sugerida: z.string().max(200),
  version_minima_viable: minimalVersionSchema,
});

export const weeklyMissionSchema = z.object({
  nombre: z.string().min(3).max(80),
  descripcion: z.string().min(3).max(300),
  atributo: attributeSchema,
  dificultad: easyMediumSchema,
  veces_por_semana: z.number().int().min(1).max(3),
  duracion_minutos: z.number().int().min(1).max(240),
  evidencia_sugerida: z.string().max(200),
  version_minima_viable: minimalVersionSchema,
});

export const rewardSuggestionSchema = z.object({
  nombre: z.string().min(2).max(80),
  nivel: z.number().int().min(1).max(5),
  es_gratuita: z.boolean(),
  limite_de_frecuencia: z.string().max(60).nullable(),
  por_que_encaja: z.string().max(240),
});

export const onboardingOutputSchema = z.object({
  riesgo_detectado: z.boolean(),
  clase: z.object({
    id: classIdSchema,
    nombre: z.string().max(40),
    descripcion: z.string().max(300),
    frase_identidad: z.string().max(160),
    atributo_principal: attributeSchema,
    razon_de_asignacion: z.string().max(300),
  }),
  mision_principal: z.object({
    nombre: z.string().min(3).max(80),
    descripcion: z.string().max(300),
    atributo: attributeSchema,
    hitos: z.array(z.string().max(120)).min(3).max(5),
    plazo_estimado_semanas: z.number().int().min(4).max(52),
  }),
  misiones_diarias: z.array(dailyMissionSchema).min(3).max(5),
  misiones_semanales: z.array(weeklyMissionSchema).min(1).max(2),
  recompensas_sugeridas: z.array(rewardSuggestionSchema).min(4).max(6),
  explicacion: z.object({
    por_clase: z.string().max(500),
    por_mision: z
      .array(
        z.object({
          nombre_mision: z.string().max(80),
          que_dijiste: z.string().max(240),
          atributo: attributeSchema,
          como_ayuda_a_tu_meta: z.string().max(240),
        }),
      )
      .min(3)
      .max(6),
    estrategia_general: z.string().max(700),
    que_pasa_despues: z.string().max(400),
  }),
});
export type OnboardingOutput = z.infer<typeof onboardingOutputSchema>;

export const onboardingInputSchema = z.object({
  answers: z.object({
    q1_goal: z.string().min(3).max(600),
    q2_why: z.string().max(400),
    q3_tried: z.array(z.string().max(60)).max(8),
    q4_time: z.enum(['15', '30', '60', 'more']),
    q5_moment: z.enum(['morning', 'afternoon', 'evening', 'varies']),
    q6_demotivator: z.enum(['boredom', 'no_results', 'too_hard', 'forget', 'punishment']),
    q7_anchors: z.string().max(400),
    q8_rewards: z.string().max(400),
  }),
  rejected: z
    .object({
      missions: z.array(z.string().max(80)).max(20),
      class: z.string().max(40).optional(),
      reason: z.string().max(300).optional(),
    })
    .optional(),
  regenerationIndex: z.number().int().min(0).max(3),
});
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

// ── Tasador ──
export const appraisalOutputSchema = z.object({
  nivel_sugerido: z.number().int().min(1).max(5),
  dias_de_esfuerzo: z.number().min(1).max(200),
  limite_de_frecuencia: z.string().max(60).nullable(),
  razonamiento: z.string().max(400),
  conflicto_con_meta: z.boolean(),
  nota_de_conflicto: z.string().max(300).nullable(),
  refuerza_meta: z.boolean(),
  posible_duplicado_de: z.string().max(80).nullable(),
});
export type AppraisalOutput = z.infer<typeof appraisalOutputSchema>;

export const appraisalInputSchema = z.object({
  rewardName: z.string().min(2).max(80),
  playerGoal: z.string().max(600),
  why: z.string().max(400),
  rewardWishes: z.string().max(400),
  rank: z.enum(['D', 'C', 'B', 'A', 'S']),
  level: z.number().int().min(1).max(50),
  estimatedCoinsPerDay: z.number().min(1),
  recentCheapRewards: z.number().int().min(0),
  existingRewards: z.array(z.object({ name: z.string().max(80), tier: z.number().int().min(1).max(5) })).max(40),
});
export type AppraisalInput = z.infer<typeof appraisalInputSchema>;

// ── Propuesta de misión nueva ──
export const nextMissionOutputSchema = z.object({
  mision: z.object({
    nombre: z.string().min(3).max(80),
    descripcion: z.string().min(3).max(300),
    atributo: attributeSchema,
    tipo: z.enum(['daily', 'weekly']),
    dificultad: difficultySchema,
    ancla: z.string().max(120),
    comportamiento_minimo: z.string().max(200),
    dias: z.array(z.number().int().min(0).max(6)).max(7),
    ventana: windowSchema,
    veces_por_semana: z.number().int().min(1).max(3).nullable(),
    duracion_minutos: z.number().int().min(1).max(240),
    evidencia_sugerida: z.string().max(200),
    version_minima_viable: minimalVersionSchema,
  }),
  razon: z.string().max(400),
  que_cambia: z.string().max(300).nullable(),
});
export type NextMissionOutput = z.infer<typeof nextMissionOutputSchema>;

export const nextMissionInputSchema = z.object({
  reason: z.enum(['quota_freed', 'escalation', 'lower_to_minimal']),
  answers: z.object({
    q1_goal: z.string().max(600),
    q2_why: z.string().max(400),
    q4_time: z.string().max(10),
    q5_moment: z.string().max(20),
    q7_anchors: z.string().max(400),
  }),
  className: z.string().max(40),
  activeMissions: z
    .array(
      z.object({
        name: z.string().max(80),
        attribute: attributeSchema,
        difficulty: difficultySchema,
        masteryState: z.string().max(20),
        estimatedMinutes: z.number().int().min(0).max(300),
      }),
    )
    .max(20),
  masteredMissions: z.array(z.string().max(80)).max(40),
  attributes: z.record(z.string(), z.number()),
  targetMission: z
    .object({
      name: z.string().max(80),
      description: z.string().max(300),
      xp: z.number(),
      coins: z.number(),
      difficulty: difficultySchema,
      anchor: z.string().max(120).optional(),
    })
    .optional(),
});
export type NextMissionInput = z.infer<typeof nextMissionInputSchema>;

// ── Disponibilidad (gimnasio): texto libre → bloques ──
export const availabilityOutputSchema = z.object({
  bloques: z
    .array(
      z.object({
        dia: z.number().int().min(0).max(6),
        inicio: hhmm,
        fin: hhmm,
      }),
    )
    .max(21),
  ambiguedades: z.array(z.string().max(200)).max(6),
});
export type AvailabilityOutput = z.infer<typeof availabilityOutputSchema>;

export const availabilityInputSchema = z.object({
  text: z.string().min(3).max(1000),
});

// ── Escaneo de gimnasio: fotos → equipamiento del catálogo ──
/** Fotos en base64 (sin prefijo `data:`). El cliente las deja en ≤ 200 KB cada una (~267k caracteres). */
export const gymScanInputSchema = z.object({
  images: z.array(z.string().min(100).max(300_000)).min(1).max(4),
});
export type GymScanInput = z.infer<typeof gymScanInputSchema>;

export const gymEquipmentIdSchema = z.enum(GYM_EQUIPMENT_IDS);
export const scanConfidenceSchema = z.enum(['alta', 'media', 'baja']);

export const gymScanOutputSchema = z.object({
  equipos: z
    .array(
      z.object({
        id: gymEquipmentIdSchema,
        confianza: scanConfidenceSchema,
        detalle: z.string().max(80).optional(),
      }),
    )
    .max(30),
  noReconocido: z.array(z.string().max(60)).max(8),
  espacioLibre: z.boolean(),
});
export type GymScanOutput = z.infer<typeof gymScanOutputSchema>;
