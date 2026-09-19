/**
 * Servidor de Life Quest.
 * - Sirve el cliente compilado (dist/) como PWA.
 * - Expone /api/* con la clave de Gemini SOLO del lado del servidor.
 * Cloud Run inyecta GEMINI_API_KEY y PORT como variables de entorno.
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aiRouter, IMAGE_ROUTES } from './ai/routes.ts';
import { timeRouter } from './time.ts';
import { pushRouter } from './push.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
const jsonSmall = express.json({ limit: '256kb' });
// /api/ai/gym-scan y /api/ai/tasks-from-photo llevan fotos en base64: usan su propio parser (límite mayor) dentro del router.
app.use((req, res, next) => ((IMAGE_ROUTES as readonly string[]).includes(req.path) ? next() : jsonSmall(req, res, next)));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ai: Boolean(process.env.GEMINI_API_KEY),
    push: Boolean(process.env.VAPID_PRIVATE_KEY && process.env.VAPID_PUBLIC_KEY),
    projectId: process.env.FIREBASE_PROJECT_ID ?? null,
  });
});
app.use('/api/time', timeRouter);
app.use('/api/ai', aiRouter);
app.use('/api/push', pushRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// ── Cliente estático ──
const distCandidates = [path.resolve(__dirname, '../dist'), path.resolve(process.cwd(), 'dist')];
const distDir = distCandidates.find((p) => fs.existsSync(path.join(p, 'index.html')));

if (distDir) {
  app.use(
    express.static(distDir, {
      maxAge: '1h',
      setHeaders(res, filePath) {
        // El service worker y el HTML nunca deben cachearse de forma agresiva.
        if (filePath.endsWith('sw.js') || filePath.endsWith('index.html') || filePath.endsWith('manifest.webmanifest')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text').send('Life Quest API activa. El cliente no está compilado: ejecuta `npm run build` o usa `npm run dev`.');
  });
}

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`[life-quest] escuchando en :${port} · IA ${process.env.GEMINI_API_KEY ? 'activa' : 'SIN CLAVE (fallback local)'}`);
});
