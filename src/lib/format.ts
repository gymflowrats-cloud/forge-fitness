export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtNum = (n: number | null | undefined, dp = 1) => {
  if (n == null || Number.isNaN(n)) return '–';
  const r = Math.round(n * 10 ** dp) / 10 ** dp;
  return r.toLocaleString('en-US', { maximumFractionDigits: dp });
};
export const fmtSigned = (n: number, dp = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtNum(Math.abs(n), dp);
export const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}%`;

export function fmtDuration(sec: number) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function fmtMinutes(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
export const initials = (s: string) =>
  s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
