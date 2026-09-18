/**
 * Escaneo del gimnasio por fotos (cliente, sin React).
 * Comprime cada foto, la manda al servidor (/api/ai/gym-scan) y devuelve el equipamiento del catálogo
 * que la IA reconoció. Las fotos no se guardan en ningún sitio: viajan y se descartan.
 * Si la IA no está disponible se lanza `GymScanUnavailable`: la UI ofrece entonces los chips manuales.
 */
import { compressImage } from '@/lib/image';
import { apiPost } from '@/lib/api';
import { gymScanOutputSchema, type GymScanOutput } from '@/shared/schemas/ai';
import type { GymEquipmentId } from '@/shared/gymEquipmentIds';
import { equipmentName } from './data/equipment';
import type { EquipmentItem, GymProfile } from './types';

export const GYM_SCAN = {
  maxPhotos: 4,
  maxLongSide: 800,
  jpegQuality: 0.7,
  /** Límite por foto tras comprimir (≈ 267k caracteres en base64; el servidor admite hasta 300k). */
  maxBytesPerPhoto: 200_000,
  timeoutMs: 60_000,
} as const;

export type ScanConfidence = GymScanOutput['equipos'][number]['confianza'];

export interface ScannedEquipment {
  id: GymEquipmentId;
  name: string;
  confianza: ScanConfidence;
  detalle?: string;
}

export interface GymScanResult {
  equipos: ScannedEquipment[];
  noReconocido: string[];
  espacioLibre: boolean;
  source: 'ai';
}

export type GymScanUnavailableReason =
  | 'no_photos'
  | 'too_many_photos'
  | 'compress_failed'
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'bad_request'
  | 'invalid_response'
  | 'unavailable'
  | 'quota'
  | 'invalid'
  | 'unknown'
  | (string & {});

/** La IA no pudo escanear (sin clave, sin red, cuota, respuesta inválida…). La UI ofrece la selección manual. */
export class GymScanUnavailable extends Error {
  readonly name = 'GymScanUnavailable';
  constructor(
    public readonly reason: GymScanUnavailableReason,
    message = 'No se pudo analizar las fotos ahora. Puedes marcar el equipamiento a mano.',
  ) {
    super(message);
  }
}

export interface ScanGymPhotosOptions {
  maxLongSide?: number;
  quality?: number;
  maxBytesPerPhoto?: number;
  timeoutMs?: number;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      const comma = url.indexOf(',');
      resolve(comma >= 0 ? url.slice(comma + 1) : url);
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });
}

/** Comprime una foto hasta dejarla por debajo de `maxBytes` y la devuelve en base64 (sin prefijo `data:`). */
export async function prepareGymPhoto(file: Blob, opts: ScanGymPhotosOptions = {}): Promise<string> {
  let side = opts.maxLongSide ?? GYM_SCAN.maxLongSide;
  let q = opts.quality ?? GYM_SCAN.jpegQuality;
  const maxBytes = opts.maxBytesPerPhoto ?? GYM_SCAN.maxBytesPerPhoto;
  let img = await compressImage(file, side, q);
  // Igual que image.ts: primero baja calidad, después tamaño.
  while (img.blob.size > maxBytes && (q > 0.4 || side > 400)) {
    if (q > 0.4) q = Math.max(0.4, Math.round((q - 0.1) * 100) / 100);
    else side = Math.round(side * 0.8);
    img = await compressImage(img.blob, side, q);
  }
  if (img.blob.size > maxBytes) throw new GymScanUnavailable('compress_failed', 'Una de las fotos pesa demasiado incluso comprimida.');
  return blobToBase64(img.blob);
}

function toResult(out: GymScanOutput): GymScanResult {
  const seen = new Set<GymEquipmentId>();
  const equipos: ScannedEquipment[] = [];
  for (const e of out.equipos) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    equipos.push({ id: e.id, name: equipmentName(e.id), confianza: e.confianza, ...(e.detalle ? { detalle: e.detalle } : {}) });
  }
  return { equipos, noReconocido: out.noReconocido, espacioLibre: out.espacioLibre, source: 'ai' };
}

/**
 * Escanea 1–4 fotos del gimnasio. Lanza `GymScanUnavailable` si la IA no responde (red, cuota, sin clave,
 * respuesta que no cumple el esquema). Nunca devuelve un resultado "local": sin IA no hay escaneo.
 */
export async function scanGymPhotos(files: File[], opts: ScanGymPhotosOptions = {}): Promise<GymScanResult> {
  if (!files.length) throw new GymScanUnavailable('no_photos', 'Elige al menos una foto.');
  if (files.length > GYM_SCAN.maxPhotos) throw new GymScanUnavailable('too_many_photos', `Máximo ${GYM_SCAN.maxPhotos} fotos por escaneo.`);

  let images: string[];
  try {
    images = await Promise.all(files.map((f) => prepareGymPhoto(f, opts)));
  } catch (err) {
    if (err instanceof GymScanUnavailable) throw err;
    throw new GymScanUnavailable('compress_failed', 'No se pudo leer una de las fotos.');
  }

  const res = await apiPost<unknown>('/api/ai/gym-scan', { images }, opts.timeoutMs ?? GYM_SCAN.timeoutMs);
  if (!res.ok) {
    const reason: GymScanUnavailableReason = res.reason === 'http_429' ? 'rate_limited' : res.reason === 'http_400' ? 'bad_request' : res.reason;
    const message =
      reason === 'rate_limited'
        ? 'Ya usaste los escaneos de hoy (10 al día). Marca el equipamiento a mano o vuelve mañana.'
        : reason === 'timeout' || reason === 'network'
          ? 'Sin conexión con el servidor. Puedes marcar el equipamiento a mano.'
          : undefined;
    throw new GymScanUnavailable(reason, message);
  }
  const parsed = gymScanOutputSchema.safeParse(res.data);
  if (!parsed.success) throw new GymScanUnavailable('invalid_response');
  return toResult(parsed.data);
}

/**
 * Mezcla el escaneo con el equipamiento actual: agrega los equipos con confianza alta o media que falten
 * (nombre del catálogo), sin duplicar. Los de confianza baja quedan para que el jugador los confirme.
 */
export function mergeScanIntoEquipment(
  current: GymProfile['equipment'],
  scan: { equipos: { id: GymEquipmentId; confianza: ScanConfidence; detalle?: string }[] },
): EquipmentItem[] {
  const out: EquipmentItem[] = [...current];
  const have = new Set(current.map((e) => e.id));
  for (const e of scan.equipos) {
    if (e.confianza === 'baja' || have.has(e.id)) continue;
    have.add(e.id);
    out.push({ id: e.id, name: equipmentName(e.id), ...(e.detalle ? { locationNote: e.detalle } : {}) });
  }
  return out;
}
