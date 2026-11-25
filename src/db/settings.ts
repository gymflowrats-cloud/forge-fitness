import { db } from './db';

/**
 * Single source of truth for the default Gemini model. If Google retires it, services/gemini.ts
 * automatically switches to the replacement Google names in its 404 response (or the newest Flash model).
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

export interface AppSettings {
  onboarded: boolean;
  theme: 'system' | 'light' | 'dark';
  weightStepLb: number;
  weightStepKg: number;
  defaultRestSec: number;
  meals: string[];
  waterGoalOz: number;
  aiMode: 'direct' | 'proxy';
  geminiKey: string;
  proxyUrl: string;
  geminiModel: string;
  lastBackupAt: string | null;
  backupReminderSnoozedAt: string | null;
  dismissed: Record<string, string>;
  restSound: boolean;
  logView: 'focus' | 'list';
  googleClientId: string;
  lastHealthSync: string | null;
  healthErrors: Record<string, string>;
  palette: 'forest' | 'amber' | 'terracotta' | 'ocean' | 'plum';
  sportyNumbers: boolean;
  heroTexture: boolean;
  celebrations: boolean;
  /** Achievement ids already celebrated, so each one pops only once. */
  seenAchievements: string[];
  /** Meal reminder push notifications (needs the push Worker, see push-worker/). */
  mealReminders: boolean;
  /** Meal name → "HH:MM" ('' = off). Missing meals use defaultMealTime(). */
  mealTimes: Record<string, string>;
  lastPushSync: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  theme: 'system',
  weightStepLb: 5,
  weightStepKg: 2.5,
  defaultRestSec: 90,
  meals: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
  waterGoalOz: 64,
  aiMode: 'direct',
  geminiKey: '',
  proxyUrl: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  lastBackupAt: null,
  backupReminderSnoozedAt: null,
  dismissed: {},
  restSound: true,
  logView: 'focus',
  googleClientId: '',
  lastHealthSync: null,
  healthErrors: {},
  palette: 'amber',
  sportyNumbers: true,
  heroTexture: true,
  celebrations: true,
  seenAchievements: [],
  mealReminders: false,
  mealTimes: {},
  lastPushSync: null,
};

const DEFAULT_MEAL_TIMES: Record<string, string> = { breakfast: '08:30', lunch: '13:00', snack: '16:30', snacks: '16:30', dinner: '20:00' };
/** Sensible default reminder time for common meal names (null for custom meals). */
export const defaultMealTime = (meal: string): string | null => DEFAULT_MEAL_TIMES[meal.toLowerCase().trim()] ?? null;
/** The reminder schedule actually used: user times, else defaults. Custom meals without a time are skipped. */
export function effectiveMealTimes(meals: string[], custom: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of meals) {
    const t = m in custom ? custom[m] : defaultMealTime(m); // '' = reminder turned off for this meal
    if (t) out[m] = t;
  }
  return out;
}

/** Keys never included in JSON backups. */
export const PRIVATE_SETTING_KEYS: (keyof AppSettings)[] = ['geminiKey'];

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  // The old default alias stopped responding for new API users; move them to the current default.
  if (out.geminiModel === 'gemini-flash-latest') out.geminiModel = DEFAULT_GEMINI_MODEL;
  return out as unknown as AppSettings;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await db.settings.put({ key, value });
}

let onboardedThisSession = false;
/** Mark onboarding done synchronously so the router gate doesn't bounce back before the DB read updates. */
export async function completeOnboarding() {
  onboardedThisSession = true;
  await setSetting('onboarded', true);
}
export const justOnboarded = () => onboardedThisSession;

export async function dismiss(key: string) {
  const s = await getSettings();
  await setSetting('dismissed', { ...s.dismissed, [key]: new Date().toISOString() });
}

import type { Profile } from './types';

/** Sensible defaults used when no profile has been saved yet (e.g. onboarding skipped). */
export function defaultProfile(): Profile {
  return {
    id: 'me', name: 'Athlete', sex: 'male', birthYear: new Date().getFullYear() - 30, heightIn: 70, units: 'imperial', goal: 'recomp',
    activityLevel: 'moderate', calorieTarget: 2200, proteinG: 150, carbsG: 220, fatG: 66, goalWeight: null, startWeight: null, checkInDay: 0,
    createdAt: new Date().toISOString(),
  };
}
