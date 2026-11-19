// Pure calculation helpers. No DB or React imports here so they stay unit-testable.

export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'build' | 'recomp' | 'maintain';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps || reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface SetLike {
  weight?: number | null;
  reps?: number | null;
  completed?: boolean;
  setType?: string;
}

export const setVolume = (s: SetLike) => (s.weight || 0) * (s.reps || 0);

/** Total volume of completed, non-warm-up sets. */
export function totalVolume(sets: SetLike[]): number {
  return sets.reduce((acc, s) => (s.completed && s.setType !== 'warmup' ? acc + setVolume(s) : acc), 0);
}

export function bestE1rm(sets: SetLike[]): number {
  return sets.reduce((m, s) => Math.max(m, e1rm(s.weight || 0, s.reps || 0)), 0);
}

export interface PRResult {
  isPR: boolean;
  kinds: ('weight' | 'reps' | 'e1rm')[];
}

/**
 * Does `candidate` beat history? Kinds:
 *  - weight: heaviest weight ever lifted (for >=1 rep)
 *  - reps: most reps at this weight (or heavier)
 *  - e1rm: best estimated 1RM
 * With no history at all we don't award PRs (otherwise the first session is all PRs).
 */
export function detectPR(history: SetLike[], candidate: SetLike): PRResult {
  const w = candidate.weight || 0;
  const r = candidate.reps || 0;
  const hist = history.filter((s) => s.completed !== false && s.setType !== 'warmup' && (s.reps || 0) > 0);
  if (!hist.length || r <= 0 || candidate.setType === 'warmup') return { isPR: false, kinds: [] };
  const kinds: PRResult['kinds'] = [];
  const maxW = Math.max(...hist.map((s) => s.weight || 0));
  if (w > 0 && w > maxW) kinds.push('weight');
  const atWeight = hist.filter((s) => (s.weight || 0) >= w);
  const maxRepsAtW = atWeight.length ? Math.max(...atWeight.map((s) => s.reps || 0)) : 0;
  if (atWeight.length && r > maxRepsAtW) kinds.push('reps');
  if (w > 0) {
    const best = bestE1rm(hist);
    if (e1rm(w, r) > best + 1e-9) kinds.push('e1rm');
  }
  return { isPR: kinds.length > 0, kinds };
}

// ---------- Energy ----------
export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Mifflin-St Jeor BMR (kcal/day). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function tdee(bmrValue: number, activity: Activity) {
  return bmrValue * ACTIVITY_FACTORS[activity];
}

export const GOAL_ADJUST: Record<Goal, number> = { lose: -500, build: 300, recomp: -200, maintain: 0 };

export interface TargetInput {
  sex: Sex;
  weightLb: number;
  heightIn: number;
  age: number;
  activity: Activity;
  goal: Goal;
}

export function suggestTargets(i: TargetInput) {
  const kg = i.weightLb / 2.2046226218;
  const cm = i.heightIn * 2.54;
  const t = tdee(bmr(i.sex, kg, cm, i.age), i.activity);
  const calories = Math.round((t + GOAL_ADJUST[i.goal]) / 10) * 10;
  const perLb = i.goal === 'maintain' ? 0.8 : i.goal === 'lose' ? 1.0 : 0.9;
  const protein = Math.round(i.weightLb * perLb);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat, tdee: Math.round(t) };
}

export const macroCalories = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;

// ---------- Series ----------
export interface Point {
  date: string; // YYYY-MM-DD
  value: number;
}

const dayNum = (k: string) => Math.floor(Date.parse(k + 'T00:00:00Z') / 86400000);

/** Trailing time-window moving average (window in days, inclusive). Input need not be sorted. */
export function movingAverage(points: Point[], windowDays = 7): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p) => {
    const d = dayNum(p.date);
    const win = sorted.filter((q) => {
      const qd = dayNum(q.date);
      return qd <= d && qd > d - windowDays;
    });
    return { date: p.date, value: win.reduce((a, q) => a + q.value, 0) / win.length };
  });
}

/** Least-squares slope in units per week. Returns null with <2 points or zero span. */
export function weeklyRate(points: Point[]): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => dayNum(p.date));
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i]! - my);
    den += (x - mx) ** 2;
  });
  if (den === 0) return null;
  return (num / den) * 7;
}

export const pctChange = (prev: number, cur: number) => (prev === 0 ? (cur === 0 ? 0 : 100) : ((cur - prev) / prev) * 100);

// ---------- Streaks & adherence ----------
const addDaysKey = (k: string, n: number) => new Date((dayNum(k) + n) * 86400000).toISOString().slice(0, 10);
const weekdayOfKey = (k: string) => new Date(k + 'T00:00:00Z').getUTCDay();

/**
 * Current streak of training days, where rest days (not scheduled) don't break it.
 * Today being an untrained scheduled day doesn't break it either (the day isn't over).
 */
export function trainingStreak(trained: Set<string>, isScheduled: (weekday: number) => boolean, today: string): number {
  let streak = 0;
  for (let i = 0; i < 730; i++) {
    const k = addDaysKey(today, -i);
    const sched = isScheduled(weekdayOfKey(k));
    if (trained.has(k)) streak++;
    else if (sched && i > 0) break;
  }
  return streak;
}

/** Consecutive ISO weeks (Mon-start) with at least one workout, counting back from this week. */
export function weekStreak(trained: Set<string>, today: string): number {
  const monday = (k: string) => addDaysKey(k, -((weekdayOfKey(k) + 6) % 7));
  const weeks = new Set([...trained].map(monday));
  let w = monday(today);
  let streak = 0;
  if (!weeks.has(w)) w = addDaysKey(w, -7); // current week still in progress
  while (weeks.has(w)) {
    streak++;
    w = addDaysKey(w, -7);
  }
  return streak;
}

/** % of scheduled days in [from, to] that were trained (training on any day of that date counts). */
export function adherence(trained: Set<string>, isScheduled: (weekday: number) => boolean, from: string, to: string) {
  let scheduled = 0;
  let hit = 0;
  for (let k = from; k <= to; k = addDaysKey(k, 1)) {
    if (isScheduled(weekdayOfKey(k))) {
      scheduled++;
      if (trained.has(k)) hit++;
    }
  }
  return { scheduled, hit, pct: scheduled ? (hit / scheduled) * 100 : 0 };
}

export function parseRepRange(s: string): { min: number; max: number } | null {
  const m = s.trim().match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}
