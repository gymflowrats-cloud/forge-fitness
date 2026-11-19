import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ExerciseForm, ExerciseList, MuscleChips, SearchBox } from '../../components/ExercisePicker';
import { toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { BottomSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, TYPE_LABELS } from '../../db/seedExercises';
import type { Exercise } from '../../db/types';

export default function ExerciseLibrary() {
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Exercise | null>(null);
  const [editing, setEditing] = useState<Exercise | null>(null);
  return (
    <Page>
      <BackHeader title="Exercise library" right={<button aria-label="New exercise" className="btn-ghost" onClick={() => setCreating(true)}><Plus size={26} /></button>} />
      <div className="space-y-3">
        <SearchBox value={q} onChange={setQ} />
        <MuscleChips value={f} onChange={setF} />
        <ExerciseList query={q} filter={f} onPick={setViewing} />
      </div>
      <ExerciseForm open={creating} onClose={() => setCreating(false)} initialName={q} />
      <ExerciseForm open={!!editing} onClose={() => setEditing(null)} existing={editing ?? undefined} />
      <BottomSheet open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name}>
        {viewing && (
          <div className="space-y-3">
            <div className="card divide-y divide-line">
              {[
                ['Type', TYPE_LABELS[viewing.type]],
                ['Primary muscle', MUSCLE_LABELS[viewing.primaryMuscle]],
                ['Secondary', viewing.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ') || '—'],
                ['Equipment', EQUIPMENT_LABELS[viewing.equipment]],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-4 py-3"><span className="text-muted">{k}</span><span className="font-semibold">{v}</span></div>
              ))}
            </div>
            <button className="btn-primary" onClick={() => { setEditing(viewing); setViewing(null); }}>Edit</button>
            <button
              className="w-full min-h-[44px] text-danger font-bold"
              onClick={async () => {
                await db.exercises.update(viewing.id, { archived: true });
                const id = viewing.id;
                setViewing(null);
                toast('Exercise hidden', 'default', { label: 'Undo', run: () => db.exercises.update(id, { archived: false }) });
              }}
            >
              Hide from library
            </button>
          </div>
        )}
      </BottomSheet>
    </Page>
  );
}
