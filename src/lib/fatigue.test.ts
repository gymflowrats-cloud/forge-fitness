import { describe, expect, it } from 'vitest';
import { assessFatigue } from './fatigue';
import { addDays } from './stats';

const today = '2026-11-20';
const days = (n: number, f: (i: number) => { restingHr?: number; hrvMs?: number; sleepMin?: number }) =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(today, -i), restingHr: null, hrvMs: null, sleepMin: null, ...f(i) }));

describe('assessFatigue', () => {
  it('is calm with normal data', () => {
    const r = assessFatigue({ today, wearable: days(30, () => ({ restingHr: 55, hrvMs: 60, sleepMin: 450 })), sets: [], exerciseNames: new Map(), trainedDates: [] });
    expect(r.level).toBe(0);
  });
  it('flags low HRV + high resting HR as level 2', () => {
    const r = assessFatigue({
      today,
      wearable: days(30, (i) => (i < 3 ? { restingHr: 63, hrvMs: 42, sleepMin: 450 } : { restingHr: 55, hrvMs: 60, sleepMin: 450 })),
      sets: [], exerciseNames: new Map(), trainedDates: [],
    });
    expect(r.signals.map((s) => s.key)).toEqual(['hrv', 'rhr']);
    expect(r.level).toBe(2);
  });
  it('suggests a deload after 6 straight hard weeks', () => {
    const trained: string[] = [];
    for (let w = 0; w < 7; w++) for (const d of [0, 2, 4]) trained.push(addDays('2026-10-05', w * 7 + d));
    const r = assessFatigue({ today: '2026-11-22', wearable: [], sets: [], exerciseNames: new Map(), trainedDates: trained });
    expect(r.signals[0]!.key).toBe('deload');
    expect(r.level).toBe(1);
  });
  it('detects strength dips on two lifts', () => {
    const sets = ['a', 'b'].flatMap((id) =>
      [100, 102, 104, 90].map((w, i) => ({ exerciseId: id, date: addDays(today, -21 + i * 7), weight: w, reps: 5, setType: 'working', completed: true })),
    );
    const r = assessFatigue({ today, wearable: [], sets, exerciseNames: new Map([['a', 'Bench'], ['b', 'Squat']]), trainedDates: [] });
    expect(r.signals.some((s) => s.key === 'strength')).toBe(true);
  });
});
