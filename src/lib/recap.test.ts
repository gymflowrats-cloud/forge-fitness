import { describe, expect, it } from 'vitest';
import { buildRecap } from './recap';

describe('buildRecap', () => {
  it('summarises a week and compares to the previous one', () => {
    const r = buildRecap({
      weekStart: '2026-11-16',
      sessions: [{ id: 's1', date: '2026-11-16' }, { id: 's2', date: '2026-11-18' }, { id: 's0', date: '2026-11-10' }],
      sets: [
        { sessionId: 's1', exerciseId: 'b', weight: 200, reps: 5, completed: true, setType: 'working', isPR: true, date: '2026-11-16' },
        { sessionId: 's2', exerciseId: 'b', weight: 100, reps: 10, completed: true, setType: 'working', isPR: false, date: '2026-11-18' },
        { sessionId: 's0', exerciseId: 'b', weight: 100, reps: 10, completed: true, setType: 'working', isPR: false, date: '2026-11-10' },
      ],
      exerciseNames: new Map([['b', 'Bench Press']]),
      scheduledWeekdays: [1, 3, 5],
      weights: [{ date: '2026-11-17', weight: 180 }, { date: '2026-11-11', weight: 181 }],
      foodLogs: [{ date: '2026-11-16', calories: 2000, protein: 150 }, { date: '2026-11-17', calories: 2200, protein: 120 }],
      calorieTarget: 2200, proteinTarget: 150,
      wearable: [{ date: '2026-11-16', steps: 8000, sleepMin: 420 }],
      achievements: [{ title: 'First PR', date: '2026-11-16', unlocked: true }],
    });
    expect(r.workouts).toBe(2);
    expect(r.planned).toBe(3);
    expect(r.volume).toBe(2000);
    expect(r.prevVolume).toBe(1000);
    expect(r.prs[0]!.name).toBe('Bench Press');
    expect(r.weightAvg).toBe(180);
    expect(r.calAvg).toBe(2100);
    expect(r.proteinDaysHit).toBe(1);
    expect(r.achievements).toEqual(['First PR']);
    expect(r.hasData).toBe(true);
  });
});
