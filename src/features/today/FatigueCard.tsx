import { useLiveQuery } from 'dexie-react-hooks';
import { BatteryLow, X } from 'lucide-react';
import { db } from '../../db/db';
import { dismiss } from '../../db/settings';
import { useSettings } from '../../hooks/useData';
import { todayKey } from '../../lib/dates';
import { assessFatigue } from '../../lib/fatigue';
import { addDays } from '../../lib/stats';

/** Recovery warning on Today, built from Fitbit HRV/RHR/sleep plus recent strength and training load. */
export function FatigueCard() {
  const s = useSettings();
  const today = todayKey();
  const r = useLiveQuery(async () => {
    const from = addDays(today, -60);
    const [wearable, sets, exercises, sessions] = await Promise.all([
      db.wearableDays.where('date').aboveOrEqual(from).toArray(),
      db.sets.where('date').aboveOrEqual(from).filter((x) => x.completed).toArray(),
      db.exercises.toArray(),
      db.workoutSessions.where('date').aboveOrEqual(from).toArray(),
    ]);
    const doneSessions = new Set(sets.map((x) => x.sessionId));
    return assessFatigue({
      today,
      wearable,
      sets,
      exerciseNames: new Map(exercises.map((e) => [e.id, e.name])),
      trainedDates: sessions.filter((x) => doneSessions.has(x.id)).map((x) => x.date),
    });
  }, [today]);
  const key = `fatigue-${today}`;
  if (!r || r.level === 0 || s.dismissed[key]) return null;
  const strong = r.level === 2;
  return (
    <div className={`rounded-card p-4 border ${strong ? 'bg-danger/[0.08] border-danger/25' : 'bg-warn/[0.1] border-warn/30'}`}>
      <div className="flex items-start gap-3">
        <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${strong ? 'bg-danger/15 text-danger' : 'bg-warn/20 text-warn'}`}>
          <BatteryLow size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold">{r.headline}</div>
          <ul className="text-[13px] mt-1 space-y-0.5">
            {r.signals.map((x) => <li key={x.key}>• {x.text}</li>)}
          </ul>
          <div className="text-[13px] text-muted mt-1.5">{r.advice}</div>
        </div>
        <button aria-label="Dismiss for today" className="btn-ghost -mr-2 -mt-2 text-muted" onClick={() => dismiss(key)}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
