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
};

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
