import { useState } from 'react';
import { Field, SegmentedControl, Stepper, Toggle } from '../../components/Controls';
import { toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { db } from '../../db/db';
import { setSetting } from '../../db/settings';
import { useProfile, useSettings } from '../../hooks/useData';
import type { Units } from '../../lib/units';

export default function Preferences() {
  const s = useSettings();
  const p = useProfile();
  const [mealText, setMealText] = useState<string | null>(null);
  return (
    <Page>
      <BackHeader title="Units, theme & logging" />
      <div className="space-y-5">
        <Field label="Units" hint="Data is stored in a unit-independent way, so switching is safe.">
          <SegmentedControl
            options={[{ value: 'imperial', label: 'lb / in' }, { value: 'metric', label: 'kg / cm' }]}
            value={p?.units ?? 'imperial'}
            onChange={(v: Units) => p && db.profile.update('me', { units: v })}
          />
        </Field>
        <Field label="Theme">
          <SegmentedControl
            size="sm"
            options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            value={s.theme}
            onChange={(v) => setSetting('theme', v)}
          />
        </Field>
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Weight step (lb)</span>
            <Stepper value={s.weightStepLb} onChange={(v) => setSetting('weightStepLb', v || 5)} step={2.5} min={0.5} label="pound step" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Weight step (kg)</span>
            <Stepper value={s.weightStepKg} onChange={(v) => setSetting('weightStepKg', v || 2.5)} step={0.5} min={0.25} decimals={2} label="kilogram step" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Default rest (sec)</span>
            <Stepper value={s.defaultRestSec} onChange={(v) => setSetting('defaultRestSec', v || 90)} step={15} decimals={0} label="default rest" inputMode="numeric" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Water goal (oz)</span>
            <Stepper value={s.waterGoalOz} onChange={(v) => setSetting('waterGoalOz', v || 64)} step={8} decimals={0} label="water goal" inputMode="numeric" />
          </div>
          <div className="flex items-center justify-between min-h-[44px]">
            <span className="font-semibold">Sound when rest ends</span>
            <Toggle checked={s.restSound} onChange={(v) => setSetting('restSound', v)} label="Rest timer sound" />
          </div>
        </div>
        <Field label="Meals (comma separated)">
          <input
            className="input"
            value={mealText ?? s.meals.join(', ')}
            onChange={(e) => setMealText(e.target.value)}
            onBlur={async () => {
              if (mealText == null) return;
              const meals = mealText.split(',').map((m) => m.trim()).filter(Boolean);
              if (meals.length) {
                await setSetting('meals', meals);
                toast('Meals updated', 'success');
              }
              setMealText(null);
            }}
          />
        </Field>
      </div>
    </Page>
  );
}
