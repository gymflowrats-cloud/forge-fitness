import type { Activity, Goal, Sex } from '../lib/calc';
import type { Units } from '../lib/units';

export type ExerciseType = 'weight_reps' | 'bodyweight_reps' | 'time' | 'cardio';
export type Muscle =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'cardio' | 'full_body';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'cardio_machine' | 'band' | 'other';
export type SetType = 'warmup' | 'working' | 'drop' | 'failure';
export type Meal = string;

export interface Profile {
  id: 'me';
  name: string;
  sex: Sex;
  birthYear: number;
  heightIn: number;
  units: Units;
  goal: Goal;
  activityLevel: Activity;
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  goalWeight: number | null; // lb
  startWeight: number | null; // lb
  checkInDay: number; // 0-6
  createdAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  isCustom: boolean;
  archived: boolean;
}

export interface TemplateExercise {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeight: number | null; // lb
  restSec: number;
  /** Exercises sharing a group id are done as a superset (alternating sets). */
  group?: string | null;
}

export interface Template {
  id: string;
  name: string;
  color: string;
  exercises: TemplateExercise[];
  archived: boolean;
  createdAt?: string;
}

export interface WeekSchedule {
  weekday: number;
  templateId: string | null;
}

export interface WorkoutSession {
  id: string;
  date: string;
  templateId: string | null;
  templateNameSnapshot: string;
  startedAt: string | null;
  endedAt: string | null;
  status: 'in_progress' | 'done';
  rating: number | null;
  note: string;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  isExtra: boolean;
  note: string;
  skipped?: boolean;
  restSec?: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  group?: string | null;
}

export interface WorkoutSet {
  id: string;
  sessionExerciseId: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  setType: SetType;
  weight: number | null; // lb (added weight for bodyweight)
  reps: number | null;
  durationSec: number | null;
  distance: number | null; // miles
  calories?: number | null;
  completed: boolean;
  completedAt: string | null;
  isPR: boolean;
  date?: string; // denormalised session date for fast history queries
}

export interface Food {
  id: string;
  name: string;
  servingDesc: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isFavorite: boolean;
  lastUsedAt: string | null;
}

export interface FoodLog {
  id: string;
  date: string;
  meal: Meal;
  foodId: string | null;
  name: string;
  servings: number;
  calories: number; // totals (already multiplied by servings)
  protein: number;
  carbs: number;
  fat: number;
  source: 'manual' | 'ai' | 'photo';
  createdAt?: string;
}

export interface MealCombo {
  id: string;
  name: string;
  items: Omit<FoodLog, 'id' | 'date' | 'meal'>[];
}

export interface Water {
  date: string;
  oz: number;
}

export interface BodyWeight {
  id: string;
  date: string;
  weight: number; // lb
}

export const MEASUREMENT_KEYS = ['chest', 'waist', 'hips', 'neck', 'armL', 'armR', 'thighL', 'thighR', 'calves', 'bodyFat'] as const;
export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];
export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  chest: 'Chest', waist: 'Waist', hips: 'Hips', neck: 'Neck', armL: 'Left arm', armR: 'Right arm',
  thighL: 'Left thigh', thighR: 'Right thigh', calves: 'Calves', bodyFat: 'Body fat %',
};

export type Measurement = {
  id: string;
  date: string;
  photoBlobId: string | null;
  note: string;
} & { [K in MeasurementKey]: number | null };

export interface Photo {
  id: string;
  blob: Blob;
  createdAt: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
  structured?: CoachSuggestion[] | null;
  kind?: 'chat' | 'recap';
}

export interface CoachSuggestion {
  templateName: string;
  exerciseName: string;
  newTargetWeight: number | null; // in user's display unit as returned by AI
  newTargetRepsMin: number | null;
  newTargetRepsMax: number | null;
  reason: string;
  applied?: boolean;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** One day of wearable data pulled from the Google Health API (Fitbit). */
export interface WearableDay {
  date: string; // YYYY-MM-DD
  steps: number | null;
  caloriesOut: number | null; // total kcal burned
  restingHr: number | null;
  avgHr: number | null;
  hrvMs: number | null;
  sleepMin: number | null;
  syncedAt: string;
}
