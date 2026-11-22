import { useMemo, useState } from 'react';
import { MUSCLE_LABELS } from '../../db/seedExercises';
import type { Muscle } from '../../db/types';
import { fmtNum } from '../../lib/format';
import type { ChartColors } from './chartTheme';

type Shape = { m: Muscle; d?: string; e?: [number, number, number, number] };

// Simple, symmetric body diagrams (viewBox 200×370). Ellipses are [cx, cy, rx, ry].
const mirror = (m: Muscle, cx: number, cy: number, rx: number, ry: number): Shape[] => [
  { m, e: [cx, cy, rx, ry] },
  { m, e: [200 - cx, cy, rx, ry] },
];
const FRONT: Shape[] = [
  ...mirror('shoulders', 66, 74, 15, 13),
  { m: 'chest', d: 'M78 62 Q99 58 99 64 L99 96 Q88 102 76 94 Q72 76 78 62 Z' },
  { m: 'chest', d: 'M122 62 Q101 58 101 64 L101 96 Q112 102 124 94 Q128 76 122 62 Z' },
  ...mirror('biceps', 56, 108, 9, 20),
  ...mirror('forearms', 50, 152, 8, 22),
  { m: 'core', d: 'M82 102 Q100 98 118 102 L116 160 Q100 168 84 160 Z' },
  ...mirror('quads', 86, 218, 14, 40),
  ...mirror('calves', 86, 302, 9, 30),
];
const BACK: Shape[] = [
  ...mirror('shoulders', 66, 74, 15, 13),
  { m: 'back', d: 'M80 60 Q100 52 120 60 L128 92 Q120 128 108 146 L92 146 Q80 128 72 92 Z' },
  ...mirror('triceps', 56, 108, 9, 20),
  ...mirror('forearms', 50, 152, 8, 22),
  ...mirror('glutes', 88, 172, 13, 14),
  ...mirror('hamstrings', 86, 228, 13, 34),
  ...mirror('calves', 86, 300, 11, 28),
];

function Figure({ shapes, label, fillOf, onPick, sel, c }: { shapes: Shape[]; label: string; fillOf: (m: Muscle) => string; onPick: (m: Muscle) => void; sel: Muscle | null; c: ChartColors }) {
  const body = c.dark ? '#2c2f2c' : '#e6e4de';
  return (
    <figure className="flex-1 min-w-0">
      <svg viewBox="0 0 200 350" className="w-full max-h-[300px]" role="img" aria-label={`${label} muscle map`}>
        {/* silhouette */}
        <g fill={body}>
          <circle cx="100" cy="28" r="17" />
          <rect x="92" y="42" width="16" height="14" rx="4" />
          <path d="M70 58 Q100 48 130 58 L134 100 Q128 140 122 166 L78 166 Q72 140 66 100 Z" />
          <rect x="76" y="160" width="48" height="22" rx="8" />
          <ellipse cx="55" cy="108" rx="11" ry="24" /><ellipse cx="145" cy="108" rx="11" ry="24" />
          <ellipse cx="49" cy="152" rx="10" ry="26" /><ellipse cx="151" cy="152" rx="10" ry="26" />
          <ellipse cx="86" cy="225" rx="16" ry="46" /><ellipse cx="114" cy="225" rx="16" ry="46" />
          <ellipse cx="86" cy="302" rx="12" ry="34" /><ellipse cx="114" cy="302" rx="12" ry="34" />
        </g>
        {shapes.map((s, k) => {
          const common = {
            fill: fillOf(s.m),
            stroke: sel === s.m ? c.ink : c.card,
            strokeWidth: sel === s.m ? 2 : 1.2,
            onClick: () => onPick(s.m),
            style: { cursor: 'pointer' },
          };
          return s.e ? <ellipse key={k} cx={s.e[0]} cy={s.e[1]} rx={s.e[2]} ry={s.e[3]} {...common} /> : <path key={k} d={s.d} {...common} />;
        })}
      </svg>
      <figcaption className="text-center text-[12px] text-muted font-semibold">{label}</figcaption>
    </figure>
  );
}

/** Front/back body map coloured by working sets this week (target ~10–20 per muscle). */
export function MuscleMap({ perMuscle, c }: { perMuscle: Record<string, number>; c: ChartColors }) {
  const [sel, setSel] = useState<Muscle | null>(null);
  // Body grey → accent, so trained muscles glow in the palette's action colour (works in light and dark).
  const scale = useMemo(() => {
    const st = getComputedStyle(document.documentElement);
    const tri = (v: string) => st.getPropertyValue(v).trim().split(/\s+/).map(Number);
    const a = tri('--c-accent');
    const b = c.dark ? [72, 76, 72] : [205, 202, 194];
    return [0, 0.3, 0.55, 0.8, 1].map((t) => `rgb(${b.map((x, i) => Math.round(x + ((a[i] ?? 0) - x) * t)).join(',')})`);
  }, [c]);
  const level = (v: number) => (v <= 0 ? 0 : v < 4 ? 1 : v < 8 ? 2 : v < 12 ? 3 : 4);
  const fillOf = (m: Muscle) => scale[level(perMuscle[m] ?? 0)]!;
  const neglected = (['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'] as Muscle[]).filter((m) => !(perMuscle[m] ?? 0));
  return (
    <div>
      <div className="flex gap-2">
        <Figure shapes={FRONT} label="Front" fillOf={fillOf} onPick={setSel} sel={sel} c={c} />
        <Figure shapes={BACK} label="Back" fillOf={fillOf} onPick={setSel} sel={sel} c={c} />
      </div>
      <div className="flex items-center gap-1 justify-center mt-2 text-[11px] text-muted">
        0 {scale.map((h) => <span key={h} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: h }} />)} 12+ sets
      </div>
      <div className="text-center text-[14px] mt-2 min-h-[22px]">
        {sel ? <><b>{MUSCLE_LABELS[sel]}</b>: {fmtNum(perMuscle[sel] ?? 0, 1)} sets this week</> : <span className="text-muted">Tap a muscle to see its sets</span>}
      </div>
      {neglected.length > 0 && <div className="text-[13px] text-warn text-center mt-1">Not trained yet this week: {neglected.map((m) => MUSCLE_LABELS[m]).join(', ')}</div>}
    </div>
  );
}
