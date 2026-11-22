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

const norm = (n: string) => n.toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * Every food you've ever logged: saved foods plus names that only exist in the log (copied meals, combos,
 * old entries). Log-only foods get a per-serving entry rebuilt from their latest log and an id of `log:<name>`;
 * they become real saved foods the first time you add them again.
 */
export async function foodCatalog(): Promise<{ foods: Food[]; lastUsed: Map<string, string>; byName: Map<string, Food> }> {
  const [saved, logs] = await Promise.all([db.foods.toArray(), db.foodLogs.toArray()]);
  const byName = new Map<string, Food>(saved.map((f) => [norm(f.name), f]));
  const lastUsed = new Map<string, string>();
  for (const f of saved) if (f.lastUsedAt) lastUsed.set(f.id, f.lastUsedAt);
  for (const l of [...logs].sort((x, y) => (y.createdAt ?? y.date).localeCompare(x.createdAt ?? x.date))) {
    const key = norm(l.name);
    let f = byName.get(key);
    if (!f) {
      const n = l.servings || 1;
      f = { id: `log:${key}`, name: l.name, servingDesc: '1 serving', calories: Math.round(l.calories / n), protein: r1(l.protein / n), carbs: r1(l.carbs / n), fat: r1(l.fat / n), isFavorite: false, lastUsedAt: null };
      byName.set(key, f);
    }
    const when = l.createdAt ?? `${l.date}T12:00:00.000Z`;
    if ((lastUsed.get(f.id) ?? '') < when) lastUsed.set(f.id, when);
  }
  return { foods: [...byName.values()], lastUsed, byName };
}

/** Word-by-word search over everything logged ("chick bowl" finds "Chicken burrito bowl"); prefix matches first, then most recent. */
export async function searchFoods(q: string, limit = 40): Promise<Food[]> {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return [];
  const { foods, lastUsed } = await foodCatalog();
  const hits = foods.filter((f) => {
    const n = norm(f.name);
    return words.every((w) => n.includes(w));
  });
  const starts = (f: Food) => (norm(f.name).startsWith(words[0]!) || norm(f.name).includes(' ' + words[0]!) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b) || (lastUsed.get(b.id) ?? '').localeCompare(lastUsed.get(a.id) ?? '')).slice(0, limit);
}

/** Most recently eaten foods, across saved foods and the log. */
export async function recentFoods(limit = 25): Promise<Food[]> {
  const { foods, lastUsed } = await foodCatalog();
  return foods.filter((f) => lastUsed.has(f.id)).sort((a, b) => lastUsed.get(b.id)!.localeCompare(lastUsed.get(a.id)!)).slice(0, limit);
}

/** Foods most often logged in this meal over the last `days` days, most frequent first. */
export async function frequentForMeal(date: string, meal: string, days = 45, limit = 12): Promise<Food[]> {
  const [logs, { byName }] = await Promise.all([
    db.foodLogs.where('date').between(shiftKey(date, -days), date, true, true).filter((l) => l.meal === meal).toArray(),
    foodCatalog(),
  ]);
  const count = new Map<string, { f: Food; n: number }>();
  for (const l of logs) {
    const f = byName.get(norm(l.name));
    if (!f) continue;
    const c = count.get(f.id) ?? { f, n: 0 };
    c.n++;
    count.set(f.id, c);
  }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((c) => c.f);
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
