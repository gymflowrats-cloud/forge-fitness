import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { initDb } from './init';
import { createStarterRoutine } from './routines';
import { addExtraExercise, createSession, lastPerformance, switchTemplate, toggleSetComplete, updateSet } from './workouts';
import { exportJSON, importBackup, inspectBackup } from '../services/backup';
import { buildCoachContext } from '../services/coachContext';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await initDb();
});

async function logSession(date: string, templateId: string, weight: number, reps: number) {
  const sid = await createSession(date, templateId);
  const sets = await db.sets.where('sessionId').equals(sid).sortBy('order');
  for (const s of sets) {
    await updateSet(s.id, { weight, reps });
    await toggleSetComplete(s.id, true);
  }
  return sid;
}

describe('workout flow', () => {
  it('seeds the library and creates sessions from templates', async () => {
    expect(await db.exercises.count()).toBeGreaterThan(80);
    const [push] = await createStarterRoutine();
    const sid = await createSession('2026-11-16', push!);
    expect(await db.sessionExercises.where('sessionId').equals(sid).count()).toBe(5);
    const bench = await db.sets.where({ sessionId: sid, exerciseId: 'ex-barbell-bench-press' }).count();
    expect(bench).toBe(4);
  });

  it('prefills from last time and detects PRs', async () => {
    const [push] = await createStarterRoutine();
    await logSession('2026-11-09', push!, 135, 8);
    const last = await lastPerformance('ex-barbell-bench-press', '2026-11-16');
    expect(last).toHaveLength(4);
    const sid = await createSession('2026-11-16', push!);
    const sets = await db.sets.where({ sessionId: sid, exerciseId: 'ex-barbell-bench-press' }).sortBy('order');
    expect(sets[0]!.weight).toBe(135);
    expect(sets[0]!.reps).toBe(8);
    await updateSet(sets[0]!.id, { weight: 140 });
    const r = await toggleSetComplete(sets[0]!.id, true);
    expect(r.isPR).toBe(true);
    // Same weight & reps as an earlier set is not a PR
    await updateSet(sets[1]!.id, { weight: 135, reps: 8 });
    expect((await toggleSetComplete(sets[1]!.id, true)).isPR).toBe(false);
  });

  it('editing a template does not change logged sessions', async () => {
    const [push] = await createStarterRoutine();
    const sid = await logSession('2026-11-09', push!, 100, 10);
    await db.templates.update(push!, { name: 'Push v2', exercises: [] });
    const s = await db.workoutSessions.get(sid);
    expect(s!.templateNameSnapshot).toBe('Push');
    expect(await db.sets.where('sessionId').equals(sid).count()).toBeGreaterThan(0);
  });

  it('switching templates can keep completed sets', async () => {
    const [push, pull] = await createStarterRoutine();
    const sid = await createSession('2026-11-16', push!);
    const first = (await db.sets.where({ sessionId: sid, exerciseId: 'ex-barbell-bench-press' }).sortBy('order'))[0]!;
    await updateSet(first.id, { weight: 100, reps: 5 });
    await toggleSetComplete(first.id, true);
    await switchTemplate(sid, pull!, true);
    const ses = await db.sessionExercises.where('sessionId').equals(sid).toArray();
    expect(ses.some((x) => x.exerciseId === 'ex-barbell-bench-press')).toBe(true);
    expect(ses.some((x) => x.exerciseId === 'ex-deadlift')).toBe(true);
    expect(await db.sets.where({ sessionId: sid, exerciseId: 'ex-barbell-bench-press' }).count()).toBe(1);
    expect((await db.workoutSessions.get(sid))!.templateNameSnapshot).toBe('Pull');
  });

  it('extra exercise can also be added to the template', async () => {
    const [push] = await createStarterRoutine();
    const sid = await createSession('2026-11-16', push!);
    await addExtraExercise(sid, 'ex-cable-crossover', true);
    const t = await db.templates.get(push!);
    expect(t!.exercises.some((e) => e.exerciseId === 'ex-cable-crossover')).toBe(true);
  });
});

describe('backup', () => {
  it('round-trips and never exports the API key', async () => {
    const [push] = await createStarterRoutine();
    await logSession('2026-11-09', push!, 135, 8);
    await db.settings.put({ key: 'geminiKey', value: 'SECRET' });
    const text = await (await exportJSON()).text();
    expect(text).not.toContain('SECRET');
    const r = inspectBackup(text);
    expect(r.ok).toBe(true);
    const before = await db.sets.count();
    await db.sets.clear();
    if (r.ok) await importBackup(r.parsed, 'replace');
    expect(await db.sets.count()).toBe(before);
    expect((await db.settings.get('geminiKey'))?.value).toBe('SECRET');
  });
});

describe('coach context', () => {
  it('summarises routine and training compactly', async () => {
    await db.profile.put({ id: 'me', name: 'T', sex: 'male', birthYear: 1995, heightIn: 70, units: 'imperial', goal: 'lose', activityLevel: 'moderate', calorieTarget: 2200, proteinG: 170, carbsG: 200, fatG: 70, goalWeight: 175, startWeight: 185, checkInDay: 0, createdAt: new Date().toISOString() });
    const [push] = await createStarterRoutine();
    const { todayKey, shiftKey } = await import('../lib/dates');
    await logSession(shiftKey(todayKey(), -3), push!, 135, 8);
    const ctx = await buildCoachContext();
    expect(ctx.routine.map((r) => r.template)).toEqual(['Push', 'Pull', 'Legs']);
    expect(ctx.training_last_4_weeks.sessionsTrained).toBe(1);
    expect(ctx.training_last_4_weeks.perExercise.find((e) => e.exercise === 'Barbell Bench Press')?.lastSession).toContain('135x8');
    expect(JSON.stringify(ctx).length).toBeLessThan(8000);
  });
});
