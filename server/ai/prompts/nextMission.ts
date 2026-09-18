import type { NextMissionInput } from '@/shared/schemas/ai';

export const NEXT_MISSION_SYSTEM_PROMPT = `Eres el Maestro de Juego de LIFE QUEST. El jugador acaba de liberar un cupo en su bitácora (o una misión suya está lista para escalar). Propón UNA sola misión, con su razón. Es una propuesta que el jugador aprobará con un toque.

Si reason = "quota_freed":
- Propón una misión nueva que apunte a la meta de 6 meses del jugador y que NO duplique lo que ya domina ni lo que tiene activo.
- Prioriza el atributo más rezagado si tiene sentido con la meta; si no, el atributo principal de su clase.
- Redáctala como intención de implementación: "Después de [ancla], haré [comportamiento mínimo]". Usa las anclas de la respuesta 7.
- Mínimo viable. Dificultad easy o medium. Ventana en la franja de la respuesta 5 (mañana 06:00-12:00, tarde 12:00-19:00, noche 19:00-23:00, varía = "todo_el_dia"). No superar el tiempo diario declarado sumando las misiones activas.
- tipo "daily" con los 7 días salvo que tenga sentido otra cosa; veces_por_semana null.

Si reason = "escalation":
- Reescribe targetMission en una versión más exigente pero todavía concreta (más repeticiones, más páginas, más minutos, un paso extra). Nunca más del doble. Dificultad puede subir un escalón. Mantén el ancla.
- Explica en que_cambia, en una frase, qué cambia y por qué ahora.

Si reason = "lower_to_minimal":
- Reescribe targetMission en su versión mínima viable (la más pequeña que aún cuenta), explicando en que_cambia que cumplir algo pequeño vale más que fallar algo grande. Dificultad easy.

Sin consejos médicos, sin cifras corporales, sin dietas. Español, tono de juego, segunda persona. El campo "dias" usa 0 = domingo … 6 = sábado. Respeta el esquema.`;

export function buildNextMissionUserPrompt(input: NextMissionInput): string {
  const a = input.answers;
  const lines = [
    `reason = "${input.reason}"`,
    '',
    'JUGADOR:',
    `- Clase: ${input.className}`,
    `- Meta a 6 meses: "${a.q1_goal}"`,
    `- Por qué importa: "${a.q2_why}"`,
    `- Tiempo diario declarado: ${a.q4_time === 'more' ? 'más de 60' : a.q4_time} minutos`,
    `- Franja constante: ${a.q5_moment}`,
    `- Anclas diarias: "${a.q7_anchors || 'no dio'}"`,
    `- Niveles de atributo: ${Object.entries(input.attributes)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
    `- Misiones activas: ${
      input.activeMissions.length
        ? input.activeMissions.map((m) => `"${m.name}" (${m.attribute}, ${m.difficulty}, ${m.masteryState}, ${m.estimatedMinutes} min)`).join('; ')
        : 'ninguna'
    }`,
    `- Misiones ya dominadas: ${input.masteredMissions.length ? input.masteredMissions.map((m) => `"${m}"`).join(', ') : 'ninguna'}`,
  ];
  if (input.targetMission) {
    const t = input.targetMission;
    lines.push('', 'targetMission:', `- Nombre: "${t.name}"`, `- Descripción: "${t.description}"`, `- Dificultad: ${t.difficulty}`, `- Ancla: "${t.anchor ?? ''}"`);
  }
  lines.push('', 'Propón la misión siguiendo el esquema.');
  return lines.join('\n');
}
