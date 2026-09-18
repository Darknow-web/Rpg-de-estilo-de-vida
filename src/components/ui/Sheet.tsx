import type { ReactNode } from 'react';

/** Hoja inferior (modal) usable con una mano. */
export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full max-w-lg rounded-t-3xl border-t border-steel bg-slate p-5 animate-pop ${tall ? 'max-h-[92vh]' : 'max-h-[80vh]'} overflow-y-auto`} onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ash" />
        {title && <h2 className="font-display mb-3 text-lg text-gold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
