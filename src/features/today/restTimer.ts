import { create } from 'zustand';

interface RestState {
  endsAt: number | null;
  total: number;
  label: string;
  start: (sec: number, label?: string) => void;
  adjust: (delta: number) => void;
  skip: () => void;
}

const KEY = 'forge.rest';
function load(): Pick<RestState, 'endsAt' | 'total' | 'label'> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && v.endsAt > Date.now()) return v;
  } catch {
    /* ignore */
  }
  return { endsAt: null, total: 0, label: '' };
}
const save = (s: Pick<RestState, 'endsAt' | 'total' | 'label'>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

export const useRestTimer = create<RestState>((set, get) => ({
  ...load(),
  start: (sec, label = '') => {
    unlockAudio();
    const next = { endsAt: Date.now() + sec * 1000, total: sec, label };
    save(next);
    set(next);
  },
  adjust: (delta) => {
    const { endsAt, total, label } = get();
    if (!endsAt) return;
    const next = { endsAt: Math.max(Date.now() + 1000, endsAt + delta * 1000), total: Math.max(1, total + delta), label };
    save(next);
    set(next);
  },
  skip: () => {
    const next = { endsAt: null, total: 0, label: '' };
    save(next);
    set(next);
  },
}));

// ---- sound (WebAudio; must be unlocked from a user gesture on iOS) ----
let ctx: AudioContext | null = null;
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === 'suspended') ctx.resume();
  } catch {
    /* no audio */
  }
}
export function beep() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [0, 0.22, 0.44].forEach((off, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'sine';
    o.frequency.value = i === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, t0 + off);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.18);
    o.connect(g).connect(ctx!.destination);
    o.start(t0 + off);
    o.stop(t0 + off + 0.2);
  });
}
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS Safari) */
  }
}
