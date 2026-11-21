import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, Footprints, HeartPulse, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';

const fmtSleep = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

/** Compact Fitbit summary for a day. Renders nothing until Google Health has been synced at least once. */
export function WearableCard({ date }: { date: string }) {
  const nav = useNavigate();
  const d = useLiveQuery(() => db.wearableDays.get(date), [date]);
  const any = useLiveQuery(() => db.wearableDays.count(), [], 0);
  if (!any) return null;
  const items = [
    { icon: <Footprints size={17} />, label: 'Steps', value: d?.steps != null ? d.steps.toLocaleString() : '–' },
    { icon: <Flame size={17} />, label: 'Burned', value: d?.caloriesOut != null ? d.caloriesOut.toLocaleString() : '–' },
    { icon: <HeartPulse size={17} />, label: 'Rest HR', value: d?.restingHr != null ? `${d.restingHr}` : '–' },
    { icon: <Moon size={17} />, label: 'Sleep', value: d?.sleepMin != null ? fmtSleep(d.sleepMin) : '–' },
  ];
  return (
    <button onClick={() => nav('/settings/health')} className="card w-full px-3 py-3 grid grid-cols-4 gap-1 text-left" aria-label="Fitbit summary">
      {items.map((i) => (
        <div key={i.label} className="min-w-0 text-center">
          <div className="text-primary flex justify-center">{i.icon}</div>
          <div className="text-[15px] font-extrabold tabular truncate mt-0.5">{i.value}</div>
          <div className="text-[11px] text-muted">{i.label}</div>
        </div>
      ))}
    </button>
  );
}
