#!/usr/bin/env node
// One-time setup for Forge meal reminders: creates the free Cloudflare Worker that sends push notifications.
//   npm run push:setup
// Steps: Cloudflare login → KV storage → deploy Worker → upload signing key → write src/pushConfig.json.
// Safe to re-run; finished steps are skipped. The private signing key stays in push-worker/.vapid.json (git-ignored)
// and in Cloudflare as a secret.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'push-worker');
const tomlPath = join(dir, 'wrangler.toml');
const keyPath = join(dir, '.vapid.json');
const configPath = join(root, 'src', 'pushConfig.json');
const WRANGLER = ['--yes', 'wrangler@4'];

/** Run wrangler, echoing its output live (so login/subdomain prompts work) and returning stdout. */
function wrangler(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', [...WRANGLER, ...args], { cwd: dir, stdio: [input ? 'pipe' : 'inherit', 'pipe', 'inherit'] });
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
      process.stdout.write(d);
    });
    if (input) {
      p.stdin.write(input);
      p.stdin.end();
    }
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`wrangler ${args.join(' ')} failed (exit ${code})`))));
  });
}

const step = (n, s) => console.log(`\n\x1b[1m[${n}/5] ${s}\x1b[0m`);

async function main() {
  step(1, 'Cloudflare account');
  const who = await wrangler(['whoami']).catch(() => '');
  if (/not authenticated|You are not logged in/i.test(who) || !who) await wrangler(['login']);

  step(2, 'Storage for reminder times (KV)');
  let toml = readFileSync(tomlPath, 'utf8');
  if (toml.includes('REPLACE_WITH_KV_ID')) {
    const out = await wrangler(['kv', 'namespace', 'create', 'SUBS']);
    const id = /"?id"?\s*[:=]\s*"([0-9a-f]{32})"/.exec(out)?.[1];
    if (!id) throw new Error('Could not read the KV id from the output above. Paste it into push-worker/wrangler.toml and re-run.');
    toml = toml.replace('REPLACE_WITH_KV_ID', id);
    writeFileSync(tomlPath, toml);
    console.log(`Saved KV id ${id}`);
  } else console.log('Already set up.');

  step(3, 'Signing keys');
  let jwk;
  if (existsSync(keyPath)) {
    jwk = JSON.parse(readFileSync(keyPath, 'utf8'));
    console.log('Using existing push-worker/.vapid.json');
  } else {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    writeFileSync(keyPath, JSON.stringify(jwk), { mode: 0o600 });
    console.log('Created push-worker/.vapid.json (keep it private; it is git-ignored)');
  }
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const publicKey = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]));

  step(4, 'Deploy the Worker');
  let out;
  try {
    out = await wrangler(['deploy']);
  } catch (e) {
    // New accounts must pick a free workers.dev name once; wrangler can't ask when its output is captured.
    throw new Error(
      'If the error above says "register a workers.dev subdomain": open the dashboard link it printed, pick any name ' +
        '(e.g. your name), click Set up, wait a minute, then run `npm run push:setup` again. Finished steps are skipped.',
    );
  }
  const url = /https:\/\/[\w.-]+\.workers\.dev/.exec(out)?.[0];
  if (!url) throw new Error('Deployed, but could not find the workers.dev URL in the output above.');
  await wrangler(['secret', 'put', 'VAPID_PRIVATE_JWK'], { input: JSON.stringify(jwk) });

  step(5, 'Connect the app');
  writeFileSync(configPath, JSON.stringify({ url, publicKey }, null, 2) + '\n');
  console.log(`Wrote src/pushConfig.json → ${url}`);
  console.log('\n\x1b[32mDone.\x1b[0m Tell Claude "push setup done" (or commit src/pushConfig.json and push) to turn reminders on in the app.');
}

main().catch((e) => {
  console.error(`\n\x1b[31m${e.message}\x1b[0m`);
  process.exit(1);
});
