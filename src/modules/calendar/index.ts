/**
 * Módulo Agenda: lee Google Calendar (todo en el navegador), deja marcar eventos como
 * compromisos → misión "Llegar a tiempo" sin apuestas (stakes 'none'). El core aplica ventana, XP,
 * bonus de adelanto, contador de puntualidad y medallas; el módulo no escribe XP ni corazones.
 *
 * Sin UI propia aquí: `view` y `executionView` quedan en null (flujo genérico foto → completar).
 * La pantalla de agenda se registra desde la capa de UI cuando exista.
 */
import type { Module } from '@/core/module';

export const calendarModule: Module = {
  id: 'calendar',
  displayName: 'Agenda',
  description: 'Tu Google Calendar de los próximos 14 días. Marca un evento como compromiso y gana XP por llegar a tiempo.',
  icon: '📅',
  async proposeMissions() {
    // Los compromisos los marca el jugador evento por evento (markCommitment); el módulo no propone solo.
    return [];
  },
  view: null,
  executionView: null,
};

export { useCalendar, eventsRange, CALENDAR_STORAGE_KEY } from './store';
export { groupEventsByDay, nextEvent, eventsOn, eventDay } from './selectors';
export { markCommitment, unmarkCommitment, commitmentToMission, commitmentToTemplate, canAddCommitment, commitmentEligibility, findCommitment, calendarMissionsOn, calendarData, isCalendarMission, punctualityWindow } from './commitments';
export { calendarConfigured, CalendarAuthError, CalendarApiError } from './client';
export type { CalendarEvent, CalendarInfo, CalendarMissionData } from './types';
