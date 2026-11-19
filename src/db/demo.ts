// Sample-data generator (Settings → Developer). All demo rows use ids starting with "demo-" so they can be cleared.
import { db } from './db';
import { createStarterRoutine } from './routines';
import { detectPR } from '../lib/calc';
import { shiftKey, todayKey, weekdayOf } from '../lib/dates';
import type { BodyWeight, FoodLog, Measurement, SessionExercise, WorkoutSession, WorkoutSet } from './types';

let n = 0;
const did = () => `demo-${Date.now().toString(36)}-${(n++).toString(36)}`;
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
const round5 = (x: number) => Math.round(x / 5) * 5;

const START_WEIGHT: Record<string, number> = {
  'ex-barbell-bench-press': 155, 'ex-overhead-press': 95, 'ex-incline-dumbbell-press': 50, 'ex-lateral-raise': 15, 'ex-rope-pushdown': 40,
  'ex-deadlift': 225, 'ex-pull-up': 0, 'ex-barbell-row': 135, 'ex-face-pull': 35, 'ex-dumbbell-curl': 25,
  'ex-back-squat': 185, 'ex-romanian-deadlift': 155, 'ex-leg-press': 270, 'ex-lying-leg-curl': 70, 'ex-standing-calf-raise': 120,
};

const FOODS: { meal: string; items: [string, number, number, number, number][] }[] = [
  { meal: 'Breakfast', items: [['Oatmeal with berries', 350, 12, 60, 7], ['3 eggs scrambled', 230, 19, 2, 16], ['Greek yogurt + honey', 220, 20, 28, 3], ['Protein shake', 160, 30, 5, 2], ['Toast with peanut butter', 290, 10, 30, 15]] },
  { meal: 'Lunch', items: [['Chicken burrito bowl', 650, 45, 70, 18], ['Turkey sandwich', 480, 32, 50, 14], ['Chicken caesar salad', 520, 40, 18, 32], ['Rice + salmon', 610, 38, 65, 20]] },
  { meal: 'Dinner', items: [['Steak, potatoes & greens', 720, 52, 55, 30], ['Pasta bolognese', 760, 38, 90, 24], ['Chicken stir-fry with rice', 640, 45, 72, 15], ['Salmon, quinoa & veg', 590, 42, 50, 22]] },
  { meal: 'Snacks', items: [['Protein bar', 210, 20, 22, 7], ['Apple + almonds', 260, 7, 28, 15], ['Cottage cheese', 180, 24, 8, 5], ['Banana', 105, 1, 27, 0]] },
];

