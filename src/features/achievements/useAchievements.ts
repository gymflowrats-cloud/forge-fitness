import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { computeAchievements, type Achievement } from '../../lib/achievements';
import { todayKey } from '../../lib/dates';

export async function loadAchievements(): Promise<Achievement[]> {
  const [sessions, sets, exercises, weights, foodLogs, profile] = await Promise.all([
    db.workoutSessions.toArray(),
    db.sets.filter((s) => s.completed).toArray(),
    db.exercises.toArray(),
    db.bodyWeights.toArray(),
    db.foodLogs.toArray(),
    db.profile.get('me'),
  ]);
  return computeAchievements({
    sessions,
    sets,
    exerciseNames: new Map(exercises.map((e) => [e.id, e.name])),
    weightDates: weights.map((w) => w.date),
    foodDates: [...new Set(foodLogs.map((f) => f.date))],
    weights,
    goalWeight: profile?.goalWeight ?? null,
    startWeight: profile?.startWeight ?? null,
    metric: profile?.units === 'metric',
    today: todayKey(),
  });
}

export function useAchievements() {
  return useLiveQuery(loadAchievements, []);
}
