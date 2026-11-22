import { describe, expect, it } from 'vitest';
import { PLATES_KG, PLATES_LB, platesPerSide, suggestNext, warmupRamp } from './progression';

describe('suggestNext', () => {
  const w = (weight: number, reps: number) => ({ weight, reps, setType: 'working' });
  it('adds weight to every set when all hit the top of the range', () => {
    const s = suggestNext([w(135, 12), w(135, 12), w(130, 12)], { repsMin: 8, repsMax: 12, stepLb: 5 })!;
    expect(s.kind).toBe('add_weight');
    expect(s.sets).toEqual([{ weight: 140, reps: 8 }, { weight: 140, reps: 8 }, { weight: 135, reps: 8 }]);
  });
  it('keeps back-off weights and adds reps when only the top set hit the range', () => {
    const s = suggestNext([w(175, 8), w(170, 6), w(170, 6)], { repsMin: 6, repsMax: 8, stepLb: 5 })!;
    expect(s.kind).toBe('add_reps');
    expect(s.sets).toEqual([{ weight: 175, reps: 8 }, { weight: 170, reps: 7 }, { weight: 170, reps: 7 }]);
  });
  it('rebuilds when below the range', () => {
    const s = suggestNext([w(135, 6), w(135, 9)], { repsMin: 8, repsMax: 12, stepLb: 5 })!;
    expect(s.kind).toBe('rebuild');
    expect(s.sets.map((x) => x.reps)).toEqual([8, 9]);
  });
  it('ignores warm-ups and returns null with no history', () => {
    expect(suggestNext([{ weight: 45, reps: 10, setType: 'warmup' }], { stepLb: 5 })).toBeNull();
    expect(suggestNext([], { stepLb: 5 })).toBeNull();
  });
  it('bodyweight with no added weight adds reps past the range', () => {
    expect(suggestNext([{ weight: null, reps: 12 }], { repsMin: 8, repsMax: 12, stepLb: 5, bodyweight: true })!.sets[0]!.reps).toBe(13);
  });
});

describe('platesPerSide', () => {
  it('loads 225 lb as two 45s per side', () => {
    expect(platesPerSide(225, 45, PLATES_LB).perSide).toEqual([45, 45]);
  });
  it('handles kg with small plates and reports remainder', () => {
    const r = platesPerSide(62.5, 20, PLATES_KG);
    expect(r.perSide).toEqual([20, 1.25]);
    expect(r.remainder).toBe(0);
    expect(platesPerSide(101, 20, PLATES_KG).remainder).toBe(1);
  });
  it('empty bar when target is below the bar', () => {
    expect(platesPerSide(30, 45, PLATES_LB).perSide).toEqual([]);
  });
});

describe('warmupRamp', () => {
  it('ramps a barbell lift from the empty bar', () => {
    const r = warmupRamp(225, { barbell: true, bar: 45, inc: 5 });
    expect(r[0]).toEqual({ weight: 45, reps: 10 });
    expect(r.map((x) => x.weight)).toEqual([45, 90, 135, 180]);
  });
  it('skips warm-ups for light weights', () => {
    expect(warmupRamp(50, { barbell: true, bar: 45, inc: 5 })).toEqual([]);
  });
  it('uses two sets for dumbbells', () => {
    expect(warmupRamp(30, { barbell: false, bar: 0, inc: 2.5 })).toEqual([{ weight: 15, reps: 8 }, { weight: 22.5, reps: 4 }]);
  });
});
