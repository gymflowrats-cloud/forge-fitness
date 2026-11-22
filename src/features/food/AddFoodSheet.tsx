import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Loader2, Minus, Pencil, Plus, Sparkles, Star, Trash2, Wand2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip, ChipRow, Field, NumberInput, SegmentedControl, Stepper, Toggle } from '../../components/Controls';
import { SearchBox } from '../../components/ExercisePicker';
import { toast } from '../../components/Feedback';
import { FullSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { foodCatalog, frequentForMeal, logCombo, logFood, recentFoods, searchFoods, setLogServings, upsertFood } from '../../db/food';
import { fmtNum } from '../../lib/format';
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
  const [mode, setMode] = useState<'total' | 'items'>(() => (sessionStorage.getItem('forge.quickMode') as 'total' | 'items') || 'items');
  return (
    <div className="space-y-4">
      <SegmentedControl
        size="sm"
        options={[{ value: 'items', label: 'Item by item' }, { value: 'total', label: 'Just a total' }]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          try { sessionStorage.setItem('forge.quickMode', m); } catch { /* ignore */ }
        }}
      />
      {mode === 'items' ? <ItemsAdd date={date} meal={meal} onDone={onDone} /> : <TotalAdd date={date} meal={meal} onDone={onDone} />}
    </div>
  );
}

interface Row {
  key: number;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  servings: number;
  servingDesc: string;
  foodId: string | null;
  macros: boolean;
}
let rowKey = 0;
const emptyRow = (): Row => ({ key: ++rowKey, name: '', calories: null, protein: null, carbs: null, fat: null, servings: 1, servingDesc: '1 serving', foodId: null, macros: false });

