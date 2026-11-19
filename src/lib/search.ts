// Forgiving exercise search: word-by-word, ignores punctuation/hyphens, understands gym shorthand.
const SYNONYMS: Record<string, string> = {
  db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell', ez: 'ez bar', ohp: 'overhead press', rdl: 'romanian deadlift',
  sldl: 'romanian deadlift', bench: 'bench', bp: 'bench press', dl: 'deadlift', pulldown: 'pulldown', lat: 'lat', tri: 'triceps',
  tricep: 'triceps', bi: 'biceps', bicep: 'biceps', delt: 'delt', delts: 'shoulders', abs: 'core', ab: 'core', quad: 'quads', ham: 'hamstrings',
  hammies: 'hamstrings', glute: 'glutes', calf: 'calves', shoulder: 'shoulders', pec: 'chest', pecs: 'chest', legs: 'quads hamstrings calves',
  cardio: 'cardio', treadmill: 'treadmill', run: 'run', bike: 'bike', row: 'row', fly: 'fly', flye: 'fly', flyes: 'fly', flies: 'fly',
  squats: 'squat', curls: 'curl', rows: 'row', presses: 'press', raises: 'raise', dips: 'dip', lunges: 'lunge', pullups: 'pullup', chinups: 'chinup',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const squash = (s: string) => norm(s).replace(/ /g, '');

export interface Searchable {
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  equipment: string;
}

/** Returns a score > 0 when every query word matches (higher = better), 0 when it doesn't match. */
export function matchScore(e: Searchable, query: string): number {
  const q = norm(query);
  if (!q) return 1;
  const name = norm(e.name);
  const hay = `${name} ${norm(e.primaryMuscle)} ${(e.secondaryMuscles ?? []).map(norm).join(' ')} ${norm(e.equipment.replace('_', ' '))}`;
  const hayWords = hay.split(' ');
  const haySquash = squash(hay);
  let score = 0;
  for (const raw of q.split(' ')) {
    const alts = [raw, ...(SYNONYMS[raw] ? [SYNONYMS[raw]!] : [])];
    let best = 0;
    for (const alt of alts) {
      for (const w of alt.split(' ')) {
        if (name.split(' ').some((nw) => nw.startsWith(w))) best = Math.max(best, 3);
        else if (hayWords.some((hw) => hw.startsWith(w))) best = Math.max(best, 2);
        else if (haySquash.includes(squash(w))) best = Math.max(best, 1);
      }
    }
    if (!best) return 0;
    score += best;
  }
  if (name.startsWith(q)) score += 5;
  if (squash(e.name).includes(squash(query))) score += 2;
  return score;
}

export function searchExercises<T extends Searchable>(list: T[], query: string): T[] {
  if (!query.trim()) return [...list].sort((a, b) => a.name.localeCompare(b.name));
  return list
    .map((e) => ({ e, s: matchScore(e, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .map((x) => x.e);
}
