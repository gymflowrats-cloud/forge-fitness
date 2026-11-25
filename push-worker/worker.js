// Forge meal-reminder push server (Cloudflare Worker, free tier).
//
// Stores, per phone: its push address + meal times + time zone. Nothing else (no food, health or names).
// A cron trigger runs every 5 minutes and sends "Time to log lunch" to phones whose meal time falls in that slot.
//
// Bindings (see wrangler.toml): KV namespace SUBS, var APP_URL, var ALLOWED_ORIGIN, secret VAPID_PRIVATE_JWK.
import { b64u, publicKeyFromJwk, sendPush } from './webpush.js';

const SLOT_MIN = 5;
// Only real browser push services, so the Worker can't be used to POST to arbitrary URLs.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /^android\.googleapis\.com$/];

const json = (data, status, cors) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });

function corsFor(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map((s) => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin || '*' : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    },
  };
}

async function keyFor(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return b64u.encode(h);
}

export function validSubscription(s) {
  if (!s || typeof s.endpoint !== 'string' || !s.keys?.p256dh || !s.keys?.auth) return false;
  try {
    const u = new URL(s.endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** Keep only "Meal": "HH:MM" pairs; at most 8 meals. */
export function cleanTimes(times) {
  const out = {};
  for (const [meal, t] of Object.entries(times || {}).slice(0, 8)) {
    if (typeof meal === 'string' && meal.length <= 24 && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t))) out[meal] = t;
  }
  return out;
}

/** Local minutes-since-midnight of `ms` in time zone `tz`. */
export function localMinutes(ms, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

/** Meals whose time falls in the 5-minute slot starting at slotMs (local to tz). */
export function dueMeals(times, tz, slotMs) {
  const start = localMinutes(slotMs, tz);
  return Object.entries(times).filter(([, t]) => {
    const [h, m] = t.split(':').map(Number);
    const mins = h * 60 + m;
    return mins >= start && mins < start + SLOT_MIN;
  }).map(([meal]) => meal);
}

const vapid = (env) => ({ jwk: JSON.parse(env.VAPID_PRIVATE_JWK), subject: env.APP_URL || 'https://example.com' });

function reminder(env, meal) {
  const base = (env.APP_URL || '').replace(/#.*$/, '');
  return {
    title: `Time to log ${meal.toLowerCase()}`,
    body: 'Tap to add what you ate.',
    url: `${base}#/food?meal=${encodeURIComponent(meal)}`,
    tag: `meal-${meal}`,
  };
}

export default {
  async fetch(req, env) {
    const cors = corsFor(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors.headers });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'forge-push', publicKey: env.VAPID_PRIVATE_JWK ? publicKeyFromJwk(JSON.parse(env.VAPID_PRIVATE_JWK)) : null }, 200, cors.headers);
    }
    if (!cors.ok) return json({ error: 'origin not allowed' }, 403, cors.headers);
    if (req.method !== 'POST') return json({ error: 'not found' }, 404, cors.headers);
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'bad json' }, 400, cors.headers);
    }

    if (url.pathname === '/subscribe') {
      if (!validSubscription(body.subscription)) return json({ error: 'invalid subscription' }, 400, cors.headers);
      const tz = typeof body.tz === 'string' && body.tz.length < 64 ? body.tz : 'UTC';
      try {
        localMinutes(Date.now(), tz);
      } catch {
        return json({ error: 'invalid time zone' }, 400, cors.headers);
      }
      const times = cleanTimes(body.times);
      const { endpoint, keys } = body.subscription;
      await env.SUBS.put(await keyFor(endpoint), JSON.stringify({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }), { metadata: { tz, times } });
      return json({ ok: true, meals: Object.keys(times).length }, 200, cors.headers);
    }

    if (url.pathname === '/unsubscribe') {
      if (typeof body.endpoint !== 'string') return json({ error: 'endpoint required' }, 400, cors.headers);
      await env.SUBS.delete(await keyFor(body.endpoint));
      return json({ ok: true }, 200, cors.headers);
    }

    if (url.pathname === '/test') {
      if (typeof body.endpoint !== 'string') return json({ error: 'endpoint required' }, 400, cors.headers);
      const sub = await env.SUBS.get(await keyFor(body.endpoint), 'json');
      if (!sub) return json({ error: 'not subscribed' }, 404, cors.headers);
      const status = await sendPush(sub, { title: 'Forge reminders are on', body: "You'll get a nudge at each meal time.", url: env.APP_URL, tag: 'forge-test' }, vapid(env));
      return json({ ok: status >= 200 && status < 300, status }, 200, cors.headers);
    }
    return json({ error: 'not found' }, 404, cors.headers);
  },

  async scheduled(event, env, ctx) {
    const slot = Math.floor(event.scheduledTime / (SLOT_MIN * 60000)) * SLOT_MIN * 60000;
    const keys = vapid(env);
    const jobs = [];
    let cursor;
    do {
      const page = await env.SUBS.list({ cursor });
      for (const k of page.keys) {
        const meta = k.metadata;
        if (!meta?.times) continue;
        let due;
        try {
          due = dueMeals(meta.times, meta.tz || 'UTC', slot);
        } catch {
          continue;
        }
        if (!due.length) continue;
        jobs.push((async () => {
          const sub = await env.SUBS.get(k.name, 'json');
          if (!sub) return;
          for (const meal of due) {
            const status = await sendPush(sub, reminder(env, meal), { ...keys, topic: `meal${meal.replace(/[^A-Za-z0-9]/g, '').slice(0, 20)}` });
            if (status === 404 || status === 410) {
              await env.SUBS.delete(k.name); // phone unsubscribed or app removed
              return;
            }
          }
        })());
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    ctx.waitUntil(Promise.allSettled(jobs));
  },
};
