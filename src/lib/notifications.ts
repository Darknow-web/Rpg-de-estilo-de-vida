/**
 * Web Push + avisos locales. Si el permiso está denegado, la app funciona igual.
 */
import { apiGet, apiPost } from './api';
import type { PlannedNotification } from '@/core/notifications/planner';

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function permissionState(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function getPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const info = await apiGet<{ publicKey: string | null; configured: boolean }>('/api/push/public-key');
      const key = info?.publicKey || (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined);
      if (!key) return null;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource });
    }
    return sub.toJSON();
  } catch (err) {
    console.warn('[push] sin suscripción:', (err as Error).message);
    return null;
  }
}

const localTimers: number[] = [];

/** Programa avisos: en el servidor (push) y localmente mientras la app esté abierta. */
export async function scheduleNotifications(plan: PlannedNotification[]): Promise<{ server: boolean; local: number }> {
  for (const t of localTimers) clearTimeout(t);
  localTimers.length = 0;
  if (permissionState() !== 'granted') return { server: false, local: 0 };
  const now = Date.now();
  let local = 0;
  for (const n of plan) {
    const delay = n.at.getTime() - now;
    if (delay <= 0 || delay > 24 * 3600_000) continue;
    const t = window.setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker?.ready;
        if (reg) await reg.showNotification(n.title, { body: n.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: n.id, data: { url: n.url } });
        else new Notification(n.title, { body: n.body, tag: n.id });
      } catch {
        /* silencioso */
      }
    }, delay);
    localTimers.push(t);
    local++;
  }
  let server = false;
  const sub = await getPushSubscription();
  if (sub && sub.endpoint && sub.keys) {
    const res = await apiPost<{ scheduled: number }>('/api/push/schedule', {
      subscription: { endpoint: sub.endpoint, expirationTime: sub.expirationTime ?? null, keys: sub.keys },
      notifications: plan.map((n) => ({ id: n.id, at: n.at.toISOString(), title: n.title, body: n.body, url: n.url })),
    });
    server = res.ok;
  }
  return { server, local };
}
