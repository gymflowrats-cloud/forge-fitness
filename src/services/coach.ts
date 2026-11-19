import { db } from '../db/db';
import type { CoachMessage, CoachSuggestion, Template } from '../db/types';
import { uid } from '../lib/id';
import { fromDispW } from '../lib/units';
import { COACH_SCHEMA, COACH_SYSTEM, RECAP_SCHEMA, buildCoachContext } from './coachContext';
import { generateJSON, type Content } from './gemini';

async function systemWithContext() {
  const ctx = await buildCoachContext();
  return `${COACH_SYSTEM}\n\nUSER DATA (JSON):\n${JSON.stringify(ctx)}`;
}

export async function askCoach(text: string): Promise<void> {
  const userMsg: CoachMessage = { id: uid(), role: 'user', content: text, createdAt: new Date().toISOString(), kind: 'chat' };
  await db.coachMessages.add(userMsg);
  const history = (await db.coachMessages.orderBy('createdAt').toArray()).slice(-14);
  const contents: Content[] = history.map((m) => ({ role: m.role, parts: [{ text: m.content }] }));
  let r: { reply: string; suggestions?: CoachSuggestion[] };
  try {
    r = await generateJSON<{ reply: string; suggestions?: CoachSuggestion[] }>({ system: await systemWithContext(), schema: COACH_SCHEMA, contents, temperature: 0.5 });
  } catch (e) {
    await db.coachMessages.delete(userMsg.id); // don't leave an unanswered question behind
    throw e;
  }
  await db.coachMessages.add({
    id: uid(), role: 'model', content: r.reply || '…', createdAt: new Date().toISOString(), kind: 'chat',
    structured: (r.suggestions ?? []).filter((s) => s.newTargetWeight != null || s.newTargetRepsMin != null),
  });
}

export async function weeklyRecap(): Promise<void> {
  const r = await generateJSON<{ headline: string; wins: string[]; slipped: string[]; actions: string[]; suggestions?: CoachSuggestion[] }>({
    system: await systemWithContext(),
    schema: RECAP_SCHEMA,
    temperature: 0.5,
    contents: [{ role: 'user', parts: [{ text: 'Write my weekly recap focused on the last 7 days (use the 4-week data for comparison): wins, what slipped, and exactly 3 specific actions for next week.' }] }],
  });
  const md = [
    `### ${r.headline}`,
    '**Wins**',
    ...(r.wins ?? []).map((w) => `- ${w}`),
    '',
    '**What slipped**',
    ...(r.slipped?.length ? r.slipped.map((w) => `- ${w}`) : ['- Nothing major 👏']),
    '',
    '**Next week**',
    ...(r.actions ?? []).slice(0, 3).map((a, i) => `${i + 1}. ${a}`),
  ].join('\n');
  await db.coachMessages.add({
    id: uid(), role: 'model', content: md, createdAt: new Date().toISOString(), kind: 'recap',
    structured: (r.suggestions ?? []).filter((s) => s.newTargetWeight != null || s.newTargetRepsMin != null),
  });
}

export interface ResolvedSuggestion {
  template: Template;
  index: number;
  exerciseName: string;
  before: { weight: number | null; min: number; max: number };
  after: { weight: number | null; min: number; max: number };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function resolveSuggestion(s: CoachSuggestion): Promise<ResolvedSuggestion | null> {
  const templates = await db.templates.filter((t) => !t.archived).toArray();
  const exercises = await db.exercises.toArray();
  const profile = await db.profile.get('me');
  const u = profile?.units ?? 'imperial';
  const candidates = templates.filter((t) => norm(t.name) === norm(s.templateName));
  const pool = candidates.length ? candidates : templates;
  for (const t of pool) {
    const index = t.exercises.findIndex((te) => {
      const n = norm(exercises.find((e) => e.id === te.exerciseId)?.name ?? '');
      return n === norm(s.exerciseName) || n.includes(norm(s.exerciseName)) || norm(s.exerciseName).includes(n);
    });
    if (index >= 0) {
      const te = t.exercises[index]!;
      const min = s.newTargetRepsMin ?? te.targetRepsMin;
      const max = Math.max(min, s.newTargetRepsMax ?? (s.newTargetRepsMin != null ? s.newTargetRepsMin : te.targetRepsMax));
      return {
        template: t, index, exerciseName: exercises.find((e) => e.id === te.exerciseId)?.name ?? s.exerciseName,
        before: { weight: te.targetWeight, min: te.targetRepsMin, max: te.targetRepsMax },
        after: { weight: s.newTargetWeight != null ? fromDispW(s.newTargetWeight, u) : te.targetWeight, min, max },
      };
    }
  }
  return null;
}

export async function applySuggestion(msgId: string, idx: number, r: ResolvedSuggestion) {
  const t = await db.templates.get(r.template.id);
  if (!t) return;
  const list = [...t.exercises];
  list[r.index] = { ...list[r.index]!, targetWeight: r.after.weight, targetRepsMin: r.after.min, targetRepsMax: r.after.max };
  await db.templates.update(t.id, { exercises: list });
  const m = await db.coachMessages.get(msgId);
  if (m?.structured) {
    const s = [...m.structured];
    s[idx] = { ...s[idx]!, applied: true };
    await db.coachMessages.update(msgId, { structured: s });
  }
}
