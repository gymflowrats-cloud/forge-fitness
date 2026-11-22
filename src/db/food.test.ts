import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { copyMealFromYesterday, frequentForMeal, logFood, setLogServings } from './food';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('food helpers', () => {
  it("copies yesterday's dinner into today's lunch", async () => {
    await logFood('2026-11-21', 'Dinner', { name: 'Dal rice', calories: 600, protein: 20 });
    await logFood('2026-11-21', 'Lunch', { name: 'Salad', calories: 300 });
    const n = await copyMealFromYesterday('2026-11-22', 'Dinner', 'Lunch');
    expect(n).toBe(1);
    const today = await db.foodLogs.where('date').equals('2026-11-22').toArray();
    expect(today.map((l) => [l.meal, l.name])).toEqual([['Lunch', 'Dal rice']]);
  });

  it('adjusts servings on a log and deletes at zero', async () => {
    const l = await logFood('2026-11-22', 'Lunch', { name: 'Roti', calories: 120, protein: 3 });
    await setLogServings(l.id, { calories: 120, protein: 3, carbs: 0, fat: 0 }, 3);
    expect((await db.foodLogs.get(l.id))!).toMatchObject({ servings: 3, calories: 360, protein: 9 });
    await setLogServings(l.id, { calories: 120, protein: 3, carbs: 0, fat: 0 }, 0);
    expect(await db.foodLogs.get(l.id)).toBeUndefined();
  });

  it('ranks the usual foods for a meal, including logs without a saved food', async () => {
    for (const d of ['2026-11-18', '2026-11-19', '2026-11-20']) await logFood(d, 'Lunch', { name: 'Chicken bowl', calories: 550 });
    await logFood('2026-11-20', 'Lunch', { name: 'Apple', calories: 90 });
    await db.foodLogs.add({ id: 'x', date: '2026-11-21', meal: 'Lunch', foodId: null, name: 'Old soup', servings: 2, calories: 300, protein: 10, carbs: 0, fat: 0, source: 'manual' });
    const usual = await frequentForMeal('2026-11-22', 'Lunch');
    expect(usual[0]!.name).toBe('Chicken bowl');
    const soup = usual.find((f) => f.name === 'Old soup')!;
    expect(soup.calories).toBe(150);
    expect((await frequentForMeal('2026-11-22', 'Dinner')).length).toBe(0);
  });
});
