import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { shiftKey, todayKey } from '../lib/dates';

// Minimal browser globals for node
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  configurable: true,
});
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

const { syncHealth, isConnected } = await import('./googleHealth');

const today = todayKey();
const y = shiftKey(today, -1);
const gd = (k: string) => ({ year: +k.slice(0, 4), month: +k.slice(5, 7), day: +k.slice(8, 10) });

function mockApi() {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${decodeURIComponent(url)}`);
    const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200 });
    if (url.includes('steps/dataPoints:dailyRollUp')) return ok({ rollupDataPoints: [{ civilStartTime: { date: gd(y) }, steps: { countSum: '8421' } }] });
    if (url.includes('total-calories/dataPoints:dailyRollUp')) return ok({ rollupDataPoints: [{ civilStartTime: { date: gd(y) }, totalCalories: { kcalSum: 2512.4 } }] });
    if (url.includes('heart-rate/dataPoints:dailyRollUp')) return ok({ rollupDataPoints: [{ civilStartTime: { date: gd(y) }, heartRate: { beatsPerMinuteAvg: 71.6 } }] });
    if (url.includes('daily-resting-heart-rate')) {
      // first filter spelling rejected → client must retry with the other one
      if (url.includes('dailyRestingHeartRate.date')) return new Response(JSON.stringify({ error: { message: 'bad filter' } }), { status: 400 });
      return ok({ dataPoints: [{ dailyRestingHeartRate: { date: gd(y), beatsPerMinute: '58' } }] });
    }
    if (url.includes('daily-heart-rate-variability')) return ok({ dataPoints: [{ dailyHeartRateVariability: { date: gd(y), averageHeartRateVariabilityMilliseconds: 47.2 } }] });
    if (url.includes('dataTypes/sleep/')) return ok({
      dataPoints: [
        { sleep: { interval: { civilEndTime: { date: gd(y) } }, summary: { minutesAsleep: '412' }, metadata: { nap: false } } },
        { sleep: { interval: { civilEndTime: { date: gd(y) } }, summary: { minutesAsleep: '30' }, metadata: { nap: true } } },
      ],
    });
    return new Response('{}', { status: 404 });
  });
  return calls;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  store.clear();
});

describe('google health sync', () => {
  it('requires a token', async () => {
    expect(isConnected()).toBe(false);
    await expect(syncHealth(7)).rejects.toMatchObject({ kind: 'needs_auth' });
  });

  it('parses daily summaries into wearableDays', async () => {
    store.set('forge.healthToken', JSON.stringify({ accessToken: 't', expiresAt: Date.now() + 3600_000 }));
    const calls = mockApi();
    const r = await syncHealth(7);
    expect(r.errors).toEqual({});
    const d = await db.wearableDays.get(y);
    expect(d).toMatchObject({ steps: 8421, caloriesOut: 2512, avgHr: 72, restingHr: 58, hrvMs: 47, sleepMin: 412 });
    // calorie/heart-rate rollups are chunked to the documented 14-day max
    expect(calls.some((c) => c.startsWith('POST') && c.includes('total-calories'))).toBe(true);
    expect(calls.filter((c) => c.includes('daily-resting-heart-rate')).length).toBe(2);
    vi.unstubAllGlobals();
  });
});
