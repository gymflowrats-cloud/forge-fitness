import { describe, it, expect } from 'vitest';
import {
  e1rm, totalVolume, detectPR, bmr, tdee, suggestTargets, movingAverage, weeklyRate,
  trainingStreak, weekStreak, adherence, parseRepRange, pctChange,
} from './calc';

describe('e1rm', () => {
  it('uses Epley', () => {
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(e1rm(225, 1)).toBe(225);
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(100, 0)).toBe(0);
  });
});

describe('totalVolume', () => {
  it('sums completed non-warmup sets', () => {
    expect(
      totalVolume([
        { weight: 100, reps: 10, completed: true },
        { weight: 100, reps: 10, completed: false },
        { weight: 45, reps: 10, completed: true, setType: 'warmup' },
        { weight: 120, reps: 5, completed: true },
      ]),
    ).toBe(1600);
  });
});

describe('detectPR', () => {
  const hist = [
    { weight: 135, reps: 10, completed: true },
    { weight: 155, reps: 5, completed: true },
  ];
  it('no PR without history', () => {
    expect(detectPR([], { weight: 135, reps: 10 }).isPR).toBe(false);
  });
  it('heavier weight', () => {
    const r = detectPR(hist, { weight: 160, reps: 3 });
    expect(r.kinds).toContain('weight');
  });
  it('more reps at a weight', () => {
    const r = detectPR(hist, { weight: 155, reps: 6 });
    expect(r.kinds).toContain('reps');
  });
  it('e1rm', () => {
    const r = detectPR(hist, { weight: 140, reps: 10 });
    expect(r.kinds).toContain('e1rm');
  });
  it('not a PR when matching', () => {
    expect(detectPR(hist, { weight: 135, reps: 10 }).isPR).toBe(false);
  });
  it('warmups never PR', () => {
    expect(detectPR(hist, { weight: 300, reps: 1, setType: 'warmup' }).isPR).toBe(false);
  });
});

describe('energy', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr('male', 80, 180, 30)).toBeCloseTo(1780, 0);
    expect(bmr('female', 60, 165, 30)).toBeCloseTo(1320.25, 1);
  });
  it('tdee', () => {
    expect(tdee(1800, 'moderate')).toBeCloseTo(2790, 0);
  });
  it('suggestTargets', () => {
    const t = suggestTargets({ sex: 'male', weightLb: 180, heightIn: 70, age: 30, activity: 'moderate', goal: 'lose' });
    expect(t.calories).toBeGreaterThan(1800);
    expect(t.calories).toBeLessThan(2600);
    expect(t.protein).toBe(180);
    expect(t.carbs).toBeGreaterThan(0);
  });
});

describe('series', () => {
  it('moving average over 7 days', () => {
    const pts = [
      { date: '2026-01-01', value: 10 },
      { date: '2026-01-02', value: 20 },
      { date: '2026-01-09', value: 30 },
    ];
    const ma = movingAverage(pts, 7);
    expect(ma[1]!.value).toBe(15);
    expect(ma[2]!.value).toBe(30);
  });
  it('weekly rate slope', () => {
    const pts = [
      { date: '2026-01-01', value: 200 },
      { date: '2026-01-08', value: 199 },
      { date: '2026-01-15', value: 198 },
    ];
    expect(weeklyRate(pts)).toBeCloseTo(-1, 5);
    expect(weeklyRate([pts[0]!])).toBeNull();
  });
  it('pctChange', () => {
    expect(pctChange(100, 110)).toBeCloseTo(10);
    expect(pctChange(0, 0)).toBe(0);
  });
});

describe('streaks & adherence', () => {
  // 2026-11-16 is a Monday. Schedule Mon/Wed/Fri.
  const sched = (wd: number) => [1, 3, 5].includes(wd);
  it('rest days do not break the streak', () => {
    const trained = new Set(['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16']);
    expect(trainingStreak(trained, sched, '2026-11-17')).toBe(4);
  });
  it('missed scheduled day breaks it', () => {
    const trained = new Set(['2026-11-09', '2026-11-13', '2026-11-16']);
    expect(trainingStreak(trained, sched, '2026-11-17')).toBe(2);
  });
  it('today untrained does not break', () => {
    const trained = new Set(['2026-11-13']);
    expect(trainingStreak(trained, sched, '2026-11-16')).toBe(1);
  });
  it('week streak', () => {
    const trained = new Set(['2026-11-03', '2026-11-10', '2026-11-17']);
    expect(weekStreak(trained, '2026-11-19')).toBe(3);
  });
  it('adherence', () => {
    const trained = new Set(['2026-11-16', '2026-11-18']);
    const a = adherence(trained, sched, '2026-11-16', '2026-11-22');
    expect(a.scheduled).toBe(3);
    expect(a.hit).toBe(2);
  });
});

describe('parseRepRange', () => {
  it('parses', () => {
    expect(parseRepRange('8-12')).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('5')).toEqual({ min: 5, max: 5 });
    expect(parseRepRange('x')).toBeNull();
  });
});
