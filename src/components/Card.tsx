import type { ReactNode, HTMLAttributes } from 'react';

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Dark green gradient card (Pocket "Net Worth"). */
export function HeroCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-card p-6 text-white shadow-float hero-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function HeroSplit({ items }: { items: { label: string; value: ReactNode; tone?: 'danger' | 'success' }[] }) {
  return (
    <div className="mt-4 flex">
      {items.map((it, i) => (
        <div key={it.label} className={`flex-1 min-w-0 ${i > 0 ? 'pl-5 border-l border-white/15' : 'pr-2'}`}>
          <div className="text-[13px] text-white/70 truncate">{it.label}</div>
          <div
            className={`num text-[19px] font-bold tabular truncate ${
              it.tone === 'danger' ? 'text-[#E8B1A6]' : it.tone === 'success' ? 'text-[#B9DDBF]' : ''
            }`}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeroPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'danger' | 'success' }) {
  const cls =
    tone === 'danger' ? 'bg-[#E8B1A6]/20 text-[#F0C3B8]' : tone === 'success' ? 'bg-[#B9DDBF]/20 text-[#CFE9D3]' : 'bg-white/15 text-white';
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold ${cls}`}>{children}</span>;
}

/** Small stat card with round tinted icon (Pocket Income / Expense). */
export function StatCard({
  icon, label, value, tone = 'success', sub, onClick,
}: {
  icon: ReactNode; label: string; value: ReactNode; tone?: 'success' | 'danger' | 'warn' | 'neutral'; sub?: ReactNode; onClick?: () => void;
}) {
  const tint = {
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
    warn: 'bg-warn/15 text-warn',
    neutral: 'bg-track text-ink',
  }[tone];
  const valueColor = { success: 'text-success', danger: 'text-danger', warn: 'text-warn', neutral: 'text-ink' }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className="card p-5 text-left flex-1 min-w-0 active:scale-[0.98] transition-transform">
      <div className={`h-11 w-11 rounded-full flex items-center justify-center ${tint}`}>{icon}</div>
      <div className="mt-3 text-[15px] text-muted">{label}</div>
      <div className={`num text-[26px] font-extrabold leading-tight tabular truncate ${valueColor}`}>{value}</div>
      {sub && <div className="text-[13px] text-muted mt-0.5">{sub}</div>}
    </Comp>
  );
}

export function SectionTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mt-7 mb-3">
      <div>
        <h2 className="text-[22px] font-extrabold tracking-tight">{title}</h2>
        {sub && <div className="text-[14px] text-muted">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
