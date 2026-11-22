import { Check, Trash2 } from 'lucide-react';
import { toast } from '../../components/Feedback';
import { BottomSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import type { SetType, WorkoutSet } from '../../db/types';
import { deleteSet, updateSet } from '../../db/workouts';

const TYPES: { t: SetType; label: string; sub: string }[] = [
  { t: 'working', label: 'Normal set', sub: 'Counts toward volume and PRs' },
  { t: 'warmup', label: 'Warm-up', sub: 'Light prep set. Not counted' },
  { t: 'drop', label: 'Drop set', sub: 'Lighter weight straight after a set' },
  { t: 'failure', label: 'To failure', sub: 'As many reps as you can' },
];

/** Change a set's type or delete it. Opened by tapping the set number. */
export function SetOptionsSheet({ set, title, onClose }: { set: WorkoutSet | null; title: string; onClose: () => void }) {
  return (
    <BottomSheet open={!!set} onClose={onClose} title={title}>
      {set && (
        <div className="space-y-2">
          {TYPES.map((o) => (
            <button
              key={o.t}
              onClick={() => { updateSet(set.id, { setType: o.t }); onClose(); }}
              className={`w-full min-h-[56px] rounded-btn border px-4 py-2 flex items-center gap-3 text-left ${set.setType === o.t ? 'border-accent bg-accent/10' : 'border-line bg-card'}`}
            >
              <div className="flex-1">
                <div className="font-bold">{o.label}</div>
                <div className="text-[13px] text-muted">{o.sub}</div>
              </div>
              {set.setType === o.t && <Check size={20} className="text-accent" />}
            </button>
          ))}
          <button
            className="w-full min-h-[52px] rounded-btn border border-danger/30 bg-danger/[0.06] text-danger font-bold flex items-center justify-center gap-2 !mt-4"
            onClick={async () => {
              await deleteSet(set.id);
              onClose();
              toast('Set deleted', 'default', { label: 'Undo', run: () => db.sets.put(set) });
            }}
          >
            <Trash2 size={18} /> Delete set
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
