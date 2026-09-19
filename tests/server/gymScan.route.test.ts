// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

vi.mock('../../server/auth.ts', () => ({
  requireAuth: (req: { uid?: string }, _res: unknown, next: () => void) => {
    req.uid = 'test-uid';
    next();
  },
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../server/ai/model.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/ai/model.ts')>();
  return { ...actual, structuredCall: vi.fn(), aiAvailable: () => true };
});

import { structuredCall, AiError } from '../../server/ai/model.ts';
import { aiRouter, sniffImageMime } from '../../server/ai/routes.ts';
import { GYM_SCAN_SYSTEM_PROMPT } from '../../server/ai/prompts/gymScan.ts';
import { GYM_EQUIPMENT_IDS } from '../../src/shared/gymEquipmentIds.ts';

const mocked = vi.mocked(structuredCall);
let server: Server;
let base = '';

beforeAll(async () => {
  const app = express();
  // Igual que server.ts: el parser global NO se aplica a /api/ai/gym-scan; el router trae el suyo.
  const jsonSmall = express.json({ limit: '256kb' });
  app.use((req, res, next) => (req.path === '/api/ai/gym-scan' ? next() : jsonSmall(req, res, next)));
  app.use('/api/ai', aiRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => mocked.mockReset());

const post = (body: unknown) =>
  fetch(`${base}/api/ai/gym-scan`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' }, body: JSON.stringify(body) });
const jpeg = (n = 1000) => '/9j/' + 'A'.repeat(n);

describe('POST /api/ai/gym-scan', () => {
  it('devuelve ok con el resultado validado y pasa las imágenes como inlineData al modelo', async () => {
    mocked.mockResolvedValueOnce({ equipos: [{ id: 'smith', confianza: 'alta' }], noReconocido: ['TRX'], espacioLibre: true });
    const res = await post({ images: [jpeg(), 'iVBOR' + 'B'.repeat(500)] });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.equipos[0].id).toBe('smith');
    expect(mocked).toHaveBeenCalledTimes(1);
    const call = mocked.mock.calls[0][0];
    expect(call.images).toHaveLength(2);
    expect(call.images?.[0].mimeType).toBe('image/jpeg');
    expect(call.images?.[1].mimeType).toBe('image/png');
    expect(call.temperature).toBe(0.1);
    expect(call.system).toBe(GYM_SCAN_SYSTEM_PROMPT);
    expect(call.user).toMatch(/2 fotos/);
  });
  it('400 con más de 4 imágenes, sin llamar al modelo', async () => {
    const res = await post({ images: [jpeg(), jpeg(), jpeg(), jpeg(), jpeg()] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad_request');
    expect(mocked).not.toHaveBeenCalled();
  });
  it('400 con una imagen que supera el máximo de caracteres', async () => {
    const res = await post({ images: ['A'.repeat(300_001)] });
    expect(res.status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });
  it('acepta un cuerpo mayor de 256 KB (4 fotos grandes) gracias al límite propio de la ruta', async () => {
    mocked.mockResolvedValueOnce({ equipos: [], noReconocido: [], espacioLibre: false });
    const res = await post({ images: [jpeg(280_000), jpeg(280_000), jpeg(280_000), jpeg(280_000)] });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
  it('nunca 500: si la IA falla responde { ok:false, fallback:true, reason }', async () => {
    mocked.mockRejectedValueOnce(new AiError('sin cuota', 'quota'));
    const res = await post({ images: [jpeg()] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, fallback: true, reason: 'quota' });
  });
});

describe('prompt del escaneo', () => {
  it('la tabla del system prompt incluye los 30 ids del catálogo', () => {
    for (const id of GYM_EQUIPMENT_IDS) expect(GYM_SCAN_SYSTEM_PROMPT).toMatch(new RegExp(`^- ${id}: `, 'm'));
    expect(GYM_SCAN_SYSTEM_PROMPT).toMatch(/smith: Máquina Smith → barra guiada en rieles verticales/);
  });
  it('sniffImageMime detecta png/webp y asume jpeg por defecto', () => {
    expect(sniffImageMime('iVBORw0KGgo')).toBe('image/png');
    expect(sniffImageMime('UklGRiQAAABXRUJQ')).toBe('image/webp');
    expect(sniffImageMime('/9j/4AAQSkZJRg')).toBe('image/jpeg');
    expect(sniffImageMime('zzzz')).toBe('image/jpeg');
  });
});
