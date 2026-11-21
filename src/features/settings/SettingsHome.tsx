import { ChevronRight, CalendarDays, Database, Dumbbell, HeartPulse, Library, Palette, Sparkles, User, Wrench, AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BackHeader, Page } from '../../components/Layout';
import { useProfile, useSettings } from '../../hooks/useData';

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

export default function SettingsHome() {
  const p = useProfile();
  const s = useSettings();
  return (
    <Page>
      <BackHeader title="Settings" />
      <div className="space-y-4">
        <div className="card divide-y divide-line overflow-hidden">
          <Row to="/settings/profile" icon={<User size={20} />} title="Profile & goals" sub={p ? `${p.calorieTarget} kcal · ${p.proteinG} g protein` : undefined} />
          <Row to="/settings/routines" icon={<CalendarDays size={20} />} title="Routine & weekly schedule" sub="Templates, weekday mapping" />
          <Row to="/settings/exercises" icon={<Library size={20} />} title="Exercise library" sub="Search, create custom exercises" />
        </div>
        <div className="card divide-y divide-line overflow-hidden">
          <Row to="/settings/preferences" icon={<Palette size={20} />} title="Units, theme & logging" sub={`${p?.units === 'metric' ? 'kg / cm' : 'lb / in'} · ${s.theme} theme`} />
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
