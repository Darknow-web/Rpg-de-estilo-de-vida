// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { structuredCall } from '../../server/ai/model.ts';

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  generateContent.mockReset();
});

describe('structuredCall con imágenes', () => {
  it('añade cada imagen como inlineData ANTES del texto y mantiene el resto igual', async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ ok: true }) });
    const out = await structuredCall({
      system: 'sys',
      user: 'hola',
      schema: z.object({ ok: z.boolean() }),
      temperature: 0.1,
      images: [
        { mimeType: 'image/jpeg', data: 'AAAA' },
        { mimeType: 'image/png', data: 'BBBB' },
      ],
    });
    expect(out).toEqual({ ok: true });
    const req = generateContent.mock.calls[0][0];
    expect(req.contents[0].parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } },
      { inlineData: { mimeType: 'image/png', data: 'BBBB' } },
      { text: 'hola' },
    ]);
    expect(req.config.temperature).toBe(0.1);
    expect(req.config.systemInstruction).toBe('sys');
    expect(req.config.responseMimeType).toBe('application/json');
  });
  it('sin imágenes sigue mandando solo la parte de texto', async () => {
    generateContent.mockResolvedValueOnce({ text: '{"ok":true}' });
    await structuredCall({ system: 'sys', user: 'texto', schema: z.object({ ok: z.boolean() }) });
    expect(generateContent.mock.calls[0][0].contents[0].parts).toEqual([{ text: 'texto' }]);
  });
});
