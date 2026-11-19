import { AlertCircle, Sparkles, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { create } from 'zustand';

/** Dismissible banner with sparkle icon (Pocket "Your October recap is ready"). */
export function Banner({
  title, sub, onClick, onDismiss, icon,
}: { title: string; sub?: string; onClick?: () => void; onDismiss?: () => void; icon?: ReactNode }) {
  return (
    <div className="rounded-card bg-soft p-4 flex items-center gap-4">
      <button onClick={onClick} className="flex items-center gap-4 flex-1 text-left min-w-0">
        <div className="h-14 w-14 shrink-0 rounded-[18px] bg-primary text-white flex items-center justify-center">
          {icon ?? <Sparkles size={26} fill="currentColor" />}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-[17px] leading-snug">{title}</div>
          {sub && <div className="text-[14px] text-muted leading-snug">{sub}</div>}
        </div>
      </button>
      {onDismiss && (
        <button aria-label="Dismiss" className="btn-ghost text-muted shrink-0" onClick={onDismiss}>
          <X size={22} />
        </button>
      )}
    </div>
  );
}

/** Alert row with amber icon (Pocket "You overspent…"). */
export function AlertRow({ children, tone = 'warn', icon }: { children: ReactNode; tone?: 'warn' | 'danger' | 'success'; icon?: ReactNode }) {
  const c = { warn: 'text-warn', danger: 'text-danger', success: 'text-success' }[tone];
  return (
    <div className="card px-5 py-4 flex items-center gap-4">
      <span className={`${c} shrink-0`}>{icon ?? <AlertCircle size={26} />}</span>
      <div className="text-[15px] leading-snug">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="card p-8 text-center flex flex-col items-center">
      <div className="h-16 w-16 rounded-[20px] bg-track text-primary flex items-center justify-center mb-4">{icon}</div>
      <div className="text-[18px] font-bold">{title}</div>
      {sub && <div className="text-muted text-[15px] mt-1 max-w-[280px]">{sub}</div>}
      {action && <div className="mt-5 w-full">{action}</div>}
    </div>
  );
}

// ---- Toasts ----
interface ToastItem {
  id: number;
  text: string;
  tone: 'default' | 'success' | 'error';
  action?: { label: string; run: () => void };
}
interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => void;
  remove: (id: number) => void;
}
let nextId = 1;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.action ? 5000 : 2600);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = (text: string, tone: ToastItem['tone'] = 'default', action?: ToastItem['action']) =>
  useToasts.getState().push({ text, tone, action });

export function Toaster() {
  const { toasts, remove } = useToasts();
  return (
    <div className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" style={{ top: 'max(env(safe-area-inset-top), 12px)' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto animate-fade-in rounded-2xl px-4 py-3 shadow-float text-[15px] font-semibold flex items-center gap-3 max-w-md ${
            t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'success' ? 'bg-primary text-white' : 'bg-ink text-bg'
          }`}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              className="underline font-bold"
              onClick={() => {
                t.action!.run();
                remove(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
