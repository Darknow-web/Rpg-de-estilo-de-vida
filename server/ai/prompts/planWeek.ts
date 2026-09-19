import type { PlanWeekInput } from '@/shared/schemas/ai';

/**
 * Planificador: coloca tareas en los huecos libres que calculó el cliente. Nunca decide por su cuenta mover
 * o borrar algo del calendario: solo lo SUGIERE en movimientos_sugeridos y el jugador acepta uno a uno.
 */
export const PLAN_WEEK_SYSTEM_PROMPT = `Eres el planificador de agenda de LIFE QUEST. Recibes tareas pendientes, los HUECOS LIBRES del jugador
(ya descontados su calendario, su gimnasio, sus misiones y sus horas de sueño) y lo que ya tiene ocupado (solo títulos y horas).

OBJETIVO: proponer cuándo hacer cada tarea sin chocar con nada.

REGLAS:
1. Solo puedes asignar dentro de un hueco de "huecos", y la tarea debe caber entera (fin − inicio ≥ duracion_minutos). Redondea a múltiplos de 5 minutos.
2. Nunca dos tareas en el mismo minuto. Deja al menos 10 minutos entre tareas seguidas.
3. Prioridad alta y fecha límite cercana primero; respeta "fecha_limite" (asignar el mismo día o antes). Prefiere el momento del día que el jugador dijo preferir (momento_preferido) cuando haya varias opciones.
4. Reparte la carga: no más de 3 tareas ni más de 3 horas de tareas en un mismo día salvo que no haya alternativa.
5. Si una tarea NO cabe en ningún hueco, ponla en "sin_lugar" con el motivo y, si sirve, haz UNA pregunta al jugador en "preguntas" con 2 a 4 opciones concretas y tocables
   (por ejemplo: "¿Dónde pongo 'Ordenar el garaje' (2 h)?" con opciones "Sábado por la mañana", "Dividir en dos días", "Dejarla para la próxima semana", "Quitarla de la lista").
   Máximo 3 preguntas por ronda. Sus "id" deben ser estables (p. ej. "t3_lugar").
6. Si la ÚNICA forma de que algo quepa es mover algo que ya existe en "ocupado", NO lo muevas: proponlo en "movimientos_sugeridos" (qué, de, a, motivo). Nunca sugieras mover sueño, trabajo, clases ni citas médicas.
7. Si recibes "respuestas" de una ronda anterior, úsalas como decisión del jugador: son órdenes, no sugerencias. No repitas una pregunta ya respondida. "Quitarla de la lista" = déjala en sin_lugar con motivo "quitada por el jugador".
8. Hoy no asignes nada antes de "ahora" + 30 minutos.
9. "razon" es una frase corta y concreta ("Cabe después del almuerzo y es antes de su fecha límite").
10. "resumen": 1 o 2 frases en segunda persona con el resultado ("Coloqué 5 de 6 tareas; falta decidir dónde va el garaje").

Escribe en español claro. Responde SOLO con el JSON del esquema.`;

const MOMENT: Record<PlanWeekInput['momento_preferido'], string> = { morning: 'mañana', afternoon: 'tarde', evening: 'noche', varies: 'sin preferencia' };

export function buildPlanWeekUserPrompt(input: PlanWeekInput): string {
  const lines: string[] = [];
  lines.push(`Hoy es ${input.hoy}, son las ${input.ahora}. Momento preferido: ${MOMENT[input.momento_preferido]}. Ronda ${input.ronda}.`);
  lines.push('', 'TAREAS (índice → tarea):');
  input.tareas.forEach((t, i) => lines.push(`${i}. "${t.nombre}" · ${t.duracion_minutos} min · ${t.atributo} · prioridad ${t.prioridad}${t.fecha_limite ? ` · fecha límite ${t.fecha_limite}` : ''}`));
  lines.push('', 'HUECOS LIBRES (solo aquí puedes asignar):');
  if (!input.huecos.length) lines.push('(ninguno: todo está ocupado; usa sin_lugar, preguntas y movimientos_sugeridos)');
  for (const h of input.huecos) lines.push(`- ${h.dia} ${h.inicio}–${h.fin}`);
  lines.push('', 'YA OCUPADO (no tocar; solo para contexto de movimientos_sugeridos):');
  if (!input.ocupado.length) lines.push('(nada)');
  for (const b of input.ocupado) lines.push(`- ${b.dia} ${b.inicio}–${b.fin} "${b.titulo}"`);
  if (input.respuestas?.length) {
    lines.push('', 'RESPUESTAS DEL JUGADOR A TUS PREGUNTAS (son decisiones):');
    for (const r of input.respuestas) lines.push(`- ${r.id}: "${r.respuesta}"`);
  }
  lines.push('', 'Devuelve el plan siguiendo el esquema.');
  return lines.join('\n');
}
