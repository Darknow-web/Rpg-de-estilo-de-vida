/**
 * Web Push sin servicios externos: el par VAPID vive en variables de entorno.
 *
 * Limitación honesta: sin Cloud Scheduler ni Cloud Functions (capa Starter), los avisos
 * programados se guardan en memoria del proceso y se envían con temporizadores mientras
 * la instancia de Cloud Run esté viva. Si la instancia se apaga, el cliente reprograma
 * al abrir la app y, mientras la app está abierta, muestra avisos locales por su cuenta.
 * El presupuesto de 4 avisos/día se aplica en el cliente (planificador) y se refuerza aquí.
 */
import { Router } from 'express';
import webpush, { type PushSubscription } from 'web-push';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from './auth.ts';

export const pushRouter = Router();

const MAX_PER_DAY = 4;
const configured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

pushRouter.get('/public-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null, configured });
});

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

const scheduleSchema = z.object({
  subscription: subscriptionSchema,
  /** Avisos del día, hora ISO con zona, máximo 4. */
  notifications: z
    .array(
      z.object({
        id: z.string().max(80),
        at: z.string().datetime({ offset: true }),
        title: z.string().max(80),
        body: z.string().max(160),
        url: z.string().max(200).optional(),
      }),
    )
    .max(MAX_PER_DAY),
});

interface Scheduled {
  timer: NodeJS.Timeout;
}
const scheduledByUid = new Map<string, Scheduled[]>();

function clearUser(uid: string) {
  for (const s of scheduledByUid.get(uid) ?? []) clearTimeout(s.timer);
  scheduledByUid.delete(uid);
}

pushRouter.post('/schedule', requireAuth, async (req: AuthedRequest, res) => {
  if (!configured) {
    res.json({ ok: false, reason: 'push_not_configured' });
    return;
  }
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'bad_request' });
    return;
  }
  const uid = req.uid!;
  clearUser(uid);
  const now = Date.now();
  const list: Scheduled[] = [];
  for (const n of parsed.data.notifications) {
    const delay = new Date(n.at).getTime() - now;
    if (delay < 0 || delay > 36 * 3600 * 1000) continue;
    const timer = setTimeout(async () => {
      try {
        await webpush.sendNotification(parsed.data.subscription as PushSubscription, JSON.stringify({ title: n.title, body: n.body, url: n.url ?? '/', id: n.id }), {
          TTL: 60 * 30,
        });
      } catch (err) {
        console.warn('[push] fallo al enviar:', (err as Error).message);
      }
    }, delay);
    list.push({ timer });
  }
  scheduledByUid.set(uid, list);
  res.json({ ok: true, scheduled: list.length });
});

pushRouter.post('/test', requireAuth, async (req: AuthedRequest, res) => {
  if (!configured) {
    res.json({ ok: false, reason: 'push_not_configured' });
    return;
  }
  const parsed = subscriptionSchema.safeParse(req.body?.subscription);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'bad_request' });
    return;
  }
  try {
    await webpush.sendNotification(parsed.data as PushSubscription, JSON.stringify({ title: 'Life Quest', body: 'Los avisos funcionan. Tu bitácora te llamará a tiempo.', url: '/' }));
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, reason: (err as Error).message });
  }
});
