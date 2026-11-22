import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Copy, ExternalLink, HeartPulse, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Field } from '../../components/Controls';
import { AlertRow, toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { db } from '../../db/db';
import { setSetting } from '../../db/settings';
import { useSettings } from '../../hooks/useData';
import { prettyDate } from '../../lib/dates';
import { HealthError, disconnect, isConnected, redirectUri, startConnect, syncHealth, tokenExpiresAt } from '../../services/googleHealth';

const AUTH_MESSAGES: Record<string, string> = {
  connected: 'Connected to Google Health ✓',
  access_denied: 'Google sign-in was cancelled.',
  state_mismatch: 'Sign-in check failed — please try again.',
  interaction_required: 'Please sign in again.',
  login_required: 'Please sign in again.',
};

function CopyField({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-btn bg-track px-3 py-2">
      <code className="flex-1 min-w-0 text-[13px] break-all">{value}</code>
      <button
        aria-label="Copy"
        className="btn-ghost shrink-0"
        onClick={() => navigator.clipboard?.writeText(value).then(() => toast('Copied', 'success'), () => toast('Copy failed', 'error'))}
      >
        <Copy size={18} />
      </button>
    </div>
  );
}

export default function HealthSettings() {
  const s = useSettings();
  const [params, setParams] = useSearchParams();
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const connected = isConnected();
  const days = useLiveQuery(() => db.wearableDays.orderBy('date').reverse().limit(7).toArray(), [], []) ?? [];
  const total = useLiveQuery(() => db.wearableDays.count(), [], 0);

  async function sync(full = false) {
    setBusy(true);
    try {
      const r = await syncHealth(full ? 90 : undefined);
      const errs = Object.keys(r.errors);
      toast(errs.length ? `Synced ${r.days} days (some data types failed — see below)` : `Synced ${r.days} days ✓`, errs.length ? 'default' : 'success');
    } catch (e) {
      // Never auto-redirect here: a rejected token would bounce between Forge and Google forever.
      if (e instanceof HealthError && e.kind === 'needs_auth') toast('Google session ended — tap Connect to sign in again.', 'error');
      else toast(e instanceof Error ? e.message : 'Sync failed', 'error');
    } finally {
      setBusy(false);
      force((n) => n + 1);
    }
  }

  // Just came back from Google sign-in
  useEffect(() => {
    const auth = params.get('auth');
    if (!auth) return;
    setParams({}, { replace: true });
    toast(AUTH_MESSAGES[auth] ?? `Google sign-in error: ${auth}`, auth === 'connected' ? 'success' : 'error');
    if (auth === 'connected') sync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exp = tokenExpiresAt();
  const errors = Object.entries(s.healthErrors ?? {});

  return (
    <Page>
      <BackHeader title="Fitbit (Google Health)" />
      <div className="space-y-4">
        <div className="rounded-card p-5 text-white hero-surface">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-[16px] bg-white text-primary flex items-center justify-center"><HeartPulse size={26} /></div>
            <div>
              <div className="font-extrabold text-[18px]">{connected ? 'Connected' : s.lastHealthSync ? 'Signed out (sessions last ~1 hour)' : 'Not connected'}</div>
              <div className="text-white/75 text-[13px]">
                {s.lastHealthSync ? `Last sync ${new Date(s.lastHealthSync).toLocaleString()} · ${total} days stored` : 'Steps, calories burned, heart rate, HRV, sleep'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button className="min-h-[48px] rounded-btn bg-white text-primary font-bold flex items-center justify-center gap-2 disabled:opacity-50" disabled={busy || !s.googleClientId} onClick={() => (connected ? sync() : startConnect())}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : connected ? <RefreshCw size={18} /> : <Check size={18} />} {connected ? 'Sync now' : 'Connect'}
            </button>
            {connected ? (
              <button className="min-h-[48px] rounded-btn bg-white/15 font-bold flex items-center justify-center gap-2" onClick={() => { disconnect(); force((n) => n + 1); toast('Disconnected. Synced data stays on this phone.'); }}>
                <Unplug size={18} /> Disconnect
              </button>
            ) : (
              <button className="min-h-[48px] rounded-btn bg-white/15 font-bold disabled:opacity-50" disabled={!s.lastHealthSync || !s.googleClientId} onClick={() => startConnect(true)}>
                Quick reconnect
              </button>
            )}
          </div>
          {connected && exp && <div className="text-white/60 text-[12px] mt-2">Session valid until {new Date(exp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Forge syncs automatically when you open it while signed in.</div>}
          {connected && (
            <button className="text-white/80 underline text-[13px] mt-2 min-h-[36px]" onClick={() => sync(true)} disabled={busy}>Re-sync last 90 days</button>
          )}
        </div>

        {errors.length > 0 && (
          <AlertRow>
            <div className="font-bold mb-1">Some data types didn't sync</div>
            {errors.map(([k, v]) => (
              <div key={k} className="text-[13px]"><b>{k}:</b> {v}</div>
            ))}
            <div className="text-[12px] text-muted mt-1">Usually means your device doesn't record that metric, or Google hasn't synced it yet.</div>
          </AlertRow>
        )}

        {days.length > 0 && (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-6 text-[11px] font-bold uppercase text-muted px-4 pt-3 pb-1">
              <span className="col-span-2">Day</span><span className="text-right">Steps</span><span className="text-right">kcal</span><span className="text-right">RHR</span><span className="text-right">Sleep</span>
            </div>
            {days.map((d) => (
              <div key={d.date} className="grid grid-cols-6 text-[13px] px-4 py-1.5 tabular border-t border-line">
                <span className="col-span-2">{prettyDate(d.date)}</span>
                <span className="text-right font-semibold">{d.steps?.toLocaleString() ?? '–'}</span>
                <span className="text-right">{d.caloriesOut?.toLocaleString() ?? '–'}</span>
                <span className="text-right">{d.restingHr ?? '–'}</span>
                <span className="text-right">{d.sleepMin != null ? `${Math.floor(d.sleepMin / 60)}h${String(d.sleepMin % 60).padStart(2, '0')}` : '–'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card p-5 space-y-4">
          <div className="font-extrabold text-[17px]">One-time setup (about 10 minutes)</div>
          <ol className="list-decimal pl-5 space-y-3 text-[14px]">
            <li>Make sure your Fitbit Air syncs in the <b>Google Health / Fitbit app</b> on your phone, signed in with your Google account.</li>
            <li>
              Open{' '}
              <a className="text-primary font-bold inline-flex items-center gap-0.5" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
                Google Cloud Console <ExternalLink size={12} />
              </a>{' '}
              and create a project (e.g. "Forge").
            </li>
            <li>
              Enable the{' '}
              <a className="text-primary font-bold inline-flex items-center gap-0.5" href="https://console.cloud.google.com/apis/library/health.googleapis.com" target="_blank" rel="noreferrer">
                Google Health API <ExternalLink size={12} />
              </a>.
            </li>
            <li>
              <b>Google Auth Platform → Branding/Audience:</b> app name "Forge", User type <b>External</b>, status <b>Testing</b>, and add your Google email under <b>Test users</b>.
            </li>
            <li><b>Data Access → Add scopes:</b> search "Google Health API" and tick the three <code>.readonly</code> scopes: activity_and_fitness, health_metrics_and_measurements, sleep.</li>
            <li>
              <b>Clients → Create client → Web application.</b> Add this to both <b>Authorized JavaScript origins</b> (without the path) and <b>Authorized redirect URIs</b> (full URL):
              <div className="mt-2 space-y-1.5">
                <CopyField value={location.origin} />
                <CopyField value={redirectUri()} />
              </div>
              <div className="text-[12px] text-muted mt-1">Do it from both your Pages site and anywhere else you open Forge (e.g. localhost) — each address must be listed.</div>
            </li>
            <li>Copy the <b>Client ID</b> (ends in <code>.apps.googleusercontent.com</code>) and paste it below, then tap <b>Connect</b>.</li>
          </ol>
          <Field label="Google OAuth Client ID" hint="Not a secret — it only identifies your app to Google. Stored on this device.">
            <input
              className="input font-mono text-[14px]"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="1234-abc.apps.googleusercontent.com"
              value={clientId ?? s.googleClientId}
              onChange={(e) => setClientId(e.target.value)}
              onBlur={async () => {
                if (clientId != null) await setSetting('googleClientId', clientId.trim());
                setClientId(null);
              }}
            />
          </Field>
          <p className="text-[12px] text-muted">
            In Testing mode Google lets the app work only for the test users you add, and sign-ins last about an hour; Forge reconnects with one tap (usually no password needed). Data is read-only and saved only on this phone.
          </p>
        </div>
      </div>
    </Page>
  );
}
