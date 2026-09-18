import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listCalendars, listEvents, CalendarAuthError, toCalendarEvent } from '@/modules/calendar/client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('cliente de Google Calendar', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('listCalendars manda el Bearer, omite borrados y pone el principal primero', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: 'work', summary: 'Trabajo', backgroundColor: '#123' },
          { id: 'old', summary: 'Viejo', deleted: true },
          { id: 'me@x.com', summary: 'me@x.com', summaryOverride: 'Personal', primary: true },
        ],
      }),
    );
    const cals = await listCalendars('tok');
    expect(cals.map((c) => c.id)).toEqual(['me@x.com', 'work']);
    expect(cals[0]).toMatchObject({ summary: 'Personal', primary: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/users/me/calendarList');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('listEvents consulta cada calendario con singleEvents/orderBy/maxResults, fusiona y ordena', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/calendars/a/events')) return jsonResponse({ items: [{ id: '2', summary: 'Tarde', start: { dateTime: '2026-09-18T18:00:00-05:00' }, end: { dateTime: '2026-09-18T19:00:00-05:00' } }] });
      if (url.includes('/calendars/b%40x.com/events')) return jsonResponse({ items: [{ id: '1', summary: 'Mañana', start: { dateTime: '2026-09-18T09:00:00-05:00' }, end: { dateTime: '2026-09-18T10:00:00-05:00' } }, { id: '0', status: 'cancelled', start: { dateTime: '2026-09-18T09:00:00-05:00' }, end: { dateTime: '2026-09-18T10:00:00-05:00' } }] });
      return jsonResponse({}, 500);
    });
    const evs = await listEvents('tok', ['a', 'b@x.com'], '2026-09-18T05:00:00.000Z', '2026-10-02T05:00:00.000Z');
    expect(evs.map((e) => e.id)).toEqual(['1', '2']);
    expect(evs[0].calendarId).toBe('b@x.com');
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('singleEvents')).toBe('true');
    expect(url.searchParams.get('orderBy')).toBe('startTime');
    expect(url.searchParams.get('maxResults')).toBe('250');
    expect(url.searchParams.get('timeMin')).toBe('2026-09-18T05:00:00.000Z');
  });

  it('un 401 lanza CalendarAuthError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'Invalid Credentials' } }, 401));
    await expect(listCalendars('bad')).rejects.toBeInstanceOf(CalendarAuthError);
  });

  it('un calendario que responde 404 se omite sin tumbar el resto', async () => {
    fetchMock.mockImplementation(async (input) => (String(input).includes('/calendars/gone/') ? jsonResponse({ error: { message: 'Not Found' } }, 404) : jsonResponse({ items: [{ id: 'x', start: { date: '2026-09-18' }, end: { date: '2026-09-19' } }] })));
    const evs = await listEvents('tok', ['gone', 'ok'], 'a', 'b');
    expect(evs).toEqual([{ id: 'x', calendarId: 'ok', summary: '(Sin título)', start: '2026-09-18', end: '2026-09-19', allDay: true, location: undefined, htmlLink: undefined, colorId: undefined }]);
  });

  it('toCalendarEvent distingue todo-el-día (start.date) de eventos con hora', () => {
    expect(toCalendarEvent({ id: '1', start: { date: '2026-09-18' }, end: { date: '2026-09-19' } }, 'c')?.allDay).toBe(true);
    expect(toCalendarEvent({ id: '2', start: { dateTime: '2026-09-18T09:00:00-05:00' }, end: { dateTime: '2026-09-18T10:00:00-05:00' } }, 'c')?.allDay).toBe(false);
    expect(toCalendarEvent({ id: '3' }, 'c')).toBeNull();
  });
});
