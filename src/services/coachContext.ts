// Builds a compact JSON summary of the user's data for the AI coach (never raw dumps).
import { db } from '../db/db';
import { adherence, e1rm, movingAverage, totalVolume, weeklyRate } from '../lib/calc';
import { WEEKDAYS_SHORT, shiftKey, todayKey, weekdayOf } from '../lib/dates';
import { exerciseProgress, trainedDates } from '../lib/stats';
import { lUnit, toDispL, toDispW, wUnit } from '../lib/units';
import { MEASUREMENT_KEYS } from '../db/types';

const r1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);

export async function buildCoachContext() {
  const today = todayKey();
  const from = shiftKey(today, -27);
  const prevFrom = shiftKey(today, -55);
  const [profile, templates, schedule, sessions, sets, exercises, weights, measurements, foodLogs, wearable] = await Promise.all([
    db.profile.get('me'),
    db.templates.filter((t) => !t.archived).toArray().then((l) => l.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))),
    db.weekSchedule.toArray(),
    db.workoutSessions.where('date').aboveOrEqual(prevFrom).toArray(),
    db.sets.where('date').aboveOrEqual(prevFrom).filter((s) => s.completed).toArray(),
    db.exercises.toArray(),
    db.bodyWeights.orderBy('date').toArray(),
    db.measurements.orderBy('date').toArray(),
    db.foodLogs.where('date').aboveOrEqual(from).toArray(),
    db.wearableDays.where('date').aboveOrEqual(shiftKey(today, -13)).toArray(),
  ]);
  const u = profile?.units ?? 'imperial';
  const W = (lb: number | null | undefined) => r1(toDispW(lb ?? null, u));
  const exName = new Map(exercises.map((e) => [e.id, e.name]));
  const exType = new Map(exercises.map((e) => [e.id, e.type]));

  const routine = templates.map((t) => ({
    template: t.name,
    days: schedule.filter((s) => s.templateId === t.id).map((s) => WEEKDAYS_SHORT[s.weekday]),
    exercises: t.exercises.map((e) => ({
      name: exName.get(e.exerciseId) ?? '?',
      sets: e.targetSets,
      reps: e.targetRepsMin === e.targetRepsMax ? `${e.targetRepsMin}` : `${e.targetRepsMin}-${e.targetRepsMax}`,
      targetWeight: W(e.targetWeight),
    })),
  }));

  const recentSessions = sessions.filter((s) => s.date >= from);
  const recentSets = sets.filter((s) => (s.date ?? '') >= from);
  const trained = trainedDates(recentSessions, recentSets);
  const isSched = (wd: number) => !!schedule.find((s) => s.weekday === wd)?.templateId;
  const adh = adherence(trained, isSched, from, shiftKey(today, -1));
  const missed: string[] = [];
  for (let k = from; k < today; k = shiftKey(k, 1)) if (isSched(weekdayOf(k)) && !trained.has(k)) missed.push(k);

  const byEx = new Map<string, typeof sets>();
  for (const s of sets) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s]);
  const perExercise = [...byEx.entries()]
    .filter(([, list]) => list.some((s) => (s.date ?? '') >= from))
    .map(([id, list]) => {
      const t = exType.get(id);
      const prog = exerciseProgress(list.filter((s) => (s.date ?? '') >= from));
      const recentVol = totalVolume(list.filter((s) => (s.date ?? '') >= from));
      const prevVol = totalVolume(list.filter((s) => (s.date ?? '') < from));
      const last = prog[prog.length - 1];
      const lastSets = list.filter((s) => s.date === last?.date).sort((a, b) => a.order - b.order);
      return {
        exercise: exName.get(id) ?? '?',
        sessions: prog.length,
        ...(t === 'weight_reps' || t === 'bodyweight_reps'
          ? {
              lastSession: last ? `${last.date}: ${lastSets.map((s) => `${W(s.weight)}x${s.reps}`).join(', ')}` : null,
              e1rmFirstToLast: prog.length ? [W(prog[0]!.e1rm), W(last!.e1rm)] : null,
              volumeChangeVsPrev4wPct: prevVol ? Math.round(((recentVol - prevVol) / prevVol) * 100) : null,
            }
          : { lastSession: last?.date ?? null }),
      };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20);

  const prs = recentSets
    .filter((s) => s.isPR)
    .map((s) => ({ date: s.date, exercise: exName.get(s.exerciseId), set: `${W(s.weight)}x${s.reps}`, e1rm: W(e1rm(s.weight ?? 0, s.reps ?? 0)) }))
    .slice(-15);

  const ma = movingAverage(weights.map((w) => ({ date: w.date, value: w.weight })), 7);
  const trendAt = (k: string) => [...ma].reverse().find((p) => p.date <= k)?.value ?? null;
  const rate = weeklyRate(weights.filter((w) => w.date >= from).map((w) => ({ date: w.date, value: w.weight })));
  const lastM = measurements[measurements.length - 1];
  const oldM = [...measurements].reverse().find((m) => m.date <= shiftKey(today, -28));
  const mPick = (m?: (typeof measurements)[number]) =>
    m ? { date: m.date, ...Object.fromEntries(MEASUREMENT_KEYS.filter((k) => m[k] != null).map((k) => [k, k === 'bodyFat' ? m[k] : r1(toDispL(m[k], u))])) } : null;

  const days = new Map<string, { c: number; p: number }>();
  for (const l of foodLogs) {
    const d = days.get(l.date) ?? { c: 0, p: 0 };
    d.c += l.calories;
    d.p += l.protein;
    days.set(l.date, d);
  }
  const dl = [...days.values()];
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);

  return {
    today,
    units: { weight: wUnit(u), length: lUnit(u) },
    profile: profile && {
      name: profile.name, sex: profile.sex, age: new Date().getFullYear() - profile.birthYear, heightIn: r1(profile.heightIn), goal: profile.goal,
      activity: profile.activityLevel, goalWeight: W(profile.goalWeight),
      targets: { calories: profile.calorieTarget, proteinG: profile.proteinG, carbsG: profile.carbsG, fatG: profile.fatG },
    },
    routine,
    training_last_4_weeks: {
      sessionsTrained: trained.size, scheduledDays: adh.scheduled, adherencePct: Math.round(adh.pct), missedScheduledDays: missed.slice(-10),
      perExercise,
    },
    prs_last_4_weeks: prs,
    body: {
      currentWeight: W(weights[weights.length - 1]?.weight),
      trend7dAvg: { now: W(trendAt(today)), weekAgo: W(trendAt(shiftKey(today, -7))), fourWeeksAgo: W(trendAt(shiftKey(today, -28))) },
      ratePerWeek: W(rate),
      weighInsLast4w: weights.filter((w) => w.date >= from).length,
      latestMeasurements: mPick(lastM),
      measurements4wAgo: mPick(oldM),
    },
    wearable_fitbit_last_14_days: wearable.length
      ? wearable
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((w) => ({ date: w.date, steps: w.steps, kcalBurned: w.caloriesOut, restingHr: w.restingHr, hrvMs: w.hrvMs, sleepMin: w.sleepMin }))
      : 'not connected',
    nutrition_last_4_weeks: {
      daysLogged: dl.length, avgCalories: avg(dl.map((d) => d.c)), avgProteinG: avg(dl.map((d) => d.p)),
      daysProteinTargetHit: profile ? dl.filter((d) => d.p >= profile.proteinG * 0.95).length : null,
    },
  };
}

