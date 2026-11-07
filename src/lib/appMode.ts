// Detects whether ewvon is running as the installed app (PWA / Android app made
// from the site) or inside a normal browser tab. Note: the installed app and Chrome
// share the same localStorage on Android, so this must never be stored there.
let cached: boolean | null = null;

export function isInstalledApp(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') return false;
  const standalone = ['standalone', 'fullscreen', 'minimal-ui'].some((m) => window.matchMedia?.(`(display-mode: ${m})`).matches);
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const twa = document.referrer.startsWith('android-app://');
  const flag = new URLSearchParams(window.location.search).get('app') === '1';
  if (flag) { try { sessionStorage.setItem('ewvon:app', '1'); } catch { /* ignore */ } }
  let session = false;
  try { session = sessionStorage.getItem('ewvon:app') === '1'; } catch { /* ignore */ }
  cached = standalone || ios || twa || flag || session;
  return cached;
}

export const isMobileBrowser = () => !isInstalledApp() && typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

// ---------------------------------------------------------------- install (browser only)
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPrompt; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}
export const canPromptInstall = () => !!deferred;
export const onInstallChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Shows the browser's install dialog. Returns 'manual' when the browser needs the menu instead. */
export async function installApp(): Promise<'installed' | 'dismissed' | 'manual'> {
  if (!deferred) return 'manual';
  const d = deferred;
  await d.prompt();
  const r = await d.userChoice;
  deferred = null;
  return r.outcome === 'accepted' ? 'installed' : 'dismissed';
}
