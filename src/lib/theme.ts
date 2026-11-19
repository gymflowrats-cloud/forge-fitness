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
