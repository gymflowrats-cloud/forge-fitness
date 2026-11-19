import type { Equipment, Exercise, ExerciseType, Muscle } from './types';

type Row = [name: string, type: ExerciseType, primary: Muscle, secondary: Muscle[], equipment: Equipment];

const ROWS: Row[] = [
  // Chest
  ['Barbell Bench Press', 'weight_reps', 'chest', ['triceps', 'shoulders'], 'barbell'],
  ['Incline Barbell Bench Press', 'weight_reps', 'chest', ['shoulders', 'triceps'], 'barbell'],
  ['Decline Bench Press', 'weight_reps', 'chest', ['triceps'], 'barbell'],
  ['Dumbbell Bench Press', 'weight_reps', 'chest', ['triceps', 'shoulders'], 'dumbbell'],
  ['Incline Dumbbell Press', 'weight_reps', 'chest', ['shoulders', 'triceps'], 'dumbbell'],
  ['Dumbbell Fly', 'weight_reps', 'chest', [], 'dumbbell'],
  ['Cable Crossover', 'weight_reps', 'chest', [], 'cable'],
  ['Machine Chest Press', 'weight_reps', 'chest', ['triceps'], 'machine'],
  ['Pec Deck', 'weight_reps', 'chest', [], 'machine'],
  ['Push-up', 'bodyweight_reps', 'chest', ['triceps', 'shoulders'], 'bodyweight'],
  ['Chest Dip', 'bodyweight_reps', 'chest', ['triceps'], 'bodyweight'],
  // Back
  ['Deadlift', 'weight_reps', 'back', ['hamstrings', 'glutes'], 'barbell'],
  ['Barbell Row', 'weight_reps', 'back', ['biceps'], 'barbell'],
  ['Pendlay Row', 'weight_reps', 'back', ['biceps'], 'barbell'],
  ['Dumbbell Row', 'weight_reps', 'back', ['biceps'], 'dumbbell'],
  ['Pull-up', 'bodyweight_reps', 'back', ['biceps'], 'bodyweight'],
  ['Chin-up', 'bodyweight_reps', 'back', ['biceps'], 'bodyweight'],
  ['Lat Pulldown', 'weight_reps', 'back', ['biceps'], 'cable'],
  ['Close-Grip Lat Pulldown', 'weight_reps', 'back', ['biceps'], 'cable'],
  ['Seated Cable Row', 'weight_reps', 'back', ['biceps'], 'cable'],
  ['T-Bar Row', 'weight_reps', 'back', ['biceps'], 'machine'],
  ['Machine Row', 'weight_reps', 'back', ['biceps'], 'machine'],
  ['Straight-Arm Pulldown', 'weight_reps', 'back', [], 'cable'],
  ['Rack Pull', 'weight_reps', 'back', ['glutes'], 'barbell'],
  ['Back Extension', 'bodyweight_reps', 'back', ['glutes', 'hamstrings'], 'bodyweight'],
  // Shoulders
  ['Overhead Press', 'weight_reps', 'shoulders', ['triceps'], 'barbell'],
  ['Seated Dumbbell Press', 'weight_reps', 'shoulders', ['triceps'], 'dumbbell'],
  ['Arnold Press', 'weight_reps', 'shoulders', ['triceps'], 'dumbbell'],
  ['Machine Shoulder Press', 'weight_reps', 'shoulders', ['triceps'], 'machine'],
  ['Lateral Raise', 'weight_reps', 'shoulders', [], 'dumbbell'],
  ['Cable Lateral Raise', 'weight_reps', 'shoulders', [], 'cable'],
  ['Front Raise', 'weight_reps', 'shoulders', [], 'dumbbell'],
  ['Rear Delt Fly', 'weight_reps', 'shoulders', ['back'], 'dumbbell'],
  ['Reverse Pec Deck', 'weight_reps', 'shoulders', ['back'], 'machine'],
  ['Face Pull', 'weight_reps', 'shoulders', ['back'], 'cable'],
  ['Barbell Shrug', 'weight_reps', 'back', [], 'barbell'],
  ['Dumbbell Shrug', 'weight_reps', 'back', [], 'dumbbell'],
  // Biceps
  ['Barbell Curl', 'weight_reps', 'biceps', ['forearms'], 'barbell'],
  ['EZ-Bar Curl', 'weight_reps', 'biceps', ['forearms'], 'barbell'],
  ['Dumbbell Curl', 'weight_reps', 'biceps', ['forearms'], 'dumbbell'],
  ['Hammer Curl', 'weight_reps', 'biceps', ['forearms'], 'dumbbell'],
  ['Incline Dumbbell Curl', 'weight_reps', 'biceps', [], 'dumbbell'],
  ['Preacher Curl', 'weight_reps', 'biceps', [], 'machine'],
  ['Cable Curl', 'weight_reps', 'biceps', [], 'cable'],
  ['Concentration Curl', 'weight_reps', 'biceps', [], 'dumbbell'],
  // Triceps
  ['Close-Grip Bench Press', 'weight_reps', 'triceps', ['chest'], 'barbell'],
  ['Triceps Pushdown', 'weight_reps', 'triceps', [], 'cable'],
  ['Rope Pushdown', 'weight_reps', 'triceps', [], 'cable'],
  ['Overhead Triceps Extension', 'weight_reps', 'triceps', [], 'cable'],
  ['Skull Crusher', 'weight_reps', 'triceps', [], 'barbell'],
  ['Dumbbell Kickback', 'weight_reps', 'triceps', [], 'dumbbell'],
  ['Triceps Dip', 'bodyweight_reps', 'triceps', ['chest'], 'bodyweight'],
  // Legs
  ['Back Squat', 'weight_reps', 'quads', ['glutes', 'hamstrings'], 'barbell'],
  ['Front Squat', 'weight_reps', 'quads', ['glutes', 'core'], 'barbell'],
  ['Goblet Squat', 'weight_reps', 'quads', ['glutes'], 'dumbbell'],
  ['Leg Press', 'weight_reps', 'quads', ['glutes'], 'machine'],
  ['Hack Squat', 'weight_reps', 'quads', ['glutes'], 'machine'],
  ['Bulgarian Split Squat', 'weight_reps', 'quads', ['glutes'], 'dumbbell'],
  ['Walking Lunge', 'weight_reps', 'quads', ['glutes'], 'dumbbell'],
  ['Leg Extension', 'weight_reps', 'quads', [], 'machine'],
  ['Romanian Deadlift', 'weight_reps', 'hamstrings', ['glutes', 'back'], 'barbell'],
  ['Dumbbell Romanian Deadlift', 'weight_reps', 'hamstrings', ['glutes'], 'dumbbell'],
  ['Lying Leg Curl', 'weight_reps', 'hamstrings', [], 'machine'],
  ['Seated Leg Curl', 'weight_reps', 'hamstrings', [], 'machine'],
  ['Good Morning', 'weight_reps', 'hamstrings', ['back'], 'barbell'],
  ['Standing Calf Raise', 'weight_reps', 'calves', [], 'machine'],
  ['Seated Calf Raise', 'weight_reps', 'calves', [], 'machine'],
  // Glutes
  ['Hip Thrust', 'weight_reps', 'glutes', ['hamstrings'], 'barbell'],
  ['Glute Bridge', 'bodyweight_reps', 'glutes', ['hamstrings'], 'bodyweight'],
  ['Cable Kickback', 'weight_reps', 'glutes', [], 'cable'],
  ['Hip Abduction Machine', 'weight_reps', 'glutes', [], 'machine'],
  ['Kettlebell Swing', 'weight_reps', 'glutes', ['hamstrings', 'back'], 'kettlebell'],
  // Core
  ['Plank', 'time', 'core', [], 'bodyweight'],
  ['Side Plank', 'time', 'core', [], 'bodyweight'],
  ['Hanging Leg Raise', 'bodyweight_reps', 'core', [], 'bodyweight'],
  ['Cable Crunch', 'weight_reps', 'core', [], 'cable'],
  ['Crunch', 'bodyweight_reps', 'core', [], 'bodyweight'],
  ['Ab Wheel Rollout', 'bodyweight_reps', 'core', [], 'other'],
  ['Russian Twist', 'bodyweight_reps', 'core', [], 'bodyweight'],
  ['Dead Bug', 'bodyweight_reps', 'core', [], 'bodyweight'],
  // Cardio
  ['Treadmill', 'cardio', 'cardio', [], 'cardio_machine'],
  ['Stationary Bike', 'cardio', 'cardio', [], 'cardio_machine'],
  ['Rowing Machine', 'cardio', 'cardio', ['back'], 'cardio_machine'],
  ['Elliptical', 'cardio', 'cardio', [], 'cardio_machine'],
  ['Stair Climber', 'cardio', 'cardio', ['glutes'], 'cardio_machine'],
  ['Outdoor Run', 'cardio', 'cardio', [], 'bodyweight'],
  ['Jump Rope', 'time', 'cardio', ['calves'], 'other'],
];

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const SEED_EXERCISES: Exercise[] = ROWS.map(([name, type, primaryMuscle, secondaryMuscles, equipment]) => ({
  id: 'ex-' + slug(name),
  name,
  type,
  primaryMuscle,
  secondaryMuscles,
  equipment,
  isCustom: false,
  archived: false,
}));

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core', cardio: 'Cardio', full_body: 'Full body',
};
export const MUSCLE_FILTERS: { key: string; label: string; muscles: Muscle[] }[] = [
  { key: 'all', label: 'All', muscles: [] },
  { key: 'chest', label: 'Chest', muscles: ['chest'] },
  { key: 'back', label: 'Back', muscles: ['back'] },
  { key: 'shoulders', label: 'Shoulders', muscles: ['shoulders'] },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'calves'] },
  { key: 'glutes', label: 'Glutes', muscles: ['glutes'] },
  { key: 'core', label: 'Core', muscles: ['core'] },
  { key: 'cardio', label: 'Cardio', muscles: ['cardio'] },
];
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable', bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell', cardio_machine: 'Cardio machine', band: 'Band', other: 'Other',
};
export const TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight × reps', bodyweight_reps: 'Bodyweight reps', time: 'Duration', cardio: 'Cardio',
};
