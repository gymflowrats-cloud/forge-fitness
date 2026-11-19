import { db } from './db';
import { SEED_EXERCISES } from './seedExercises';

/** Idempotent first-run setup: seed library + empty weekday schedule. */
export async function initDb() {
  await db.transaction('rw', db.exercises, db.weekSchedule, async () => {
    const existing = new Set(await db.exercises.toCollection().primaryKeys());
    const missing = SEED_EXERCISES.filter((e) => !existing.has(e.id));
    if (missing.length) await db.exercises.bulkAdd(missing);
    const sched = await db.weekSchedule.count();
    if (sched < 7) {
      const have = new Set(await db.weekSchedule.toCollection().primaryKeys());
      for (let d = 0; d < 7; d++) if (!have.has(d)) await db.weekSchedule.put({ weekday: d, templateId: null });
    }
  });
}
