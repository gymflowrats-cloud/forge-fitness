// Training helpers: progressive-overload suggestions, plate maths and warm-up ramps.
// Pure functions; weights are in pounds unless a function says otherwise.

export interface SetIn {
  weight: number | null;
  reps: number | null;
  setType?: string;
}

export interface Suggestion {
  /** Target for each working set, in the same order as last time's working sets. */
  sets: { weight: number | null; reps: number }[];
  reason: string;
  kind: 'add_weight' | 'add_reps' | 'rebuild';
}

/**
 * Double progression, set by set: when every working set reached the top of the rep range,
 * add weight to each set and drop to the bottom of the range; otherwise keep the weights and add reps.
 */
export function suggestNext(last: SetIn[], opts: { repsMin?: number; repsMax?: number; stepLb: number; bodyweight?: boolean }): Suggestion | null {
  const work = last.filter((s) => s.setType !== 'warmup' && (s.reps ?? 0) > 0);
  if (!work.length) return null;
  const lo = opts.repsMin || 0;
  const hi = opts.repsMax || opts.repsMin || 0;
  const reps = work.map((s) => s.reps ?? 0);
  const noWeight = work.every((s) => !s.weight);

  if (hi && reps.every((r) => r >= hi) && !(opts.bodyweight && noWeight)) {
    return {
      sets: work.map((s) => ({ weight: (s.weight ?? 0) + opts.stepLb, reps: lo || hi })),
      reason: `You hit ${hi}+ reps on every set last time, so add weight`,
      kind: 'add_weight',
    };
  }
  if (lo && reps.some((r) => r < lo)) {
    return {
      sets: work.map((s) => ({ weight: s.weight ?? null, reps: Math.max(s.reps ?? 0, lo) })),
      reason: `Same weights. Build every set back up to ${lo} reps`,
      kind: 'rebuild',
    };
  }
  return {
    sets: work.map((s) => ({ weight: s.weight ?? null, reps: hi && !(opts.bodyweight && noWeight) ? Math.min(hi, (s.reps ?? 0) + 1) : (s.reps ?? 0) + 1 })),
    reason: hi && reps.some((r) => r >= hi) ? `Same weights. Bring the other sets up to ${hi} reps` : 'Same weights, one more rep per set',
    kind: 'add_reps',
  };
}

// ---------- Plates ----------
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5];
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BARS_LB = [45, 35, 15];
export const BARS_KG = [20, 15, 10];

/** Plates per side for a target (all in the same display unit). Greedy works for standard plate sets. */
export function platesPerSide(target: number, bar: number, plates: number[]): { perSide: number[]; achieved: number; remainder: number } {
  let side = Math.max(0, (target - bar) / 2);
  const perSide: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  const achieved = bar + perSide.reduce((a, p) => a + p, 0) * 2;
  return { perSide, achieved: Math.round(achieved * 100) / 100, remainder: Math.round((target - achieved) * 100) / 100 };
}
