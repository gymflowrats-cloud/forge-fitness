import { CalendarRange, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AchievementsSummary } from '../achievements/Achievements';
import { Chip, ChipRow, SegmentedControl } from '../../components/Controls';
import { Page, PageTitle } from '../../components/Layout';
import { useProfile, useUnits } from '../../hooks/useData';
import { ActivityStats } from './ActivityStats';
import { BodyStats } from './BodyStats';
import { GymStats } from './GymStats';
import { NutritionStats } from './NutritionStats';
import { RANGES, useStatsData, type Range } from './useStatsData';

type Tab = 'gym' | 'body' | 'nutrition' | 'activity';

export default function Stats() {
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('forge.statsTab') as Tab) || 'gym');
  const [range, setRange] = useState<Range>('12W');
  const data = useStatsData(range);
  const units = useUnits();
  const profile = useProfile();
  const nav = useNavigate();
  return (
    <Page>
      <PageTitle title="Statistics" sub="Your progress at a glance" />
      <div className="space-y-3 mb-4">
        <SegmentedControl
          size="sm"
          options={[{ value: 'gym', label: 'Gym' }, { value: 'body', label: 'Body' }, { value: 'nutrition', label: 'Food' }, { value: 'activity', label: 'Activity' }]}
          value={tab}
          onChange={(t) => {
            setTab(t);
            try { sessionStorage.setItem('forge.statsTab', t); } catch { /* ignore */ }
          }}
        />
        <ChipRow>
          {RANGES.map((r) => <Chip key={r} active={range === r} onClick={() => setRange(r)}>{r}</Chip>)}
        </ChipRow>
      </div>
      {tab === 'gym' && (
        <div className="space-y-3 mb-4">
          <AchievementsSummary onClick={() => nav('/achievements')} />
          <button onClick={() => nav('/recap')} className="card p-4 w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform">
            <div className="h-12 w-12 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0"><CalendarRange size={24} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold">Weekly recap</div>
              <div className="text-[13px] text-muted">Workouts, PRs, weight and food for each week</div>
            </div>
            <ChevronRight size={20} className="text-muted" />
          </button>
        </div>
      )}
      {!data ? (
        <div className="card p-8 text-center text-muted">Crunching numbers…</div>
      ) : tab === 'gym' ? (
        <GymStats d={data} units={units} />
      ) : tab === 'body' ? (
        <BodyStats d={data} units={units} profile={profile} />
      ) : tab === 'nutrition' ? (
        <NutritionStats d={data} units={units} profile={profile} />
      ) : (
        <ActivityStats d={data} />
      )}
    </Page>
  );
}
