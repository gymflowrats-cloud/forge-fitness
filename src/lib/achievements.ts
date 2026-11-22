// Achievements are derived from logged data (never stored), so they survive backups/restores
// and can't drift out of sync. Only "already celebrated" ids are kept in settings.
import { setVolume } from './calc';
import { addDays, mondayOf } from './stats';

export type AchievementGroup = 'Consistency' | 'Strength' | 'Records' | 'Habits';

export interface Achievement {
  id: string;
  group: AchievementGroup;
  title: string;
  sub: string;
  unlocked: boolean;
  /** Date it was first earned (YYYY-MM-DD), when known. */
  date: string | null;
  progress: { cur: number; target: number } | null;
}

export interface AchInput {
  sessions: { id: string; date: string; status: string; startedAt: string | null }[];
  sets: { sessionId: string; exerciseId: string; weight: number | null; reps: number | null; completed: boolean; setType: string; isPR: boolean; date?: string }[];
  exerciseNames: Map<string, string>;
  weightDates: string[];
  foodDates: string[];
  weights: { date: string; weight: number }[];
  goalWeight: number | null;
  startWeight: number | null;
  metric: boolean;
  today: string;
}

const LB = 2.20462;

/** Find the date the running count first reaches `target` (dates sorted ascending). */
function dateAtCount(dates: string[], target: number) {
  return dates.length >= target ? dates[target - 1]! : null;
}

/** Longest run of consecutive days present in `dates`; returns [length, endDate of first run reaching target]. */
function dayStreak(dates: Set<string>, target: number): { best: number; reachedOn: string | null } {
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  let reachedOn: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
    if (!reachedOn && run >= target) reachedOn = d;
  }
  return { best, reachedOn };
}

/** Longest run of consecutive weeks with >= perWeek trained days. */
function weekStreakOf(trained: string[], perWeek: number, target: number) {
  const counts = new Map<string, number>();
  for (const d of trained) counts.set(mondayOf(d), (counts.get(mondayOf(d)) ?? 0) + 1);
  const weeks = [...counts].filter(([, c]) => c >= perWeek).map(([w]) => w).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  let reachedOn: string | null = null;
  for (const w of weeks) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    prev = w;
    best = Math.max(best, run);
    if (!reachedOn && run >= target) reachedOn = addDays(w, 6);
  }
  return { best, reachedOn };
}

