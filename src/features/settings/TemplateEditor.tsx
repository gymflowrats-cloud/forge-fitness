import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, GripVertical, Link2, Plus, Trash2 } from 'lucide-react';
import { uid } from '../../lib/id';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Field, Stepper } from '../../components/Controls';
import { ExercisePicker } from '../../components/ExercisePicker';
import { EmptyState, toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { BottomSheet, ConfirmSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { TEMPLATE_COLORS, archiveTemplate, duplicateTemplate, newTemplateExercise, saveTemplateExercises } from '../../db/routines';
import { MUSCLE_LABELS } from '../../db/seedExercises';
import type { Exercise, TemplateExercise } from '../../db/types';
import { useExerciseMap, useSettings, useUnits } from '../../hooks/useData';
import { fromDispW, toDispW, wUnit } from '../../lib/units';
import { Dumbbell } from 'lucide-react';

function SortRow({ id, te, ex, unitLabel, weightDisp, onEdit }: { id: string; te: TemplateExercise; ex?: Exercise; unitLabel: string; weightDisp: number | null; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isTime = ex?.type === 'time' || ex?.type === 'cardio';
  const reps = te.targetRepsMin === te.targetRepsMax ? `${te.targetRepsMin}` : `${te.targetRepsMin}–${te.targetRepsMax}`;
  return (
    <div ref={setNodeRef} style={style} className={`card flex items-center gap-1 pr-3 ${isDragging ? 'z-10 shadow-float opacity-90' : ''}`}>
      <button aria-label="Drag to reorder" className="h-[68px] w-11 flex items-center justify-center text-muted touch-none" {...attributes} {...listeners}>
        <GripVertical size={22} />
      </button>
      <button className="flex-1 min-w-0 text-left py-3" onClick={onEdit}>
        <div className="font-bold truncate">{ex?.name ?? 'Unknown exercise'}</div>
        <div className="text-[13px] text-muted">
          {isTime ? `${te.targetSets} × timed` : `${te.targetSets} × ${reps}`}
          {weightDisp ? ` @ ${weightDisp} ${unitLabel}` : ''} · rest {te.restSec}s
          {ex ? ` · ${MUSCLE_LABELS[ex.primaryMuscle]}` : ''}
        </div>
      </button>
    </div>
  );
}

export default function TemplateEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const t = useLiveQuery(() => db.templates.get(id!), [id]);
  const exMap = useExerciseMap();
  const units = useUnits();
  const settings = useSettings();
  const [picking, setPicking] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateExercise | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!t) return <Page><BackHeader title="Template" /></Page>;

  /** Flip the superset link between exercise i and i+1, then re-number contiguous linked runs. */
  async function toggleLink(i: number) {
    const list = t!.exercises;
    const links = list.slice(0, -1).map((te, k) => !!te.group && te.group === list[k + 1]!.group);
    links[i] = !links[i];
    const out = list.map((te) => ({ ...te, group: null as string | null }));
    let k = 0;
    while (k < out.length) {
      let end = k;
      while (end < links.length && links[end]) end++;
      if (end > k) {
        const g = uid();
        for (let m = k; m <= end; m++) out[m]!.group = g;
      }
      k = end + 1;
    }
    await saveTemplateExercises(t!.id, out);
  }
  const ids = t.exercises.map((e) => e.exerciseId);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    saveTemplateExercises(t.id, arrayMove(t.exercises, from, to));
  };

  const openEdit = (i: number) => {
    setEditIdx(i);
    setDraft({ ...t.exercises[i]! });
  };
  const saveEdit = async () => {
    if (editIdx == null || !draft) return;
    const list = [...t.exercises];
    list[editIdx] = { ...draft, targetRepsMax: Math.max(draft.targetRepsMin, draft.targetRepsMax) };
    await saveTemplateExercises(t.id, list);
    setEditIdx(null);
  };
  const removeEdit = async () => {
    if (editIdx == null) return;
    await saveTemplateExercises(t.id, t.exercises.filter((_, i) => i !== editIdx));
    setEditIdx(null);
  };
  const draftEx = draft ? exMap.get(draft.exerciseId) : undefined;
  const step = units === 'metric' ? settings.weightStepKg : settings.weightStepLb;

  return (
    <Page>
      <BackHeader
        title={t.name}
        right={
          <button aria-label="Duplicate template" className="btn-ghost" onClick={async () => { const nid = await duplicateTemplate(t.id); if (nid) nav(`/settings/routines/${nid}`, { replace: true }); }}>
            <Copy size={20} />
          </button>
        }
      />
      <div className="space-y-4">
        <Field label="Name">
          <input className="input" value={t.name} onChange={(e) => db.templates.update(t.id, { name: e.target.value })} />
        </Field>
        <div className="flex gap-2">
          {TEMPLATE_COLORS.map((c) => (
            <button key={c} aria-label={`Color ${c}`} onClick={() => db.templates.update(t.id, { color: c })} className={`h-9 w-9 rounded-full border-4 ${t.color === c ? 'border-ink/30' : 'border-transparent'}`} style={{ background: c }} />
          ))}
        </div>
        <p className="text-sm text-muted">Hold the grip to drag and reorder. Tap an exercise to set targets. Changes here never affect workouts you've already logged.</p>

        {t.exercises.length === 0 ? (
          <EmptyState icon={<Dumbbell size={30} />} title="No exercises yet" sub="Add exercises from the library." />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {t.exercises.map((te, i) => {
                  const next = t.exercises[i + 1];
                  const linked = !!te.group && next?.group === te.group;
                  return (
                    <div key={te.exerciseId}>
                      <SortRow id={te.exerciseId} te={te} ex={exMap.get(te.exerciseId)} unitLabel={wUnit(units)} weightDisp={toDispW(te.targetWeight, units)} onEdit={() => openEdit(i)} />
                      {next && (
                        <div className="flex justify-center -my-1 relative z-[1]">
                          <button
                            onClick={() => toggleLink(i)}
                            className={`min-h-[34px] rounded-full px-3 text-[12px] font-bold flex items-center gap-1 border ${linked ? 'bg-accent text-accent-ink border-accent' : 'bg-bg text-muted border-line border-dashed'}`}
                          >
                            <Link2 size={13} /> {linked ? 'Superset' : 'Make superset'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
        <button className="btn-primary" onClick={() => setPicking(true)}><Plus size={20} /> Add exercise</button>
        <button className="w-full min-h-[48px] text-danger font-bold flex items-center justify-center gap-2" onClick={() => setConfirmDel(true)}>
          <Trash2 size={18} /> Delete template
        </button>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        selected={new Set(ids)}
        onRemove={async (e) => {
          await saveTemplateExercises(t.id, t.exercises.filter((x) => x.exerciseId !== e.id));
          toast(`Removed ${e.name}`);
        }}
        onPick={async (e) => {
          if (ids.includes(e.id)) return;
          await saveTemplateExercises(t.id, [...t.exercises, newTemplateExercise(e.id, settings.defaultRestSec, e.type)]);
          toast(`Added ${e.name}`, 'success');
        }}
      />

      <BottomSheet
        open={editIdx != null}
        onClose={() => setEditIdx(null)}
        title={draftEx?.name ?? 'Exercise'}
        footer={
          <div className="space-y-2">
            <button className="btn-primary" onClick={saveEdit}>Save targets</button>
            <button className="w-full min-h-[44px] text-danger font-bold" onClick={removeEdit}>Remove from template</button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Sets</span>
              <Stepper value={draft.targetSets} onChange={(v) => setDraft({ ...draft, targetSets: Math.max(1, v ?? 1) })} step={1} min={1} decimals={0} label="sets" inputMode="numeric" />
            </div>
            {draftEx?.type !== 'time' && draftEx?.type !== 'cardio' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Reps min</span>
                  <Stepper value={draft.targetRepsMin} onChange={(v) => setDraft({ ...draft, targetRepsMin: v ?? 0 })} decimals={0} label="minimum reps" inputMode="numeric" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Reps max</span>
                  <Stepper value={draft.targetRepsMax} onChange={(v) => setDraft({ ...draft, targetRepsMax: v ?? 0 })} decimals={0} label="maximum reps" inputMode="numeric" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Weight ({wUnit(units)})</span>
                  <Stepper value={toDispW(draft.targetWeight, units)} onChange={(v) => setDraft({ ...draft, targetWeight: v == null || v === 0 ? null : fromDispW(v, units) })} step={step} label="target weight" />
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="font-semibold">Rest (sec)</span>
              <Stepper value={draft.restSec} onChange={(v) => setDraft({ ...draft, restSec: v ?? 0 })} step={15} decimals={0} label="rest seconds" inputMode="numeric" />
            </div>
            <Field label="Rest presets">
              <div className="flex gap-2 flex-wrap">
                {[45, 60, 90, 120, 180].map((s) => (
                  <button key={s} className={`btn-secondary !min-h-[38px] text-sm ${draft.restSec === s ? '!bg-primary !text-white' : ''}`} onClick={() => setDraft({ ...draft, restSec: s })}>{s}s</button>
                ))}
              </div>
            </Field>
          </div>
        )}
      </BottomSheet>

      <ConfirmSheet
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title={`Delete "${t.name}"?`}
        message="Past workouts logged with this template are kept. It will be removed from your weekly schedule."
        confirmLabel="Delete template"
        danger
        onConfirm={async () => {
          await archiveTemplate(t.id);
          nav(-1);
        }}
      />
    </Page>
  );
}

