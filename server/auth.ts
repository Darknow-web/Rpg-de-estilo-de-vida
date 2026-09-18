/**
 * Verificación de ID tokens de Firebase Auth sin firebase-admin (sin credenciales de servicio).
 * Los tokens están firmados por Google; basta con las claves públicas y el projectId.
 */
import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export interface AuthedRequest extends Request {
  uid?: string;
}

function projectId(): string | undefined {
  return process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
}

export async function verifyIdToken(token: string): Promise<string> {
  const pid = projectId();
  if (!pid) throw new Error('FIREBASE_PROJECT_ID no configurado');

  // Emulador de Auth (desarrollo): tokens sin firma real.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const payload = decodeJwt(token);
    if (payload.aud !== pid || !payload.sub) throw new Error('token de emulador inválido');
    return payload.sub;
  }

  jwks ??= createRemoteJWKSet(new URL(JWKS_URL));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${pid}`,
    audience: pid,
    algorithms: ['RS256'],
  });
  if (!payload.sub) throw new Error('token sin sub');
  return payload.sub;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  try {
    req.uid = await verifyIdToken(token);
    next();
  } catch (err) {
    console.warn('[auth] token rechazado:', (err as Error).message);
    res.status(401).json({ error: 'invalid_token' });
  }
}

/** Límite simple por usuario y por ruta, en memoria (protege la cuota de la Gemini API). */
const buckets = new Map<string, { count: number; day: string }>();
export function rateLimit(key: string, perDay: number) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const day = new Date().toISOString().slice(0, 10);
    const k = `${key}:${req.uid ?? req.ip}`;
    const b = buckets.get(k);
    if (!b || b.day !== day) {
      buckets.set(k, { count: 1, day });
      next();
      return;
    }
    if (b.count >= perDay) {
      res.status(429).json({ error: 'rate_limited', fallback: true });
      return;
    }
    b.count++;
    next();
  };
}
