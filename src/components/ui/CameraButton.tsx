import { useRef, useState, type ReactNode } from 'react';

/**
 * Botón que abre la cámara directamente (input capture). Si la cámara falla o se niega,
 * el mismo control permite elegir de la galería. Nunca hay "omitir foto".
 */
export function CameraButton({ onPhoto, children, className, disabled, allowGallery = true }: { onPhoto: (file: File) => void | Promise<void>; children: ReactNode; className?: string; disabled?: boolean; allowGallery?: boolean }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);

  const handle = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      await onPhoto(f);
    } finally {
      setBusy(false);
      if (camRef.current) camRef.current.value = '';
      if (galRef.current) galRef.current.value = '';
    }
  };

  return (
    <>
      <button type="button" className={className ?? 'btn btn-ember w-full'} disabled={disabled || busy} onClick={() => camRef.current?.click()}>
        {busy ? 'Guardando…' : children}
      </button>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} onError={() => setFallback(true)} />
      {allowGallery && (
        <>
          <button type="button" className="mt-2 w-full text-center text-xs text-mist underline" disabled={disabled || busy} onClick={() => galRef.current?.click()}>
            {fallback ? 'La cámara no respondió: elige de la galería' : 'Sin cámara · subir desde galería'}
          </button>
          <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
        </>
      )}
    </>
  );
}
