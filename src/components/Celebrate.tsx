import { Award, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import { create } from 'zustand';
import { getSettings } from '../db/settings';

interface Burst {
  id: number;
  kind: 'pr' | 'achievement';
  title: string;
  sub?: string;
}
const useBurst = create<{ items: Burst[]; push: (b: Burst) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (b) => set((s) => ({ items: [...s.items, b] })),
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Short CSS-only confetti burst in the current palette + gold. */
export function confetti(count = 70) {
  if (reducedMotion()) return;
  const css = getComputedStyle(document.documentElement);
  const rgb = (v: string) => `rgb(${css.getPropertyValue(v).trim().split(/\s+/).join(',')})`;
  const colors = [rgb('--c-accent'), rgb('--c-primary'), rgb('--c-gold'), rgb('--c-success'), '#ffffff'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = colors[i % colors.length]!;
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 220}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 1080}deg`);
    el.style.setProperty('--dur', `${1.6 + Math.random() * 1.4}s`);
    el.style.animationDelay = `${Math.random() * 0.25}s`;
    if (i % 3 === 0) el.style.borderRadius = '50%';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }
}

let n = 0;
/** Confetti + a gold badge card. Respects the Celebrations setting. */
export async function celebrate(kind: Burst['kind'], title: string, sub?: string) {
  const s = await getSettings();
  if (!s.celebrations) return false;
  confetti(kind === 'achievement' ? 90 : 60);
  useBurst.getState().push({ id: ++n, kind, title, sub });
  return true;
}

function BurstCard({ b }: { b: Burst }) {
  const drop = useBurst((s) => s.drop);
  useEffect(() => {
    const t = setTimeout(() => drop(b.id), 3200);
    return () => clearTimeout(t);
  }, [b.id, drop]);
  return (
    <button onClick={() => drop(b.id)} className="pointer-events-auto mx-auto max-w-sm w-full card !rounded-[22px] p-4 flex items-center gap-3 shadow-float animate-pop text-left border-2 !border-gold/60">
      <div className="h-14 w-14 shrink-0 rounded-full bg-gold/20 text-gold flex items-center justify-center">
        {b.kind === 'pr' ? <Trophy size={28} /> : <Award size={28} />}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gold">{b.kind === 'pr' ? 'New personal record' : 'Achievement unlocked'}</div>
        <div className="font-extrabold text-[17px] leading-tight">{b.title}</div>
        {b.sub && <div className="text-[13px] text-muted truncate">{b.sub}</div>}
      </div>
    </button>
  );
}

export function CelebrationLayer() {
  const items = useBurst((s) => s.items);
  if (!items.length) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] px-4 space-y-2 pointer-events-none" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      {items.slice(-2).map((b) => <BurstCard key={b.id} b={b} />)}
    </div>
  );
}
