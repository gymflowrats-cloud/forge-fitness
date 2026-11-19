import { db } from './db';
import { uid } from '../lib/id';
import { detectPR, e1rm, totalVolume } from '../lib/calc';
import { weekdayOf } from '../lib/dates';
import { addExerciseToTemplate } from './routines';
import type { SessionExercise, SetType, TemplateExercise, WorkoutSession, WorkoutSet } from './types';

const TABLES = [db.workoutSessions, db.sessionExercises, db.sets, db.templates, db.exercises, db.weekSchedule];

export async function getSessionForDate(date: string): Promise<WorkoutSession | undefined> {
  const list = await db.workoutSessions.where('date').equals(date).toArray();
  return list.sort((a, b) => (a.status === 'in_progress' ? -1 : 1) - (b.status === 'in_progress' ? -1 : 1))[0];
}

/** Completed sets of the most recent earlier session that included this exercise. */
export async function lastPerformance(exerciseId: string, beforeDate: string, excludeSessionId?: string): Promise<WorkoutSet[]> {
  const all = await db.sets.where('exerciseId').equals(exerciseId).filter((s) => s.completed && s.sessionId !== excludeSessionId && (s.date ?? '') <= beforeDate).toArray();
  if (!all.length) return [];
  const byS = new Map<string, WorkoutSet[]>();
  for (const s of all) byS.set(s.sessionId, [...(byS.get(s.sessionId) ?? []), s]);
  let best: WorkoutSet[] = [];
  let bestKey = '';
  for (const sets of byS.values()) {
    const key = (sets[0]!.date ?? '') + (sets.map((s) => s.completedAt ?? '').sort().pop() ?? '');
    if (key > bestKey) {
      bestKey = key;
      best = sets;
    }
  }
  return best.sort((a, b) => a.order - b.order);
}

function prefill(te: Pick<TemplateExercise, 'targetSets' | 'targetRepsMin' | 'targetWeight'>, last: WorkoutSet[], base: Omit<WorkoutSet, 'id' | 'order' | 'weight' | 'reps' | 'durationSec' | 'distance' | 'setType'>): WorkoutSet[] {
  const working = last.filter((s) => s.setType !== 'warmup');
  const n = Math.max(1, te.targetSets || working.length || 3);
  return Array.from({ length: n }, (_, i) => {
    const ref = working[i] ?? working[working.length - 1];
    return {
      ...base,
      id: uid(),
      order: i,
      setType: 'working' as SetType,
      weight: ref?.weight ?? te.targetWeight ?? null,
      reps: ref?.reps ?? (te.targetRepsMin || null),
      durationSec: ref?.durationSec ?? null,
      distance: ref?.distance ?? null,
      calories: ref?.calories ?? null,
    };
  });
}

async function addSessionExercise(session: WorkoutSession, te: TemplateExercise, order: number, isExtra: boolean) {
  const seId = uid();
  const se: SessionExercise = {
    id: seId, sessionId: session.id, exerciseId: te.exerciseId, order, isExtra, note: '',
    restSec: te.restSec, targetRepsMin: te.targetRepsMin, targetRepsMax: te.targetRepsMax,
  };
  // Carry over last note for this exercise (e.g. "seat height 4")
  const prevSe = (await db.sessionExercises.where('exerciseId').equals(te.exerciseId).toArray()).filter((x) => x.note && x.sessionId !== session.id).pop();
  if (prevSe) se.note = prevSe.note;
  await db.sessionExercises.add(se);
  const last = await lastPerformance(te.exerciseId, session.date, session.id);
  const sets = prefill(te, last, {
    sessionExerciseId: seId, sessionId: session.id, exerciseId: te.exerciseId, completed: false, completedAt: null, isPR: false, date: session.date,
  });
  await db.sets.bulkAdd(sets);
}

export async function createSession(date: string, templateId: string | null): Promise<string> {
  return db.transaction('rw', TABLES, async () => {
    const t = templateId ? await db.templates.get(templateId) : undefined;
    const session: WorkoutSession = {
      id: uid(), date, templateId: t?.id ?? null, templateNameSnapshot: t?.name ?? 'Workout',
      startedAt: null, endedAt: null, status: 'in_progress', rating: null, note: '',
    };
    await db.workoutSessions.add(session);
    let i = 0;
    for (const te of [...(t?.exercises ?? [])].sort((a, b) => a.order - b.order)) await addSessionExercise(session, te, i++, false);
    return session.id;
  });
}

