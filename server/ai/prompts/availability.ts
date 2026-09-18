export const AVAILABILITY_SYSTEM_PROMPT = `Convierte la disponibilidad semanal que un jugador describe en español libre a bloques {dia, inicio, fin}.
- dia: 0 = domingo, 1 = lunes, 2 = martes, 3 = miércoles, 4 = jueves, 5 = viernes, 6 = sábado.
- inicio y fin en formato HH:mm de 24 horas. "temprano" o "antes de las 9" → inicio 06:00. "de noche" o "desde las 8 de la noche" → 20:00 a 22:30 salvo que diga otra cosa. "tarde" sin hora → 15:00 a 18:00.
- Un bloque debe durar al menos 30 minutos.
- Si algo es ambiguo (no dice mañana o noche, no dice qué días, "a veces"), NO adivines: deja el bloque fuera y describe la duda en ambiguedades con una pregunta corta que la app hará al jugador.
- Devuelve solo lo que el texto respalda. Español. Respeta el esquema.`;

export function buildAvailabilityUserPrompt(text: string): string {
  return `TEXTO DEL JUGADOR:\n"""${text}"""\n\nConvierte a bloques.`;
}
