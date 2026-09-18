import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Icon } from '@/components/ui/Icon';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth(), new GoogleAuthProvider());
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code.includes('popup')) {
        await signInWithRedirect(auth(), new GoogleAuthProvider());
      } else setError(humanize(code));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await createUserWithEmailAndPassword(auth(), email.trim(), password);
      else await signInWithEmailAndPassword(auth(), email.trim(), password);
    } catch (err) {
      setError(humanize((err as { code?: string }).code ?? ''));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email) return setError('Escribe tu correo para enviarte el enlace.');
    try {
      await sendPasswordResetEmail(auth(), email.trim());
      setError('Te enviamos un enlace para cambiar la contraseña.');
    } catch (err) {
      setError(humanize((err as { code?: string }).code ?? ''));
    }
  };

  return (
    <div className="tinted mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10" style={{ '--tint': 'var(--color-xp)' } as React.CSSProperties}>
      <div className="screen">
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div className="mx-auto mb-4 grid h-[84px] w-[84px] place-items-center rounded-[26px] border border-line bg-card" style={{ color: 'var(--color-xp)', boxShadow: '0 0 40px rgba(56,242,215,.18)' }}>
            <svg viewBox="0 0 80 80" style={{ width: 44, height: 44 }}>
              <use href="#emblem" />
            </svg>
          </div>
          <div className="flex justify-center gap-[.06em] text-[34px] font-extrabold uppercase tracking-[.14em]">
            {'LIFE QUEST'.split('').map((ch, i) => (
              <span key={i} style={{ animation: `fadeup .4s ${i * 0.05}s both`, whiteSpace: 'pre' }}>
                {ch}
              </span>
            ))}
          </div>
          <p className="s mt-2">Tus acciones reales son misiones. La prueba es una foto. Tu personaje sube de nivel.</p>
        </div>

        <div className="card mt-4">
          <button className="btn ghost" onClick={google} disabled={busy}>
            <Icon id="google" />
            Continuar con Google
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-mute">
            <div className="h-px flex-1 bg-line" /> o con correo <div className="h-px flex-1 bg-line" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <input className="input" type="email" placeholder="Correo" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="input" type="password" placeholder="Contraseña (mín. 6)" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            <button className="btn" type="submit" disabled={busy}>
              {mode === 'register' ? 'Crear mi personaje' : 'Entrar'}
            </button>
          </form>
          {error && <p className="s mt-3 text-center" style={{ color: 'var(--color-ember)' }}>{error}</p>}
          <div className="mt-4 flex justify-between text-xs text-dim">
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="underline">
              {mode === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
            </button>
            {mode === 'login' && (
              <button onClick={reset} className="underline">
                Olvidé mi contraseña
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-mute">Sin funciones sociales. Nadie ve tus misiones ni tus fotos: solo tú.</p>
      </div>
    </div>
  );
}

function humanize(code: string): string {
  if (code.includes('email-already-in-use')) return 'Ese correo ya tiene cuenta. Entra con tu contraseña.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Correo o contraseña incorrectos.';
  if (code.includes('weak-password')) return 'La contraseña necesita al menos 6 caracteres.';
  if (code.includes('invalid-email')) return 'Ese correo no parece válido.';
  if (code.includes('network')) return 'Sin conexión. Inténtalo de nuevo.';
  if (code.includes('operation-not-allowed')) return 'Este método de acceso no está habilitado en Firebase (ver docs/FIREBASE-CHECKLIST.md).';
  return code ? `No se pudo entrar (${code}).` : 'No se pudo entrar.';
}