const inflight = new Map<string, Promise<string | null>>();
/** For today only: auto-create the session for the weekday's scheduled template (idempotent). */
export function ensureScheduledSession(date: string): Promise<string | null> {
  if (inflight.has(date)) return inflight.get(date)!;
  const p = (async () => {
    const existing = await getSessionForDate(date);
    if (existing) return existing.id;
    const sched = await db.weekSchedule.get(weekdayOf(date));
    if (!sched?.templateId) return null;
    const t = await db.templates.get(sched.templateId);
    if (!t || t.archived) return null;
    return createSession(date, t.id);
  })().finally(() => setTimeout(() => inflight.delete(date), 500));
  inflight.set(date, p);
  return p;
}

export async function sessionHasCompletedSets(sessionId: string) {
  return (await db.sets.where('sessionId').equals(sessionId).filter((s) => s.completed).count()) > 0;
}

/** Switch a session to another template. keep=true keeps exercises that already have completed sets. */
export async function switchTemplate(sessionId: string, templateId: string | null, keep: boolean) {
  await db.transaction('rw', TABLES, async () => {
    const session = await db.workoutSessions.get(sessionId);
    if (!session) return;
    const t = templateId ? await db.templates.get(templateId) : undefined;
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    const keptIds = new Set<string>();
    for (const se of ses) {
      const done = sets.some((s) => s.sessionExerciseId === se.id && s.completed);
      if (keep && done) {
        keptIds.add(se.exerciseId);
        await db.sets.bulkDelete(sets.filter((s) => s.sessionExerciseId === se.id && !s.completed).map((s) => s.id));
      } else {
        await db.sets.bulkDelete(sets.filter((s) => s.sessionExerciseId === se.id).map((s) => s.id));
        await db.sessionExercises.delete(se.id);
      }
    }
    const updated: WorkoutSession = { ...session, templateId: t?.id ?? null, templateNameSnapshot: t?.name ?? 'Workout' };
    if (!keep) updated.startedAt = null;
    await db.workoutSessions.put(updated);
    let order = keptIds.size;
    let i = 0;
    for (const se of (await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order'))) await db.sessionExercises.update(se.id, { order: i++ });
    for (const te of [...(t?.exercises ?? [])].sort((a, b) => a.order - b.order)) {
      if (keptIds.has(te.exerciseId)) continue;
      await addSessionExercise(updated, te, order++, false);
    }
  });
}

export async function deleteSession(sessionId: string) {
  await db.transaction('rw', db.workoutSessions, db.sessionExercises, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessionExercises.where('sessionId').equals(sessionId).delete();
    await db.workoutSessions.delete(sessionId);
  });
}

export async function addExtraExercise(sessionId: string, exerciseId: string, alsoTemplate: boolean, restSec = 90) {
  const session = await db.workoutSessions.get(sessionId);
  if (!session) return;
  const ex = await db.exercises.get(exerciseId);
  const isTime = ex?.type === 'time' || ex?.type === 'cardio';
  const count = await db.sessionExercises.where('sessionId').equals(sessionId).count();
  let te: TemplateExercise = { exerciseId, order: count, targetSets: isTime ? 1 : 3, targetRepsMin: isTime ? 0 : 8, targetRepsMax: isTime ? 0 : 12, targetWeight: null, restSec };
  if (alsoTemplate && session.templateId) {
    await addExerciseToTemplate(session.templateId, exerciseId, restSec);
    const t = await db.templates.get(session.templateId);
    te = t?.exercises.find((e) => e.exerciseId === exerciseId) ?? te;
  }
  await db.transaction('rw', TABLES, () => addSessionExercise(session, te, count, !alsoTemplate || !session.templateId));
}

export async function removeSessionExercise(seId: string) {
  await db.transaction('rw', db.sessionExercises, db.sets, async () => {
    await db.sets.where('sessionExerciseId').equals(seId).delete();
    await db.sessionExercises.delete(seId);
  });
}

export async function moveSessionExercise(sessionId: string, seId: string, dir: -1 | 1) {
  const list = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
  const i = list.findIndex((x) => x.id === seId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j]!, list[i]!];
  await db.transaction('rw', db.sessionExercises, async () => {
    for (let k = 0; k < list.length; k++) await db.sessionExercises.update(list[k]!.id, { order: k });
  });
}

export async function addSet(seId: string) {
  const sets = await db.sets.where('sessionExerciseId').equals(seId).sortBy('order');
  const se = await db.sessionExercises.get(seId);
  if (!se) return;
  const session = await db.workoutSessions.get(se.sessionId);
  const prev = sets[sets.length - 1];
  await db.sets.add({
    id: uid(), sessionExerciseId: seId, sessionId: se.sessionId, exerciseId: se.exerciseId, order: (prev?.order ?? -1) + 1,
    setType: prev?.setType === 'warmup' ? 'working' : prev?.setType ?? 'working', weight: prev?.weight ?? null, reps: prev?.reps ?? null,
    durationSec: prev?.durationSec ?? null, distance: prev?.distance ?? null, calories: prev?.calories ?? null,
    completed: false, completedAt: null, isPR: false, date: session?.date,
  });
}

