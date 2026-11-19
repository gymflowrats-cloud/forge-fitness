import { Trash2 } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

/** Swipe left to reveal a delete button (touch). */
export function SwipeRow({ children, onDelete, className = '' }: { children: ReactNode; onDelete: () => void; className?: string }) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; locked: 'h' | 'v' | null } | null>(null);
  const W = 84;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {(dx < 0 || open) && (
      <button
        aria-label="Delete set"
        onClick={() => {
          setOpen(false);
          setDx(0);
          onDelete();
        }}
        className="absolute inset-y-0 right-0 bg-danger text-white flex items-center justify-center gap-1 font-bold text-sm"
        style={{ width: W }}
        tabIndex={open ? 0 : -1}
      >
        <Trash2 size={18} /> Delete
      </button>
      )}
      <div
        className="relative"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform 200ms ease' }}
        onTouchStart={(e) => {
          const t = e.touches[0]!;
          start.current = { x: t.clientX, y: t.clientY, base: open ? -W : 0, locked: null };
        }}
        onTouchMove={(e) => {
          const s = start.current;
          if (!s) return;
          const t = e.touches[0]!;
          const mx = t.clientX - s.x;
          const my = t.clientY - s.y;
          if (!s.locked) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            s.locked = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
          }
          if (s.locked === 'h') setDx(Math.min(0, Math.max(-W * 1.4, s.base + mx)));
        }}
        onTouchEnd={() => {
          const s = start.current;
          start.current = null;
          if (!s || s.locked !== 'h') return;
          const shouldOpen = dx < -W / 2;
          setOpen(shouldOpen);
          setDx(shouldOpen ? -W : 0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
