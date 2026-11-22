import { ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Utensils, Ruler, ChartPie, Sparkles, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { prettyDate, shiftKey, todayKey } from '../lib/dates';
import { initials } from '../lib/format';

const TABS = [
  { to: '/today', label: 'Today', icon: Dumbbell },
  { to: '/food', label: 'Food', icon: Utensils },
  { to: '/body', label: 'Body', icon: Ruler },
  { to: '/stats', label: 'Stats', icon: ChartPie },
  { to: '/coach', label: 'Coach', icon: Sparkles },
];

const FILLABLE = new Set(['/stats', '/coach']);

/** Floating translucent bottom tab bar. */
export function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
      aria-label="Main"
    >
      <div className="mx-auto max-w-md rounded-[28px] border border-line bg-card/80 backdrop-blur-xl shadow-float flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 min-h-[62px] flex flex-col items-center justify-center gap-0.5 text-[12px] ${isActive ? 'text-primary font-bold' : 'text-muted font-medium'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={25} strokeWidth={isActive ? 2.3 : 1.8} fill={isActive && FILLABLE.has(to) ? 'currentColor' : 'none'} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Round floating action button above the tab bar. */
export function Fab({ onClick, label, icon }: { onClick: () => void; label: string; icon?: ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="fixed right-5 z-40 h-16 w-16 rounded-full bg-accent text-accent-ink shadow-float flex items-center justify-center active:scale-90 transition-transform"
      style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 10px) + 84px)' }}
    >
      {icon ?? <Plus size={30} strokeWidth={2.4} />}
    </button>
  );
}

/** Page wrapper: safe areas + room for the tab bar. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <main className={`mx-auto max-w-md px-4 pt-safe ${className}`} style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 10px) + 170px)' }}>
      {children}
    </main>
  );
}

/** "Welcome back / Name" header with optional right slot. */
export function WelcomeHeader({ name, right, sub = 'Welcome back', onTitleClick }: { name: string; right?: ReactNode; sub?: string; onTitleClick?: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3 pt-2 pb-4">
      {onTitleClick ? (
        <button className="min-w-0 text-left" onClick={onTitleClick} aria-label="Change day or workout">
          <div className="text-[13px] text-muted flex items-center gap-1">Change day or workout <ChevronDown size={14} /></div>
          <div className="text-[24px] font-extrabold tracking-tight truncate leading-tight">{name}</div>
        </button>
      ) : (
        <div className="min-w-0">
          <div className="text-[15px] text-muted">{sub}</div>
          <div className="text-[26px] font-extrabold tracking-tight truncate leading-tight">{name}</div>
        </div>
      )}
      {right}
    </header>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 pt-2 pb-4">
      <div className="min-w-0">
        <h1 className="h-title">{title}</h1>
        {sub && <div className="text-[15px] text-muted mt-0.5">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

/** `< Thu, Nov 19 >` pill. */
export function DateNav({ date, onChange, allowFuture = false }: { date: string; onChange: (d: string) => void; allowFuture?: boolean }) {
  const isToday = date === todayKey();
  return (
    <div className="flex items-center rounded-full border border-line bg-card shadow-card shrink-0">
      <button aria-label="Previous day" className="h-11 w-10 flex items-center justify-center" onClick={() => onChange(shiftKey(date, -1))}>
        <ChevronLeft size={22} strokeWidth={2.4} />
      </button>
      <button className="font-bold text-[15px] px-1 min-w-[92px] h-11" onClick={() => onChange(todayKey())} aria-label="Go to today">
        {isToday ? 'Today' : prettyDate(date)}
      </button>
      <button
        aria-label="Next day"
        disabled={!allowFuture && isToday}
        className="h-11 w-10 flex items-center justify-center disabled:opacity-25"
        onClick={() => onChange(shiftKey(date, 1))}
      >
        <ChevronRight size={22} strokeWidth={2.4} />
      </button>
    </div>
  );
}

/** List row (Pocket "Subscriptions"): initials square, title + subtitle, right value. */
export function ListRow({
  title, sub, right, onClick, avatar, trailing,
}: { title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; avatar?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="card px-4 py-3.5 flex items-center gap-3.5">
      <button onClick={onClick} disabled={!onClick} className="flex items-center gap-3.5 flex-1 min-w-0 text-left">
        <div className="h-14 w-14 shrink-0 rounded-[18px] bg-soft text-primary font-bold text-[17px] flex items-center justify-center">
          {avatar ?? (typeof title === 'string' ? initials(title) : '•')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[17px] truncate">{title}</div>
          {sub && <div className="text-[14px] text-muted truncate">{sub}</div>}
        </div>
        {right && <div className="font-extrabold text-[17px] tabular shrink-0">{right}</div>}
      </button>
      {trailing}
    </div>
  );
}

export function BackHeader({ title, right }: { title: string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="grid grid-cols-[48px_1fr_48px] items-center pt-1 pb-3 -mx-2">
      <button aria-label="Back" className="btn-ghost" onClick={() => nav(-1)}>
        <ChevronLeft size={28} strokeWidth={2.4} />
      </button>
      <h1 className="text-center text-[20px] font-extrabold truncate">{title}</h1>
      <div className="flex justify-end">{right}</div>
    </div>
  );
}
