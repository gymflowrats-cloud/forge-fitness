import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUp, Check, Loader2, Sparkles, Trash2, WifiOff, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chip, ChipRow } from '../../components/Controls';
import { Banner, toast } from '../../components/Feedback';
import { Page, PageTitle } from '../../components/Layout';
import { BottomSheet, ConfirmSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import type { CoachMessage, CoachSuggestion } from '../../db/types';
import { useSettings, useUnits } from '../../hooks/useData';
import { useOnline } from '../../hooks/useOnline';
import { useReminders } from '../../hooks/useReminders';
import { fmtNum } from '../../lib/format';
import { toDispW, wUnit } from '../../lib/units';
import { applySuggestion, askCoach, resolveSuggestion, weeklyRecap, type ResolvedSuggestion } from '../../services/coach';
import { GeminiError } from '../../services/gemini';

const PROMPTS = [
  'Should I increase weight on anything?',
  'Am I eating enough protein?',
  'Why is my weight stalling?',
  'Suggest a deload',
  'Adjust my routine for weak points',
  "Plan today's meals to hit my macros",
];

export default function Coach() {
  const s = useSettings();
  const online = useOnline();
  const nav = useNavigate();
  const units = useUnits();
  const reminders = useReminders();
  const [params, setParams] = useSearchParams();
  const messages = useLiveQuery(() => db.coachMessages.orderBy('createdAt').toArray(), [], [] as CoachMessage[]) ?? [];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'chat' | 'recap' | null>(null);
  const [pending, setPending] = useState<{ msgId: string; idx: number; r: ResolvedSuggestion } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const configured = s.aiMode === 'proxy' ? !!s.proxyUrl : !!s.geminiKey;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, busy]);

  const handleErr = (e: unknown) => toast(e instanceof GeminiError ? e.message : 'Something went wrong talking to Gemini', 'error');

  async function send(q: string) {
    if (!q.trim() || busy) return;
    if (!online) return toast('Coach needs internet', 'error');
    setText('');
    setBusy('chat');
    try {
      await askCoach(q.trim());
    } catch (e) {
      setText(q);
      handleErr(e);
    } finally {
      setBusy(null);
    }
  }
  async function recap() {
    if (!online) return toast('Coach needs internet', 'error');
    setBusy('recap');
    try {
      await weeklyRecap();
    } catch (e) {
      handleErr(e);
    } finally {
      setBusy(null);
    }
  }
  useEffect(() => {
    if (params.get('recap') === '1' && configured && online && !busy) {
      setParams({}, { replace: true });
      recap();
    }
  }, [params, configured]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openSuggestion(msgId: string, idx: number, sug: CoachSuggestion) {
    const r = await resolveSuggestion(sug);
    if (!r) return toast(`Couldn't find ${sug.exerciseName} in your ${sug.templateName} template`, 'error');
    setPending({ msgId, idx, r });
  }

  const fmtTarget = (t: { weight: number | null; min: number; max: number }) =>
    `${t.min === t.max ? t.min : `${t.min}–${t.max}`} reps${t.weight ? ` @ ${fmtNum(toDispW(t.weight, units))} ${wUnit(units)}` : ''}`;

  if (!configured)
    return (
      <Page>
        <PageTitle title="Coach" sub="Your AI training partner" />
        <div className="rounded-card p-6 text-white hero-surface">
          <div className="h-14 w-14 rounded-[18px] bg-white text-primary flex items-center justify-center"><Sparkles size={28} /></div>
          <div className="text-[24px] font-extrabold mt-4">Set up your AI coach</div>
          <p className="text-white/80 mt-2">Forge uses Google Gemini. Get a free API key from Google AI Studio (aistudio.google.com/apikey) and paste it in Settings. It's stored only on this phone.</p>
          <p className="text-white/60 text-sm mt-2">Note: a Google AI Pro subscription covers the Gemini app, not the API — the API key's free tier is separate.</p>
          <button className="mt-5 w-full min-h-[52px] rounded-btn bg-white text-primary font-bold" onClick={() => nav('/settings/ai')}>Add API key</button>
        </div>
      </Page>
    );

  return (
    <Page className="!pb-0">
      <PageTitle
        title="Coach"
        sub="Answers use only your logged data"
        right={messages.length > 0 ? <button aria-label="Clear chat" className="btn-ghost text-muted" onClick={() => setConfirmClear(true)}><Trash2 size={20} /></button> : undefined}
      />
      {!online && (
        <div className="card px-4 py-3 mb-3 flex items-center gap-3 text-warn font-semibold"><WifiOff size={20} /> Coach needs internet. Your logging still works offline.</div>
      )}
      <div className="space-y-3">
        <Banner
          title={reminders.recapReady ? 'Your weekly AI recap is ready' : 'Weekly recap'}
          sub={busy === 'recap' ? 'Analysing your week…' : 'Wins, what slipped, and 3 actions for next week'}
          icon={busy === 'recap' ? <Loader2 className="animate-spin" size={26} /> : undefined}
          onClick={recap}
        />
        <ChipRow>
          {PROMPTS.map((p) => (
            <Chip key={p} onClick={() => send(p)}>{p}</Chip>
          ))}
        </ChipRow>
      </div>

      <div className="mt-5 space-y-3">
        {messages.length === 0 && !busy && (
          <div className="text-center text-muted py-8 px-6">
            <Wand2 className="mx-auto mb-2" size={28} />
            Ask anything about your training, body or nutrition. Coach sees a summary of the last 4 weeks of your data.
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-primary text-white px-4 py-2.5 text-[15px] whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className={`card px-4 py-3 text-[15px] ${m.kind === 'recap' ? 'border-primary/40' : ''}`}>
              {m.kind === 'recap' && <div className="section-label mb-1 flex items-center gap-1.5"><Sparkles size={14} /> Weekly recap · {new Date(m.createdAt).toLocaleDateString()}</div>}
              <div className="md">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.structured && m.structured.length > 0 && (
                <div className="mt-3 space-y-2">
                  {m.structured.map((sg, i) => (
                    <div key={i} className="rounded-2xl bg-soft p-3">
                      <div className="font-bold text-[14px]">{sg.exerciseName} · {sg.templateName}</div>
                      <div className="text-[13px] text-muted">
                        {sg.newTargetWeight != null && `→ ${sg.newTargetWeight} ${wUnit(units)} `}
                        {sg.newTargetRepsMin != null && `→ ${sg.newTargetRepsMin}${sg.newTargetRepsMax && sg.newTargetRepsMax !== sg.newTargetRepsMin ? `–${sg.newTargetRepsMax}` : ''} reps `}
                        · {sg.reason}
                      </div>
                      {sg.applied ? (
                        <div className="mt-2 text-success font-bold text-[14px] flex items-center gap-1"><Check size={16} /> Applied to template</div>
                      ) : (
                        <button className="btn-secondary mt-2 !min-h-[40px] text-[14px] !bg-primary !text-white" onClick={() => openSuggestion(m.id, i, sg)}>Apply to template</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy === 'chat' && (
          <div className="card px-4 py-3 inline-flex items-center gap-2 text-muted"><Loader2 size={18} className="animate-spin" /> Thinking… (can take up to a minute)</div>
        )}
        <div ref={endRef} style={{ height: 'calc(max(env(safe-area-inset-bottom), 10px) + 160px)' }} />
      </div>

      <form
        className="fixed inset-x-0 z-30 px-3"
        style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 10px) + 74px)' }}
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="mx-auto max-w-md flex items-end gap-2 rounded-[24px] border border-line bg-card/90 backdrop-blur-xl shadow-float p-1.5 pl-4">
          <textarea
            aria-label="Message the coach"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder="Ask your coach…"
            className="flex-1 resize-none bg-transparent outline-none py-2.5 max-h-28 text-[16px]"
          />
          <button aria-label="Send" disabled={!text.trim() || !!busy} className="h-11 w-11 rounded-full bg-accent text-accent-ink flex items-center justify-center disabled:opacity-40 shrink-0">
            {busy === 'chat' ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={22} />}
          </button>
        </div>
      </form>

      <BottomSheet open={!!pending} onClose={() => setPending(null)} title="Apply to template?">
        {pending && (
          <div className="space-y-4">
            <div className="text-muted">{pending.r.exerciseName} in <b className="text-ink">{pending.r.template.name}</b></div>
            <div className="card divide-y divide-line">
              <div className="flex justify-between px-4 py-3"><span className="text-muted">Now</span><span className="font-semibold">{fmtTarget(pending.r.before)}</span></div>
              <div className="flex justify-between px-4 py-3"><span className="text-muted">New</span><span className="font-bold text-success">{fmtTarget(pending.r.after)}</span></div>
            </div>
            <p className="text-xs text-muted">Only future workouts use the new targets. Past logs stay unchanged.</p>
            <button
              className="btn-primary"
              onClick={async () => {
                await applySuggestion(pending.msgId, pending.idx, pending.r);
                toast('Template updated', 'success');
                setPending(null);
              }}
            >
              Apply change
            </button>
          </div>
        )}
      </BottomSheet>
      <ConfirmSheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear chat history?" message="All coach messages and recaps on this device will be deleted." confirmLabel="Clear" danger onConfirm={() => db.coachMessages.clear()} />
    </Page>
  );
}
