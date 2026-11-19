import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_SETTINGS, getSettings, type AppSettings } from '../db/settings';
import type { Exercise, Profile } from '../db/types';
import type { Units } from '../lib/units';

export function useSettings(): AppSettings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS;
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(() => db.profile.get('me'), []);
}

export function useUnits(): Units {
  const p = useProfile();
  return p?.units ?? 'imperial';
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[]);
  return new Map((list ?? []).map((e) => [e.id, e]));
}

export function useWeightStep(): number {
  const s = useSettings();
  const u = useUnits();
  return u === 'metric' ? s.weightStepKg : s.weightStepLb;
}
