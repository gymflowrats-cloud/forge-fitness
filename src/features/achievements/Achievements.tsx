import { Award, Lock } from 'lucide-react';
import { ProgressBar } from '../../components/Controls';
import { BackHeader, Page } from '../../components/Layout';
import type { Achievement, AchievementGroup } from '../../lib/achievements';
import { prettyDate } from '../../lib/dates';
import { fmtInt } from '../../lib/format';
import { useAchievements } from './useAchievements';

const GROUPS: AchievementGroup[] = ['Strength', 'Records', 'Consistency', 'Habits'];

function Badge({ a }: { a: Achievement }) {
  return (
    <div className={`card p-3.5 flex flex-col gap-2 ${a.unlocked ? '' : 'opacity-75'}`}>
      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${a.unlocked ? 'bg-gold/20 text-gold' : 'bg-track text-muted'}`}>
        {a.unlocked ? <Award size={26} /> : <Lock size={20} />}
      </div>
      <div>
        <div className="font-extrabold leading-tight">{a.title}</div>
        <div className="text-[12px] text-muted leading-snug mt-0.5">{a.sub}</div>
      </div>
      <div className="mt-auto">
        {a.unlocked ? (
          <div className="text-[12px] font-semibold text-gold">{a.date ? `Earned ${prettyDate(a.date, 'MMM d, yyyy')}` : 'Earned'}</div>
        ) : a.progress ? (
          <>
            <ProgressBar value={a.progress.cur} max={a.progress.target} className="!h-1.5" />
            <div className="text-[11px] text-muted tabular mt-1">{fmtInt(a.progress.cur)} / {fmtInt(a.progress.target)}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function AchievementsSummary({ onClick }: { onClick: () => void }) {
  const list = useAchievements();
  if (!list) return null;
  const got = list.filter((a) => a.unlocked);
  const next = list.filter((a) => !a.unlocked && a.progress).sort((a, b) => b.progress!.cur / b.progress!.target - a.progress!.cur / a.progress!.target)[0];
  return (
    <button onClick={onClick} className="card p-4 w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform">
      <div className="h-12 w-12 rounded-full bg-gold/20 text-gold flex items-center justify-center shrink-0"><Award size={26} /></div>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold">Achievements <span className="num tabular text-muted font-bold ml-1">{got.length}/{list.length}</span></div>
        <div className="text-[13px] text-muted truncate">{next ? `Next up: ${next.title} (${fmtInt(next.progress!.cur)}/${fmtInt(next.progress!.target)})` : 'All unlocked. Legend.'}</div>
      </div>
    </button>
  );
}

export default function Achievements() {
  const list = useAchievements() ?? [];
  const got = list.filter((a) => a.unlocked).length;
  return (
    <Page>
      <BackHeader title="Achievements" />
      <div className="rounded-card p-5 text-white hero-surface shadow-float mb-5">
        <div className="text-white/75 text-[14px]">Unlocked</div>
        <div className="num text-[52px] font-extrabold leading-tight tabular">{got} <span className="text-white/60 text-[28px]">/ {list.length}</span></div>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden mt-2"><div className="h-full bg-accent rounded-full" style={{ width: `${list.length ? (got / list.length) * 100 : 0}%` }} /></div>
      </div>
      {GROUPS.map((g) => {
        const items = list.filter((a) => a.group === g).sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
        if (!items.length) return null;
        return (
          <section key={g} className="mb-6">
            <h2 className="text-[20px] font-extrabold mb-2">{g}</h2>
            <div className="grid grid-cols-2 gap-3">{items.map((a) => <Badge key={a.id} a={a} />)}</div>
          </section>
        );
      })}
    </Page>
  );
}
