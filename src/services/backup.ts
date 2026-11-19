import { ALL_TABLES, db, type TableName } from '../db/db';
import { PRIVATE_SETTING_KEYS, setSetting } from '../db/settings';
import { toCSV } from '../lib/csv';
import { todayKey } from '../lib/dates';
import { toDispD, toDispL, toDispW, type Units } from '../lib/units';
import { MEASUREMENT_KEYS } from '../db/types';

export const BACKUP_FORMAT = 'forge-backup';
export const BACKUP_VERSION = 1;

const blobToDataURL = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(b);
  });
const dataURLToBlob = async (d: string) => (await fetch(d)).blob();

export async function exportJSON(): Promise<Blob> {
  const data: Record<string, unknown[]> = {};
  for (const t of ALL_TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: any[] = await (db as any)[t].toArray();
    if (t === 'photos') rows = await Promise.all(rows.map(async (p) => ({ ...p, blob: await blobToDataURL(p.blob) })));
    if (t === 'settings') rows = rows.filter((r) => !PRIVATE_SETTING_KEYS.includes(r.key));
    data[t] = rows;
  }
  const json = JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, schema: db.verno, exportedAt: new Date().toISOString(), data });
  return new Blob([json], { type: 'application/json' });
}

export interface BackupSummary {
  exportedAt: string;
  counts: Record<string, number>;
}

export function inspectBackup(text: string): { ok: true; parsed: { data: Record<string, unknown[]> }; summary: BackupSummary } | { ok: false; error: string } {
  try {
    const j = JSON.parse(text);
    if (j?.format !== BACKUP_FORMAT || typeof j.data !== 'object') return { ok: false, error: "This doesn't look like a Forge backup file." };
    const counts: Record<string, number> = {};
    for (const t of ALL_TABLES) counts[t] = Array.isArray(j.data[t]) ? j.data[t].length : 0;
    return { ok: true, parsed: j, summary: { exportedAt: j.exportedAt, counts } };
  } catch {
    return { ok: false, error: 'Could not read the file (invalid JSON).' };
  }
}

export async function importBackup(parsed: { data: Record<string, unknown[]> }, mode: 'merge' | 'replace') {
  const tables = ALL_TABLES.map((t) => (db as unknown as Record<TableName, import('dexie').Table>)[t]);
  // Convert photos first (async fetch can't run inside the Dexie transaction)
  const photos = await Promise.all(
    ((parsed.data.photos ?? []) as { blob: string }[]).map(async (p) => ({ ...p, blob: typeof p.blob === 'string' ? await dataURLToBlob(p.blob) : p.blob })),
  );
  await db.transaction('rw', tables, async () => {
    for (const t of ALL_TABLES) {
      const table = (db as unknown as Record<TableName, import('dexie').Table>)[t];
      let rows = (t === 'photos' ? photos : parsed.data[t] ?? []) as Record<string, unknown>[];
      if (t === 'settings') rows = rows.filter((r) => !PRIVATE_SETTING_KEYS.includes(r.key as never));
      if (mode === 'replace') {
        if (t === 'settings') {
          const keep = (await table.toArray()).filter((r) => PRIVATE_SETTING_KEYS.includes(r.key));
          await table.clear();
          await table.bulkPut(keep);
        } else await table.clear();
      }
      if (t === 'bodyWeights' && mode === 'merge') {
        // unique date index: drop local rows on dates the backup covers
        const dates = new Set(rows.map((r) => r.date));
        const clash = (await table.toArray()).filter((r) => dates.has(r.date) && !rows.some((x) => x.id === r.id));
        await table.bulkDelete(clash.map((r) => r.id));
      }
      if (rows.length) await table.bulkPut(rows);
    }
  });
  await setSetting('onboarded', true);
}

export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

export async function exportBackupFile() {
  const blob = await exportJSON();
  const r = await shareOrDownload(blob, `forge-backup-${todayKey()}.json`);
  if (r !== 'cancelled') await setSetting('lastBackupAt', new Date().toISOString());
  return r;
}

export async function exportCSV(kind: 'workouts' | 'food' | 'body', units: Units) {
  let rows: Record<string, unknown>[] = [];
  if (kind === 'workouts') {
    const [sessions, ses, sets, exercises] = await Promise.all([db.workoutSessions.toArray(), db.sessionExercises.toArray(), db.sets.toArray(), db.exercises.toArray()]);
    const sMap = new Map(sessions.map((s) => [s.id, s]));
    const seMap = new Map(ses.map((s) => [s.id, s]));
    const eMap = new Map(exercises.map((e) => [e.id, e]));
    rows = sets
      .map((s) => {
        const sess = sMap.get(s.sessionId);
        return {
          date: sess?.date ?? s.date, workout: sess?.templateNameSnapshot, exercise: eMap.get(s.exerciseId)?.name, exercise_order: seMap.get(s.sessionExerciseId)?.order,
          set: s.order + 1, set_type: s.setType, [`weight_${units === 'metric' ? 'kg' : 'lb'}`]: toDispW(s.weight, units), reps: s.reps, duration_sec: s.durationSec,
          [`distance_${units === 'metric' ? 'km' : 'mi'}`]: toDispD(s.distance, units), completed: s.completed, pr: s.isPR, note: seMap.get(s.sessionExerciseId)?.note,
        };
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.exercise_order) - Number(b.exercise_order) || Number(a.set) - Number(b.set));
  } else if (kind === 'food') {
    rows = (await db.foodLogs.toArray()).sort((a, b) => a.date.localeCompare(b.date)).map(({ date, meal, name, servings, calories, protein, carbs, fat, source }) => ({ date, meal, name, servings, calories, protein_g: protein, carbs_g: carbs, fat_g: fat, source }));
  } else {
    const [weights, ms] = await Promise.all([db.bodyWeights.toArray(), db.measurements.toArray()]);
    const dates = [...new Set([...weights.map((w) => w.date), ...ms.map((m) => m.date)])].sort();
    rows = dates.map((d) => {
      const m = ms.find((x) => x.date === d);
      return {
        date: d,
        [`weight_${units === 'metric' ? 'kg' : 'lb'}`]: toDispW(weights.find((w) => w.date === d)?.weight, units),
        ...Object.fromEntries(MEASUREMENT_KEYS.map((k) => [k === 'bodyFat' ? 'body_fat_pct' : `${k}_${units === 'metric' ? 'cm' : 'in'}`, m ? (k === 'bodyFat' ? m[k] : toDispL(m[k], units)) : null])),
      };
    });
  }
  return shareOrDownload(new Blob([toCSV(rows)], { type: 'text/csv' }), `forge-${kind}-${todayKey()}.csv`);
}
