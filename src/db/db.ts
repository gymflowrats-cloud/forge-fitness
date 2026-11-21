import Dexie, { type Table } from 'dexie';
import type {
  Profile, Exercise, Template, WeekSchedule, WorkoutSession, SessionExercise, WorkoutSet,
  Food, FoodLog, MealCombo, Water, BodyWeight, Measurement, Photo, CoachMessage, Setting, WearableDay,
} from './types';

export class ForgeDB extends Dexie {
  profile!: Table<Profile, string>;
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  weekSchedule!: Table<WeekSchedule, number>;
  workoutSessions!: Table<WorkoutSession, string>;
  sessionExercises!: Table<SessionExercise, string>;
  sets!: Table<WorkoutSet, string>;
  foods!: Table<Food, string>;
  foodLogs!: Table<FoodLog, string>;
  mealCombos!: Table<MealCombo, string>;
  water!: Table<Water, string>;
  bodyWeights!: Table<BodyWeight, string>;
  measurements!: Table<Measurement, string>;
  photos!: Table<Photo, string>;
  coachMessages!: Table<CoachMessage, string>;
  settings!: Table<Setting, string>;
  wearableDays!: Table<WearableDay, string>;

  constructor() {
    super('forge');
    // Schema history. Never edit a released version; add a new version() with an upgrade() instead.
    this.version(1).stores({
      profile: 'id',
      exercises: 'id, name, primaryMuscle, archived',
      templates: 'id, name',
      weekSchedule: 'weekday',
      workoutSessions: 'id, date, templateId, status',
      sessionExercises: 'id, sessionId, exerciseId',
      sets: 'id, sessionId, exerciseId, sessionExerciseId, date',
      foods: 'id, name, lastUsedAt, isFavorite',
      foodLogs: 'id, date, meal, foodId',
      mealCombos: 'id, name',
      water: 'date',
      bodyWeights: 'id, &date',
      measurements: 'id, date',
      photos: 'id',
      coachMessages: 'id, createdAt',
      settings: 'key',
    });
    // v2: wearable (Fitbit / Google Health) daily summaries
    this.version(2).stores({ wearableDays: 'date' });
  }
}

export const db = new ForgeDB();

export const ALL_TABLES = [
  'profile', 'exercises', 'templates', 'weekSchedule', 'workoutSessions', 'sessionExercises', 'sets',
  'foods', 'foodLogs', 'mealCombos', 'water', 'bodyWeights', 'measurements', 'photos', 'coachMessages', 'settings', 'wearableDays',
] as const;
export type TableName = (typeof ALL_TABLES)[number];
