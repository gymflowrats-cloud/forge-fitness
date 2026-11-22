import { Minus, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export function SegmentedControl<T extends string>({
  options, value, onChange, tone = 'primary', size = 'md',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  tone?: 'primary' | 'danger';
  size?: 'md' | 'sm';
}) {
  return (
    <div className="flex rounded-[18px] bg-track p-1.5 gap-1" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[14px] font-bold transition-colors ${size === 'sm' ? 'min-h-[40px] text-[15px]' : 'min-h-[48px] text-[17px]'} ${
              active ? (tone === 'danger' ? 'bg-danger text-white' : 'bg-primary text-white') : 'text-muted'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active, onClick, children, className = '',
}: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 min-h-[44px] rounded-full px-4 border text-[15px] font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors active:scale-[0.97] ${
        active ? 'bg-primary border-primary text-white' : 'bg-card border-line text-ink'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-0.5 ${className}`}>{children}</div>;
}

export function ProgressBar({ value, max = 1, tone = 'primary', className = '', light = false }: {
  value: number; max?: number; tone?: 'primary' | 'danger' | 'success' | 'warn'; className?: string; light?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = light ? 'bg-accent' : { primary: 'bg-primary', danger: 'bg-danger', success: 'bg-success', warn: 'bg-warn' }[tone];
  return (
    <div className={`h-2.5 rounded-full overflow-hidden ${light ? 'bg-white/20' : 'bg-track'} ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Number field with big - / + buttons; tap the number to type. */
export function Stepper({
  value, onChange, step = 1, min = 0, decimals = 1, label, compact = false, inputMode = 'decimal',
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  decimals?: number;
  label?: string;
  compact?: boolean;
  inputMode?: 'decimal' | 'numeric';
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);
  const commit = (t: string) => {
    if (t.trim() === '') return onChange(null);
    const n = Number(t.replace(',', '.'));
    if (!Number.isNaN(n)) onChange(Math.max(min, round(n, decimals)));
    else setText(value == null ? '' : String(value));
  };
  const bump = (d: number) => onChange(Math.max(min, round((value ?? 0) + d, decimals)));
  const btn = `${compact ? 'h-11 w-9' : 'h-12 w-12'} shrink-0 rounded-xl bg-track flex items-center justify-center active:scale-90 transition-transform text-ink`;
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label={`Decrease ${label ?? ''}`} className={btn} onClick={() => bump(-step)}>
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <input
        aria-label={label}
        inputMode={inputMode}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        onFocus={(e) => e.target.select()}
        className={`${compact ? 'w-[52px] h-11' : 'w-20 h-12'} min-w-0 rounded-xl bg-card border border-line text-center font-bold tabular text-[17px] outline-none focus:border-primary`}
      />
      <button type="button" aria-label={`Increase ${label ?? ''}`} className={btn} onClick={() => bump(step)}>
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-track'}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[24px]' : 'left-1'}`} />
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

/** Controlled numeric input that keeps a string while editing. */
export function NumberInput({
  value, onChange, placeholder, className = 'input', decimal = true, ariaLabel,
}: {
  value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string; className?: string; decimal?: boolean; ariaLabel?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    const cur = text.trim() === '' ? null : Number(text);
    if (cur !== value) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      aria-label={ariaLabel}
      className={className}
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        if (!/^\d*\.?\d*$/.test(t)) return;
        setText(t);
        onChange(t === '' || t === '.' ? null : Number(t));
      }}
    />
  );
}
