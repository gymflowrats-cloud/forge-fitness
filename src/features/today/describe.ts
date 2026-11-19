import type { ExerciseType, WorkoutSet } from '../../db/types';
import { fmtNum } from '../../lib/format';
import { dUnit, toDispD, toDispW, wUnit, type Units } from '../../lib/units';

export function describeSet(s: WorkoutSet, type: ExerciseType, u: Units): string {
  if (type === 'time') return `${s.durationSec ?? 0}s`;
  if (type === 'cardio') return `${Math.round((s.durationSec ?? 0) / 60)}m${s.distance ? ` · ${fmtNum(toDispD(s.distance, u), 2)}${dUnit(u)}` : ''}`;
  const w = toDispW(s.weight, u);
  if (type === 'bodyweight_reps') return w ? `+${fmtNum(w)}×${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
  return `${fmtNum(w ?? 0)}×${s.reps ?? 0}`;
}

/** "3 × 10 @ 135 lb" or "135×10, 145×8" */
export function describeSets(sets: WorkoutSet[], type: ExerciseType, u: Units): string {
  const working = sets.filter((s) => s.setType !== 'warmup');
  const list = working.length ? working : sets;
  if (!list.length) return '';
  if (type === 'cardio') return list.map((s) => describeSet(s, type, u)).join(', ');
  if (type === 'time') {
    const same = list.every((s) => s.durationSec === list[0]!.durationSec);
    return same ? `${list.length} × ${list[0]!.durationSec ?? 0}s` : list.map((s) => `${s.durationSec}s`).join(', ');
  }
  const same = list.every((s) => s.weight === list[0]!.weight && s.reps === list[0]!.reps);
  if (same) {
    const w = toDispW(list[0]!.weight, u);
    if (type === 'bodyweight_reps') return `${list.length} × ${list[0]!.reps ?? 0}${w ? ` @ +${fmtNum(w)} ${wUnit(u)}` : ''}`;
    return `${list.length} × ${list[0]!.reps ?? 0} @ ${fmtNum(w ?? 0)} ${wUnit(u)}`;
  }
  return list.map((s) => describeSet(s, type, u)).join(', ') + (type === 'weight_reps' ? ` ${wUnit(u)}` : '');
}
