import { ArrowDown, ArrowUp, Clock, Dumbbell, ListChecks, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HeroCard } from '../../components/Card';
import { toast } from '../../components/Feedback';
import { FullSheet } from '../../components/Sheet';
import { finishSession, summarizeSession, type SessionSummary } from '../../db/workouts';
import type { WorkoutSession } from '../../db/types';
import { fmtInt, fmtMinutes } from '../../lib/format';
import { prettyDate } from '../../lib/dates';
import { lbToKg, type Units } from '../../lib/units';
import { useRestTimer } from './restTimer';

const FEELS = ['😫', '😕', '😐', '🙂', '💪'];

export function FinishSheet({ open, onClose, session, units }: { open: boolean; onClose: () => void; session: WorkoutSession; units: Units }) {
  const [sum, setSum] = useState<SessionSummary | null>(null);
  const [rating, setRating] = useState<number | null>(session.rating);
  const [note, setNote] = useState(session.note);
  const skipRest = useRestTimer((s) => s.skip);
  useEffect(() => {
    if (open) {
      summarizeSession(session.id).then(setSum);
      setRating(session.rating);
      setNote(session.note);
    }
  }, [open, session.id, session.rating, session.note]);

  const vol = (v: number) => fmtInt(units === 'metric' ? lbToKg(v) : v);
  const unit = units === 'metric' ? 'kg' : 'lb';
  const delta = sum && sum.prevVolume ? ((sum.volume - sum.prevVolume) / sum.prevVolume) * 100 : null;

  return (
    <FullSheet
      open={open}
      onClose={onClose}
      title={session.status === 'done' ? 'Workout summary' : 'Finish workout'}
      footer={
        <button
          className="btn-primary"
          onClick={async () => {
            await finishSession(session.id, rating, note);
            skipRest();
            toast(session.status === 'done' ? 'Workout updated' : 'Workout saved. Nice work! 💪', 'success');
            onClose();
          }}
        >
          Save workout
        </button>
      }
    >
      {sum && (
        <div className="space-y-4">
          <HeroCard>
            <div className="text-white/75 text-[15px]">{session.templateNameSnapshot} · {prettyDate(session.date)}</div>
            <div className="text-[44px] font-extrabold tracking-tight leading-tight tabular">{vol(sum.volume)} <span className="text-[22px] text-white/75">{unit}</span></div>
            <div className="text-white/75 text-[14px]">Total volume</div>
            {delta != null && (
              <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-bold ${delta >= 0 ? 'bg-[#B9DDBF]/20 text-[#CFE9D3]' : 'bg-[#E8B1A6]/20 text-[#F0C3B8]'}`}>
                {delta >= 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                {Math.abs(Math.round(delta))}% vs last {session.templateNameSnapshot} ({prettyDate(sum.prevDate!, 'MMM d')})
              </div>
            )}
          </HeroCard>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <Clock size={20} />, label: 'Duration', value: sum.durationSec ? fmtMinutes(sum.durationSec) : '–' },
              { icon: <ListChecks size={20} />, label: 'Sets', value: sum.setsDone },
              { icon: <Trophy size={20} />, label: 'PRs', value: sum.prs },
            ].map((x) => (
              <div key={x.label} className="card p-4">
                <div className="h-9 w-9 rounded-full bg-success/15 text-success flex items-center justify-center">{x.icon}</div>
                <div className="text-[13px] text-muted mt-2">{x.label}</div>
                <div className="text-[20px] font-extrabold">{x.value}</div>
              </div>
            ))}
          </div>
          {sum.prs > 0 && (
            <div className="card p-4 flex items-center gap-3">
              <Trophy className="text-warn fill-warn" />
              <div className="font-semibold">You hit {sum.prs} personal record{sum.prs > 1 ? 's' : ''} today!</div>
            </div>
          )}
          <div>
            <div className="section-label mb-2">How did it feel?</div>
            <div className="flex gap-2">
              {FEELS.map((f, i) => (
                <button
                  key={i}
                  aria-label={`Rating ${i + 1} of 5`}
                  onClick={() => setRating(rating === i + 1 ? null : i + 1)}
                  className={`flex-1 h-14 rounded-btn border text-[26px] transition-transform active:scale-90 ${rating === i + 1 ? 'bg-primary border-primary' : 'bg-card border-line'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="section-label">Note (optional)</span>
            <textarea className="input mt-2 py-3 min-h-[96px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Energy, sleep, anything notable…" />
          </label>
          {!sum.setsDone && (
            <div className="text-sm text-muted flex items-center gap-2"><Dumbbell size={16} /> No sets completed yet — you can still save it.</div>
          )}
        </div>
      )}
    </FullSheet>
  );
}
