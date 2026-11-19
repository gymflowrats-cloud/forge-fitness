import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

/** Bottom sheet (replaces alert/confirm). */
export function BottomSheet({
  open, onClose, title, children, footer,
}: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useLockScroll(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative bg-bg rounded-t-[28px] max-h-[90vh] flex flex-col animate-slide-up shadow-float">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" />
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <h3 className="text-[20px] font-extrabold">{title}</h3>
            <button aria-label="Close" className="btn-ghost -mr-2" onClick={onClose}>
              <X size={22} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {footer && <div className="px-5 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>{footer}</div>}
        {!footer && <div style={{ height: 'max(env(safe-area-inset-bottom), 12px)' }} />}
      </div>
    </div>,
    document.body,
  );
}

/** Full-screen modal with × top-left and centred title (Pocket "Add Transaction"). */
export function FullSheet({
  open, onClose, title, children, footer, right,
}: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; right?: ReactNode }) {
  useLockScroll(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-bg flex flex-col animate-slide-up" role="dialog" aria-modal="true">
      <div className="pt-safe px-3 grid grid-cols-[48px_1fr_48px] items-center">
        <button aria-label="Close" className="btn-ghost" onClick={onClose}>
          <X size={26} strokeWidth={2.4} />
        </button>
        <h2 className="text-center text-[20px] font-extrabold truncate">{title}</h2>
        <div className="flex justify-end">{right}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">{children}</div>
      {footer && (
        <div className="px-4 pt-3 border-t border-line bg-bg" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          {footer}
        </div>
      )}
    </div>,
    document.body,
  );
}

/** Confirmation sheet (replaces window.confirm). */
export function ConfirmSheet({
  open, onClose, title, message, confirmLabel = 'Confirm', danger, onConfirm,
}: { open: boolean; onClose: () => void; title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {message && <div className="text-muted text-[15px] mb-5">{message}</div>}
      <button
        className={`btn-primary ${danger ? '!bg-danger' : ''}`}
        onClick={() => {
          onConfirm();
          onClose();
        }}
      >
        {confirmLabel}
      </button>
      <button className="w-full min-h-[48px] mt-2 font-semibold text-muted" onClick={onClose}>
        Cancel
      </button>
    </BottomSheet>
  );
}
