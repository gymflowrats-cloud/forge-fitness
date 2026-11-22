import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarRange } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Banner } from '../../components/Feedback';
import { dismiss } from '../../db/settings';
import { useSettings } from '../../hooks/useData';
import { todayKey } from '../../lib/dates';
import { addDays, mondayOf } from '../../lib/stats';
import { loadRecap } from '../recap/WeeklyRecap';

/** Mon–Wed: "Your week in review" for last week, until dismissed or opened. */
export function WeeklyRecapBanner() {
  const nav = useNavigate();
  const s = useSettings();
  const today = todayKey();
  const lastWeek = addDays(mondayOf(today), -7);
  const key = `weekrecap-${lastWeek}`;
  const early = today <= addDays(mondayOf(today), 2);
  const r = useLiveQuery(() => (early ? loadRecap(lastWeek) : Promise.resolve(null)), [lastWeek, early]);
  if (!early || !r?.hasData || s.dismissed[key]) return null;
  return (
    <Banner
      icon={<CalendarRange size={24} />}
      title="Your week in review"
      sub={`${r.headline} · ${r.workouts} workout${r.workouts === 1 ? '' : 's'}, ${r.prs.length} PR${r.prs.length === 1 ? '' : 's'}`}
      onClick={() => {
        dismiss(key);
        nav('/recap');
      }}
      onDismiss={() => dismiss(key)}
    />
  );
}
