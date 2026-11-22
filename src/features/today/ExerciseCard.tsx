import { Check, ChevronDown, ChevronUp, MoreHorizontal, NotebookPen, Plus, SkipForward, Trash2, Trophy, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Stepper } from '../../components/Controls';
import { celebrate } from '../../components/Celebrate';
import { SetOptionsSheet } from './SetOptionsSheet';
import { toast } from '../../components/Feedback';
import { BottomSheet, ConfirmSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { MUSCLE_LABELS } from '../../db/seedExercises';
import type { Exercise, SessionExercise, SetType, WorkoutSet } from '../../db/types';
import { addSet, deleteSet, moveSessionExercise, removeSessionExercise, toggleSetComplete, updateSet } from '../../db/workouts';
import { fromDispD, fromDispW, toDispD, toDispW, dUnit, wUnit, type Units } from '../../lib/units';
import { todayKey } from '../../lib/dates';
import { describeSet, describeSets } from './describe';
import { useRestTimer, vibrate } from './restTimer';
import { SwipeRow } from './SwipeRow';

const SET_TYPE_BADGE: Record<SetType, { label: string; cls: string }> = {
  working: { label: '', cls: 'text-ink' },
  warmup: { label: 'W', cls: 'text-warn' },
  drop: { label: 'D', cls: 'text-primary' },
  failure: { label: 'F', cls: 'text-danger' },
};

function Cell({ value, onCommit, label, decimal = true }: { value: number | null; onCommit: (v: number | null) => void; label: string; decimal?: boolean }) {
  const [t, setT] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setT(value == null ? '' : String(value));
  }, [value]);
  return (
    <input
      aria-label={label}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={t}
      placeholder="–"
      onFocus={(e) => e.target.select()}
      onChange={(e) => /^\d*[.,]?\d*$/.test(e.target.value) && setT(e.target.value)}
      onBlur={() => {
        const n = t.trim() === '' ? null : Number(t.replace(',', '.'));
        if (n !== value && (n == null || !Number.isNaN(n))) onCommit(n);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="w-full h-11 min-w-0 rounded-xl bg-track/70 text-center font-bold tabular text-[17px] outline-none focus:ring-2 focus:ring-primary"
    />
  );
}

export function ExerciseCard({
  se, exercise, sets, last, units, step, isFirst, isLast, sessionDate, focused, onFocus,
}: {
  se: SessionExercise;
  exercise?: Exercise;
  sets: WorkoutSet[];
  last: WorkoutSet[];
  units: Units;
  step: number;
  isFirst: boolean;
  isLast: boolean;
  sessionDate: string;
  focused: boolean;
  onFocus: () => void;
}) {
  const type = exercise?.type ?? 'weight_reps';
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!se.note);
  const [note, setNote] = useState(se.note);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [popId, setPopId] = useState<string | null>(null);
  const [optsId, setOptsId] = useState<string | null>(null);
  const startRest = useRestTimer((s) => s.start);
  useEffect(() => {
    setNote(se.note);
  }, [se.note]);

  const firstOpen = sets.find((s) => !s.completed)?.id ?? null;
  const active = activeId && sets.some((s) => s.id === activeId) ? activeId : firstOpen;
  const done = sets.filter((s) => s.completed).length;
  const workingLast = last.filter((s) => s.setType !== 'warmup');

  async function complete(s: WorkoutSet) {
    const next = !s.completed;
    setPopId(s.id);
    setTimeout(() => setPopId(null), 260);
    vibrate(next ? 15 : 0);
    const { isPR } = await toggleSetComplete(s.id, next);
    if (next) {
      if (isPR) {
        if (!(await celebrate('pr', exercise?.name ?? 'New PR'))) toast(`🏆 New PR on ${exercise?.name}!`, 'success');
        vibrate([30, 60, 30]);
      }
      startRest(se.restSec ?? 90, exercise?.name);
      const nextOpen = sets.find((x) => x.order > s.order && !x.completed);
      setActiveId(nextOpen?.id ?? null);
    }
  }

  const prevFor = (i: number) => {
    const p = workingLast[i] ?? null;
    return p ? describeSet(p, type, units) : '–';
  };
  const copyPrev = (s: WorkoutSet, i: number) => {
    const p = workingLast[i];
    if (p) updateSet(s.id, { weight: p.weight, reps: p.reps, durationSec: p.durationSec, distance: p.distance });
  };

  if (se.skipped) {
    return (
      <div className="card px-5 py-4 flex items-center justify-between opacity-70">
        <div>
          <div className="font-bold">{exercise?.name}</div>
          <div className="text-sm text-muted">Skipped today</div>
        </div>
        <button className="btn-secondary" onClick={() => db.sessionExercises.update(se.id, { skipped: false })}>
          <Undo2 size={16} /> Undo
        </button>
      </div>
    );
  }

  const isWeighted = type === 'weight_reps' || type === 'bodyweight_reps';
  const cols = type === 'time' ? 'grid-cols-[34px_1fr_78px_48px]' : 'grid-cols-[34px_1fr_68px_60px_48px]';
  const headers =
    type === 'weight_reps' ? [wUnit(units), 'Reps'] : type === 'bodyweight_reps' ? [`+${wUnit(units)}`, 'Reps'] : type === 'time' ? ['Sec'] : ['Min', dUnit(units)];
  const target = se.targetRepsMin ? (se.targetRepsMin === se.targetRepsMax || !se.targetRepsMax ? `${se.targetRepsMin}` : `${se.targetRepsMin}–${se.targetRepsMax}`) : null;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[18px] font-extrabold leading-tight">{exercise?.name ?? 'Exercise'}</h3>
            {se.isExtra && <span className="text-[11px] font-bold uppercase tracking-wide rounded-full bg-warn/15 text-warn px-2 py-0.5">Extra</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {exercise && <span className="text-[12px] font-semibold rounded-full bg-soft text-primary px-2.5 py-0.5">{MUSCLE_LABELS[exercise.primaryMuscle]}</span>}
            {target && <span className="text-[12px] text-muted">Target {target} reps</span>}
            <span className="text-[12px] text-muted">{done}/{sets.length} sets</span>
          </div>
          <div className="text-[13px] text-muted mt-1.5 truncate">
            {last.length ? `Last time: ${describeSets(last, type, units)}` : 'First time — no history yet'}
          </div>
        </div>
        <button aria-label="Exercise options" className="btn-ghost -mr-2 -mt-1 text-muted" onClick={() => setMenu(true)}>
          <MoreHorizontal size={22} />
        </button>
      </div>

      <div className={`grid ${cols} gap-1.5 px-4 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted`}>
        <div className="text-center">Set</div>
        <div>Previous</div>
        {headers.map((h) => <div key={h} className="text-center">{h}</div>)}
        <div className="text-center">✓</div>
      </div>

      <div>
        {sets.map((s, i) => {
          const badge = SET_TYPE_BADGE[s.setType];
          const workingIdx = sets.slice(0, i + 1).filter((x) => x.setType !== 'warmup').length;
          const isActive = active === s.id;
          return (
            <div key={s.id}>
              <SwipeRow onDelete={() => { deleteSet(s.id); toast('Set deleted', 'default', { label: 'Undo', run: () => db.sets.put(s) }); }}>
                <div
                  className={`grid ${cols} gap-1.5 items-center px-4 py-1.5 transition-colors ${s.completed ? 'bg-success/[0.12]' : isActive && focused ? 'bg-track/40' : 'bg-card'} ${popId === s.id ? 'animate-pop' : ''}`}
                  onClick={() => {
                    setActiveId(s.id);
                    onFocus();
                  }}
                >
                  <button
                    aria-label={`Set ${i + 1} options`}
                    className={`h-11 rounded-lg font-extrabold text-[15px] ${badge.cls}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOptsId(s.id);
                    }}
                  >
                    {badge.label || workingIdx}
                  </button>
                  <button className="text-left text-[13px] text-muted tabular truncate h-11" onClick={(e) => { e.stopPropagation(); copyPrev(s, workingIdx - 1); }} aria-label="Copy previous values">
                    {s.setType === 'warmup' ? '–' : prevFor(workingIdx - 1)}
                  </button>
                  {isWeighted && (
                    <>
                      <Cell label={`Set ${i + 1} weight`} value={toDispW(s.weight, units)} onCommit={(v) => updateSet(s.id, { weight: v == null ? null : fromDispW(v, units) })} />
                      <Cell label={`Set ${i + 1} reps`} value={s.reps} decimal={false} onCommit={(v) => updateSet(s.id, { reps: v })} />
                    </>
                  )}
                  {type === 'time' && <Cell label={`Set ${i + 1} seconds`} value={s.durationSec} decimal={false} onCommit={(v) => updateSet(s.id, { durationSec: v })} />}
                  {type === 'cardio' && (
                    <>
                      <Cell label={`Set ${i + 1} minutes`} value={s.durationSec != null ? Math.round(s.durationSec / 6) / 10 : null} onCommit={(v) => updateSet(s.id, { durationSec: v == null ? null : Math.round(v * 60) })} />
                      <Cell label={`Set ${i + 1} distance`} value={toDispD(s.distance, units)} onCommit={(v) => updateSet(s.id, { distance: v == null ? null : fromDispD(v, units) })} />
                    </>
                  )}
                  <button
                    aria-label={s.completed ? `Mark set ${i + 1} not done` : `Complete set ${i + 1}`}
                    onClick={(e) => { e.stopPropagation(); complete(s); }}
                    className={`relative h-11 w-11 justify-self-center rounded-xl flex items-center justify-center transition-all active:scale-90 ${s.completed ? 'bg-success text-white' : 'bg-track text-muted'}`}
                  >
                    <Check size={22} strokeWidth={3} />
                    {s.isPR && <Trophy size={14} className="absolute -top-1.5 -right-1.5 text-warn fill-warn" aria-label="Personal record" />}
                  </button>
                </div>
              </SwipeRow>
              {isActive && focused && !s.completed && (
                <div className="px-4 pb-3 pt-1 bg-track/40 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-around gap-2">
                    {isWeighted && (
                      <>
                        <div className="flex flex-col items-center">
                          <Stepper compact label={`weight`} value={toDispW(s.weight, units)} step={step} onChange={(v) => updateSet(s.id, { weight: v == null ? null : fromDispW(v, units) })} />
                          <span className="text-[11px] text-muted mt-0.5">{type === 'bodyweight_reps' ? 'Added ' : ''}{wUnit(units)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <Stepper compact label="reps" value={s.reps} step={1} decimals={0} inputMode="numeric" onChange={(v) => updateSet(s.id, { reps: v })} />
                          <span className="text-[11px] text-muted mt-0.5">reps</span>
                        </div>
                      </>
                    )}
                    {type === 'time' && (
                      <div className="flex flex-col items-center">
                        <Stepper compact label="seconds" value={s.durationSec} step={15} decimals={0} inputMode="numeric" onChange={(v) => updateSet(s.id, { durationSec: v })} />
                        <span className="text-[11px] text-muted mt-0.5">seconds</span>
                      </div>
                    )}
                    {type === 'cardio' && (
                      <div className="flex flex-col items-center">
                        <Stepper compact label="calories" value={s.calories ?? null} step={10} decimals={0} inputMode="numeric" onChange={(v) => updateSet(s.id, { calories: v })} />
                        <span className="text-[11px] text-muted mt-0.5">kcal (optional)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 pt-2 pb-3 flex gap-2">
        <button className="btn-secondary flex-1 !rounded-xl" onClick={() => addSet(se.id)}>
          <Plus size={18} /> Add set
        </button>
        <button aria-label="Exercise note" className={`btn-secondary !rounded-xl !px-3 ${noteOpen ? '!bg-primary !text-white' : ''}`} onClick={() => setNoteOpen(!noteOpen)}>
          <NotebookPen size={18} />
        </button>
      </div>
      {noteOpen && (
        <div className="px-4 pb-4">
          <input
            className="input !min-h-[44px]"
            placeholder="Note, e.g. seat height 4"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== se.note && db.sessionExercises.update(se.id, { note })}
          />
        </div>
      )}

      <SetOptionsSheet set={sets.find((x) => x.id === optsId) ?? null} title={`Set ${sets.findIndex((x) => x.id === optsId) + 1} options`} onClose={() => setOptsId(null)} />
      <BottomSheet open={menu} onClose={() => setMenu(false)} title={exercise?.name}>
        <div className="space-y-2">
          {!isFirst && (
            <button className="w-full min-h-[52px] rounded-btn bg-card border border-line px-4 flex items-center gap-3 font-semibold" onClick={() => { moveSessionExercise(se.sessionId, se.id, -1); setMenu(false); }}>
              <ChevronUp size={20} /> Move up
            </button>
          )}
          {!isLast && (
            <button className="w-full min-h-[52px] rounded-btn bg-card border border-line px-4 flex items-center gap-3 font-semibold" onClick={() => { moveSessionExercise(se.sessionId, se.id, 1); setMenu(false); }}>
              <ChevronDown size={20} /> Move down
            </button>
          )}
          <button className="w-full min-h-[52px] rounded-btn bg-card border border-line px-4 flex items-center gap-3 font-semibold" onClick={() => { db.sessionExercises.update(se.id, { skipped: true }); setMenu(false); }}>
            <SkipForward size={20} /> Skip today
          </button>
          <button className="w-full min-h-[52px] rounded-btn bg-card border border-line px-4 flex items-center gap-3 font-semibold text-danger" onClick={() => { setMenu(false); done ? setConfirmRemove(true) : removeSessionExercise(se.id); }}>
            <Trash2 size={20} /> Remove from this workout
          </button>
          <p className="text-xs text-muted pt-1">These only affect {sessionDate === todayKey() ? 'today' : 'this day'}; your template stays the same. Tap a set number to change its type or delete it.</p>
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remove exercise?"
        message={`${done} completed set${done === 1 ? '' : 's'} will be deleted.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => removeSessionExercise(se.id)}
      />
    </div>
  );
}
