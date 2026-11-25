import { describe, expect, it, vi } from 'vitest';
import { b64u, encryptPayload, publicKeyFromJwk, vapidAuth } from './webpush.js';
import worker, { cleanTimes, dueMeals, localMinutes, validSubscription } from './worker.js';

const enc = new TextEncoder();
const concat = (...p) => {
  const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of p) { o.set(x, i); i += x.length; }
  return o;
};
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
const hkdf = async (salt, ikm, info, len) => (await hmac(await hmac(salt, ikm), concat(info, new Uint8Array([1])))).slice(0, len);

/** What a browser does with an incoming push: the receiving side of RFC 8291. */
async function makePhone() {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: b64u.encode(uaPublic), auth: b64u.encode(auth) } };
  async function decrypt(body) {
    const salt = body.slice(0, 16);
    const idlen = body[20];
    const asPublic = body.slice(21, 21 + idlen);
    const cipher = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
    const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
    expect(plain[plain.length - 1]).toBe(2); // last-record delimiter
    return new TextDecoder().decode(plain.slice(0, -1));
  }
  return { subscription, decrypt };
}

async function makeVapid() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { jwk, publicKey: kp.publicKey };
}

describe('web push crypto', () => {
  it('encrypts a payload that the phone can decrypt (aes128gcm)', async () => {
    const phone = await makePhone();
    const body = await encryptPayload(phone.subscription, { title: 'Time to log lunch' });
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(JSON.parse(await phone.decrypt(body))).toEqual({ title: 'Time to log lunch' });
  });

  it('matches the RFC 8291 Appendix A test vector byte for byte', async () => {
    const d = b64u.decode('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw');
    const der = new Uint8Array([0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20, ...d]);
    const privateKey = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const jwk = await crypto.subtle.exportKey('jwk', privateKey);
    const publicKey = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    const out = await encryptPayload(
      { keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } },
      'When I grow up, I want to be a watermelon',
      b64u.decode('DGv6ra1nlYgDCS1FRnbzlw'),
      { privateKey, publicKey },
    );
    expect(b64u.encode(out)).toBe('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
  });

  it('signs a VAPID JWT that verifies with the public key', async () => {
    const { jwk, publicKey } = await makeVapid();
    const header = await vapidAuth('https://fcm.googleapis.com/fcm/send/x', jwk, 'https://example.com/', 1_700_000_000);
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(m).not.toBeNull();
    const claims = JSON.parse(new TextDecoder().decode(b64u.decode(m[2])));
    expect(claims).toMatchObject({ aud: 'https://fcm.googleapis.com', sub: 'https://example.com/', exp: 1_700_000_000 + 43200 });
    expect(m[4]).toBe(publicKeyFromJwk(jwk));
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, b64u.decode(m[3]), enc.encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });
});

describe('scheduling helpers', () => {
  it('finds meals due in a 5-minute slot in the user time zone', () => {
    const slot = Date.UTC(2026, 10, 25, 7, 30); // 07:30 UTC = 13:00 in Kolkata
    expect(localMinutes(slot, 'Asia/Kolkata')).toBe(13 * 60);
    const times = { Breakfast: '08:30', Lunch: '13:00', Snacks: '13:04', Dinner: '13:05' };
    expect(dueMeals(times, 'Asia/Kolkata', slot)).toEqual(['Lunch', 'Snacks']);
    expect(dueMeals(times, 'UTC', slot)).toEqual([]);
  });
  it('validates input', () => {
    expect(cleanTimes({ Lunch: '13:00', Bad: '25:00', Also: 'x' })).toEqual({ Lunch: '13:00' });
    expect(validSubscription({ endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'a', auth: 'b' } })).toBe(true);
    expect(validSubscription({ endpoint: 'https://evil.example.com/abc', keys: { p256dh: 'a', auth: 'b' } })).toBe(false);
    expect(validSubscription({ endpoint: 'http://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } })).toBe(false);
  });
});

function fakeKV() {
  const m = new Map();
  return {
    m,
    async put(k, v, o) { m.set(k, { v, meta: o?.metadata }); },
    async get(k, type) { const e = m.get(k); return e ? (type === 'json' ? JSON.parse(e.v) : e.v) : null; },
    async delete(k) { m.delete(k); },
    async list() { return { keys: [...m].map(([name, e]) => ({ name, metadata: e.meta })), list_complete: true }; },
  };
}

describe('worker', () => {
  it('subscribes, sends due reminders on cron, and drops dead subscriptions', async () => {
    const { jwk } = await makeVapid();
    const phone = await makePhone();
    const env = { SUBS: fakeKV(), VAPID_PRIVATE_JWK: JSON.stringify(jwk), APP_URL: 'https://app.example/forge/', ALLOWED_ORIGIN: 'https://app.example' };
    const post = (path, body, origin = 'https://app.example') =>
      worker.fetch(new Request(`https://w.dev${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);

    expect((await post('/subscribe', { subscription: phone.subscription, tz: 'Asia/Kolkata', times: { Lunch: '13:00' } }, 'https://evil.example')).status).toBe(403);
    const r = await post('/subscribe', { subscription: phone.subscription, tz: 'Asia/Kolkata', times: { Lunch: '13:00', Dinner: '20:00' } });
    expect(await r.json()).toEqual({ ok: true, meals: 2 });

    const sent = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      sent.push({ url, init });
      return new Response(null, { status: 201 });
    });
    const waits = [];
    const ctx = { waitUntil: (p) => waits.push(p) };
    await worker.scheduled({ scheduledTime: Date.UTC(2026, 10, 25, 7, 31) }, env, ctx); // 13:01 IST → Lunch slot
    await Promise.all(waits);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe(phone.subscription.endpoint);
    expect(sent[0].init.headers.Authorization).toMatch(/^vapid t=/);
    const payload = JSON.parse(await phone.decrypt(new Uint8Array(sent[0].init.body)));
    expect(payload).toMatchObject({ title: 'Time to log lunch', url: 'https://app.example/forge/#/food?meal=Lunch' });

    await worker.scheduled({ scheduledTime: Date.UTC(2026, 10, 25, 8, 0) }, env, ctx); // 13:30 IST → nothing due
    await Promise.all(waits);
    expect(sent).toHaveLength(1);

    fetchMock.mockImplementation(async () => new Response(null, { status: 410 }));
    await worker.scheduled({ scheduledTime: Date.UTC(2026, 10, 25, 14, 30) }, env, ctx); // 20:00 IST → Dinner, but gone
    await Promise.all(waits);
    expect(env.SUBS.m.size).toBe(0);
    fetchMock.mockRestore();
  });
});