export async function updateSet(id: string, patch: Partial<WorkoutSet>) {
  await db.sets.update(id, patch);
  const s = await db.sets.get(id);
  if (s?.completed && ('weight' in patch || 'reps' in patch)) await recomputePR(id);
}

/** PR check vs. all earlier history (earlier days + earlier sets in this session). */
export async function recomputePR(setId: string): Promise<boolean> {
  const s = await db.sets.get(setId);
  if (!s) return false;
  const ex = await db.exercises.get(s.exerciseId);
  if (!ex || (ex.type !== 'weight_reps' && ex.type !== 'bodyweight_reps') || !s.completed) {
    if (s.isPR) await db.sets.update(setId, { isPR: false });
    return false;
  }
  const date = s.date ?? '';
  const history = await db.sets
    .where('exerciseId')
    .equals(s.exerciseId)
    .filter((h) => h.id !== s.id && h.completed && ((h.date ?? '') < date || (h.sessionId === s.sessionId && h.order < s.order && h.sessionExerciseId === s.sessionExerciseId)))
    .toArray();
  const r = detectPR(history, s);
  if (r.isPR !== s.isPR) await db.sets.update(setId, { isPR: r.isPR });
  return r.isPR;
}

export async function toggleSetComplete(id: string, completed: boolean): Promise<{ isPR: boolean }> {
  const s = await db.sets.get(id);
  if (!s) return { isPR: false };
  await db.sets.update(id, { completed, completedAt: completed ? new Date().toISOString() : null, isPR: false });
  if (completed) {
    const session = await db.workoutSessions.get(s.sessionId);
    if (session && !session.startedAt) await db.workoutSessions.update(session.id, { startedAt: new Date().toISOString() });
    // Carry this set's values into later, still-empty sets of the same exercise
    const later = await db.sets.where('sessionExerciseId').equals(s.sessionExerciseId).filter((x) => x.order > s.order && !x.completed).toArray();
    for (const x of later) {
      const patch: Partial<WorkoutSet> = {};
      if (x.weight == null && s.weight != null) patch.weight = s.weight;
      if (x.reps == null && s.reps != null) patch.reps = s.reps;
      if (x.durationSec == null && s.durationSec != null) patch.durationSec = s.durationSec;
      if (Object.keys(patch).length) await db.sets.update(x.id, patch);
    }
    return { isPR: await recomputePR(id) };
  }
  return { isPR: false };
}

export async function deleteSet(id: string) {
  await db.sets.delete(id);
}

export async function finishSession(sessionId: string, rating: number | null, note: string) {
  const s = await db.workoutSessions.get(sessionId);
  if (!s) return;
  await db.workoutSessions.update(sessionId, {
    status: 'done', rating, note, endedAt: s.endedAt ?? new Date().toISOString(), startedAt: s.startedAt ?? new Date().toISOString(),
  });
}

export interface SessionSummary {
  durationSec: number;
  volume: number;
  setsDone: number;
  prs: number;
  prevVolume: number | null;
  prevDate: string | null;
}

export async function summarizeSession(sessionId: string): Promise<SessionSummary> {
  const s = await db.workoutSessions.get(sessionId);
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  const end = s?.endedAt ? Date.parse(s.endedAt) : Date.now();
  const durationSec = s?.startedAt ? Math.round((end - Date.parse(s.startedAt)) / 1000) : 0;
  let prevVolume: number | null = null;
  let prevDate: string | null = null;
  if (s?.templateId) {
    const prev = (await db.workoutSessions.where('templateId').equals(s.templateId).filter((x) => x.id !== s.id && x.date < s.date).toArray())
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prev) {
      prevVolume = totalVolume(await db.sets.where('sessionId').equals(prev.id).toArray());
      prevDate = prev.date;
    }
  }
  return {
    durationSec,
    volume: totalVolume(sets),
    setsDone: sets.filter((x) => x.completed).length,
    prs: sets.filter((x) => x.isPR).length,
    prevVolume,
    prevDate,
  };
}

export const bestSetLabel = (sets: WorkoutSet[]) => {
  const best = [...sets].sort((a, b) => e1rm(b.weight || 0, b.reps || 0) - e1rm(a.weight || 0, a.reps || 0))[0];
  return best;
};
