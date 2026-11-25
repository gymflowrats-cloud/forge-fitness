import { BellRing, ChevronRight, CalendarDays, Database, Dumbbell, HeartPulse, Library, Palette, Sparkles, User, Wrench, AlertTriangle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { BottomSheet } from '../../components/Sheet';
import { platform, promptInstall, useInstall } from '../../lib/install';
import { isStandalone } from '../../services/push';
import { Link } from 'react-router-dom';
import { BackHeader, Page } from '../../components/Layout';
import { useProfile, useSettings } from '../../hooks/useData';
import { effectiveMealTimes } from '../../db/settings';

function Row({ to, icon, title, sub }: { to: string; icon: ReactNode; title: string; sub?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3.5 px-4 py-3 min-h-[64px] active:bg-track">
      <div className="h-10 w-10 rounded-[14px] bg-soft text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold">{title}</div>
        {sub && <div className="text-[13px] text-muted truncate">{sub}</div>}
      </div>
      <ChevronRight size={20} className="text-muted" />
    </Link>
  );
}

/** Shown when Forge is open in a browser tab rather than installed. */
function InstallCard() {
  const canPrompt = useInstall((x) => !!x.prompt);
  const installed = useInstall((x) => x.installed);
  const [help, setHelp] = useState(false);
  if (installed || isStandalone()) return null;
  const os = platform();
  return (
    <>
      <button
        className="w-full card p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform !border-accent"
        onClick={async () => {
          if (!(canPrompt && (await promptInstall()))) setHelp(true);
        }}
      >
        <div className="h-11 w-11 rounded-[14px] bg-accent text-accent-ink flex items-center justify-center shrink-0"><Download size={22} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold">Install Forge on this phone</div>
          <div className="text-[13px] text-muted">Full screen, works offline, enables meal reminders</div>
        </div>
      </button>
      <BottomSheet open={help} onClose={() => setHelp(false)} title="Install Forge">
        <div className="space-y-4 text-[15px]">
          {(os === 'ios' || os === 'other') && (
            <div className="card p-4 space-y-1.5">
              <div className="font-bold">iPhone / iPad (Safari)</div>
              <div>1. Tap <Share size={15} className="inline -mt-1" /> Share at the bottom of Safari</div>
              <div>2. Tap <SquarePlus size={15} className="inline -mt-1" /> Add to Home Screen → Add</div>
              <div>3. Open Forge from your Home Screen</div>
            </div>
          )}
          {(os === 'android' || os === 'other') && (
            <div className="card p-4 space-y-1.5">
              <div className="font-bold">Android (Chrome)</div>
              <div>1. Tap <EllipsisVertical size={15} className="inline -mt-1" /> in the top-right corner of Chrome</div>
              <div>2. Tap Install app (or Add to Home screen → Install)</div>
              <div>3. Open Forge from your app drawer or Home screen</div>
            </div>
          )}
          <p className="text-[13px] text-muted">Your data stays in this browser, so open Forge the same way each time.</p>
        </div>
      </BottomSheet>
    </>
  );
}

export default function SettingsHome() {
  const p = useProfile();
  const s = useSettings();
  return (
    <Page>
      <BackHeader title="Settings" />
      <div className="space-y-4">
        <InstallCard />
        <div className="card divide-y divide-line overflow-hidden">
          <Row to="/settings/profile" icon={<User size={20} />} title="Profile & goals" sub={p ? `${p.calorieTarget} kcal · ${p.proteinG} g protein` : undefined} />
          <Row to="/settings/routines" icon={<CalendarDays size={20} />} title="Routine & weekly schedule" sub="Templates, weekday mapping" />
          <Row to="/settings/exercises" icon={<Library size={20} />} title="Exercise library" sub="Search, create custom exercises" />
        </div>
        <div className="card divide-y divide-line overflow-hidden">
          <Row to="/settings/preferences" icon={<Palette size={20} />} title="Units, theme & logging" sub={`${p?.units === 'metric' ? 'kg / cm' : 'lb / in'} · ${s.theme} theme`} />
          <Row to="/settings/reminders" icon={<BellRing size={20} />} title="Meal reminders" sub={s.mealReminders ? `On · ${Object.values(effectiveMealTimes(s.meals, s.mealTimes)).join(', ')}` : 'Off'} />
          <Row to="/settings/health" icon={<HeartPulse size={20} />} title="Fitbit (Google Health)" sub={s.lastHealthSync ? `Last sync ${new Date(s.lastHealthSync).toLocaleString()}` : 'Steps, calories, heart rate, sleep'} />
          <Row to="/settings/ai" icon={<Sparkles size={20} />} title="AI coach (Gemini)" sub={s.geminiKey || s.proxyUrl ? `Connected · ${s.geminiModel}` : 'Not set up'} />
          <Row to="/settings/backup" icon={<Database size={20} />} title="Backup & export" sub={s.lastBackupAt ? `Last backup ${new Date(s.lastBackupAt).toLocaleDateString()}` : 'Never backed up'} />
        </div>
        <div className="card divide-y divide-line overflow-hidden">
          <Row to="/settings/developer" icon={<Wrench size={20} />} title="Developer" sub="Sample data" />
          <Row to="/settings/reset" icon={<AlertTriangle size={20} />} title="Reset all data" />
        </div>
        <p className="text-center text-xs text-muted pt-2 flex items-center justify-center gap-1.5">
          <Dumbbell size={14} /> Forge · data stays on this device
        </p>
      </div>
    </Page>
  );
}