export function computeAchievements(i: AchInput): Achievement[] {
  const out: Achievement[] = [];
  const done = i.sets.filter((s) => s.completed && s.setType !== 'warmup');
  const sessionsWithSets = new Set(done.map((s) => s.sessionId));
  const trainedSessions = i.sessions.filter((s) => sessionsWithSets.has(s.id)).sort((a, b) => a.date.localeCompare(b.date));
  const trainedDays = [...new Set(trainedSessions.map((s) => s.date))].sort();

  // ---------- Consistency ----------
  for (const [n, title] of [[1, 'First workout'], [10, '10 workouts'], [25, '25 workouts'], [50, '50 workouts'], [100, '100 club'], [250, '250 workouts']] as const) {
    const date = dateAtCount(trainedDays, n);
    out.push({ id: `workouts_${n}`, group: 'Consistency', title, sub: n === 1 ? 'Log your first session' : `Train on ${n} different days`, unlocked: !!date, date, progress: { cur: Math.min(trainedDays.length, n), target: n } });
  }
  for (const [weeks, title] of [[4, 'Locked in'], [12, 'Quarter strong'], [26, 'Half-year habit']] as const) {
    const w = weekStreakOf(trainedDays, 3, weeks);
    out.push({ id: `weekstreak_${weeks}`, group: 'Consistency', title, sub: `${weeks} weeks in a row with 3+ workouts`, unlocked: w.best >= weeks, date: w.reachedOn, progress: { cur: Math.min(w.best, weeks), target: weeks } });
  }
  const early = trainedSessions.find((s) => s.startedAt && new Date(s.startedAt).getHours() < 7);
  out.push({ id: 'early_bird', group: 'Consistency', title: 'Early bird', sub: 'Start a workout before 7 am', unlocked: !!early, date: early?.date ?? null, progress: null });
  const late = trainedSessions.find((s) => s.startedAt && new Date(s.startedAt).getHours() >= 21);
  out.push({ id: 'night_owl', group: 'Consistency', title: 'Night owl', sub: 'Start a workout after 9 pm', unlocked: !!late, date: late?.date ?? null, progress: null });

  // ---------- Records ----------
  const prs = done.filter((s) => s.isPR).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  for (const [n, title] of [[1, 'First PR'], [10, '10 PRs'], [50, 'Record breaker'], [100, 'PR machine']] as const) {
    const d = prs.length >= n ? prs[n - 1]!.date ?? null : null;
    out.push({ id: `prs_${n}`, group: 'Records', title, sub: n === 1 ? 'Beat one of your previous bests' : `Set ${n} personal records`, unlocked: prs.length >= n, date: d, progress: { cur: Math.min(prs.length, n), target: n } });
  }
  // Lifetime volume (kg or lb depending on units, so the numbers read naturally)
  const byDate = [...done].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const unitDiv = i.metric ? LB : 1;
  const totalVol = byDate.reduce((a, s) => a + setVolume(s), 0) / unitDiv;
  const volTargets = i.metric ? [10_000, 100_000, 500_000, 1_000_000] : [25_000, 250_000, 1_000_000, 2_500_000];
  for (const t of volTargets) {
    let acc = 0;
    let date: string | null = null;
    for (const s of byDate) {
      acc += setVolume(s) / unitDiv;
      if (acc >= t) { date = s.date ?? null; break; }
    }
    const label = t >= 1_000_000 ? `${t / 1_000_000}M` : `${t / 1000}k`;
    out.push({ id: `volume_${t}${i.metric ? 'kg' : 'lb'}`, group: 'Records', title: `${label} ${i.metric ? 'kg' : 'lb'} lifted`, sub: 'Total lifetime volume', unlocked: totalVol >= t, date, progress: { cur: Math.min(Math.round(totalVol), t), target: t } });
  }

  // ---------- Strength (plate milestones; thresholds stored in lb) ----------
  const match = (re: RegExp) => [...i.exerciseNames].filter(([, n]) => re.test(n)).map(([id]) => id);
  const lifts: { key: string; name: string; ids: string[]; steps: [number, number, string][] }[] = [
    { key: 'bench', name: 'Bench', ids: match(/bench press/i), steps: [[135, 60, '1 plate'], [225, 100, '2 plates'], [315, 140, '3 plates']] },
    { key: 'squat', name: 'Squat', ids: match(/squat/i).filter((id) => !/split|goblet|hack|jump/i.test(i.exerciseNames.get(id) ?? '')), steps: [[135, 60, '1 plate'], [225, 100, '2 plates'], [315, 140, '3 plates'], [405, 180, '4 plates']] },
    { key: 'deadlift', name: 'Deadlift', ids: match(/deadlift/i).filter((id) => !/romanian|rdl|stiff/i.test(i.exerciseNames.get(id) ?? '')), steps: [[225, 100, '2 plates'], [315, 140, '3 plates'], [405, 180, '4 plates'], [495, 220, '5 plates']] },
    { key: 'ohp', name: 'Overhead press', ids: match(/overhead press|military press|shoulder press/i).filter((id) => /barbell|military|overhead press$/i.test(i.exerciseNames.get(id) ?? '')), steps: [[95, 40, 'Strict press milestone'], [135, 60, '1 plate']] },
  ];
  for (const l of lifts) {
    if (!l.ids.length) continue;
    const ids = new Set(l.ids);
    const liftSets = byDate.filter((s) => ids.has(s.exerciseId) && (s.reps ?? 0) >= 1);
    const best = liftSets.reduce((m, s) => Math.max(m, s.weight ?? 0), 0);
    for (const [lb, kg, plate] of l.steps) {
      const need = i.metric ? kg * LB - 0.01 : lb; // compare in lb
      const hit = liftSets.find((s) => (s.weight ?? 0) >= need);
      const shown = i.metric ? `${kg} kg` : `${lb} lb`;
      out.push({
        id: `${l.key}_${lb}`, group: 'Strength', title: `${l.name} ${shown}`, sub: `${plate} for at least one rep`,
        unlocked: !!hit, date: hit?.date ?? null,
        progress: { cur: Math.round(Math.min(best, need) / unitDiv), target: i.metric ? kg : lb },
      });
    }
  }

  // ---------- Habits ----------
  const foodStreak = dayStreak(new Set(i.foodDates), 30);
  for (const n of [7, 30]) {
    const r = dayStreak(new Set(i.foodDates), n);
    out.push({ id: `food_${n}`, group: 'Habits', title: n === 7 ? 'Food diary week' : 'Food diary month', sub: `Log food ${n} days in a row`, unlocked: foodStreak.best >= n, date: r.reachedOn, progress: { cur: Math.min(foodStreak.best, n), target: n } });
  }
  const wStreak = dayStreak(new Set(i.weightDates), 30);
  for (const n of [7, 30]) {
    const r = dayStreak(new Set(i.weightDates), n);
    out.push({ id: `weighin_${n}`, group: 'Habits', title: n === 7 ? 'Weigh-in week' : 'Weigh-in month', sub: `Log your weight ${n} days in a row`, unlocked: wStreak.best >= n, date: r.reachedOn, progress: { cur: Math.min(wStreak.best, n), target: n } });
  }
  if (i.goalWeight != null && i.startWeight != null && i.goalWeight !== i.startWeight) {
    const losing = i.goalWeight < i.startWeight;
    const hit = [...i.weights].sort((a, b) => a.date.localeCompare(b.date)).find((w) => (losing ? w.weight <= i.goalWeight! : w.weight >= i.goalWeight!));
    const latest = [...i.weights].sort((a, b) => b.date.localeCompare(a.date))[0];
    const span = Math.abs(i.startWeight - i.goalWeight);
    const moved = latest ? Math.max(0, losing ? i.startWeight - latest.weight : latest.weight - i.startWeight) : 0;
    out.push({ id: 'goal_weight', group: 'Habits', title: 'Goal weight reached', sub: 'Hit the goal weight in your profile', unlocked: !!hit, date: hit?.date ?? null, progress: { cur: Math.round(Math.min(moved, span) * 10) / 10, target: Math.round(span * 10) / 10 } });
  }
  return out;
}
