import { BellRing, Loader2, Send, Share, SquarePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Toggle } from '../../components/Controls';
import { AlertRow, toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { defaultMealTime, setSetting } from '../../db/settings';
import { useSettings } from '../../hooks/useData';
import { disableReminders, enableReminders, pushStatus, sendTestReminder, syncReminders } from '../../services/push';

const fmt12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! < 12 ? 'am' : 'pm'}`;
};

export default function RemindersSettings() {
  const s = useSettings();
  const [busy, setBusy] = useState<'toggle' | 'test' | null>(null);
  const status = pushStatus();
  const syncTimer = useRef<number | undefined>(undefined);
  const timeOf = (m: string) => (m in s.mealTimes ? s.mealTimes[m]! : defaultMealTime(m) ?? '');

  async function toggle(on: boolean) {
    setBusy('toggle');
    try {
      if (on) {
        await enableReminders();
        toast('Meal reminders on', 'success');
      } else {
        await disableReminders();
        toast('Meal reminders off');
      }
    } catch (e) {
      const code = (e as Error).message;
      toast(
        ({
          denied: 'Notifications are blocked. Allow them for Forge in your phone settings.',
          needs_install: 'Add Forge to your Home Screen first.',
          not_configured: "The reminder server isn't set up yet.",
          unsupported: "This browser can't show notifications.",
        } as Record<string, string>)[code] ?? `Couldn't turn on reminders: ${code}`,
        'error',
      );
    } finally {
      setBusy(null);
    }
  }

  async function setTime(meal: string, t: string) {
    await setSetting('mealTimes', { ...s.mealTimes, [meal]: t });
    if (!s.mealReminders) return;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncReminders().then(() => toast('Reminder times saved', 'success'), () => toast("Saved on this phone; couldn't reach the reminder server", 'error'));
    }, 800);
  }

  return (
    <Page>
      <BackHeader title="Meal reminders" />
      <div className="space-y-4">
        <div className="rounded-card p-5 text-white hero-surface shadow-float">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-[16px] bg-white text-primary flex items-center justify-center"><BellRing size={24} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-[18px]">{s.mealReminders ? 'Reminders on' : 'Reminders off'}</div>
              <div className="text-white/75 text-[13px]">A nudge at each meal time to log what you ate</div>
            </div>
            {busy === 'toggle' ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Toggle checked={s.mealReminders} onChange={toggle} label="Meal reminders" />
            )}
          </div>
        </div>

        {status === 'needs_install' && (
          <AlertRow tone="warn">
            <div className="font-bold mb-1">Add Forge to your Home Screen first</div>
            <div className="text-[13px] leading-relaxed">
              iPhone only allows notifications for installed web apps. In Safari tap <Share size={13} className="inline -mt-0.5" /> Share →{' '}
              <SquarePlus size={13} className="inline -mt-0.5" /> Add to Home Screen, then open Forge from the Home Screen and come back here.
            </div>
          </AlertRow>
        )}
        {status === 'denied' && (
          <AlertRow tone="danger">
            <div className="font-bold mb-1">Notifications are blocked</div>
            <div className="text-[13px]">iPhone: Settings → Notifications → Forge → Allow. Android: long-press the Forge icon → App info → Notifications.</div>
          </AlertRow>
        )}
        {status === 'unsupported' && <AlertRow tone="warn">This browser can't receive notifications. On iPhone you need iOS 16.4 or later.</AlertRow>}
        {status === 'not_configured' && (
          <AlertRow tone="warn">
            <div className="font-bold mb-1">Reminder server not set up yet</div>
            <div className="text-[13px]">The app owner needs to run the one-time setup (npm run push:setup). Your times below are saved on this phone.</div>
          </AlertRow>
        )}

        <div className="card divide-y divide-line overflow-hidden">
          {s.meals.map((m) => {
            const t = timeOf(m);
            const on = !!t;
            return (
              <div key={m} className="flex items-center gap-3 px-4 min-h-[64px]">
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{m}</div>
                  <div className="text-[13px] text-muted">{on ? fmt12(t) : 'No reminder'}</div>
                </div>
                {on && (
                  <input
                    type="time"
                    aria-label={`${m} reminder time`}
                    className="h-11 rounded-xl bg-track px-3 font-bold tabular outline-none focus:ring-2 focus:ring-accent"
                    value={t}
                    onChange={(e) => e.target.value && setTime(m, e.target.value)}
                  />
                )}
                <Toggle checked={on} onChange={(v) => setTime(m, v ? defaultMealTime(m) ?? '12:00' : '')} label={`${m} reminder`} />
              </div>
            );
          })}
        </div>
        <p className="text-[13px] text-muted">
          Defaults: breakfast 8:30 am, lunch 1:00 pm, snacks 4:30 pm, dinner 8:00 pm. Change any time; meals added in Settings → Units, theme & logging appear here too.
        </p>

        {s.mealReminders && (
          <button
            className="btn-secondary w-full !rounded-btn min-h-[52px]"
            disabled={!!busy}
            onClick={async () => {
              setBusy('test');
              try {
                await sendTestReminder();
                toast('Test sent. It should arrive in a few seconds.', 'success');
              } catch (e) {
                toast(`Test failed: ${(e as Error).message}`, 'error');
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'test' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Send a test notification
          </button>
        )}
        <p className="text-[12px] text-muted">
          To send reminders when Forge is closed, a small reminder server stores this phone's notification address, your meal times and time zone. Nothing about your food, body or workouts leaves the phone.
        </p>
      </div>
    </Page>
  );
}