export const COACH_SYSTEM = `You are Forge Coach, an evidence-based strength and nutrition coach inside a personal fitness app.
Rules:
- Use ONLY the user's data provided in the JSON context below. Do not invent numbers. If the data is insufficient to answer, say so and say exactly what to log.
- Be concise and specific: use concrete numbers, exercises, weights (in the user's units), sets and reps. Prefer short bullet points.
- Apply established principles: progressive overload (add weight when the top of the rep range is hit for all sets), ~10-20 hard sets per muscle per week, 0.7-1 g protein per lb bodyweight, fat-loss ~0.5-1% bodyweight/week, lean gain ~0.25-0.5%/week, deload every 4-8 weeks or when performance stalls.
- If Fitbit data is present, use sleep, resting heart rate and HRV trends to judge recovery (e.g. suggest lighter training after poor sleep or a rising resting HR), and use kcal burned vs. eaten for energy balance.
- Never give medical advice or diagnose. If the user mentions pain, injury or a medical condition, recommend seeing a qualified professional (doctor or physiotherapist).
- Format "reply" in Markdown.
- When you recommend changing a target weight or rep range for an exercise that exists in the user's routine, ALSO add an entry to "suggestions" with the exact template and exercise names from the routine, using the user's weight unit. Otherwise leave "suggestions" empty.`;

export const COACH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'Markdown answer' },
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          templateName: { type: 'STRING' },
          exerciseName: { type: 'STRING' },
          newTargetWeight: { type: 'NUMBER', nullable: true },
          newTargetRepsMin: { type: 'INTEGER', nullable: true },
          newTargetRepsMax: { type: 'INTEGER', nullable: true },
          reason: { type: 'STRING' },
        },
        required: ['templateName', 'exerciseName', 'reason'],
      },
    },
  },
  required: ['reply', 'suggestions'],
};

export const RECAP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    wins: { type: 'ARRAY', items: { type: 'STRING' } },
    slipped: { type: 'ARRAY', items: { type: 'STRING' } },
    actions: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Exactly 3 specific actions for next week' },
    suggestions: COACH_SCHEMA.properties.suggestions,
  },
  required: ['headline', 'wins', 'slipped', 'actions'],
};
