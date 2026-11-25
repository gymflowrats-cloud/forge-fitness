// "Install app" support. Android Chrome/Edge fire `beforeinstallprompt`, which we keep so a button can show
// the native install dialog. iPhone has no such API: users add it from Safari's Share menu.
import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useInstall = create<{ prompt: BeforeInstallPromptEvent | null; installed: boolean }>(() => ({ prompt: null, installed: false }));

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ prompt: null, installed: true }));
}

export async function promptInstall(): Promise<boolean> {
  const p = useInstall.getState().prompt;
  if (!p) return false;
  await p.prompt();
  const { outcome } = await p.userChoice;
  useInstall.setState({ prompt: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

export function platform(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'other';
}
