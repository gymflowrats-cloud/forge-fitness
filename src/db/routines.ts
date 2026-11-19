import { db } from './db';
import { uid } from '../lib/id';
import type { Template, TemplateExercise } from './types';

export const TEMPLATE_COLORS = ['#36493B', '#9B4234', '#3F6B4A', '#D08A2E', '#4A5D7A', '#7A4A6B', '#5E6B3A'];

let lastCreated = 0;
const monotonicNow = () => new Date((lastCreated = Math.max(Date.now(), lastCreated + 1))).toISOString();

export async function createTemplate(name: string): Promise<string> {
  const count = await db.templates.count();
  const id = uid();
  await db.templates.add({
    id, name, color: TEMPLATE_COLORS[count % TEMPLATE_COLORS.length]!, exercises: [], archived: false, createdAt: monotonicNow(),
  });
  return id;
}

export async function duplicateTemplate(id: string): Promise<string | null> {
  const t = await db.templates.get(id);
  if (!t) return null;
  const nid = uid();
  await db.templates.add({ ...t, id: nid, name: `${t.name} (copy)`, exercises: t.exercises.map((e) => ({ ...e })), createdAt: monotonicNow() });
  return nid;
}

/** Archive (soft delete) so past sessions keep their snapshot name; also unmap from weekdays. */
export async function archiveTemplate(id: string) {
  await db.transaction('rw', db.templates, db.weekSchedule, async () => {
    await db.templates.update(id, { archived: true });
    const rows = await db.weekSchedule.where('weekday').between(0, 6, true, true).toArray();
    for (const r of rows) if (r.templateId === id) await db.weekSchedule.put({ weekday: r.weekday, templateId: null });
  });
}

export async function saveTemplateExercises(id: string, exercises: TemplateExercise[]) {
  await db.templates.update(id, { exercises: exercises.map((e, i) => ({ ...e, order: i })) });
}

export function newTemplateExercise(exerciseId: string, restSec = 90, type?: string): TemplateExercise {
  const isTime = type === 'time' || type === 'cardio';
  return {
    exerciseId, order: 0, targetSets: isTime ? 1 : 3, targetRepsMin: isTime ? 0 : 8, targetRepsMax: isTime ? 0 : 12, targetWeight: null, restSec,
  };
}

export async function addExerciseToTemplate(templateId: string, exerciseId: string, restSec = 90) {
  const t = await db.templates.get(templateId);
  if (!t) return;
  if (t.exercises.some((e) => e.exerciseId === exerciseId)) return;
  const ex = await db.exercises.get(exerciseId);
  await saveTemplateExercises(templateId, [...t.exercises, newTemplateExercise(exerciseId, restSec, ex?.type)]);
}

export async function setWeekday(weekday: number, templateId: string | null) {
  await db.weekSchedule.put({ weekday, templateId });
}

/** Starter Push/Pull/Legs routine so the app is useful in 1 tap. */
export async function createStarterRoutine() {
  const mk = (exerciseId: string, sets: number, min: number, max: number, rest: number): TemplateExercise => ({
    exerciseId, order: 0, targetSets: sets, targetRepsMin: min, targetRepsMax: max, targetWeight: null, restSec: rest,
  });
  const defs: { name: string; ex: TemplateExercise[] }[] = [
    { name: 'Push', ex: [mk('ex-barbell-bench-press', 4, 6, 8, 150), mk('ex-overhead-press', 3, 6, 10, 120), mk('ex-incline-dumbbell-press', 3, 8, 12, 90), mk('ex-lateral-raise', 3, 12, 15, 60), mk('ex-rope-pushdown', 3, 10, 12, 60)] },
    { name: 'Pull', ex: [mk('ex-deadlift', 3, 5, 5, 180), mk('ex-pull-up', 3, 6, 10, 120), mk('ex-barbell-row', 3, 8, 10, 90), mk('ex-face-pull', 3, 12, 15, 60), mk('ex-dumbbell-curl', 3, 10, 12, 60)] },
    { name: 'Legs', ex: [mk('ex-back-squat', 4, 5, 8, 180), mk('ex-romanian-deadlift', 3, 8, 10, 120), mk('ex-leg-press', 3, 10, 12, 90), mk('ex-lying-leg-curl', 3, 10, 12, 60), mk('ex-standing-calf-raise', 4, 10, 15, 60), mk('ex-plank', 3, 0, 0, 45)] },
  ];
  const ids: string[] = [];
  for (const d of defs) {
    const id = await createTemplate(d.name);
    await saveTemplateExercises(id, d.ex);
    ids.push(id);
  }
  // Mon Push, Tue Pull, Wed Legs, Thu Rest, Fri Push, Sat Pull, Sun Rest
  const map: (number | null)[] = [null, 0, 1, 2, null, 0, 1];
  for (let wd = 0; wd < 7; wd++) await setWeekday(wd, map[wd] == null ? null : ids[map[wd]!]!);
  return ids;
}

export type { Template };
