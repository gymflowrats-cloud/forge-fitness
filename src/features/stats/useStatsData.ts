import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { BodyWeight, Exercise, FoodLog, Measurement, Template, WeekSchedule, WorkoutSession, WorkoutSet } from '../../db/types';
import { todayKey } from '../../lib/dates';
import { addDays } from '../../lib/stats';

export type Range = '4W' | '12W' | '6M' | '1Y' | 'All';
export const RANGES: Range[] = ['4W', '12W', '6M', '1Y', 'All'];
const RANGE_DAYS: Record<Range, number> = { '4W': 28, '12W': 84, '6M': 182, '1Y': 365, All: 3650 };

export interface StatsData {
  from: string;
  to: string;
  prevFrom: string;
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
  exercises: Map<string, Exercise>;
  schedule: WeekSchedule[];
  templates: Template[];
  weights: BodyWeight[];
  measurements: Measurement[];
  foodLogs: FoodLog[];
}

export function useStatsData(range: Range): StatsData | undefined {
  return useLiveQuery(async () => {
    const to = todayKey();
    const [sessions, sets, exList, schedule, templates, weights, measurements, foodLogs] = await Promise.all([
      db.workoutSessions.toArray(),
      db.sets.filter((s) => s.completed).toArray(),
      db.exercises.toArray(),
      db.weekSchedule.toArray(),
      db.templates.toArray(),
      db.bodyWeights.orderBy('date').toArray(),
      db.measurements.orderBy('date').toArray(),
      db.foodLogs.toArray(),
    ]);
    let days = RANGE_DAYS[range];
    if (range === 'All') {
      const first = [sessions.map((s) => s.date), weights.map((w) => w.date), foodLogs.map((f) => f.date)].flat().sort()[0];
      days = first ? Math.max(28, Math.round((Date.parse(to) - Date.parse(first)) / 86400000) + 1) : 28;
    }
    const from = addDays(to, -(days - 1));
    return {
      from, to, prevFrom: addDays(from, -days), sessions, sets, exercises: new Map(exList.map((e) => [e.id, e])), schedule, templates, weights, measurements, foodLogs,
    };
  }, [range]);
}
