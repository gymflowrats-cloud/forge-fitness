// Google Health API (Fitbit) client — browser only, no backend.
// Auth: OAuth 2.0 implicit (token) flow via full-page redirect, which works inside an iPhone home-screen app
// (popup-based sign-in often can't talk back to a standalone PWA). Tokens last ~1 hour; reconnecting is one tap
// and usually skips the consent screen.
import { db } from '../db/db';
import { getSettings, setSetting } from '../db/settings';
import type { WearableDay } from '../db/types';
import { shiftKey, todayKey } from '../lib/dates';

const API = 'https://health.googleapis.com/v4/users/me';
export const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
];
const TOKEN_KEY = 'forge.healthToken';
const STATE_KEY = 'forge.healthState';

export class HealthError extends Error {
  constructor(message: string, public kind: 'needs_auth' | 'not_linked' | 'offline' | 'setup' | 'other', public status?: number) {
    super(message);
  }
}

// ---------- token handling ----------
interface Token {
  accessToken: string;
  expiresAt: number;
}

function readToken(): Token | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') as Token | null;
    return t && t.expiresAt > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

export const isConnected = () => !!readToken();
export const tokenExpiresAt = () => readToken()?.expiresAt ?? null;

export function disconnect() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** The exact URL Google redirects back to. Must be registered as an Authorized redirect URI. */
export function redirectUri() {
  return location.origin + import.meta.env.BASE_URL;
}

