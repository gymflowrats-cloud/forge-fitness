import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Loader2, Pencil, Sparkles, Star, Trash2, Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip, ChipRow, Field, NumberInput, SegmentedControl, Stepper, Toggle } from '../../components/Controls';
import { SearchBox } from '../../components/ExercisePicker';
import { toast } from '../../components/Feedback';
import { FullSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { logCombo, logFood } from '../../db/food';
import type { Food, MealCombo } from '../../db/types';
import { useOnline } from '../../hooks/useOnline';
import { useSettings } from '../../hooks/useData';
import { GeminiError, imageToBase64, parseFoodPhoto, parseFoodText, type ParsedFood } from '../../services/gemini';

type Tab = 'quick' | 'saved' | 'ai';

export function AddFoodSheet({ open, onClose, date, meal, setMeal }: { open: boolean; onClose: () => void; date: string; meal: string; setMeal: (m: string) => void }) {
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>('quick');
  return (
    <FullSheet open={open} onClose={onClose} title="Add Food">
      <div className="space-y-5">
        <SegmentedControl
          options={[{ value: 'quick', label: 'Quick' }, { value: 'saved', label: 'Saved' }, { value: 'ai', label: <span className="inline-flex items-center gap-1.5"><Sparkles size={16} /> AI</span> }]}
          value={tab}
          onChange={setTab}
        />
        <div>
          <div className="section-label mb-2">Meal</div>
          <ChipRow>
            {settings.meals.map((m) => (
              <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>{m}</Chip>
            ))}
          </ChipRow>
        </div>
        {tab === 'quick' && <QuickAdd date={date} meal={meal} onDone={onClose} />}
        {tab === 'saved' && <SavedFoods date={date} meal={meal} />}
        {tab === 'ai' && <AIAdd date={date} meal={meal} onDone={onClose} />}
      </div>
    </FullSheet>
  );
}

function QuickAdd({ date, meal, onDone }: { date: string; meal: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [cal, setCal] = useState<number | null>(null);
  const [p, setP] = useState<number | null>(null);
  const [c, setC] = useState<number | null>(null);
  const [f, setF] = useState<number | null>(null);
  const [serving, setServing] = useState('');
  const [servings, setServings] = useState<number | null>(1);
  const [fav, setFav] = useState(false);
  const save = async () => {
    if (!cal && cal !== 0) return toast('Enter calories', 'error');
    await logFood(date, meal, { name: name || 'Quick add', calories: cal, protein: p ?? 0, carbs: c ?? 0, fat: f ?? 0, servings: servings ?? 1, servingDesc: serving || '1 serving' }, 'manual', fav);
    toast(`Logged ${name || 'food'} · ${Math.round(cal * (servings ?? 1))} kcal`, 'success');
    onDone();
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <NumberInput
          ariaLabel="Calories"
          value={cal}
          onChange={setCal}
          placeholder="0"
          decimal={false}
          className="flex-1 min-w-0 h-[88px] rounded-btn bg-card border border-line text-center text-[52px] font-extrabold tabular outline-none focus:border-primary placeholder:text-muted/40"
        />
        <span className="text-[22px] font-extrabold text-muted">kcal</span>
      </div>
      <Field label="Name">
        <input className="input" placeholder="e.g. Chicken burrito bowl" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Protein g"><NumberInput value={p} onChange={setP} placeholder="0" /></Field>
        <Field label="Carbs g"><NumberInput value={c} onChange={setC} placeholder="0" /></Field>
        <Field label="Fat g"><NumberInput value={f} onChange={setF} placeholder="0" /></Field>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <Field label="Serving (optional)"><input className="input" placeholder="1 bowl" value={serving} onChange={(e) => setServing(e.target.value)} /></Field>
        <div>
          <span className="label">Servings</span>
          <Stepper value={servings} onChange={setServings} step={0.5} min={0.25} decimals={2} label="servings" compact />
        </div>
      </div>
      <div className="card px-4 min-h-[56px] flex items-center justify-between">
        <span className="font-semibold flex items-center gap-2"><Star size={18} className="text-warn" /> Save to My foods</span>
        <Toggle checked={fav} onChange={setFav} label="Save to My foods" />
      </div>
      <button className="btn-primary" onClick={save}>Save Food</button>
    </div>
  );
}

function SavedFoods({ date, meal }: { date: string; meal: string }) {
  const [q, setQ] = useState('');
  const [servings, setServings] = useState<number | null>(1);
  const recent = useLiveQuery(() => db.foods.orderBy('lastUsedAt').reverse().limit(12).toArray(), [], [] as Food[]) ?? [];
  const mine = useLiveQuery(() => db.foods.filter((f) => f.isFavorite).toArray(), [], [] as Food[]) ?? [];
  const all = useLiveQuery(() => (q ? db.foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).limit(30).toArray() : Promise.resolve([] as Food[])), [q], [] as Food[]) ?? [];
  const combos = useLiveQuery(() => db.mealCombos.toArray(), [], [] as MealCombo[]) ?? [];
  const log = async (f: Food) => {
    const l = await logFood(date, meal, { ...f, foodId: f.id, servings: servings ?? 1 });
    toast(`Added ${f.name} · ${l.calories} kcal`, 'success', { label: 'Undo', run: () => db.foodLogs.delete(l.id) });
  };
  const list = q ? all : mine;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Servings</span>
        <Stepper value={servings} onChange={setServings} step={0.5} min={0.25} decimals={2} label="servings" compact />
      </div>
      {recent.length > 0 && (
        <div>
          <div className="section-label mb-2">Recent · tap to log</div>
          <ChipRow>
            {recent.map((f) => (
              <Chip key={f.id} onClick={() => log(f)}>
                {f.name} <span className="text-muted text-[13px]">{f.calories}</span>
              </Chip>
            ))}
          </ChipRow>
        </div>
      )}
      {combos.length > 0 && (
        <div>
          <div className="section-label mb-2">Meal combos</div>
          <div className="space-y-2">
            {combos.map((c) => (
              <div key={c.id} className="card px-4 py-3 flex items-center gap-3">
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={async () => {
                    const n = await logCombo(c.id, date, meal);
                    toast(`Logged ${c.name} (${n} items)`, 'success');
                  }}
                >
                  <div className="font-bold truncate">{c.name}</div>
                  <div className="text-[13px] text-muted truncate">{c.items.length} items · {c.items.reduce((a, i) => a + i.calories, 0)} kcal</div>
                </button>
                <button aria-label={`Delete combo ${c.name}`} className="btn-ghost text-muted" onClick={() => db.mealCombos.delete(c.id)}><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3">
        <div className="section-label">{q ? 'Search results' : 'My foods'}</div>
        <SearchBox value={q} onChange={setQ} placeholder="Search foods you've logged" />
        {list.length === 0 && <div className="text-muted text-center py-6 text-[15px]">{q ? 'No matches' : 'Star foods when you add them to see them here.'}</div>}
        <div className="space-y-2">
          {list.map((f) => (
            <div key={f.id} className="card px-4 py-3 flex items-center gap-3">
              <button className="flex-1 min-w-0 text-left" onClick={() => log(f)}>
                <div className="font-bold truncate">{f.name}</div>
                <div className="text-[13px] text-muted truncate">{f.servingDesc} · P{f.protein} C{f.carbs} F{f.fat}</div>
              </button>
              <div className="font-extrabold tabular">{f.calories}</div>
              <button aria-label={f.isFavorite ? 'Remove from My foods' : 'Add to My foods'} className="btn-ghost" onClick={() => db.foods.update(f.id, { isFavorite: !f.isFavorite })}>
                <Star size={20} className={f.isFavorite ? 'text-warn fill-warn' : 'text-muted'} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIAdd({ date, meal, onDone }: { date: string; meal: string; onDone: () => void }) {
  const settings = useSettings();
  const online = useOnline();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'text' | 'photo' | null>(null);
  const [items, setItems] = useState<ParsedFood[] | null>(null);
  const [source, setSource] = useState<'ai' | 'photo'>('ai');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const configured = settings.aiMode === 'proxy' ? !!settings.proxyUrl : !!settings.geminiKey;

  const run = async (fn: () => Promise<ParsedFood[]>, kind: 'text' | 'photo') => {
    setBusy(kind);
    try {
      const r = await fn();
      if (!r.length) toast("Couldn't find any food in that", 'error');
      setItems(r);
      setSource(kind === 'photo' ? 'photo' : 'ai');
    } catch (e) {
      toast(e instanceof GeminiError ? e.message : 'AI request failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (!configured)
    return (
      <div className="card p-5 space-y-3">
        <div className="font-bold text-[17px]">Set up AI food logging</div>
        <p className="text-muted text-[15px]">Describe a meal or snap a photo and Gemini estimates calories and macros. Needs a free Gemini API key from Google AI Studio.</p>
        <button className="btn-primary" onClick={() => nav('/settings/ai')}>Add API key</button>
      </div>
    );

  const update = (i: number, patch: Partial<ParsedFood>) => setItems((list) => list!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const total = (items ?? []).reduce((a, i) => a + i.calories, 0);

  return (
    <div className="space-y-4">
      {!online && <div className="text-warn font-semibold text-[15px]">You're offline — AI needs internet. Use Quick add instead.</div>}
      {!items && (
        <>
          <Field label="Describe what you ate">
            <textarea className="input py-3 min-h-[110px]" placeholder="2 eggs, 2 slices wheat toast with butter, black coffee" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <button className="btn-primary" disabled={!text.trim() || !!busy || !online} onClick={() => run(() => parseFoodText(text), 'text')}>
            {busy === 'text' ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />} Describe with AI
          </button>
          <div className="text-center text-muted text-sm">or</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const img = await imageToBase64(file, 1024, 0.8);
              setPreview(URL.createObjectURL(img.blob));
              run(() => parseFoodPhoto(img, text || undefined), 'photo');
            }}
          />
          <button className="btn-secondary w-full !rounded-btn min-h-[52px]" disabled={!!busy || !online} onClick={() => fileRef.current?.click()}>
            {busy === 'photo' ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />} Snap a photo
          </button>
          <p className="text-xs text-muted">Photos are resized on your phone and sent only to Gemini for this estimate; they aren't stored.</p>
        </>
      )}
      {items && (
        <>
          {preview && <img src={preview} alt="Meal" className="w-full max-h-48 object-cover rounded-card" />}
          <div className="flex items-center justify-between">
            <div className="section-label">Review & edit · {total} kcal</div>
            <button className="text-primary font-bold text-sm min-h-[44px]" onClick={() => { setItems(null); setPreview(null); }}>Start over</button>
          </div>
          {items.map((it, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-muted shrink-0" />
                <input className="flex-1 min-w-0 bg-transparent font-bold text-[16px] outline-none" value={it.name} onChange={(e) => update(i, { name: e.target.value })} aria-label="Food name" />
                <button aria-label="Remove item" className="btn-ghost text-muted -mr-2" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
              </div>
              <input className="w-full bg-transparent text-[14px] text-muted outline-none" value={it.servingDesc} onChange={(e) => update(i, { servingDesc: e.target.value })} aria-label="Serving" />
              <div className="grid grid-cols-4 gap-2">
                {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
                  <label key={k} className="block">
                    <span className="text-[11px] font-bold uppercase text-muted">{k === 'calories' ? 'kcal' : k[0]!.toUpperCase() + ' g'}</span>
                    <NumberInput value={it[k]} onChange={(v) => update(i, { [k]: v ?? 0 })} className="w-full h-11 rounded-xl bg-track/70 text-center font-bold tabular outline-none focus:ring-2 focus:ring-primary" />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            className="btn-primary"
            disabled={!items.length}
            onClick={async () => {
              for (const it of items) await logFood(date, meal, it, source);
              toast(`Logged ${items.length} item${items.length > 1 ? 's' : ''} · ${total} kcal`, 'success');
              onDone();
            }}
          >
            Save {items.length} item{items.length === 1 ? '' : 's'} to {meal}
          </button>
        </>
      )}
    </div>
  );
}
