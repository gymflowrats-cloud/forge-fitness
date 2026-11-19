import { format } from 'date-fns';
import { fromKey, relativeLabel, shiftKey, todayKey } from '../lib/dates';
import { ChipRow } from './Controls';

/** Horizontal date chips: Today 19 Nov / Y'day 18 / Tue 17 … */
export function DateChips({ value, onChange, days = 14 }: { value: string; onChange: (d: string) => void; days?: number }) {
  const today = todayKey();
  const keys = Array.from({ length: days }, (_, i) => shiftKey(today, -i));
  if (!keys.includes(value)) keys.push(value);
  return (
    <ChipRow>
      {keys.map((k) => {
        const active = k === value;
        const d = fromKey(k);
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`shrink-0 w-[68px] rounded-[18px] border py-2 flex flex-col items-center transition-colors active:scale-95 ${
              active ? 'bg-primary border-primary text-white' : 'bg-card border-line'
            }`}
          >
            <span className={`text-[13px] ${active ? 'text-white/85' : 'text-muted'}`}>{relativeLabel(k)}</span>
            <span className="text-[22px] font-extrabold leading-tight">{format(d, 'd')}</span>
            <span className={`text-[12px] ${active ? 'text-white/85' : 'text-muted'}`}>{format(d, 'MMM')}</span>
          </button>
        );
      })}
    </ChipRow>
  );
}