/** Leaves the app for Google's sign-in, which then redirects back with a token in the URL fragment. */
export async function startConnect(silent = false) {
  const { googleClientId } = await getSettings();
  if (!googleClientId) throw new HealthError('Add your Google OAuth Client ID first.', 'setup');
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(STATE_KEY, state);
  const p = new URLSearchParams({
    client_id: googleClientId.trim(),
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: HEALTH_SCOPES.join(' '),
    include_granted_scopes: 'true',
    state,
  });
  if (silent) p.set('prompt', 'none');
  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

/**
 * Call once at startup, before the router reads the hash. If we're returning from Google, stores the token,
 * cleans the URL and routes to the Health settings page. Returns true when it handled a redirect.
 */
export function handleAuthRedirect(): boolean {
  const h = location.hash;
  if (!/(^#|&)(access_token|error)=/.test(h)) return false;
  const p = new URLSearchParams(h.slice(1));
  const expected = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(STATE_KEY);
  let result = 'connected';
  if (p.get('error')) result = p.get('error')!;
  else if (!expected || p.get('state') !== expected) result = 'state_mismatch';
  else {
    const token: Token = { accessToken: p.get('access_token')!, expiresAt: Date.now() + Number(p.get('expires_in') || 3600) * 1000 };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  }
  history.replaceState(null, '', `${location.pathname}#/settings/health?auth=${encodeURIComponent(result)}`);
  return true;
}

// ---------- requests ----------
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = readToken();
  if (!t) throw new HealthError('Google sign-in expired. Tap Sync to reconnect.', 'needs_auth');
  if (!navigator.onLine) throw new HealthError('Offline — will sync when you have signal.', 'offline');
  let res: Response;
  try {
    res = await fetch(`${API}/${path}`, { ...init, headers: { Authorization: `Bearer ${t.accessToken}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  } catch {
    throw new HealthError('Network error while syncing.', 'offline');
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
      if (/ACCOUNT_NOT_LINKED/i.test(JSON.stringify(j))) throw new HealthError('Open the Google Health / Fitbit app once and link your Google account, then sync again.', 'not_linked', res.status);
    } catch (e) {
      if (e instanceof HealthError) throw e;
    }
    if (res.status === 401) {
      disconnect();
      throw new HealthError('Google sign-in expired. Tap Sync to reconnect.', 'needs_auth', 401);
    }
    throw new HealthError(msg, 'other', res.status);
  }
  return res.json() as Promise<T>;
}

// ---------- parsing helpers (tolerant: the API serializes int64 as strings) ----------
interface GDate {
  year: number;
  month: number;
  day: number;
}
const pad = (n: number) => String(n).padStart(2, '0');
const gdate = (k: string): GDate => ({ year: +k.slice(0, 4), month: +k.slice(5, 7), day: +k.slice(8, 10) });
const keyOf = (d?: Partial<GDate> | null) => (d?.year && d.month && d.day ? `${d.year}-${pad(d.month)}-${pad(d.day)}` : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
/** First numeric value found in an object (fallback when a field name differs from the docs). */
function firstNum(o: unknown, prefer: string[] = []): number | null {
  if (!o || typeof o !== 'object') return num(o);
  const rec = o as Record<string, unknown>;
  for (const k of prefer) if (k in rec && num(rec[k]) != null) return num(rec[k]);
  for (const v of Object.values(rec)) {
    const n = typeof v === 'object' ? firstNum(v) : num(v);
    if (n != null) return n;
  }
  return null;
}

type RollupPoint = { civilStartTime?: { date?: GDate } } & Record<string, unknown>;

async function dailyRollUp(dataType: string, from: string, toExclusive: string, maxDays: number): Promise<RollupPoint[]> {
  const out: RollupPoint[] = [];
  for (let s = from; s < toExclusive; s = shiftKey(s, maxDays)) {
    const e = shiftKey(s, maxDays) < toExclusive ? shiftKey(s, maxDays) : toExclusive;
    const r = await call<{ rollupDataPoints?: RollupPoint[] }>(`dataTypes/${dataType}/dataPoints:dailyRollUp`, {
      method: 'POST',
      body: JSON.stringify({ range: { start: { date: gdate(s) }, end: { date: gdate(e) } }, windowSizeDays: 1, pageSize: maxDays }),
    });
    out.push(...(r.rollupDataPoints ?? []));
  }
  return out;
}

type ListPoint = Record<string, unknown>;

/** List data points, trying each filter spelling until one is accepted (docs mix camelCase and snake_case). */
async function listPoints(dataType: string, filters: string[], pageSize: number, maxPages = 10): Promise<ListPoint[]> {
  let lastErr: unknown = null;
  for (const filter of filters) {
    try {
      const out: ListPoint[] = [];
      let token = '';
      for (let i = 0; i < maxPages; i++) {
        const q = new URLSearchParams({ filter, pageSize: String(pageSize) });
        if (token) q.set('pageToken', token);
        const r = await call<{ dataPoints?: ListPoint[]; nextPageToken?: string }>(`dataTypes/${dataType}/dataPoints?${q}`);
        out.push(...(r.dataPoints ?? []));
        token = r.nextPageToken ?? '';
        if (!token) break;
      }
      return out;
    } catch (e) {
      lastErr = e;
      if (!(e instanceof HealthError) || e.status !== 400) throw e; // only retry on a rejected filter
    }
  }
  throw lastErr;
}

// ---------- sync ----------
type Patch = Partial<Omit<WearableDay, 'date' | 'syncedAt'>>;

export interface SyncResult {
  days: number;
  errors: Record<string, string>;
}

let inflight: Promise<SyncResult> | null = null;

/** Pull the last `days` days (default: since last sync, at least 3, first sync 30). Concurrent calls share one run. */
export function syncHealth(days?: number): Promise<SyncResult> {
  if (!inflight) inflight = doSync(days).finally(() => (inflight = null));
  return inflight;
}

async function doSync(days?: number): Promise<SyncResult> {
  const s = await getSettings();
  const today = todayKey();
  const n = days ?? (s.lastHealthSync ? Math.min(90, Math.max(3, Math.ceil((Date.now() - Date.parse(s.lastHealthSync)) / 86400000) + 2)) : 30);
  const from = shiftKey(today, -(n - 1));
  const end = shiftKey(today, 1);
  const patches = new Map<string, Patch>();
  const put = (k: string | null, p: Patch) => {
    if (!k || k < from || k > today) return;
    patches.set(k, { ...patches.get(k), ...p });
  };
  const errors: Record<string, string> = {};
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof HealthError && (e.kind === 'needs_auth' || e.kind === 'offline' || e.kind === 'not_linked')) throw e;
      errors[name] = e instanceof Error ? e.message : String(e);
    }
  };

  await step('steps', async () => {
    for (const p of await dailyRollUp('steps', from, end, 90)) put(keyOf(p.civilStartTime?.date), { steps: firstNum(p.steps, ['countSum']) });
  });
  await step('calories', async () => {
    let pts = await dailyRollUp('total-calories', from, end, 14);
    let field = 'totalCalories';
    if (!pts.some((p) => p[field] != null)) {
      pts = await dailyRollUp('active-energy-burned', from, end, 14);
      field = 'activeEnergyBurned';
    }
    for (const p of pts) put(keyOf(p.civilStartTime?.date), { caloriesOut: p[field] != null ? Math.round(firstNum(p[field], ['kcalSum']) ?? 0) : null });
  });
  await step('heartRate', async () => {
    for (const p of await dailyRollUp('heart-rate', from, end, 14)) {
      const v = firstNum(p.heartRate, ['beatsPerMinuteAvg']);
      put(keyOf(p.civilStartTime?.date), { avgHr: v != null ? Math.round(v) : null });
    }
  });
  await step('restingHeartRate', async () => {
    const pts = await listPoints('daily-resting-heart-rate', [`dailyRestingHeartRate.date >= "${from}"`, `daily_resting_heart_rate.date >= "${from}"`], 100);
    for (const p of pts) {
      const d = p.dailyRestingHeartRate as { date?: GDate; beatsPerMinute?: string } | undefined;
      put(keyOf(d?.date), { restingHr: num(d?.beatsPerMinute) });
    }
  });
  await step('hrv', async () => {
    const pts = await listPoints('daily-heart-rate-variability', [`dailyHeartRateVariability.date >= "${from}"`, `daily_heart_rate_variability.date >= "${from}"`], 100);
    for (const p of pts) {
      const d = p.dailyHeartRateVariability as { date?: GDate; averageHeartRateVariabilityMilliseconds?: number } | undefined;
      const v = num(d?.averageHeartRateVariabilityMilliseconds);
      put(keyOf(d?.date), { hrvMs: v != null ? Math.round(v) : null });
    }
  });
  await step('sleep', async () => {
    const pts = await listPoints('sleep', [`sleep.interval.civil_end_time >= "${from}"`], 25, 8);
    const perDay = new Map<string, number>();
    for (const p of pts) {
      const sl = p.sleep as
        | { interval?: { civilEndTime?: { date?: GDate }; startTime?: string; endTime?: string }; summary?: { minutesAsleep?: string }; metadata?: { nap?: boolean } }
        | undefined;
      if (!sl || sl.metadata?.nap) continue;
      // Night belongs to the day you wake up
      const k = keyOf(sl.interval?.civilEndTime?.date) ?? sl.interval?.endTime?.slice(0, 10) ?? null;
      let mins = num(sl.summary?.minutesAsleep);
      if (mins == null && sl.interval?.startTime && sl.interval.endTime) mins = Math.round((Date.parse(sl.interval.endTime) - Date.parse(sl.interval.startTime)) / 60000);
      if (k && mins != null) perDay.set(k, (perDay.get(k) ?? 0) + mins);
    }
    for (const [k, m] of perDay) put(k, { sleepMin: m });
  });

  const now = new Date().toISOString();
  await db.transaction('rw', db.wearableDays, async () => {
    for (const [date, p] of patches) {
      const prev = await db.wearableDays.get(date);
      const base: WearableDay = prev ?? { date, steps: null, caloriesOut: null, restingHr: null, avgHr: null, hrvMs: null, sleepMin: null, syncedAt: now };
      const merged = { ...base, syncedAt: now } as WearableDay;
      for (const [key, v] of Object.entries(p)) if (v != null) (merged as unknown as Record<string, unknown>)[key] = v;
      await db.wearableDays.put(merged);
    }
  });
  await setSetting('lastHealthSync', now);
  await setSetting('healthErrors', errors);
  return { days: patches.size, errors };
}

/** Sync if signed in and the last sync is older than `minutes`. Silent no-op otherwise. */
export async function autoSync(minutes = 30) {
  if (!isConnected() || !navigator.onLine) return;
  const s = await getSettings();
  if (s.lastHealthSync && Date.now() - Date.parse(s.lastHealthSync) < minutes * 60000) return;
  try {
    await syncHealth();
  } catch {
    /* surfaced on the Health settings page */
  }
}
