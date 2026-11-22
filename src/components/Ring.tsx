import type { ReactNode } from 'react';

/** Circular progress ring (white on the hero card by default). */
export function Ring({ value, max, size = 112, stroke = 11, children, color = 'rgb(var(--c-accent))', track = 'rgba(255,255,255,0.18)', over = '#E8B1A6' }: {
  value: number; max: number; size?: number; stroke?: number; children?: ReactNode; color?: string; track?: string; over?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  const shown = Math.min(1, pct);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={pct > 1 ? over : color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)} style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
