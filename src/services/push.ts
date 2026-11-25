// Meal reminder push notifications. The phone subscribes with its browser's push service and registers that
// address + meal times + time zone with our Cloudflare Worker (push-worker/), which sends at each meal time.
import config from '../pushConfig.json';
import { effectiveMealTimes, getSettings, setSetting } from '../db/settings';
import { platform } from '../lib/install';

export type PushStatus = 'ready' | 'not_configured' | 'unsupported' | 'needs_install' | 'denied';

const isIOS = () => platform() === 'ios';
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function pushStatus(): PushStatus {
  if (!config.url || !config.publicKey) return 'not_configured';
  // iPhone only allows web push for apps added to the Home Screen (iOS 16.4+).
  if (isIOS() && !isStandalone()) return 'needs_install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ready';
}

function keyBytes(b64url: string) {
  const s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function post(path: string, body: unknown) {
  const res = await fetch(config.url.replace(/\/$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Reminder server error (${res.status})`);
  return data;
}

async function currentSubscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) });
}

/** Ask for permission (must be called from a tap), subscribe and register the schedule. */
export async function enableReminders(): Promise<void> {
  const status = pushStatus();
  if (status !== 'ready') throw new Error(status);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  await syncReminders(true);
  await setSetting('mealReminders', true);
}

/** Send the current meal times + time zone to the server (after enabling, or when times change). */
export async function syncReminders(create = false): Promise<void> {
  const s = await getSettings();
  const sub = await currentSubscription(create);
  if (!sub) throw new Error('not_subscribed');
  await post('/subscribe', {
    subscription: sub.toJSON(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    times: effectiveMealTimes(s.meals, s.mealTimes),
  });
  await setSetting('lastPushSync', new Date().toISOString());
}

export async function disableReminders(): Promise<void> {
  await setSetting('mealReminders', false);
  if (pushStatus() === 'not_configured' || !('serviceWorker' in navigator)) return;
  const sub = await currentSubscription(false);
  if (!sub) return;
  await post('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

export async function sendTestReminder(): Promise<void> {
  const sub = await currentSubscription(false);
  if (!sub) throw new Error('not_subscribed');
  const r = await post('/test', { endpoint: sub.endpoint });
  if (!r.ok) throw new Error(`Push service answered ${r.status}`);
}

/** On app open: re-register at most once a day (keeps time zone and a rotated subscription current). */
export async function refreshRemindersOnOpen(): Promise<void> {
  try {
    const s = await getSettings();
    if (!s.mealReminders || pushStatus() !== 'ready' || Notification.permission !== 'granted') return;
    if (s.lastPushSync && Date.now() - Date.parse(s.lastPushSync) < 20 * 3600 * 1000) return;
    await syncReminders(true);
  } catch {
    /* offline or server down: try again next open */
  }
}
