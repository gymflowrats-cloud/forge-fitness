// Recovery / fatigue signals from Fitbit data + training performance. Pure and unit-tested.
import { e1rm } from './calc';
import { addDays, mondayOf } from './stats';

export interface FatigueInput {
  today: string;
  wearable: { date: string; restingHr: number | null; hrvMs: number | null; sleepMin: number | null }[];
  /** Completed working sets with date. */
  sets: { exerciseId: string; date?: string; weight: number | null; reps: number | null; setType: string; completed: boolean }[];
  exerciseNames: Map<string, string>;
  trainedDates: string[];
}

export interface FatigueSignal {
  key: 'hrv' | 'rhr' | 'sleep' | 'strength' | 'deload';
  text: string;
}

export interface FatigueResult {
  level: 0 | 1 | 2;
  signals: FatigueSignal[];
  headline: string;
  advice: string;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function assessFatigue(i: FatigueInput): FatigueResult {
  const signals: FatigueSignal[] = [];
  const recentFrom = addDays(i.today, -2); // last 3 days incl. today
  const baseFrom = addDays(i.today, -30);
  const recent = i.wearable.filter((d) => d.date >= recentFrom && d.date <= i.today);
  const base = i.wearable.filter((d) => d.date >= baseFrom && d.date < recentFrom);

  const vals = (list: typeof recent, k: 'restingHr' | 'hrvMs' | 'sleepMin') => list.map((d) => d[k]).filter((v): v is number => v != null && v > 0);
  const hrvR = vals(recent, 'hrvMs');
  const hrvB = vals(base, 'hrvMs');
  if (hrvR.length >= 2 && hrvB.length >= 7) {
    const ratio = avg(hrvR) / median(hrvB);
    if (ratio <= 0.85) signals.push({ key: 'hrv', text: `HRV ${Math.round((1 - ratio) * 100)}% below your normal` });
  }
  const rhrR = vals(recent, 'restingHr');
  const rhrB = vals(base, 'restingHr');
  if (rhrR.length >= 2 && rhrB.length >= 7) {
    const diff = avg(rhrR) - median(rhrB);
    if (diff >= 5) signals.push({ key: 'rhr', text: `Resting heart rate up ${Math.round(diff)} bpm` });
  }
  const sleepR = vals(recent, 'sleepMin');
  if (sleepR.length >= 2 && avg(sleepR) < 360) {
    const m = Math.round(avg(sleepR));
    signals.push({ key: 'sleep', text: `Averaging ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')} sleep the last few nights` });
  }

  // Strength dip: last session's best e1RM < 95% of the best of the 3 sessions before it.
  const from = addDays(i.today, -35);
  const byEx = new Map<string, Map<string, number>>();
  for (const s of i.sets) {
    if (!s.completed || s.setType === 'warmup' || !s.date || s.date < from) continue;
    const v = e1rm(s.weight ?? 0, s.reps ?? 0);
    if (!v) continue;
    const m = byEx.get(s.exerciseId) ?? new Map<string, number>();
    m.set(s.date, Math.max(m.get(s.date) ?? 0, v));
    byEx.set(s.exerciseId, m);
  }
  const dipped: string[] = [];
  for (const [id, m] of byEx) {
    const pts = [...m].sort((a, b) => a[0].localeCompare(b[0]));
    if (pts.length < 4) continue;
    const last = pts[pts.length - 1]!;
    if (last[0] < addDays(i.today, -10)) continue;
    const prev = Math.max(...pts.slice(-4, -1).map((p) => p[1]));
    if (last[1] < prev * 0.95) dipped.push(i.exerciseNames.get(id) ?? 'a lift');
  }
  if (dipped.length >= 2) signals.push({ key: 'strength', text: `Strength dipped on ${dipped.slice(0, 2).join(' and ')}` });

  // Deload: 6+ consecutive weeks (ending this or last week) with 3+ sessions.
  const counts = new Map<string, number>();
  for (const d of new Set(i.trainedDates)) counts.set(mondayOf(d), (counts.get(mondayOf(d)) ?? 0) + 1);
  let run = 0;
  let w = mondayOf(i.today);
  if ((counts.get(w) ?? 0) < 3) w = addDays(w, -7); // current week may be in progress
  while ((counts.get(w) ?? 0) >= 3) {
    run++;
    w = addDays(w, -7);
  }
  if (run >= 6) signals.push({ key: 'deload', text: `${run} hard weeks in a row without a lighter week` });

  const body = signals.filter((s) => s.key !== 'deload').length;
  const level: FatigueResult['level'] = signals.length >= 2 || body >= 2 ? 2 : signals.length === 1 ? 1 : 0;
  const onlyDeload = signals.length === 1 && signals[0]!.key === 'deload';
  return {
    level,
    signals,
    headline: level === 2 ? 'Your body could use an easier day' : onlyDeload ? 'Time to plan a deload week?' : level === 1 ? 'Recovery check' : 'Recovered',
    advice:
      level === 2
        ? 'Consider a rest day, or keep today light: about 2 sets less per exercise and leave 3 reps in the tank.'
        : onlyDeload
          ? 'A week at about 60% of your usual sets (same weights) helps you come back stronger.'
          : level === 1
            ? "Train as planned but listen to your body. Don't chase PRs if warm-ups feel heavy."
            : '',
  };
}
