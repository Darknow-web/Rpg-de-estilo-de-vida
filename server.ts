import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { aiRouter, IMAGE_ROUTES } from './server/ai/routes.ts';
import { timeRouter } from './server/time.ts';
import { pushRouter } from './server/push.ts';

// Cloud Run inyecta PORT; en AI Studio y en local se usa 3000.
const PORT = Number(process.env.PORT ?? 3000);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!process.env.FIREBASE_PROJECT_ID && raw.projectId) {
      process.env.FIREBASE_PROJECT_ID = raw.projectId;
    }
  }
} catch {
  // config file reading is optional
}

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

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(
        express.static(distPath, {
          maxAge: '1h',
          setHeaders(res, filePath) {
            if (filePath.endsWith('sw.js') || filePath.endsWith('index.html') || filePath.endsWith('manifest.webmanifest')) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        }),
      );
      app.get('*all', (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[life-quest] Server running on http://0.0.0.0:${PORT} · IA ${process.env.GEMINI_API_KEY ? 'activa' : 'SIN CLAVE (fallback local)'}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
