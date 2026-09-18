/**
 * Llamadas al servidor propio (/api). Adjunta el ID token de Firebase.
 * Toda función devuelve `{ ok: false, fallback: true }` en vez de lanzar cuando la IA no está.
 */
import { auth } from './firebase';

export interface ApiOk<T> {
  ok: true;
  data: T;
  model?: string;
}
export interface ApiFallback {
  ok: false;
  fallback: true;
  reason: string;
}
export type ApiResult<T> = ApiOk<T> | ApiFallback;

async function idToken(): Promise<string | null> {
  try {
    const user = auth().currentUser;
    return user ? await user.getIdToken() : null;
  } catch {
    return null;
  }
}

export async function apiPost<T>(path: string, body: unknown, timeoutMs = 45_000): Promise<ApiResult<T>> {
  const token = await idToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, fallback: true, reason: `http_${res.status}` };
    const json = (await res.json()) as ApiResult<T>;
    return json;
  } catch (err) {
    return { ok: false, fallback: true, reason: (err as Error).name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const token = await idToken();
    const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
