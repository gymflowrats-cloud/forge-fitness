import { useLiveQuery } from 'dexie-react-hooks';
import { BookmarkPlus, CopyPlus, GlassWater, Minus, MoreHorizontal, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { HeroCard } from '../../components/Card';
import { NumberInput, ProgressBar, Stepper } from '../../components/Controls';
import { AlertRow, toast } from '../../components/Feedback';
import { DateNav, Fab, Page, PageTitle } from '../../components/Layout';
import { Ring } from '../../components/Ring';
import { BottomSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { addWater, copyMealFromYesterday, defaultMealForNow, saveCombo, sumLogs } from '../../db/food';
import type { FoodLog } from '../../db/types';
import { useProfile, useSettings } from '../../hooks/useData';
import { shiftKey, todayKey } from '../../lib/dates';
import { fmtInt } from '../../lib/format';
import { AddFoodSheet } from './AddFoodSheet';

export default function Food() {
  const p = useProfile();
  const s = useSettings();
  const [date, setDate] = useState(todayKey());
  const logs = useLiveQuery(() => db.foodLogs.where('date').equals(date).toArray(), [date], [] as FoodLog[]) ?? [];
  const water = useLiveQuery(() => db.water.get(date), [date]);
  const wear = useLiveQuery(() => db.wearableDays.get(date), [date]);
  const [adding, setAdding] = useState(false);
  const [meal, setMeal] = useState(defaultMealForNow(s.meals));
  const [menuMeal, setMenuMeal] = useState<string | null>(null);
  const [comboName, setComboName] = useState('');
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const yLogs = useLiveQuery(() => db.foodLogs.where('date').equals(shiftKey(date, -1)).toArray(), [date], [] as FoodLog[]) ?? [];
  // Yesterday's non-empty meals: the tapped meal first, then its lunch/dinner partner, so swaps are one tap.
  const swapPair = (m: string | null) => ({ lunch: 'dinner', dinner: 'lunch' } as Record<string, string>)[(m ?? '').toLowerCase()];
  const mealRank = (m: string) => (m === menuMeal ? -2 : m.toLowerCase() === swapPair(menuMeal) ? -1 : s.meals.indexOf(m));
  const yesterdayMeals = [...new Set(yLogs.map((l) => l.meal))]
    .sort((a, b) => mealRank(a) - mealRank(b))
    .map((m) => {
      const items = yLogs.filter((l) => l.meal === m);
      return { meal: m, names: items.map((l) => l.name).join(', '), kcal: items.reduce((a, l) => a + l.calories, 0) };
    });

  const t = sumLogs(logs);
  const goal = p?.calorieTarget ?? 2200;
  const remaining = goal - t.calories;
  const over = remaining < 0;
  const isToday = date === todayKey();
  const hour = new Date().getHours();
  const proteinShort = (p?.proteinG ?? 0) - t.protein;
  const meals = [...s.meals, ...[...new Set(logs.map((l) => l.meal))].filter((m) => !s.meals.includes(m))];
  const waterOz = water?.oz ?? 0;

  const openAdd = (m?: string) => {
    setMeal(m ?? defaultMealForNow(s.meals));
    setAdding(true);
  };

  const macros = [
    { k: 'Protein', v: t.protein, g: p?.proteinG ?? 150 },
    { k: 'Carbs', v: t.carbs, g: p?.carbsG ?? 200 },
    { k: 'Fat', v: t.fat, g: p?.fatG ?? 70 },
  ];

  return (
    <Page>
      <PageTitle title="Food" sub="Calories & macros" right={<DateNav date={date} onChange={setDate} />} />

      <HeroCard>
        <div className="flex items-center gap-5">
          <Ring value={t.calories} max={goal}>
            <div className="text-[11px] text-white/70">{over ? 'over' : 'left'}</div>
            <div className="num text-[28px] font-extrabold tabular leading-none">{fmtInt(Math.abs(remaining))}</div>
            <div className="text-[11px] text-white/70">kcal</div>
          </Ring>
          <div className="min-w-0">
            <div className="text-white/75 text-[15px]">Eaten</div>
            <div className="num text-[46px] font-extrabold tracking-tight tabular leading-tight">{fmtInt(t.calories)}</div>
            <div className="text-white/75 text-[15px]">of {fmtInt(goal)} kcal goal</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4">
          {macros.map((m) => (
            <div key={m.k} className="min-w-0">
              <div className="text-[13px] text-white/70">{m.k}</div>
              <div className="text-[16px] font-bold tabular">
                {Math.round(m.v)}<span className="text-white/60 text-[13px]"> / {m.g}g</span>
              </div>
              <ProgressBar light value={m.v} max={m.g} className="mt-1.5 !h-1.5" />
            </div>
          ))}
        </div>
      </HeroCard>

      {wear?.caloriesOut != null && (
        <div className="card mt-3 px-5 py-3 flex items-center justify-between text-[14px]">
          <span className="text-muted">Fitbit burned <b className="text-ink tabular">{fmtInt(wear.caloriesOut)}</b> kcal{isToday ? ' so far' : ''}</span>
          <span className={`font-bold tabular ${t.calories - wear.caloriesOut > 0 ? 'text-danger' : 'text-success'}`}>
            Net {t.calories - wear.caloriesOut > 0 ? '+' : '−'}{fmtInt(Math.abs(t.calories - wear.caloriesOut))}
          </span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {over && <AlertRow tone="danger">You're <b>{fmtInt(-remaining)} kcal over</b> your goal{isToday ? ' today' : ''}.</AlertRow>}
        {!over && isToday && hour >= 17 && proteinShort > 20 && (
          <AlertRow>You're <b>{Math.round(proteinShort)}g short on protein</b> today. A shake or Greek yogurt would close the gap.</AlertRow>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {meals.map((m) => {
          const items = logs.filter((l) => l.meal === m).sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
          const kcal = items.reduce((a, l) => a + l.calories, 0);
          return (
            <section key={m} className="card overflow-hidden">
              <div className="flex items-center justify-between pl-5 pr-2 pt-3 pb-1">
                <div>
                  <h3 className="text-[18px] font-extrabold">{m}</h3>
                  <div className="text-[13px] text-muted">{items.length ? `${fmtInt(kcal)} kcal` : 'Nothing yet'}</div>
                </div>
                <div className="flex">
                  <button aria-label={`${m} options`} className="btn-ghost text-muted" onClick={() => setMenuMeal(m)}><MoreHorizontal size={22} /></button>
                  <button aria-label={`Add food to ${m}`} className="btn-ghost text-primary" onClick={() => openAdd(m)}><Plus size={24} strokeWidth={2.5} /></button>
                </div>
              </div>
              {items.length > 0 && (
                <div className="divide-y divide-line">
                  {items.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 pl-5 pr-2 py-2.5">
                      <button className="flex-1 min-w-0 text-left" onClick={() => setEditing(l)}>
                        <div className="font-semibold truncate">{l.name}{l.source !== 'manual' && <span className="ml-1.5 text-[10px] font-bold uppercase text-primary bg-soft rounded px-1.5 py-0.5 align-middle">{l.source}</span>}</div>
                        <div className="text-[13px] text-muted truncate">{l.servings !== 1 ? `${l.servings} × · ` : ''}P{Math.round(l.protein)} · C{Math.round(l.carbs)} · F{Math.round(l.fat)}</div>
                      </button>
                      <div className="font-bold tabular">{fmtInt(l.calories)}</div>
                      <button
                        aria-label={`Remove ${l.name}`}
                        className="btn-ghost text-muted"
                        onClick={async () => {
                          await db.foodLogs.delete(l.id);
                          toast(`Removed ${l.name}`, 'default', { label: 'Undo', run: () => db.foodLogs.put(l) });
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="h-2" />
            </section>
          );
        })}

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-extrabold">Water</h3>
              <div className="text-[13px] text-muted">{waterOz} / {s.waterGoalOz} oz</div>
            </div>
            <div className="flex gap-2">
              <button aria-label="Remove 8 oz water" className="btn-ghost bg-track" onClick={() => addWater(date, -8)} disabled={!waterOz}><Minus size={20} /></button>
              <button aria-label="Add 8 oz water" className="btn-ghost bg-accent text-accent-ink" onClick={() => addWater(date, 8)}><Plus size={20} /></button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-4 flex-wrap">
            {Array.from({ length: Math.max(8, Math.ceil(s.waterGoalOz / 8)) }, (_, i) => (
              <button key={i} aria-label={`Glass ${i + 1}`} onClick={() => addWater(date, (i + 1) * 8 - waterOz)} className={`h-11 w-9 rounded-xl flex items-center justify-center transition-colors ${i < waterOz / 8 ? 'bg-[#5B8DB8]/20 text-[#4A7FAE]' : 'bg-track text-muted/50'}`}>
                <GlassWater size={20} />
              </button>
            ))}
          </div>
        </section>
      </div>

      <Fab label="Add food" onClick={() => openAdd()} />
      <AddFoodSheet open={adding} onClose={() => setAdding(false)} date={date} meal={meal} setMeal={setMeal} />

      <BottomSheet open={!!menuMeal} onClose={() => { setMenuMeal(null); setComboName(''); }} title={menuMeal ?? ''}>
        <div className="space-y-3">
          <div className="section-label">Copy from yesterday into {menuMeal}</div>
          {yesterdayMeals.length === 0 && <div className="text-muted text-[14px]">Nothing was logged yesterday.</div>}
          {yesterdayMeals.map((ym) => (
            <button
              key={ym.meal}
              className="w-full min-h-[56px] rounded-btn bg-card border border-line px-4 py-2 flex items-center gap-3 text-left"
              onClick={async () => {
                const n = await copyMealFromYesterday(date, ym.meal, menuMeal!);
                toast(`Copied ${n} item${n > 1 ? 's' : ''} from yesterday's ${ym.meal.toLowerCase()}`, 'success');
                setMenuMeal(null);
              }}
            >
              <CopyPlus size={20} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Yesterday's {ym.meal.toLowerCase()}</div>
                <div className="text-[13px] text-muted truncate">{ym.names}</div>
              </div>
              <span className="font-bold tabular text-[14px] shrink-0">{ym.kcal} kcal</span>
            </button>
          ))}
          <div className="card p-4 space-y-3">
            <div className="font-semibold flex items-center gap-2"><BookmarkPlus size={20} /> Save as reusable combo</div>
            <input className="input" placeholder={`e.g. My usual ${menuMeal?.toLowerCase()}`} value={comboName} onChange={(e) => setComboName(e.target.value)} />
            <button
              className="btn-primary"
              disabled={!comboName.trim()}
              onClick={async () => {
                const ok = await saveCombo(comboName.trim(), date, menuMeal!);
                toast(ok ? 'Combo saved — find it under Add Food → Saved' : 'Log some food in this meal first', ok ? 'success' : 'error');
                if (ok) { setMenuMeal(null); setComboName(''); }
              }}
            >
              Save combo
            </button>
          </div>
        </div>
      </BottomSheet>

      <EditLogSheet log={editing} onClose={() => setEditing(null)} />
    </Page>
  );
}

function EditLogSheet({ log, onClose }: { log: FoodLog | null; onClose: () => void }) {
  const [draft, setDraft] = useState<FoodLog | null>(null);
  if (log && (!draft || draft.id !== log.id)) setDraft(log);
  if (!log || !draft) return null;
  const per = (k: 'calories' | 'protein' | 'carbs' | 'fat') => (log.servings ? log[k] / log.servings : log[k]);
  const setServings = (v: number | null) => {
    const n = v ?? 1;
    setDraft({ ...draft, servings: n, calories: Math.round(per('calories') * n), protein: Math.round(per('protein') * n * 10) / 10, carbs: Math.round(per('carbs') * n * 10) / 10, fat: Math.round(per('fat') * n * 10) / 10 });
  };
  return (
    <BottomSheet open onClose={onClose} title="Edit entry" footer={<button className="btn-primary" onClick={async () => { await db.foodLogs.put(draft); onClose(); }}>Save</button>}>
      <div className="space-y-4">
        <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Name" />
        <div className="flex items-center justify-between">
          <span className="font-semibold">Servings</span>
          <Stepper value={draft.servings} onChange={setServings} step={0.5} min={0.25} decimals={2} label="servings" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <label key={k} className="block">
              <span className="text-[11px] font-bold uppercase text-muted">{k === 'calories' ? 'kcal' : k}</span>
              <NumberInput value={draft[k]} onChange={(v) => setDraft({ ...draft, [k]: v ?? 0 })} className="w-full h-12 rounded-xl bg-card border border-line text-center font-bold tabular outline-none focus:border-primary" />
            </label>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
