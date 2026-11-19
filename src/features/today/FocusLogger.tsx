import { Check, ChevronRight, Minus, NotebookPen, Plus, SkipForward, Trophy, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from '../../components/Feedback';
import { db } from '../../db/db';
import { MUSCLE_LABELS } from '../../db/seedExercises';
import type { Exercise, ExerciseType, SessionExercise, SetType, WorkoutSet } from '../../db/types';
import { addSet, toggleSetComplete, updateSet } from '../../db/workouts';
import { fmtNum } from '../../lib/format';
import { dUnit, fromDispD, fromDispW, toDispD, toDispW, wUnit, type Units } from '../../lib/units';
import { describeSet, describeSets } from './describe';
import { useRestTimer, vibrate } from './restTimer';

const SET_TYPES: SetType[] = ['working', 'warmup', 'drop', 'failure'];
const TYPE_LABEL: Record<SetType, string> = { working: 'Working set', warmup: 'Warm-up', drop: 'Drop set', failure: 'To failure' };

/** Big ± control (thumb-sized). Tap the number to type. */
function BigStepper({ label, unit, value, step, decimals = 1, onChange }: { label: string; unit: string; value: number | null; step: number; decimals?: number; onChange: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const round = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;
  const bump = (d: number) => {
    vibrate(8);
    onChange(Math.max(0, round((value ?? 0) + d)));
  };
  const btn = 'h-[60px] w-12 shrink-0 rounded-[18px] bg-track flex items-center justify-center active:scale-90 transition-transform';
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold text-muted uppercase tracking-wide text-center mb-1">{unit}</div>
      <div className="flex items-center gap-1">
        <button aria-label={`Decrease ${label}`} onClick={() => bump(-step)} className={btn}>
          <Minus size={24} strokeWidth={2.6} />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              aria-label={label}
              inputMode={decimals ? 'decimal' : 'numeric'}
              value={text}
              onChange={(e) => /^\d*[.,]?\d*$/.test(e.target.value) && setText(e.target.value)}
              onBlur={() => {
                setEditing(false);
                const n = text.trim() === '' ? null : Number(text.replace(',', '.'));
                if (n == null || !Number.isNaN(n)) onChange(n == null ? null : round(n));
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="w-full h-[60px] rounded-[16px] bg-card border-2 border-primary text-center text-[30px] font-extrabold tabular outline-none"
            />
          ) : (
            <button
              aria-label={`${label}: ${value ?? 'empty'}. Tap to type`}
              onClick={() => {
                setText(value == null ? '' : String(value));
                setEditing(true);
              }}
              className={`w-full h-[60px] rounded-[16px] active:bg-track leading-none font-extrabold tabular truncate ${fmtNum(value ?? 0, decimals).length > 3 ? 'text-[26px]' : 'text-[34px]'}`}
            >
              {value == null ? '–' : fmtNum(value, decimals)}
            </button>
          )}
        </div>
        <button aria-label={`Increase ${label}`} onClick={() => bump(step)} className={btn}>
          <Plus size={24} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

function SetEditor({ s, type, units, step }: { s: WorkoutSet; type: ExerciseType; units: Units; step: number }) {
  if (type === 'time') return <BigStepper label="seconds" unit="seconds" value={s.durationSec} step={15} decimals={0} onChange={(v) => updateSet(s.id, { durationSec: v })} />;
  if (type === 'cardio')
    return (
      <div className="grid grid-cols-2 gap-3">
        <BigStepper label="minutes" unit="minutes" value={s.durationSec != null ? Math.round(s.durationSec / 6) / 10 : null} step={1} onChange={(v) => updateSet(s.id, { durationSec: v == null ? null : Math.round(v * 60) })} />
        <BigStepper label="distance" unit={dUnit(units)} value={toDispD(s.distance, units)} step={0.1} decimals={2} onChange={(v) => updateSet(s.id, { distance: v == null ? null : fromDispD(v, units) })} />
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-3">
      <BigStepper
        label="weight"
        unit={type === 'bodyweight_reps' ? `+${wUnit(units)}` : wUnit(units)}
        value={toDispW(s.weight, units)}
        step={step}
        onChange={(v) => updateSet(s.id, { weight: v == null ? null : fromDispW(v, units) })}
      />
      <BigStepper label="reps" unit="reps" value={s.reps} step={1} decimals={0} onChange={(v) => updateSet(s.id, { reps: v })} />
    </div>
  );
}

export function FocusLogger({
  ses, sets, exMap, lastMap, units, step, onAddExercise, onFinish,
}: {
  ses: SessionExercise[];
  sets: WorkoutSet[];
  exMap: Map<string, Exercise>;
  lastMap: Map<string, WorkoutSet[]>;
  units: Units;
  step: number;
  onAddExercise: () => void;
  onFinish: () => void;
}) {
  const active = ses.filter((s) => !s.skipped);
  const setsOf = (id: string) => sets.filter((s) => s.sessionExerciseId === id).sort((a, b) => a.order - b.order);
  const hasOpen = (id: string) => setsOf(id).some((s) => !s.completed);
  const [viewId, setViewId] = useState<string | null>(null);
  const [selSetId, setSelSetId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const startRest = useRestTimer((s) => s.start);
  const stripRef = useRef<HTMLDivElement>(null);

  const current = (viewId && active.find((s) => s.id === viewId)) || active.find((s) => hasOpen(s.id)) || null;
  const allDone = active.length > 0 && active.every((s) => !hasOpen(s.id));
  const exSets = current ? setsOf(current.id) : [];
  const sel = exSets.find((s) => s.id === selSetId) ?? exSets.find((s) => !s.completed) ?? exSets[exSets.length - 1] ?? null;
  const ex = current ? exMap.get(current.exerciseId) : undefined;
  const type = ex?.type ?? 'weight_reps';
  const last = current ? lastMap.get(current.exerciseId) ?? [] : [];
  const lastWorking = last.filter((s) => s.setType !== 'warmup');
  const selIdx = sel ? exSets.indexOf(sel) : -1;
  const workingIdx = sel ? exSets.slice(0, selIdx + 1).filter((x) => x.setType !== 'warmup').length - 1 : -1;
  const prevForSel = sel && sel.setType !== 'warmup' ? lastWorking[workingIdx] : undefined;
  const [note, setNote] = useState(current?.note ?? '');

  useEffect(() => {
    setNote(current?.note ?? '');
    setNoteOpen(!!current?.note);
    stripRef.current?.querySelector(`[data-se="${current?.id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function logSet() {
    if (!sel || !current) return;
    setPop(true);
    setTimeout(() => setPop(false), 250);
    if (sel.completed) {
      // already done: this button just confirms edits and moves on
      setSelSetId(null);
      return;
    }
    vibrate(15);
    const { isPR } = await toggleSetComplete(sel.id, true);
    if (isPR) {
      toast(`🏆 New PR on ${ex?.name}!`, 'success');
      vibrate([30, 60, 30]);
    }
    setSelSetId(null);
    const remaining = exSets.filter((x) => !x.completed && x.id !== sel.id);
    if (remaining.length) startRest(current.restSec ?? 90, ex?.name);
    else {
      const idx = active.findIndex((x) => x.id === current.id);
      const next = [...active.slice(idx + 1), ...active.slice(0, idx)].find((x) => x.id !== current.id && hasOpen(x.id));
      startRest(current.restSec ?? 90, next ? `next: ${exMap.get(next.exerciseId)?.name}` : ex?.name);
      setTimeout(() => setViewId(next?.id ?? null), 450);
    }
  }

  if (!active.length) return null;

  return (
    <div className="space-y-3">
      {/* Exercise strip */}
      <div ref={stripRef} className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-0.5">
        {active.map((s) => {
          const list = setsOf(s.id);
          const done = list.filter((x) => x.completed).length;
          const complete = list.length > 0 && done === list.length;
          const on = current?.id === s.id;
          return (
            <button
              key={s.id}
              data-se={s.id}
              onClick={() => {
                setViewId(s.id);
                setSelSetId(null);
              }}
              className={`shrink-0 min-h-[44px] rounded-full px-3.5 border text-[14px] font-semibold flex items-center gap-1.5 transition-colors ${
                on ? 'bg-primary border-primary text-white' : complete ? 'bg-success/15 border-transparent text-success' : 'bg-card border-line'
              }`}
            >
              {complete && <Check size={15} strokeWidth={3} />}
              <span className="max-w-[130px] truncate">{exMap.get(s.exerciseId)?.name}</span>
              <span className={`tabular text-[12px] ${on ? 'text-white/75' : 'text-muted'}`}>{done}/{list.length}</span>
            </button>
          );
        })}
        <button onClick={onAddExercise} aria-label="Add exercise" className="shrink-0 h-11 w-11 rounded-full border border-dashed border-line flex items-center justify-center text-muted">
          <Plus size={20} />
        </button>
      </div>

      {allDone && !viewId ? (
        <div className="card p-6 text-center">
          <div className="text-[44px]">🎉</div>
          <div className="text-[22px] font-extrabold">All sets done</div>
          <p className="text-muted mt-1">Great session. Wrap it up to see your summary.</p>
          <button className="btn-primary mt-5 !min-h-[60px] text-[18px]" onClick={onFinish}>Finish workout</button>
          <button className="btn-secondary w-full !rounded-btn min-h-[48px] mt-2" onClick={onAddExercise}><Plus size={18} /> Add another exercise</button>
        </div>
      ) : current && sel ? (
        <div className="card p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[22px] font-extrabold leading-tight">{ex?.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-[13px]">
                {ex && <span className="font-semibold rounded-full bg-soft text-primary px-2.5 py-0.5">{MUSCLE_LABELS[ex.primaryMuscle]}</span>}
                {current.isExtra && <span className="font-bold uppercase text-[11px] rounded-full bg-warn/15 text-warn px-2 py-0.5">Extra</span>}
                {current.targetRepsMin ? <span className="text-muted">Target {current.targetRepsMin === current.targetRepsMax || !current.targetRepsMax ? current.targetRepsMin : `${current.targetRepsMin}–${current.targetRepsMax}`} reps</span> : null}
              </div>
              <div className="text-[13px] text-muted mt-1 truncate">{last.length ? `Last time: ${describeSets(last, type, units)}` : 'First time — no history yet'}</div>
            </div>
            <button aria-label="Exercise note" className={`btn-ghost -mr-2 ${noteOpen ? 'text-primary' : 'text-muted'}`} onClick={() => setNoteOpen(!noteOpen)}>
              <NotebookPen size={20} />
            </button>
          </div>
          {noteOpen && (
            <input
              className="input !min-h-[44px] mt-3"
              placeholder="Note, e.g. seat height 4"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== current.note && db.sessionExercises.update(current.id, { note })}
            />
          )}

          {/* Set chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-1 px-1 pt-1.5 pb-1">
            {exSets.map((s, i) => {
              const on = s.id === sel.id;
              const wi = exSets.slice(0, i + 1).filter((x) => x.setType !== 'warmup').length;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelSetId(s.id)}
                  aria-label={`Set ${i + 1}${s.completed ? ' done' : ''}`}
                  className={`relative shrink-0 min-w-[60px] h-12 rounded-2xl px-2.5 flex flex-col items-center justify-center border-2 transition-colors ${
                    s.completed ? 'bg-success text-white border-success' : on ? 'border-primary bg-card' : 'border-line bg-track/50 text-muted'
                  } ${on && s.completed ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
                >
                  <span className="text-[11px] font-bold opacity-80">{s.setType === 'warmup' ? 'W' : s.setType === 'drop' ? `D` : s.setType === 'failure' ? 'F' : `Set ${wi}`}</span>
                  <span className="text-[13px] font-bold tabular leading-tight">{describeSet(s, type, units)}</span>
                  {s.isPR && <Trophy size={14} className="absolute -top-1.5 -right-1.5 text-warn fill-warn" />}
                </button>
              );
            })}
            <button aria-label="Add set" onClick={() => addSet(current.id)} className="shrink-0 w-12 h-12 rounded-2xl border-2 border-dashed border-line text-muted flex items-center justify-center">
              <Plus size={20} />
            </button>
          </div>

          {/* Current set */}
          <div className="mt-2 flex items-center justify-between">
            <button
              className="text-[13px] font-bold text-muted min-h-[44px] flex items-center gap-1"
              onClick={() => updateSet(sel.id, { setType: SET_TYPES[(SET_TYPES.indexOf(sel.setType) + 1) % SET_TYPES.length]! })}
              aria-label="Change set type"
            >
              SET {selIdx + 1} OF {exSets.length} · <span className={sel.setType === 'working' ? 'text-primary' : 'text-warn'}>{TYPE_LABEL[sel.setType]}</span>
            </button>
            {prevForSel && (
              <button
                className="text-[13px] font-semibold text-primary bg-soft rounded-full px-3 min-h-[36px]"
                onClick={() => updateSet(sel.id, { weight: prevForSel.weight, reps: prevForSel.reps, durationSec: prevForSel.durationSec, distance: prevForSel.distance })}
              >
                Last: {describeSet(prevForSel, type, units)}
              </button>
            )}
          </div>
          <div className="mt-2">
            <SetEditor s={sel} type={type} units={units} step={step} />
          </div>

          <button
            onClick={logSet}
            className={`mt-4 w-full h-16 rounded-[20px] text-white text-[20px] font-extrabold flex items-center justify-center gap-2 shadow-float transition-transform active:scale-[0.97] ${
              sel.completed ? 'bg-success' : 'bg-primary'
            } ${pop ? 'animate-pop' : ''}`}
          >
            <Check size={26} strokeWidth={3} /> {sel.completed ? 'Saved · next' : `Log set ${selIdx + 1}`}
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {sel.completed ? (
              <button className="btn-secondary !rounded-btn min-h-[48px]" onClick={() => toggleSetComplete(sel.id, false)}>
                <Undo2 size={18} /> Undo
              </button>
            ) : (
              <button
                className="btn-secondary !rounded-btn min-h-[48px]"
                onClick={async () => {
                  await db.sessionExercises.update(current.id, { skipped: true });
                  setViewId(null);
                  toast(`Skipped ${ex?.name}`, 'default', { label: 'Undo', run: () => db.sessionExercises.update(current.id, { skipped: false }) });
                }}
              >
                <SkipForward size={18} /> Skip
              </button>
            )}
            <button
              className="btn-secondary !rounded-btn min-h-[48px]"
              onClick={() => {
                const idx = active.findIndex((x) => x.id === current.id);
                const next = active[idx + 1] ?? active[0];
                setViewId(next?.id ?? null);
                setSelSetId(null);
              }}
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : null}
      {!allDone && (
        <button className="w-full min-h-[48px] rounded-btn border border-line bg-card font-bold flex items-center justify-center gap-2" onClick={onFinish}>
          Finish workout
        </button>
      )}
    </div>
  );
}
