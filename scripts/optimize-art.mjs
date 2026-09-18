/**
 * Convierte los PNG generados con Nano Banana a WebP optimizado en public/art/.
 * Uso: node scripts/optimize-art.mjs <carpeta-origen> [--out public/art]
 * Tamaño por familia: medal-/rank-/attr- → 256 px · class-/illus- → 512 px · app-icon → 1024 px.
 * Idempotente: sobrescribe solo si el origen es más reciente que el destino.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : 'public/art';
if (!src) {
  console.error('Uso: node scripts/optimize-art.mjs <carpeta-con-png> [--out public/art]');
  process.exit(1);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Falta sharp: npm i -D sharp');
  process.exit(1);
}

const sizeFor = (name) => (name.startsWith('app-icon') ? 1024 : name.startsWith('class-') || name.startsWith('illus-') ? 512 : 256);
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(src).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith('style-sheet'));
let done = 0;
for (const f of files) {
  const name = f.replace(/\.(png|jpe?g|webp)$/i, '').toLowerCase();
  const from = path.join(src, f);
  const to = path.join(out, `${name}.webp`);
  if (fs.existsSync(to) && fs.statSync(to).mtimeMs >= fs.statSync(from).mtimeMs) continue;
  const size = sizeFor(name);
  const img = sharp(from).resize(name.startsWith('illus-levelup') ? { height: size * 2, withoutEnlargement: true } : { width: size, height: size, fit: 'inside', withoutEnlargement: true });
  await img.webp({ quality: 82, effort: 6 }).toFile(to);
  const kb = Math.round(fs.statSync(to).size / 1024);
  console.log(`${name}.webp · ${size}px · ${kb} KB`);
  done++;
}
console.log(`Listo: ${done} archivo(s) en ${out}`);
