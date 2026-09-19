/**
 * Tipos del módulo Agenda (Google Calendar).
 * Los datos del calendario viven en el navegador (memoria + localStorage); nunca pasan por el servidor ni por Firestore.
 */

export interface CalendarInfo {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  summary: string;
  /**
   * Inicio en ISO 8601. Eventos con hora: instante completo con zona ("2026-09-18T14:30:00-05:00").
   * Eventos de todo el día: solo la fecha ("2026-09-18"), tal como la entrega Google.
   */
  start: string;
  /** Fin en ISO 8601. En eventos de todo el día es la fecha EXCLUSIVA (convención de Google). */
  end: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
  colorId?: string;
}

/** Datos que guarda una misión de agenda en `moduleData`. */
export interface CalendarMissionData {
  eventId: string;
  calendarId: string;
  /** Inicio del evento en ISO (instante completo). */
  eventStart: string;
  eventSummary: string;
}

/** Zona horaria del juego para la agenda (Lima, sin horario de verano). */
export const CALENDAR_TZ = 'America/Lima';

/** Días hacia adelante que se descargan de la agenda. */
export const CALENDAR_LOOKAHEAD_DAYS = 14;
