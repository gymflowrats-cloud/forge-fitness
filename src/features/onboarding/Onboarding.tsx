import { Dumbbell } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, NumberInput, SegmentedControl } from '../../components/Controls';
import { db } from '../../db/db';
import { completeOnboarding } from '../../db/settings';
import type { Profile } from '../../db/types';
import { suggestTargets, type Activity, type Goal, type Sex } from '../../lib/calc';
import { todayKey } from '../../lib/dates';
import { uid } from '../../lib/id';
import { fromDispL, fromDispW, type Units } from '../../lib/units';

export const GOAL_LABELS: Record<Goal, string> = { lose: 'Lose fat', build: 'Build muscle', recomp: 'Recomp', maintain: 'Maintain' };
export const ACTIVITY_LABELS: Record<Activity, { label: string; sub: string }> = {
  sedentary: { label: 'Sedentary', sub: 'Desk job, little walking' },
  light: { label: 'Light', sub: 'Train 1–3×/week' },
  moderate: { label: 'Moderate', sub: 'Train 3–5×/week' },
  active: { label: 'Active', sub: 'Train 6–7×/week' },
  very_active: { label: 'Very active', sub: 'Physical job + training' },
};

export default function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [units, setUnits] = useState<Units>('imperial');
  const [heightFt, setHeightFt] = useState<number | null>(null);
  const [heightInPart, setHeightInPart] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal>('recomp');
  const [activity, setActivity] = useState<Activity>('moderate');
  const [override, setOverride] = useState<{ calories?: number | null; protein?: number | null }>({});

  const heightIn = units === 'imperial' ? (heightFt ?? 0) * 12 + (heightInPart ?? 0) : fromDispL(heightCm ?? 0, 'metric');
  const weightLb = weight ? fromDispW(weight, units) : 0;
  const targets = useMemo(
    () => {
      if (!weightLb) return null;
      // Missing details fall back to typical values; sex not given = average of both formulas.
      const base = { weightLb, heightIn: heightIn || 68, age: age || 30, activity, goal };
      if (sex) return suggestTargets({ ...base, sex });
      const m = suggestTargets({ ...base, sex: 'male' });
      const f = suggestTargets({ ...base, sex: 'female' });
      const avg = (a: number, b: number) => Math.round((a + b) / 20) * 10;
      return { calories: avg(m.calories, f.calories), protein: m.protein, carbs: Math.round((m.carbs + f.carbs) / 2), fat: Math.round((m.fat + f.fat) / 2), tdee: Math.round((m.tdee + f.tdee) / 2) };
    },
    [sex, weightLb, heightIn, age, activity, goal],
  );

  async function finish(skip = false) {
    const t = targets ?? { calories: 2200, protein: 150, carbs: 220, fat: 70 };
    const calories = override.calories ?? t.calories;
    const protein = override.protein ?? t.protein;
    const fat = Math.round((calories * 0.27) / 9);
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    const profile: Profile = {
      id: 'me',
      name: name.trim() || 'Athlete',
      sex: sex ?? 'male',
      birthYear: new Date().getFullYear() - (age ?? 30),
      heightIn: heightIn || 70,
      units,
      goal,
      activityLevel: activity,
      calorieTarget: calories,
      proteinG: protein,
      carbsG: carbs,
      fatG: fat,
      goalWeight: goalWeight ? fromDispW(goalWeight, units) : null,
      startWeight: weightLb || null,
      checkInDay: 0,
      createdAt: new Date().toISOString(),
    };
    await db.profile.put(profile);
    if (weightLb && !skip) {
      const d = todayKey();
      const existing = await db.bodyWeights.where('date').equals(d).first();
      await db.bodyWeights.put({ id: existing?.id ?? uid(), date: d, weight: weightLb });
    }
    await completeOnboarding();
    nav('/settings/routines?welcome=1', { replace: true });
  }

  const wU = units === 'metric' ? 'kg' : 'lb';

  return (
    <div className="min-h-full flex flex-col bg-bg">
      <div className="rounded-b-[32px] hero-surface text-white px-6 pb-8" style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)' }}>
        <div className="flex items-center justify-between mt-6">
          <div className="h-16 w-16 rounded-[20px] bg-white text-primary flex items-center justify-center">
            <Dumbbell size={34} strokeWidth={2.4} />
          </div>
          <button className="text-white/80 font-semibold min-h-[44px] px-2" onClick={() => finish(true)}>
            Skip
          </button>
        </div>
        <h1 className="text-[44px] font-extrabold tracking-tight mt-5 leading-none">Forge</h1>
        <p className="text-white/80 text-[19px] mt-2">Your calm training command center</p>
        <div className="flex gap-1.5 mt-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-white' : 'bg-white/25'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 pt-6 pb-8 max-w-md w-full mx-auto space-y-5">
        {step === 0 && (
          <>
            <div>
              <h2 className="text-[24px] font-extrabold">About you</h2>
              <p className="text-muted text-[14px] mt-1">Everything here is optional. It's only used to suggest calorie and protein targets.</p>
            </div>
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="given-name" />
            </Field>
            <Field label="Units">
              <SegmentedControl
                options={[{ value: 'imperial', label: 'lb / in' }, { value: 'metric', label: 'kg / cm' }]}
                value={units}
                onChange={setUnits}
              />
            </Field>
            <Field label="Sex">
              <div className="grid grid-cols-2 gap-2">
                {(['male', 'female'] as Sex[]).map((x) => (
                  <button key={x} onClick={() => setSex(sex === x ? null : x)} className={`min-h-[48px] rounded-btn border font-bold ${sex === x ? 'bg-primary text-white border-primary' : 'bg-card border-line'}`}>
                    {x === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <NumberInput value={age} onChange={setAge} decimal={false} placeholder="—" />
              </Field>
              {units === 'imperial' ? (
                <Field label="Height (ft / in)">
                  <div className="flex gap-2">
                    <NumberInput value={heightFt} onChange={setHeightFt} decimal={false} ariaLabel="Feet" placeholder="ft" />
                    <NumberInput value={heightInPart} onChange={setHeightInPart} ariaLabel="Inches" placeholder="in" />
                  </div>
                </Field>
              ) : (
                <Field label="Height (cm)">
                  <NumberInput value={heightCm} onChange={setHeightCm} placeholder="cm" />
                </Field>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-[24px] font-extrabold">Your goal</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Current weight (${wU})`}>
                <NumberInput value={weight} onChange={setWeight} placeholder="optional" />
              </Field>
              <Field label={`Goal weight (${wU})`}>
                <NumberInput value={goalWeight} onChange={setGoalWeight} placeholder="optional" />
              </Field>
            </div>
            <div>
              <span className="label">Goal</span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGoal(g)}
                    className={`min-h-[52px] rounded-btn border font-bold ${goal === g ? 'bg-primary text-white border-primary' : 'bg-card border-line'}`}
                  >
                    {GOAL_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Activity level</span>
              <div className="space-y-2">
                {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setActivity(a)}
                    className={`w-full min-h-[56px] rounded-btn border px-4 text-left flex items-center justify-between ${
                      activity === a ? 'bg-primary text-white border-primary' : 'bg-card border-line'
                    }`}
                  >
                    <span className="font-bold">{ACTIVITY_LABELS[a].label}</span>
                    <span className={`text-sm ${activity === a ? 'text-white/80' : 'text-muted'}`}>{ACTIVITY_LABELS[a].sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-[24px] font-extrabold">Daily targets</h2>
            {targets ? (
              <p className="text-muted">
                Estimated maintenance is <b className="text-ink">{targets.tdee.toLocaleString()} kcal</b> (Mifflin-St Jeor × activity). Adjusted for your
                goal, we suggest:
              </p>
            ) : (
              <p className="text-muted">Add your current weight for a personal suggestion. You can change these any time in Settings.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Calories (kcal)">
                <NumberInput value={override.calories ?? targets?.calories ?? 2200} onChange={(v) => setOverride((o) => ({ ...o, calories: v }))} decimal={false} />
              </Field>
              <Field label="Protein (g)">
                <NumberInput value={override.protein ?? targets?.protein ?? 150} onChange={(v) => setOverride((o) => ({ ...o, protein: v }))} decimal={false} />
              </Field>
            </div>
            <p className="text-sm text-muted">Carbs and fat are split from the remaining calories (≈27% fat). Next, you'll set up your workout routine.</p>
          </>
        )}

        <div className="pt-2 flex gap-3">
          {step > 0 && (
            <button className="btn-secondary flex-1 min-h-[52px] !rounded-btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button className="btn-primary flex-[2]" onClick={() => (step < 2 ? setStep(step + 1) : finish())}>
            {step < 2 ? 'Continue' : 'Build my routine'}
          </button>
        </div>
      </div>
    </div>
  );
}
