import { db } from './db';
import { uid } from '../lib/id';
import { shiftKey } from '../lib/dates';
import type { Food, FoodLog } from './types';

export interface FoodItemInput {
  name: string;
  servingDesc?: string;
  servings?: number;
  calories: number; // per serving
  protein?: number;
  carbs?: number;
  fat?: number;
  foodId?: string | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Upsert into the foods table (by name) so it shows up in Recent; favorite=true puts it in "My foods". */
export async function upsertFood(item: FoodItemInput, favorite = false): Promise<string> {
  const name = item.name.trim();
  const existing = (item.foodId ? await db.foods.get(item.foodId) : undefined) ?? (await db.foods.toArray()).find((f) => f.name.toLowerCase() === name.toLowerCase());
  const now = new Date().toISOString();
  if (existing) {
    await db.foods.update(existing.id, { lastUsedAt: now, isFavorite: existing.isFavorite || favorite });
    return existing.id;
  }
  const f: Food = {
    id: uid(), name, servingDesc: item.servingDesc ?? '1 serving', calories: Math.round(item.calories), protein: r1(item.protein ?? 0),
    carbs: r1(item.carbs ?? 0), fat: r1(item.fat ?? 0), isFavorite: favorite, lastUsedAt: now,
  };
  await db.foods.add(f);
  return f.id;
}

export async function logFood(date: string, meal: string, item: FoodItemInput, source: FoodLog['source'] = 'manual', favorite = false) {
  const servings = item.servings ?? 1;
  const foodId = await upsertFood(item, favorite);
  const log: FoodLog = {
    id: uid(), date, meal, foodId, name: item.name.trim(), servings,
    calories: Math.round(item.calories * servings), protein: r1((item.protein ?? 0) * servings), carbs: r1((item.carbs ?? 0) * servings),
    fat: r1((item.fat ?? 0) * servings), source, createdAt: new Date().toISOString(),
  };
  await db.foodLogs.add(log);
  return log;
}

/** Copy yesterday's `fromMeal` into today's `toMeal` (they can differ, e.g. lunch and dinner swapped). */
export async function copyMealFromYesterday(date: string, fromMeal: string, toMeal: string = fromMeal) {
  const prev = await db.foodLogs.where('date').equals(shiftKey(date, -1)).filter((l) => l.meal === fromMeal).toArray();
  await db.foodLogs.bulkAdd(prev.map((l) => ({ ...l, id: uid(), date, meal: toMeal, createdAt: new Date().toISOString() })));
  return prev.length;
}

/** Change how many servings a logged food has; 0 deletes it. Totals are recomputed from the food's per-serving values. */
export async function setLogServings(logId: string, food: Pick<Food, 'calories' | 'protein' | 'carbs' | 'fat'>, servings: number) {
  if (servings <= 0) return db.foodLogs.delete(logId);
  await db.foodLogs.update(logId, {
    servings, calories: Math.round(food.calories * servings), protein: r1(food.protein * servings), carbs: r1(food.carbs * servings), fat: r1(food.fat * servings),
  });
}

/** Foods most often logged in this meal over the last `days` days, most frequent first (matched by id or name). */
export async function frequentForMeal(date: string, meal: string, days = 45, limit = 12): Promise<Food[]> {
  const logs = await db.foodLogs.where('date').between(shiftKey(date, -days), date, true, true).filter((l) => l.meal === meal).toArray();
  const foods = await db.foods.toArray();
  const byId = new Map(foods.map((f) => [f.id, f]));
  const byName = new Map(foods.map((f) => [f.name.toLowerCase().trim(), f]));
  const count = new Map<string, number>();
  for (const l of [...logs].sort((a, b) => b.date.localeCompare(a.date))) {
    let f = (l.foodId && byId.get(l.foodId)) || byName.get(l.name.toLowerCase().trim());
    if (!f) {
      // Older/imported logs without a saved food: rebuild a per-serving entry from the log (saved on first re-add).
      const n = l.servings || 1;
      f = { id: `log:${l.name.toLowerCase().trim()}`, name: l.name, servingDesc: '1 serving', calories: Math.round(l.calories / n), protein: r1(l.protein / n), carbs: r1(l.carbs / n), fat: r1(l.fat / n), isFavorite: false, lastUsedAt: null };
      byId.set(f.id, f);
      byName.set(l.name.toLowerCase().trim(), f);
    }
    count.set(f.id, (count.get(f.id) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => byId.get(id)!);
}

export async function saveCombo(name: string, date: string, meal: string) {
  const logs = await db.foodLogs.where('date').equals(date).filter((l) => l.meal === meal).toArray();
  if (!logs.length) return false;
  await db.mealCombos.add({
    id: uid(), name,
    items: logs.map(({ foodId, name, servings, calories, protein, carbs, fat, source }) => ({ foodId, name, servings, calories, protein, carbs, fat, source })),
  });
  return true;
}

export async function logCombo(comboId: string, date: string, meal: string) {
  const c = await db.mealCombos.get(comboId);
  if (!c) return 0;
  await db.foodLogs.bulkAdd(c.items.map((i) => ({ ...i, id: uid(), date, meal, createdAt: new Date().toISOString() })));
  return c.items.length;
}

export async function addWater(date: string, deltaOz: number) {
  const w = await db.water.get(date);
  await db.water.put({ date, oz: Math.max(0, (w?.oz ?? 0) + deltaOz) });
}

export function sumLogs(logs: FoodLog[]) {
  return logs.reduce(
    (a, l) => ({ calories: a.calories + l.calories, protein: a.protein + l.protein, carbs: a.carbs + l.carbs, fat: a.fat + l.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function defaultMealForNow(meals: string[]) {
  const h = new Date().getHours();
  const pick = h < 10.5 ? 0 : h < 15 ? 1 : h < 21 ? 2 : 3;
  return meals[Math.min(pick, meals.length - 1)] ?? meals[0] ?? 'Snacks';
}
