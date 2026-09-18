import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="text-center">
        <div className="font-display text-4xl text-gold drop-shadow-[0_0_20px_rgba(242,193,78,0.35)]">LIFE QUEST</div>
        <p className="mt-2 text-sm text-mist">Tus acciones reales son misiones. La prueba es una foto. Tu personaje sube de nivel.</p>
      </div>
      <div className="panel mt-8 p-5">
        <button className="btn btn-ghost w-full" onClick={google} disabled={busy}>
          <span className="text-lg">G</span> Continuar con Google
        </button>
        <div className="my-4 flex items-center gap-3 text-xs text-mist">
          <div className="h-px flex-1 bg-steel" /> o con correo <div className="h-px flex-1 bg-steel" />
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" type="email" placeholder="Correo" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Contraseña (mín. 6)" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {mode === 'register' ? 'Crear mi personaje' : 'Entrar'}
          </button>
        </form>
        {error && <p className="mt-3 text-center text-xs text-ember">{error}</p>}
        <div className="mt-4 flex justify-between text-xs text-mist">
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
      <p className="mt-6 text-center text-[11px] text-mist">Sin funciones sociales. Nadie ve tus misiones ni tus fotos: solo tú.</p>
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
