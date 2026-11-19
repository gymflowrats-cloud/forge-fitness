import { Timer, SkipForward } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSettings } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { fmtDuration } from '../../lib/format';
import { beep, useRestTimer, vibrate } from './restTimer';
import { toast } from '../../components/Feedback';

/** Sticky mini timer bar shown above the tab bar while resting. */
export function RestTimerBar() {
  const { endsAt, total, label, adjust, skip } = useRestTimer();
  const settings = useSettings();
  const now = useNow(250, !!endsAt);
  const fired = useRef<number | null>(null);
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (endsAt && left === 0 && fired.current !== endsAt) {
      fired.current = endsAt;
      vibrate([250, 120, 250]);
      if (settings.restSound) beep();
      toast('Rest over — next set! 💪', 'success');
      skip();
    }
  }, [left, endsAt, skip, settings.restSound]);

  if (!endsAt) return null;
  const pct = total ? (1 - left / total) * 100 : 0;
  return (
    <div className="fixed inset-x-0 z-40 px-3" style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 10px) + 70px)' }}>
      <div className="mx-auto max-w-md rounded-[22px] bg-primary text-white shadow-float overflow-hidden">
        <div className="h-1 bg-white/15">
          <div className="h-full bg-white transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <Timer size={20} className="shrink-0 ml-1" />
          <div className="flex-1 min-w-0">
            <div className="text-[22px] font-extrabold tabular leading-none">{fmtDuration(left)}</div>
            <div className="text-[12px] text-white/70 truncate">Rest{label ? ` · ${label}` : ''}</div>
          </div>
          <button aria-label="Subtract 15 seconds" className="h-11 px-3 rounded-full bg-white/15 font-bold" onClick={() => adjust(-15)}>−15s</button>
          <button aria-label="Add 15 seconds" className="h-11 px-3 rounded-full bg-white/15 font-bold" onClick={() => adjust(15)}>+15s</button>
          <button aria-label="Skip rest" className="h-11 w-11 rounded-full bg-white/15 flex items-center justify-center" onClick={skip}>
            <SkipForward size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
