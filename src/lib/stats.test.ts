import { describe, expect, it } from 'vitest';
import { exerciseProgress, mondayOf, perWeek, setsPerMuscle, trainedDates, volumeByDate, weeksBetween, changeOver } from './stats';

const S = (o: Partial<Parameters<typeof volumeByDate>[1][number]>) => ({ sessionId: 'a', exerciseId: 'x', weight: 100, reps: 10, completed: true, setType: 'working', isPR: false, date: '2026-11-16', ...o });

describe('stats', () => {
  it('mondayOf / weeksBetween', () => {
    expect(mondayOf('2026-11-19')).toBe('2026-11-16');
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
    expect(mondayOf('2026-11-22')).toBe('2026-11-16');
    expect(weeksBetween('2026-11-01', '2026-11-19')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
  });
  it('trained dates require a completed set', () => {
    const sessions = [{ id: 'a', date: '2026-11-16', templateId: null }, { id: 'b', date: '2026-11-17', templateId: null }];
    const sets = [S({}), S({ sessionId: 'b', completed: false })];
    expect([...trainedDates(sessions, sets)]).toEqual(['2026-11-16']);
    expect(volumeByDate(sessions, sets).get('2026-11-16')).toBe(1000);
  });
  it('perWeek', () => {
    expect(perWeek(['2026-11-16', '2026-11-18', '2026-11-10'], ['2026-11-09', '2026-11-16'])).toEqual([
      { week: '2026-11-09', value: 1 },
      { week: '2026-11-16', value: 2 },
    ]);
  });
  it('exerciseProgress picks heaviest and best e1rm', () => {
    const p = exerciseProgress([S({ weight: 100, reps: 10 }), S({ weight: 120, reps: 3 }), S({ weight: 200, reps: 1, setType: 'warmup' })]);
    expect(p).toHaveLength(1);
    expect(p[0]!.best).toBe(120);
    expect(p[0]!.e1rm).toBeCloseTo(133.3, 1);
  });
  it('setsPerMuscle counts secondaries as half', () => {
    const m = new Map([['x', { primary: 'chest', secondary: ['triceps'] }]]);
    expect(setsPerMuscle([S({}), S({})], m)).toEqual({ chest: 2, triceps: 1 });
  });
  it('changeOver', () => {
    const pts = [{ date: '2026-10-01', value: 100 }, { date: '2026-11-15', value: 106 }];
    expect(changeOver(pts, 28, '2026-11-19')).toBeCloseTo(6);
  });
});
