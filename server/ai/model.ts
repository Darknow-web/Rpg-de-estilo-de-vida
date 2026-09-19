/**
 * Cliente de Gemini. La clave vive SOLO aquí (variable de entorno del servidor).
 * Modelo: el Flash más económico con salida estructurada. Cambiar MODEL_ID basta para migrar.
 */
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export const MODEL_ID = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
const CANDIDATE_MODELS = [
  MODEL_ID,
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
].filter((v, i, a) => a.indexOf(v) === i);

let client: GoogleGenAI | null = null;
export function aiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** Convierte un esquema Zod a JSON Schema compatible con Gemini (quita claves que no soporta). */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>;
  return sanitize(json) as Record<string, unknown>;
}

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === '$schema' || k === 'additionalProperties' || k === 'default' || k === 'pattern') continue;
      out[k] = sanitize(v);
    }
    return out;
  }
  return node;
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly kind: 'unavailable' | 'invalid' | 'quota' | 'unknown',
  ) {
    super(message);
  }
}

/**
 * Una llamada estructurada: system prompt + entrada → JSON validado con Zod.
 * Nunca lanza sin `kind`: el que llama decide si usa fallback.
 */
export type InlineImage = { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };

export async function structuredCall<T extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: T;
  temperature?: number;
  maxOutputTokens?: number;
  /** Imágenes en base64 (sin prefijo `data:`). Van como `inlineData` ANTES del texto. */
  images?: InlineImage[];
}): Promise<z.infer<T>> {
  if (!aiAvailable()) throw new AiError('GEMINI_API_KEY ausente', 'unavailable');

  const parts = [
    ...(opts.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    { text: opts.user },
  ];

  let lastError: Error | null = null;
  let text: string | undefined;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const res = await getClient().models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: opts.system,
          responseMimeType: 'application/json',
          responseJsonSchema: toGeminiSchema(opts.schema),
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxOutputTokens ?? 4096,
        },
      });
      text = res.text;
      if (text) break;
    } catch (err) {
      lastError = err as Error;
      console.warn(`[ai] fallo con modelo ${modelName}:`, (err as Error).message);
    }
  }

  if (!text) {
    const msg = lastError?.message ?? 'respuesta vacía de todos los modelos';
    const kind = /429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? 'quota' : 'unknown';
    throw new AiError(msg, kind);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError('JSON inválido retornado por el modelo', 'invalid');
  }
  const result = opts.schema.safeParse(parsed);
  if (!result.success) {
    console.warn('[ai] la salida no valida contra el esquema:', result.error.issues.slice(0, 5));
    throw new AiError('no valida contra el esquema', 'invalid');
  }
  return result.data;
}
