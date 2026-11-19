// Pure aggregation helpers for the Stats screen (unit-tested).
import { e1rm, setVolume } from './calc';

export interface SessionLite { id: string; date: string; templateId: string | null }
export interface SetLite { sessionId: string; exerciseId: string; weight: number | null; reps: number | null; completed: boolean; setType: string; isPR: boolean; date?: string; completedAt?: string | null }

const DAY = 86400000;
const dayNum = (k: string) => Math.floor(Date.parse(k + 'T00:00:00Z') / DAY);
const fromNum = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (k: string, n: number) => fromNum(dayNum(k) + n);
export const mondayOf = (k: string) => addDays(k, -((new Date(k + 'T00:00:00Z').getUTCDay() + 6) % 7));

export function weeksBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let w = mondayOf(from); w <= to; w = addDays(w, 7)) out.push(w);
  return out;
}

/** Dates (YYYY-MM-DD) with at least one completed set. */
export function trainedDates(sessions: SessionLite[], sets: SetLite[]): Set<string> {
  const done = new Set(sets.filter((s) => s.completed).map((s) => s.sessionId));
  return new Set(sessions.filter((s) => done.has(s.id)).map((s) => s.date));
}

export function volumeBySession(sets: SetLite[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sets) if (s.completed && s.setType !== 'warmup') m.set(s.sessionId, (m.get(s.sessionId) ?? 0) + setVolume(s));
  return m;
}

export function volumeByDate(sessions: SessionLite[], sets: SetLite[]): Map<string, number> {
  const bySession = volumeBySession(sets);
  const m = new Map<string, number>();
  for (const s of sessions) if (bySession.has(s.id)) m.set(s.date, (m.get(s.date) ?? 0) + bySession.get(s.id)!);
  return m;
}

export function perWeek(dates: Iterable<string>, weeks: string[], value: (d: string) => number = () => 1) {
  const m = new Map(weeks.map((w) => [w, 0]));
  for (const d of dates) {
    const w = mondayOf(d);
    if (m.has(w)) m.set(w, m.get(w)! + value(d));
  }
  return weeks.map((w) => ({ week: w, value: m.get(w)! }));
}

export interface ProgressPoint { date: string; best: number; e1rm: number; reps: number }

/** Per session date: heaviest working set and best estimated 1RM. */
export function exerciseProgress(sets: SetLite[]): ProgressPoint[] {
  const m = new Map<string, ProgressPoint>();
  for (const s of sets) {
    if (!s.completed || s.setType === 'warmup' || !s.date || !(s.reps && s.reps > 0)) continue;
    const p = m.get(s.date) ?? { date: s.date, best: 0, e1rm: 0, reps: 0 };
    const w = s.weight ?? 0;
    if (w > p.best || (w === p.best && (s.reps ?? 0) > p.reps)) {
      p.best = w;
      p.reps = s.reps ?? 0;
    }
    p.e1rm = Math.max(p.e1rm, e1rm(w, s.reps ?? 0));
    m.set(s.date, p);
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Working sets per muscle: primary = 1, each secondary = 0.5. */
export function setsPerMuscle(sets: SetLite[], muscles: Map<string, { primary: string; secondary: string[] }>) {
  const out: Record<string, number> = {};
  for (const s of sets) {
    if (!s.completed || s.setType === 'warmup') continue;
    const m = muscles.get(s.exerciseId);
    if (!m) continue;
    out[m.primary] = (out[m.primary] ?? 0) + 1;
    for (const sec of m.secondary) out[sec] = (out[sec] ?? 0) + 0.5;
  }
  return out;
}

export function average(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/** Percent change of the first half vs. the last value window — used for "up 6% in 4 weeks" insights. */
export function changeOver(points: { date: string; value: number }[], days: number, today: string) {
  const recent = points.filter((p) => p.date > addDays(today, -days));
  const before = points.filter((p) => p.date <= addDays(today, -days));
  if (!recent.length || !before.length) return null;
  const a = before[before.length - 1]!.value;
  const b = Math.max(...recent.map((p) => p.value));
  return a ? ((b - a) / a) * 100 : null;
}
