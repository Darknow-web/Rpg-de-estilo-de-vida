/**
 * Compresión de fotos en el cliente antes de guardar.
 * Máx ~800 px lado largo, JPEG 0.7 (configurable en game-balance).
 */
import { EVIDENCE } from './game-balance';

export interface CompressedImage {
  blob: Blob;
  bytes: Uint8Array;
  width: number;
  height: number;
  mime: 'image/jpeg';
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fallback a <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

export async function compressImage(file: Blob, maxLongSide: number = EVIDENCE.maxLongSide, quality: number = EVIDENCE.jpegQuality): Promise<CompressedImage> {
  const src = await loadBitmap(file);
  const sw = 'width' in src ? src.width : 0;
  const sh = 'height' in src ? src.height : 0;
  if (!sw || !sh) throw new Error('Imagen vacía');
  const scale = Math.min(1, maxLongSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  if ('close' in src) (src as ImageBitmap).close();

  let q = quality;
  let blob = await toBlob(canvas, q);
  // Si sigue pesada, baja calidad progresivamente (fotos con mucho detalle).
  while (blob.size > EVIDENCE.maxBytes && q > 0.35) {
    q -= 0.1;
    blob = await toBlob(canvas, q);
  }
  if (blob.size > EVIDENCE.maxBytes) {
    // Último recurso: reduce tamaño.
    return compressImage(blob, Math.round(maxLongSide * 0.75), 0.6);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { blob, bytes, width: w, height: h, mime: 'image/jpeg' };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falló'))), 'image/jpeg', quality);
  });
}

export function bytesToObjectUrl(bytes: Uint8Array, mime = 'image/jpeg'): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
