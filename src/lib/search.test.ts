import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../db/seedExercises';
import { searchExercises } from './search';

const names = (q: string) => searchExercises(SEED_EXERCISES, q).map((e) => e.name);

describe('exercise search', () => {
  it('matches multiple words in any order', () => {
    expect(names('incline bench')).toContain('Incline Barbell Bench Press');
    expect(names('press bench')[0]).toMatch(/Bench Press/);
  });
  it('ignores hyphens and spacing', () => {
    expect(names('pullup')).toContain('Pull-up');
    expect(names('pull up')).toContain('Pull-up');
    expect(names('ez bar')).toContain('EZ-Bar Curl');
  });
  it('understands shorthand', () => {
    expect(names('db curl')).toContain('Dumbbell Curl');
    expect(names('rdl')).toContain('Romanian Deadlift');
    expect(names('ohp')).toContain('Overhead Press');
  });
  it('searches by muscle and equipment', () => {
    expect(names('cable').length).toBeGreaterThan(5);
    expect(names('hamstrings')).toContain('Lying Leg Curl');
  });
  it('ranks name-prefix matches first', () => {
    expect(names('squat')[0]).toBe('Back Squat');
  });
  it('returns nothing for nonsense', () => {
    expect(names('zzzz')).toEqual([]);
  });
});
