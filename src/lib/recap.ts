// Weekly recap numbers (Mon–Sun). Pure; weights in lb, volume in lb.
import { e1rm, totalVolume } from './calc';
import { addDays } from './stats';

export interface RecapInput {
  weekStart: string; // Monday
  sessions: { id: string; date: string }[];
  sets: { sessionId: string; exerciseId: string; weight: number | null; reps: number | null; completed: boolean; setType: string; isPR: boolean; date?: string }[];
  exerciseNames: Map<string, string>;
  scheduledWeekdays: number[]; // 0=Sun..6
  weights: { date: string; weight: number }[];
  foodLogs: { date: string; calories: number; protein: number }[];
  calorieTarget: number | null;
  proteinTarget: number | null;
  wearable: { date: string; steps: number | null; sleepMin: number | null }[];
  achievements: { title: string; date: string | null; unlocked: boolean }[];
}

export interface Recap {
  weekStart: string;
  weekEnd: string;
  workouts: number;
  planned: number;
  setsDone: number;
  volume: number;
  prevVolume: number;
  prs: { name: string; weight: number | null; reps: number | null }[];
  weightAvg: number | null;
  prevWeightAvg: number | null;
  foodDays: number;
  calAvg: number | null;
  proteinAvg: number | null;
  calTarget: number | null;
  proteinTarget: number | null;
  proteinDaysHit: number;
  stepsAvg: number | null;
  sleepAvg: number | null;
  achievements: string[];
  hasData: boolean;
  headline: string;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function buildRecap(i: RecapInput): Recap {
  const start = i.weekStart;
  const end = addDays(start, 6);
  const inWeek = (d: string | undefined, s = start, e = end) => !!d && d >= s && d <= e;
  const prevStart = addDays(start, -7);
  const prevEnd = addDays(start, -1);

  const done = i.sets.filter((s) => s.completed && s.setType !== 'warmup');
  const sessionIds = new Set(done.map((s) => s.sessionId));
  const weekSessions = i.sessions.filter((s) => inWeek(s.date) && sessionIds.has(s.id));
  const weekSets = done.filter((s) => inWeek(s.date));
  const prevSets = done.filter((s) => inWeek(s.date, prevStart, prevEnd));
  const workouts = new Set(weekSessions.map((s) => s.date)).size;
  const planned = i.scheduledWeekdays.length;

  // Best PR per exercise this week
  const prMap = new Map<string, { name: string; weight: number | null; reps: number | null; score: number }>();
  for (const s of weekSets.filter((x) => x.isPR)) {
    const score = e1rm(s.weight ?? 0, s.reps ?? 0) || (s.reps ?? 0);
    const cur = prMap.get(s.exerciseId);
    if (!cur || score > cur.score) prMap.set(s.exerciseId, { name: i.exerciseNames.get(s.exerciseId) ?? 'Exercise', weight: s.weight, reps: s.reps, score });
  }
  const prs = [...prMap.values()].sort((a, b) => b.score - a.score).map(({ score: _s, ...p }) => p);

  const wk = i.weights.filter((w) => inWeek(w.date)).map((w) => w.weight);
  const pw = i.weights.filter((w) => inWeek(w.date, prevStart, prevEnd)).map((w) => w.weight);

  const byDay = new Map<string, { c: number; p: number }>();
  for (const f of i.foodLogs.filter((x) => inWeek(x.date))) {
    const d = byDay.get(f.date) ?? { c: 0, p: 0 };
    d.c += f.calories;
    d.p += f.protein;
    byDay.set(f.date, d);
  }
  const days = [...byDay.values()];
  const proteinDaysHit = i.proteinTarget ? days.filter((d) => d.p >= i.proteinTarget! * 0.9).length : 0;

  const wear = i.wearable.filter((d) => inWeek(d.date));
  const steps = avg(wear.map((d) => d.steps).filter((v): v is number => v != null && v > 0));
  const sleep = avg(wear.map((d) => d.sleepMin).filter((v): v is number => v != null && v > 0));

  const achievements = i.achievements.filter((a) => a.unlocked && inWeek(a.date ?? undefined)).map((a) => a.title);
  const volume = totalVolume(weekSets);
  const prevVolume = totalVolume(prevSets);

  let headline = 'A quiet week';
  if (prs.length >= 3) headline = `${prs.length} PRs. Huge week!`;
  else if (planned && workouts >= planned) headline = 'Every planned workout done';
  else if (prs.length) headline = `New PR on ${prs[0]!.name}`;
  else if (prevVolume && volume > prevVolume * 1.05) headline = 'More work than last week';
  else if (workouts) headline = `${workouts} workout${workouts > 1 ? 's' : ''} in the bank`;

  return {
    weekStart: start, weekEnd: end, workouts, planned, setsDone: weekSets.length, volume, prevVolume, prs,
    weightAvg: avg(wk), prevWeightAvg: avg(pw),
    foodDays: days.length, calAvg: avg(days.map((d) => d.c)), proteinAvg: avg(days.map((d) => d.p)),
    calTarget: i.calorieTarget, proteinTarget: i.proteinTarget, proteinDaysHit,
    stepsAvg: steps, sleepAvg: sleep, achievements,
    hasData: workouts > 0 || wk.length > 0 || days.length > 0 || wear.length > 0,
    headline,
  };
}
