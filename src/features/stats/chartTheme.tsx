import { useEffect, useState, type ReactNode } from 'react';

// Categorical slots (validated with the dataviz validator, light + dark). Fixed order, never cycled; 8th+ → "Other" gray.
const CAT_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
const CAT_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9'];

export interface ChartColors {
  dark: boolean;
  primary: string; // single-series brand color
  primarySoft: string;
  grid: string;
  axis: string;
  ink: string;
  muted: string;
  card: string;
  good: string;
  bad: string;
  warn: string;
  other: string;
  cat: string[];
  heat: string[]; // sequential, light → dark (one hue)
}

function read(): ChartColors {
  const st = getComputedStyle(document.documentElement);
  const rgb = (v: string) => `rgb(${st.getPropertyValue(v).trim().split(/\s+/).join(',')})`;
  const dark = document.documentElement.classList.contains('dark');
  return {
    dark,
    primary: dark ? '#7FA889' : '#36493B',
    primarySoft: dark ? 'rgba(127,168,137,0.25)' : 'rgba(54,73,59,0.18)',
    grid: st.getPropertyValue('--chart-grid').trim() || '#E8E6E0',
    axis: st.getPropertyValue('--chart-axis').trim() || '#8A8A84',
    ink: rgb('--c-ink'),
    muted: rgb('--c-muted'),
    card: rgb('--c-card'),
    good: rgb('--c-success'),
    bad: rgb('--c-danger'),
    warn: rgb('--c-warn'),
    other: dark ? '#6f716c' : '#a8a79f',
    cat: dark ? CAT_DARK : CAT_LIGHT,
    heat: dark ? ['#2a2f2b', '#2f4a36', '#3f6b4a', '#5d9068', '#8fc49a'] : ['#ECEBE6', '#c9d8cc', '#93b39b', '#5a8264', '#2f4a36'],
  };
}

export function useChartColors(): ChartColors {
  const [c, setC] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

export const axisProps = (c: ChartColors) => ({
  tick: { fill: c.axis, fontSize: 11 },
  axisLine: false,
  tickLine: false,
});

export function ChartCard({ title, sub, right, children, legend }: { title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode; legend?: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[18px] font-extrabold leading-tight">{title}</h3>
          {sub && <div className="text-[13px] text-muted mt-0.5">{sub}</div>}
        </div>
        {right}
      </div>
      {legend && legend.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              {l.dashed ? <span className="w-4 border-t-2 border-dashed" style={{ borderColor: l.color }} /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />}
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Tooltip body used by all Recharts tooltips. */
export function TipBox({ title, rows }: { title: ReactNode; rows: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-xl bg-card border border-line shadow-float px-3 py-2 text-[13px]">
      <div className="font-bold mb-0.5">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-muted">{r.label}</span>
          <span className="font-bold ml-auto pl-3 tabular">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function InsightCard({ text, tone = 'neutral', icon }: { text: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'neutral'; icon: ReactNode }) {
  const cls = { good: 'bg-success/15 text-success', bad: 'bg-danger/15 text-danger', warn: 'bg-warn/15 text-warn', neutral: 'bg-soft text-primary' }[tone];
  return (
    <div className="card px-4 py-3.5 flex items-center gap-3.5">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${cls}`}>{icon}</div>
      <div className="text-[15px] leading-snug">{text}</div>
    </div>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="card p-4 min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={`text-[24px] font-extrabold tabular leading-tight truncate ${tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : ''}`}>{value}</div>
      {sub && <div className="text-[12px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
