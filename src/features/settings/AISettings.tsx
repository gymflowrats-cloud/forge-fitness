import { Check, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Field, SegmentedControl } from '../../components/Controls';
import { toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { BottomSheet } from '../../components/Sheet';
import { DEFAULT_GEMINI_MODEL, setSetting } from '../../db/settings';
import { useSettings } from '../../hooks/useData';
import { GeminiError, listModels, testConnection, type ModelInfo } from '../../services/gemini';

export default function AISettings() {
  const s = useSettings();
  const [show, setShow] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [proxy, setProxy] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState<'test' | 'models' | null>(null);
  const [models, setModels] = useState<ModelInfo[] | null>(null);

  const saveAll = async () => {
    if (key != null) await setSetting('geminiKey', key.trim());
    if (proxy != null) await setSetting('proxyUrl', proxy.trim());
    if (model != null) await setSetting('geminiModel', model.trim() || DEFAULT_GEMINI_MODEL);
    setKey(null);
    setProxy(null);
    setModel(null);
  };

  return (
    <Page>
      <BackHeader title="AI coach" />
      <div className="space-y-5">
        <div className="card p-4 text-[14px] text-muted space-y-2">
          <p>Forge calls Google's Gemini API directly from your phone. You need a <b className="text-ink">Gemini API key from Google AI Studio</b> — it has a free tier for Flash models. (A Google AI Pro subscription covers the Gemini app, not API calls.)</p>
          <a className="inline-flex items-center gap-1 text-primary font-bold" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Get a key at aistudio.google.com/apikey <ExternalLink size={14} />
          </a>
        </div>

        <Field label="Connection">
          <SegmentedControl options={[{ value: 'direct', label: 'Direct key' }, { value: 'proxy', label: 'Proxy URL' }]} value={s.aiMode} onChange={(v) => setSetting('aiMode', v)} />
        </Field>

        {s.aiMode === 'direct' ? (
          <Field label="Gemini API key" hint="Stored only on this device. Never included in backups.">
            <div className="relative">
              <input
                className="input pr-14 font-mono"
                type={show ? 'text' : 'password'}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="AIza…"
                value={key ?? s.geminiKey}
                onChange={(e) => setKey(e.target.value)}
                onBlur={saveAll}
              />
              <button aria-label={show ? 'Hide key' : 'Show key'} className="absolute right-1 top-1/2 -translate-y-1/2 btn-ghost text-muted" onClick={() => setShow(!show)}>
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </Field>
        ) : (
          <Field label="Proxy URL" hint="Your Cloudflare Worker URL (see cloudflare-worker/README.md). The key lives in the Worker as a secret.">
            <input className="input" inputMode="url" autoCapitalize="off" placeholder="https://forge-gemini.yourname.workers.dev" value={proxy ?? s.proxyUrl} onChange={(e) => setProxy(e.target.value)} onBlur={saveAll} />
          </Field>
        )}

        <Field label="Model" hint={`Default: ${DEFAULT_GEMINI_MODEL}. If Google retires a model, Forge switches to its replacement automatically.`}>
          <div className="flex gap-2">
            <input className="input font-mono" autoCapitalize="off" spellCheck={false} value={model ?? s.geminiModel} onChange={(e) => setModel(e.target.value)} onBlur={saveAll} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-secondary !rounded-btn min-h-[52px]"
            disabled={!!busy}
            onClick={async () => {
              await saveAll();
              setBusy('models');
              try {
                setModels(await listModels());
              } catch (e) {
                toast(e instanceof GeminiError ? e.message : 'Could not load models', 'error');
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'models' && <Loader2 size={18} className="animate-spin" />} Load models
          </button>
          <button
            className="btn-primary"
            disabled={!!busy}
            onClick={async () => {
              await saveAll();
              setBusy('test');
              try {
                const r = await testConnection();
                toast(`Connected ✓ (${r.slice(0, 20)})`, 'success');
              } catch (e) {
                toast(e instanceof GeminiError ? e.message : 'Connection failed', 'error');
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'test' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Test
          </button>
        </div>
      </div>

      <BottomSheet open={!!models} onClose={() => setModels(null)} title="Choose a model">
        <div className="space-y-2">
          {(models ?? [])
            .filter((m) => /gemini/i.test(m.name))
            .sort((a, b) => Number(/flash/i.test(b.name)) - Number(/flash/i.test(a.name)) || b.name.localeCompare(a.name))
            .map((m) => (
              <button
                key={m.name}
                className={`w-full rounded-btn border px-4 py-3 text-left ${s.geminiModel === m.name ? 'bg-primary text-white border-primary' : 'bg-card border-line'}`}
                onClick={async () => {
                  await setSetting('geminiModel', m.name);
                  setModels(null);
                  toast(`Model set to ${m.name}`, 'success');
                }}
              >
                <div className="font-bold font-mono text-[14px]">{m.name}</div>
                <div className={`text-[12px] ${s.geminiModel === m.name ? 'text-white/75' : 'text-muted'}`}>{m.displayName}</div>
              </button>
            ))}
        </div>
      </BottomSheet>
    </Page>
  );
}