/** Log several foods at once, each with its own calories (and optional macros). Typing a name suggests foods you've logged before. */
function ItemsAdd({ date, meal, onDone }: { date: string; meal: string; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [fav, setFav] = useState(false);
  const [aiBusy, setAiBusy] = useState<Set<number>>(new Set());
  const settings = useSettings();
  const online = useOnline();
  const aiReady = (settings.aiMode === 'proxy' ? !!settings.proxyUrl : !!settings.geminiKey) && online;
  /** Ask Gemini for kcal + macros of each named row. Calories you typed are kept; macros are scaled to match them. */
  const aiFill = async (targets: Row[]) => {
    const todo = targets.filter((r) => r.name.trim());
    if (!todo.length) return toast('Type the food name first, e.g. "2 rotis"', 'error');
    setAiBusy(new Set(todo.map((r) => r.key)));
    const results = await Promise.allSettled(todo.map((r) => parseFoodText(r.name.trim())));
    let failed = 0;
    results.forEach((res, i) => {
      const r = todo[i]!;
      if (res.status !== 'fulfilled' || !res.value.length) { failed++; return; }
      const sum = res.value.reduce((a, x) => ({ calories: a.calories + x.calories, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      const scale = r.calories && sum.calories ? r.calories / sum.calories : 1;
      const one = (n: number) => Math.round(n * scale * 10) / 10;
      set(r.key, { calories: r.calories ?? Math.round(sum.calories), protein: one(sum.protein), carbs: one(sum.carbs), fat: one(sum.fat), macros: true, servingDesc: res.value.length === 1 ? res.value[0]!.servingDesc : r.servingDesc });
    });
    setAiBusy(new Set());
    if (failed) {
      const first = results.find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined;
      toast(first?.reason instanceof GeminiError ? first.reason.message : `AI couldn't estimate ${failed} item${failed > 1 ? 's' : ''}`, 'error');
    }
  };
  const foods = useLiveQuery(() => foodCatalog().then((c) => c.foods), [], [] as Food[]) ?? [];
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const valid = rows.filter((r) => r.calories != null && (r.calories > 0 || r.name.trim()));
  const total = valid.reduce((a, r) => a + (r.calories ?? 0) * r.servings, 0);
  const suggestFor = (r: Row) => {
    const q = r.name.trim().toLowerCase();
    if (q.length < 2 || r.foodId) return [];
    return foods.filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')).slice(0, 3);
  };
  const save = async () => {
    if (!valid.length) return toast('Enter calories for at least one item', 'error');
    for (const [i, r] of valid.entries()) {
      await logFood(date, meal, {
        name: r.name.trim() || `Item ${i + 1}`, calories: r.calories ?? 0, protein: r.protein ?? 0, carbs: r.carbs ?? 0, fat: r.fat ?? 0,
        servings: r.servings, servingDesc: r.servingDesc, foodId: r.foodId,
      }, 'manual', fav);
    }
    toast(`Logged ${valid.length} item${valid.length > 1 ? 's' : ''} · ${Math.round(total)} kcal`, 'success');
    onDone();
  };
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const sug = focusKey === r.key ? suggestFor(r) : [];
        return (
          <div key={r.key} className="card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 shrink-0 rounded-full bg-track text-muted text-[13px] font-bold flex items-center justify-center">{i + 1}</span>
              <input
                className="flex-1 min-w-0 bg-transparent font-bold text-[16px] outline-none placeholder:text-muted/60 placeholder:font-semibold"
                placeholder="Food, e.g. 2 rotis"
                aria-label={`Item ${i + 1} name`}
                value={r.name}
                onFocus={() => setFocusKey(r.key)}
                onBlur={() => setTimeout(() => setFocusKey((k) => (k === r.key ? null : k)), 150)}
                onChange={(e) => set(r.key, { name: e.target.value, foodId: null })}
              />
              {aiReady && (
                <button
                  aria-label={`Estimate item ${i + 1} with AI`}
                  disabled={aiBusy.size > 0}
                  onClick={() => aiFill([r])}
                  className="h-9 w-9 shrink-0 rounded-full bg-accent/15 text-ink flex items-center justify-center disabled:opacity-50"
                >
                  {aiBusy.has(r.key) ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                </button>
              )}
              {rows.length > 1 && (
                <button aria-label={`Remove item ${i + 1}`} className="btn-ghost text-muted -mr-1 !min-h-[36px] !min-w-[36px]" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><X size={18} /></button>
              )}
            </div>
            {sug.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sug.map((f) => (
                  <button
                    key={f.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => set(r.key, { name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, servingDesc: f.servingDesc, foodId: f.id })}
                    className="rounded-full bg-accent/15 px-3 min-h-[34px] text-[13px] font-semibold"
                  >
                    {f.name} · {f.calories}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <NumberInput
                ariaLabel={`Item ${i + 1} calories`}
                value={r.calories}
                onChange={(v) => set(r.key, { calories: v })}
                placeholder="kcal"
                decimal={false}
                className="w-24 h-12 rounded-xl bg-track/70 text-center text-[20px] font-extrabold tabular outline-none focus:ring-2 focus:ring-accent placeholder:text-[15px] placeholder:font-semibold placeholder:text-muted/60"
              />
              <span className="text-muted text-[13px]">×</span>
              <Stepper value={r.servings} onChange={(v) => set(r.key, { servings: v ?? 1 })} step={0.5} min={0.5} decimals={1} label={`item ${i + 1} servings`} compact />
              <button className={`ml-auto whitespace-nowrap text-[13px] font-bold min-h-[40px] px-1 ${r.macros ? 'text-ink' : 'text-muted'}`} onClick={() => set(r.key, { macros: !r.macros })}>
                {r.macros ? 'Hide' : '+ Macros'}
              </button>
            </div>
            {r.macros && (
              <div className="grid grid-cols-3 gap-2">
                {(['protein', 'carbs', 'fat'] as const).map((k) => (
                  <label key={k} className="block">
                    <span className="text-[11px] font-bold uppercase text-muted">{k[0]!.toUpperCase()} g</span>
                    <NumberInput value={r[k]} onChange={(v) => set(r.key, { [k]: v })} placeholder="0" className="w-full h-11 rounded-xl bg-track/70 text-center font-bold tabular outline-none focus:ring-2 focus:ring-accent" />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {aiReady ? (
        rows.some((r) => r.name.trim()) && (
          <button
            className="w-full min-h-[48px] rounded-btn bg-accent/15 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            disabled={aiBusy.size > 0}
            onClick={() => aiFill(rows.filter((r) => r.name.trim() && (r.calories == null || !r.protein)))}
          >
            {aiBusy.size ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {aiBusy.size ? 'Estimating…' : 'Fill missing kcal and macros with AI'}
          </button>
        )
      ) : (
        <div className="text-[13px] text-muted text-center">Tip: add a Gemini key in Settings → AI coach and AI can fill calories and macros from the food name.</div>
      )}
      <button className="w-full min-h-[48px] rounded-btn border border-dashed border-line font-semibold flex items-center justify-center gap-2 text-muted" onClick={() => setRows([...rows, emptyRow()])}>
        <Plus size={18} /> Add another item
      </button>
      <div className="card px-4 min-h-[56px] flex items-center justify-between">
        <span className="font-semibold flex items-center gap-2"><Star size={18} className="text-warn" /> Save items to My foods</span>
        <Toggle checked={fav} onChange={setFav} label="Save items to My foods" />
      </div>
      <button className="btn-primary" onClick={save} disabled={!valid.length}>
        Save {valid.length || ''} item{valid.length === 1 ? '' : 's'} · <span className="num tabular">{Math.round(total)}</span> kcal
      </button>
    </div>
  );
}

function TotalAdd({ date, meal, onDone }: { date: string; meal: string; onDone: () => void }) {
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

type SavedView = 'usual' | 'recent' | 'starred' | 'combos';

/** One food with a one-tap + and a live serving counter for what you've added this time. */
function FoodRow({ f, count, onAdd, onMinus, onStar }: { f: Food; count: number; onAdd: () => void; onMinus: () => void; onStar: () => void }) {
  return (
    <div className={`card pl-4 pr-2 py-2 flex items-center gap-2 ${count ? '!border-accent' : ''}`}>
      <button className="flex-1 min-w-0 text-left py-1" onClick={onAdd}>
        <div className="font-bold truncate">{f.name}</div>
        <div className="text-[13px] text-muted truncate">
          <span className="font-semibold text-ink tabular">{f.calories} kcal</span> · {f.servingDesc}{f.protein ? ` · P${f.protein}` : ''}
        </div>
      </button>
      <button aria-label={f.isFavorite ? `Unstar ${f.name}` : `Star ${f.name}`} className="btn-ghost !min-w-[36px]" onClick={onStar}>
        <Star size={18} className={f.isFavorite ? 'text-warn fill-warn' : 'text-muted/60'} />
      </button>
      {count > 0 ? (
        <div className="flex items-center rounded-full bg-accent text-accent-ink">
          <button aria-label={`One less ${f.name}`} className="h-11 w-10 flex items-center justify-center" onClick={onMinus}><Minus size={18} strokeWidth={2.6} /></button>
          <span className="num tabular font-extrabold text-[18px] min-w-[1.5ch] text-center">{fmtNum(count, 1)}</span>
          <button aria-label={`One more ${f.name}`} className="h-11 w-10 flex items-center justify-center" onClick={onAdd}><Plus size={18} strokeWidth={2.6} /></button>
        </div>
      ) : (
        <button aria-label={`Add ${f.name}`} className="h-11 w-11 rounded-full bg-accent/15 text-ink flex items-center justify-center shrink-0" onClick={onAdd}>
          <Plus size={20} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

function SavedFoods({ date, meal }: { date: string; meal: string }) {
  const [q, setQ] = useState('');
  const usual = useLiveQuery(() => frequentForMeal(date, meal), [date, meal], [] as Food[]) ?? [];
  const recent = useLiveQuery(() => recentFoods(), [], [] as Food[]) ?? [];
  const starred = useLiveQuery(() => db.foods.filter((f) => f.isFavorite).toArray().then((l) => l.sort((a, b) => a.name.localeCompare(b.name))), [], [] as Food[]) ?? [];
  const found = useLiveQuery(() => searchFoods(q), [q], [] as Food[]) ?? [];
  const combos = useLiveQuery(() => db.mealCombos.toArray(), [], [] as MealCombo[]) ?? [];
  const [view, setView] = useState<SavedView | null>(null);
  const shown: SavedView = view ?? (usual.length ? 'usual' : recent.length ? 'recent' : 'starred');
  // What was added during this visit: food id → log id + servings, so +/− edit the same log entry.
  const [added, setAdded] = useState<Record<string, { logId: string; n: number }>>({});
  const k = (f: Food) => `${meal}:${f.name.toLowerCase().trim()}`; // by name: a rebuilt-from-log food gets a real id on first add

  const add = async (f: Food) => {
    const cur = added[k(f)];
    if (cur) {
      await setLogServings(cur.logId, f, cur.n + 1);
      setAdded({ ...added, [k(f)]: { ...cur, n: cur.n + 1 } });
    } else {
      const l = await logFood(date, meal, { ...f, foodId: f.id, servings: 1 });
      setAdded({ ...added, [k(f)]: { logId: l.id, n: 1 } });
      toast(`Added ${f.name} to ${meal}`, 'success');
    }
  };
  const minus = async (f: Food) => {
    const cur = added[k(f)];
    if (!cur) return;
    await setLogServings(cur.logId, f, cur.n - 1);
    const next = { ...added };
    if (cur.n - 1 <= 0) delete next[k(f)];
    else next[k(f)] = { ...cur, n: cur.n - 1 };
    setAdded(next);
  };
  const row = (f: Food) => (
    <FoodRow key={f.id} f={f} count={added[k(f)]?.n ?? 0} onAdd={() => add(f)} onMinus={() => minus(f)} onStar={() => (f.id.startsWith('log:') ? upsertFood({ ...f, foodId: null }, true) : db.foods.update(f.id, { isFavorite: !f.isFavorite }))} />
  );
  const addedTotal = Object.entries(added).filter(([key]) => key.startsWith(`${meal}:`)).length;

  const list = q.trim() ? found : shown === 'usual' ? usual : shown === 'recent' ? recent : shown === 'starred' ? starred : [];
  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search everything you've logged" />
      {!q.trim() && (
        <ChipRow>
          {usual.length > 0 && <Chip active={shown === 'usual'} onClick={() => setView('usual')}>Usual {meal.toLowerCase()}</Chip>}
          <Chip active={shown === 'recent'} onClick={() => setView('recent')}>Recent</Chip>
          <Chip active={shown === 'starred'} onClick={() => setView('starred')}>Starred</Chip>
          {combos.length > 0 && <Chip active={shown === 'combos'} onClick={() => setView('combos')}>Combos</Chip>}
        </ChipRow>
      )}
      {addedTotal > 0 && <div className="text-[13px] text-muted">Added {addedTotal} food{addedTotal > 1 ? 's' : ''} to {meal}. Use − to undo.</div>}
      {!q.trim() && shown === 'combos' ? (
        <div className="space-y-2">
          {combos.map((c) => (
            <div key={c.id} className="card px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{c.name}</div>
                <div className="text-[13px] text-muted truncate">{c.items.map((i) => i.name).join(', ')} · {c.items.reduce((a, i) => a + i.calories, 0)} kcal</div>
              </div>
              <button aria-label={`Delete combo ${c.name}`} className="btn-ghost text-muted" onClick={() => db.mealCombos.delete(c.id)}><Trash2 size={18} /></button>
              <button
                aria-label={`Add ${c.name}`}
                className="h-11 w-11 rounded-full bg-accent text-accent-ink flex items-center justify-center shrink-0"
                onClick={async () => {
                  const n = await logCombo(c.id, date, meal);
                  toast(`Logged ${c.name} (${n} items)`, 'success');
                }}
              >
                <Plus size={20} strokeWidth={2.6} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          {list.length === 0 && (
            <div className="text-muted text-center py-6 text-[15px]">
              {q.trim() ? `No foods match "${q}". Add it in Quick.` : shown === 'starred' ? 'Tap the star on any food to keep it here.' : 'Foods you log will show up here.'}
            </div>
          )}
          <div className="space-y-2">{list.map(row)}</div>
        </>
      )}
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
