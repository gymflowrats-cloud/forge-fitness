import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

describe('schema migration v1 → v2', () => {
  it('keeps existing data when the wearableDays table is added', async () => {
    // Simulate a phone still on the v1 schema with data in it
    const old = new Dexie('forge');
    old.version(1).stores({
      profile: 'id', exercises: 'id, name, primaryMuscle, archived', templates: 'id, name', weekSchedule: 'weekday',
      workoutSessions: 'id, date, templateId, status', sessionExercises: 'id, sessionId, exerciseId', sets: 'id, sessionId, exerciseId, sessionExerciseId, date',
      foods: 'id, name, lastUsedAt, isFavorite', foodLogs: 'id, date, meal, foodId', mealCombos: 'id, name', water: 'date', bodyWeights: 'id, &date',
      measurements: 'id, date', photos: 'id', coachMessages: 'id, createdAt', settings: 'key',
    });
    await old.open();
    await old.table('workoutSessions').add({ id: 's1', date: '2026-11-01', templateId: null, status: 'done' });
    await old.table('settings').add({ key: 'onboarded', value: true });
    old.close();

    const { db } = await import('./db');
    await db.open();
    expect(db.verno).toBe(2);
    expect(await db.workoutSessions.count()).toBe(1);
    expect((await db.settings.get('onboarded'))?.value).toBe(true);
    await db.wearableDays.put({ date: '2026-11-01', steps: 1, caloriesOut: null, restingHr: null, avgHr: null, hrvMs: null, sleepMin: null, syncedAt: '' });
    expect(await db.wearableDays.count()).toBe(1);
  });
});
