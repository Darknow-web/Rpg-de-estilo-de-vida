import { Router } from 'express';

/** Hora del servidor: el cliente la compara con la suya para detectar relojes manipulados. */
export const timeRouter = Router();
timeRouter.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ now: new Date().toISOString(), epochMs: Date.now() });
});
