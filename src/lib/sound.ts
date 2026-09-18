/**
 * Feedback sonoro sin archivos: pequeños tonos con Web Audio. Silencioso si el navegador no lo permite.
 */
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('lq_muted') === '1';
} catch {
  /* sin storage */
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem('lq_muted', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}
export function isMuted() {
  return muted;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}

export function playSound(kind: 'reward' | 'levelup' | 'hurt' | 'soft') {
  if (muted) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    switch (kind) {
      case 'reward':
        tone(660, 0, 0.12, 'triangle');
        tone(880, 0.1, 0.16, 'triangle');
        break;
      case 'levelup':
        tone(523, 0, 0.15, 'triangle', 0.1);
        tone(659, 0.14, 0.15, 'triangle', 0.1);
        tone(784, 0.28, 0.15, 'triangle', 0.1);
        tone(1046, 0.42, 0.35, 'triangle', 0.12);
        break;
      case 'hurt':
        tone(180, 0, 0.25, 'sawtooth', 0.06);
        tone(120, 0.12, 0.3, 'sawtooth', 0.06);
        break;
      case 'soft':
        tone(520, 0, 0.1, 'sine', 0.05);
        break;
    }
  } catch {
    /* sin audio */
  }
}
