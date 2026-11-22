export type ThemePref = 'system' | 'light' | 'dark';

let mq: MediaQueryList | null = null;
let current: ThemePref = 'system';

function apply() {
  const dark = current === 'dark' || (current === 'system' && !!mq?.matches);
  document.documentElement.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  meta?.setAttribute('content', dark ? 'black-translucent' : 'default');
}

export function setTheme(pref: ThemePref) {
  current = pref;
  if (!mq && typeof window !== 'undefined') {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
  }
  apply();
}

export type Palette = 'forest' | 'amber' | 'terracotta' | 'ocean' | 'plum';

export const PALETTES: { key: Palette; label: string; sub: string; swatch: [string, string, string] }[] = [
  { key: 'amber', label: 'Forest + amber', sub: 'Calm green, warm amber actions', swatch: ['#2F4535', '#E0A040', '#F4F1EA'] },
  { key: 'forest', label: 'Forest', sub: 'The original all-green look', swatch: ['#36493B', '#36493B', '#F5F4F0'] },
  { key: 'terracotta', label: 'Terracotta', sub: 'Warm clay, earthy and energetic', swatch: ['#A84B2A', '#C0582F', '#F6EFE6'] },
  { key: 'ocean', label: 'Deep ocean', sub: 'Petrol blue with coral', swatch: ['#1F4E5F', '#E07A5F', '#EEF3F2'] },
  { key: 'plum', label: 'Plum + peach', sub: 'Rich and premium', swatch: ['#4E3552', '#E8955A', '#F7F1EE'] },
];

/** Apply palette + style flags to <html>. */
export function setLook({ palette, sporty, texture }: { palette: Palette; sporty: boolean; texture: boolean }) {
  const el = document.documentElement;
  if (palette === 'forest') el.removeAttribute('data-palette');
  else el.setAttribute('data-palette', palette);
  el.classList.toggle('sporty', sporty);
  el.classList.toggle('flat-hero', !texture);
  try {
    localStorage.setItem('forge.look', JSON.stringify({ palette, sporty, texture }));
  } catch {
    /* private mode */
  }
}

/** Re-apply the last look before React renders, so there's no colour flash on launch. */
export function restoreLook() {
  try {
    const raw = localStorage.getItem('forge.look');
    setLook(raw ? JSON.parse(raw) : { palette: 'amber', sporty: true, texture: true });
  } catch {
    /* ignore */
  }
}
