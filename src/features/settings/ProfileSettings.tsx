import { useEffect, useState } from 'react';
import { Field, NumberInput, SegmentedControl } from '../../components/Controls';
import { toast } from '../../components/Feedback';
import { setSetting } from '../../db/settings';
import { BackHeader, Page } from '../../components/Layout';
import { db } from '../../db/db';
import type { Profile } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { defaultProfile } from '../../db/settings';
import { suggestTargets, type Activity, type Goal } from '../../lib/calc';
import { WEEKDAYS } from '../../lib/dates';
import { fromDispL, fromDispW, toDispL, toDispW, wUnit, lUnit } from '../../lib/units';
import { ACTIVITY_LABELS, GOAL_LABELS } from '../onboarding/Onboarding';

export default function ProfileSettings() {
  // null = loaded but nothing saved yet → start from defaults instead of showing an empty page
  const p = useLiveQuery(() => db.profile.get('me').then((x) => x ?? null), []);
  const [draft, setDraft] = useState<Profile | null>(null);
  useEffect(() => {
    if (p !== undefined && !draft) setDraft(p ?? defaultProfile());
  }, [p, draft]);
  if (!draft) return <Page><BackHeader title="Profile & goals" /><div className="card p-8 text-center text-muted">Loading…</div></Page>;
  const u = draft.units;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft({ ...draft, [k]: v });

  async function recalc() {
    const last = await db.bodyWeights.orderBy('date').last();
    const weightLb = last?.weight ?? draft!.startWeight ?? 170;
    const t = suggestTargets({
      sex: draft!.sex, weightLb, heightIn: draft!.heightIn, age: new Date().getFullYear() - draft!.birthYear, activity: draft!.activityLevel, goal: draft!.goal,
    });
    setDraft({ ...draft!, calorieTarget: t.calories, proteinG: t.protein, carbsG: t.carbs, fatG: t.fat });
    toast(`Suggested ${t.calories} kcal (maintenance ≈ ${t.tdee})`);
  }
  async function save() {
    await db.profile.put(draft!);
    await setSetting('onboarded', true);
    toast('Saved', 'success');
  }

  return (
    <Page>
      <BackHeader title="Profile & goals" />
      <div className="space-y-4">
        <Field label="Name">
          <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <SegmentedControl options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} value={draft.sex} onChange={(v) => set('sex', v)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Birth year">
            <NumberInput value={draft.birthYear} onChange={(v) => set('birthYear', v ?? draft.birthYear)} decimal={false} />
          </Field>
          <Field label={`Height (${lUnit(u)})`}>
            <NumberInput value={toDispL(draft.heightIn, u)} onChange={(v) => v && set('heightIn', fromDispL(v, u))} />
          </Field>
        </div>
        <div>
          <span className="label">Goal</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
              <button key={g} onClick={() => set('goal', g)} className={`min-h-[48px] rounded-btn border font-bold ${draft.goal === g ? 'bg-primary text-white border-primary' : 'bg-card border-line'}`}>
                {GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
        <Field label="Activity level">
          <select className="input" value={draft.activityLevel} onChange={(e) => set('activityLevel', e.target.value as Activity)}>
            {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
              <option key={a} value={a}>{ACTIVITY_LABELS[a].label} — {ACTIVITY_LABELS[a].sub}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Start weight (${wUnit(u)})`}>
            <NumberInput value={toDispW(draft.startWeight, u)} onChange={(v) => set('startWeight', v == null ? null : fromDispW(v, u))} />
          </Field>
          <Field label={`Goal weight (${wUnit(u)})`}>
            <NumberInput value={toDispW(draft.goalWeight, u)} onChange={(v) => set('goalWeight', v == null ? null : fromDispW(v, u))} />
          </Field>
        </div>
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold">Daily targets</div>
            <button className="btn-secondary !min-h-[36px] text-sm" onClick={recalc}>Recalculate</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories"><NumberInput value={draft.calorieTarget} onChange={(v) => set('calorieTarget', v ?? 0)} decimal={false} /></Field>
            <Field label="Protein (g)"><NumberInput value={draft.proteinG} onChange={(v) => set('proteinG', v ?? 0)} decimal={false} /></Field>
            <Field label="Carbs (g)"><NumberInput value={draft.carbsG} onChange={(v) => set('carbsG', v ?? 0)} decimal={false} /></Field>
            <Field label="Fat (g)"><NumberInput value={draft.fatG} onChange={(v) => set('fatG', v ?? 0)} decimal={false} /></Field>
          </div>
          <div className="text-xs text-muted">Macros = {draft.proteinG * 4 + draft.carbsG * 4 + draft.fatG * 9} kcal</div>
        </div>
        <Field label="Weekly check-in day">
          <select className="input" value={draft.checkInDay} onChange={(e) => set('checkInDay', Number(e.target.value))}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </Field>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>
    </Page>
  );
}