export async function loadDemoData(weeks = 8) {
  seed = 42;
  if ((await db.templates.filter((t) => !t.archived).count()) === 0) await createStarterRoutine();
  const templates = await db.templates.filter((t) => !t.archived).toArray();
  const schedule = await db.weekSchedule.toArray();
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const profile = await db.profile.get('me');
  const today = todayKey();
  const days = weeks * 7;

  const sessions: WorkoutSession[] = [];
  const ses: SessionExercise[] = [];
  const sets: WorkoutSet[] = [];
  const history = new Map<string, WorkoutSet[]>();
  const existingDates = new Set((await db.workoutSessions.toArray()).map((s) => s.date));

  for (let i = days; i >= 1; i--) {
    const date = shiftKey(today, -i);
    if (existingDates.has(date)) continue;
    const tid = schedule.find((s) => s.weekday === weekdayOf(date))?.templateId;
    const t = templates.find((x) => x.id === tid);
    if (!t || rnd() < 0.12) continue; // ~12% missed days
    const progress = (days - i) / days; // 0 → 1
    const start = new Date(date + 'T18:00:00');
    start.setMinutes(Math.floor(rnd() * 60));
    const session: WorkoutSession = {
      id: did(), date, templateId: t.id, templateNameSnapshot: t.name, startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + (50 + rnd() * 30) * 60000).toISOString(), status: 'done', rating: 3 + Math.floor(rnd() * 3), note: '',
    };
    sessions.push(session);
    let clock = start.getTime();
    t.exercises.forEach((te, order) => {
      const ex = exercises.get(te.exerciseId);
      const se: SessionExercise = { id: did(), sessionId: session.id, exerciseId: te.exerciseId, order, isExtra: false, note: '', restSec: te.restSec, targetRepsMin: te.targetRepsMin, targetRepsMax: te.targetRepsMax };
      ses.push(se);
      const base = START_WEIGHT[te.exerciseId] ?? 50;
      const isLegs = ex?.primaryMuscle === 'quads' || ex?.primaryMuscle === 'hamstrings';
      const gain = base * (isLegs ? 0.07 : 0.1) * progress;
      for (let k = 0; k < te.targetSets; k++) {
        clock += (te.restSec + 40) * 1000;
        const s: WorkoutSet = {
          id: did(), sessionExerciseId: se.id, sessionId: session.id, exerciseId: te.exerciseId, order: k, setType: 'working',
          weight: ex?.type === 'weight_reps' ? round5(base + gain + (rnd() < 0.2 ? 5 : 0)) : ex?.type === 'bodyweight_reps' ? (progress > 0.6 ? 10 : 0) : null,
          reps: ex?.type === 'time' ? null : Math.max(te.targetRepsMin || 6, Math.round((te.targetRepsMax || 10) - k - rnd() * 2)),
          durationSec: ex?.type === 'time' ? 45 + Math.round(progress * 30) : null, distance: null,
          completed: true, completedAt: new Date(clock).toISOString(), isPR: false, date,
        };
        const h = history.get(te.exerciseId) ?? [];
        if (ex?.type === 'weight_reps' || ex?.type === 'bodyweight_reps') s.isPR = detectPR(h, s).isPR;
        h.push(s);
        history.set(te.exerciseId, h);
        sets.push(s);
      }
    });
  }

  // Body weight: trending toward goal with noise
  const startW = profile?.startWeight ?? 185;
  const dir = profile?.goal === 'build' ? 1 : profile?.goal === 'maintain' ? 0 : -1;
  const weightDates = new Set((await db.bodyWeights.toArray()).map((w) => w.date));
  const weights: BodyWeight[] = [];
  const measurements: Measurement[] = [];
  for (let i = days; i >= 1; i--) {
    const date = shiftKey(today, -i);
    const trend = startW + 2 + dir * 0.55 * ((days - i) / 7);
    if (rnd() < 0.85 && !weightDates.has(date)) weights.push({ id: did(), date, weight: Math.round((trend + (rnd() - 0.5) * 2.2) * 10) / 10 });
    if (weekdayOf(date) === (profile?.checkInDay ?? 0)) {
      const p = (days - i) / days;
      measurements.push({
        id: did(), date, photoBlobId: null, note: '', chest: 41 + p * 0.4, waist: 34.5 + dir * p * 1.2, hips: 39 - p * 0.4,
        neck: 15.5, armL: 14.4 + p * 0.3, armR: 14.6 + p * 0.3, thighL: 23.5 + p * 0.2, thighR: 23.6 + p * 0.2, calves: 15, bodyFat: 18 - p * 1.5,
      });
    }
  }
  measurements.forEach((m) => {
    for (const k of ['chest', 'waist', 'hips', 'armL', 'armR', 'thighL', 'thighR', 'bodyFat'] as const) m[k] = Math.round((m[k]! + (rnd() - 0.5) * 0.3) * 10) / 10;
  });

  // Food logs
  const target = profile?.calorieTarget ?? 2300;
  const foodDates = new Set((await db.foodLogs.toArray()).map((f) => f.date));
  const logs: FoodLog[] = [];
  for (let i = days; i >= 1; i--) {
    const date = shiftKey(today, -i);
    if (foodDates.has(date) || rnd() < 0.08) continue;
    const scale = target / 2100 + (rnd() - 0.5) * 0.25;
    for (const m of FOODS) {
      if (m.meal === 'Snacks' && rnd() < 0.3) continue;
      const count = m.meal === 'Breakfast' ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const [name, cal, p, c, f] = pick(m.items);
        const sv = Math.round(scale * 4) / 4 || 1;
        logs.push({ id: did(), date, meal: m.meal, foodId: null, name, servings: sv, calories: Math.round(cal * sv), protein: Math.round(p * sv), carbs: Math.round(c * sv), fat: Math.round(f * sv), source: 'manual', createdAt: `${date}T12:00:00.000Z` });
      }
    }
  }

  await db.transaction('rw', [db.workoutSessions, db.sessionExercises, db.sets, db.bodyWeights, db.measurements, db.foodLogs], async () => {
    await db.workoutSessions.bulkAdd(sessions);
    await db.sessionExercises.bulkAdd(ses);
    await db.sets.bulkAdd(sets);
    await db.bodyWeights.bulkAdd(weights);
    await db.measurements.bulkAdd(measurements);
    await db.foodLogs.bulkAdd(logs);
  });
  return { sessions: sessions.length, sets: sets.length, weights: weights.length, logs: logs.length };
}

export async function clearDemoData() {
  const isDemo = (id: string) => id.startsWith('demo-');
  await db.transaction('rw', [db.workoutSessions, db.sessionExercises, db.sets, db.bodyWeights, db.measurements, db.foodLogs], async () => {
    for (const t of [db.workoutSessions, db.sessionExercises, db.sets, db.bodyWeights, db.measurements, db.foodLogs] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keys = ((await (t as any).toCollection().primaryKeys()) as string[]).filter(isDemo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (t as any).bulkDelete(keys);
    }
  });
}
