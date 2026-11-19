import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { db } from '../db/db';
import { EQUIPMENT_LABELS, MUSCLE_FILTERS, MUSCLE_LABELS, TYPE_LABELS } from '../db/seedExercises';
import type { Equipment, Exercise, ExerciseType, Muscle } from '../db/types';
import { uid } from '../lib/id';
import { searchExercises } from '../lib/search';
import { Chip, ChipRow, Field } from './Controls';
import { toast } from './Feedback';
import { BottomSheet, FullSheet } from './Sheet';

export function useExerciseSearch(query: string, filter: string) {
  const all = useLiveQuery(() => db.exercises.toArray(), [], [] as Exercise[]);
  return useMemo(() => {
    const f = MUSCLE_FILTERS.find((m) => m.key === filter);
    const q = query.trim();
    // While typing, search the whole library (a muscle chip shouldn't hide matches).
    const pool = (all ?? []).filter((e) => !e.archived).filter((e) => q || !f || f.muscles.length === 0 || f.muscles.includes(e.primaryMuscle));
    return searchExercises(pool, q);
  }, [all, query, filter]);
}

export function ExerciseList({
  query, filter, onPick, selected, onRemove,
}: { query: string; filter: string; onPick: (e: Exercise) => void; selected?: Set<string>; onRemove?: (e: Exercise) => void }) {
  const found = useExerciseSearch(query, filter);
  // Without a search, show what's already added first so it's easy to review/remove.
  const list = !query.trim() && selected?.size ? [...found.filter((e) => selected.has(e.id)), ...found.filter((e) => !selected.has(e.id))] : found;
  if (!list.length) return <div className="text-center text-muted py-10">No exercises match "{query}". Tap Create to add it.</div>;
  return (
    <div className="divide-y divide-line card overflow-hidden">
      {list.map((e) => {
        const added = !!selected?.has(e.id);
        return (
          <div key={e.id} className={`flex items-center ${added ? 'bg-success/[0.08]' : ''}`}>
            <button onClick={() => (added && onRemove ? onRemove(e) : onPick(e))} className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left active:bg-track min-h-[60px]">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">
                  {e.name} {e.isCustom && <span className="ml-1 text-[11px] font-bold uppercase text-warn">custom</span>}
                </div>
                <div className="text-[13px] text-muted truncate">
                  {added ? <span className="text-success font-semibold">Added{onRemove ? ' · tap to remove' : ''}</span> : `${MUSCLE_LABELS[e.primaryMuscle]} · ${EQUIPMENT_LABELS[e.equipment]}`}
                </div>
              </div>
              {added && !onRemove && <Check size={20} className="text-success" />}
            </button>
            {added && onRemove && (
              <button aria-label={`Remove ${e.name}`} onClick={() => onRemove(e)} className="h-11 w-11 mr-2 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <X size={20} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search exercises' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        className="input pl-12 pr-12"
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 btn-ghost text-muted" onClick={() => onChange('')}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export function MuscleChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ChipRow>
      {MUSCLE_FILTERS.map((m) => (
        <Chip key={m.key} active={value === m.key} onClick={() => onChange(m.key)}>
          {m.label}
        </Chip>
      ))}
    </ChipRow>
  );
}

/** Full-screen library picker with search, muscle filters and "create new". */
export function ExercisePicker({
  open, onClose, onPick, title = 'Add Exercise', selected, onRemove,
}: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void; title?: string; selected?: Set<string>; onRemove?: (e: Exercise) => void }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const [creating, setCreating] = useState(false);
  return (
    <FullSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={selected && selected.size > 0 ? <button className="btn-primary" onClick={onClose}>Done · {selected.size} exercise{selected.size === 1 ? '' : 's'}</button> : undefined}
      right={
        <button aria-label="Create exercise" className="btn-ghost" onClick={() => setCreating(true)}>
          <Plus size={26} />
        </button>
      }
    >
      <div className="space-y-3">
        <SearchBox value={q} onChange={setQ} />
        <MuscleChips value={f} onChange={setF} />
        <button className="btn-secondary w-full !rounded-btn" onClick={() => setCreating(true)}>
          <Plus size={18} /> Create {q ? `"${q}"` : 'custom exercise'}
        </button>
        <ExerciseList query={q} filter={f} onPick={onPick} selected={selected} onRemove={onRemove} />
      </div>
      <ExerciseForm
        open={creating}
        initialName={q}
        onClose={() => setCreating(false)}
        onSaved={(e) => {
          setCreating(false);
          onPick(e);
        }}
      />
    </FullSheet>
  );
}

const MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export function ExerciseForm({
  open, onClose, onSaved, initialName = '', existing,
}: { open: boolean; onClose: () => void; onSaved?: (e: Exercise) => void; initialName?: string; existing?: Exercise }) {
  const [name, setName] = useState(existing?.name ?? initialName);
  const [type, setType] = useState<ExerciseType>(existing?.type ?? 'weight_reps');
  const [muscle, setMuscle] = useState<Muscle>(existing?.primaryMuscle ?? 'chest');
  const [equipment, setEquipment] = useState<Equipment>(existing?.equipment ?? 'barbell');
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(existing?.name ?? initialName);
      setType(existing?.type ?? 'weight_reps');
      setMuscle(existing?.primaryMuscle ?? 'chest');
      setEquipment(existing?.equipment ?? 'barbell');
    }
  }
  async function save() {
    if (!name.trim()) return toast('Give it a name', 'error');
    const e: Exercise = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      type,
      primaryMuscle: muscle,
      secondaryMuscles: existing?.secondaryMuscles ?? [],
      equipment,
      isCustom: existing?.isCustom ?? true,
      archived: false,
    };
    await db.exercises.put(e);
    toast(existing ? 'Exercise updated' : 'Exercise created', 'success');
    onSaved?.(e);
    onClose();
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={existing ? 'Edit exercise' : 'New exercise'} footer={<button className="btn-primary" onClick={save}>Save exercise</button>}>
      <div className="space-y-4">
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine Press" />
        </Field>
        <div>
          <span className="label">Type</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TYPE_LABELS) as ExerciseType[]).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`min-h-[48px] rounded-btn border font-semibold text-[15px] ${type === t ? 'bg-primary text-white border-primary' : 'bg-card border-line'}`}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Primary muscle</span>
          <ChipRow>
            {MUSCLES.map((m) => (
              <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
                {MUSCLE_LABELS[m]}
              </Chip>
            ))}
          </ChipRow>
        </div>
        <div>
          <span className="label">Equipment</span>
          <ChipRow>
            {EQUIPMENT.map((m) => (
              <Chip key={m} active={equipment === m} onClick={() => setEquipment(m)}>
                {EQUIPMENT_LABELS[m]}
              </Chip>
            ))}
          </ChipRow>
        </div>
      </div>
    </BottomSheet>
  );
}

