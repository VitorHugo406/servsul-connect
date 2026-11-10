// The Android app (WebView) exposes window.EwvonNative. After login the site registers this phone as a device of the
// signed-in person, so the app's background service can deliver messages and ring calls without Chrome or Firebase.
import { supabase } from '@/integrations/supabase/client';

type Native = { isNative(): boolean; getDevice(): string; getDeviceProfile(): string; setDevice(secret: string, profileId: string): void; clearDevice(): void };
const native = (): Native | null => (typeof window !== 'undefined' ? ((window as unknown as { EwvonNative?: Native }).EwvonNative ?? null) : null);
export const isNativeApp = () => !!native();

export async function ensureNativeDevice(profileId: string) {
  const n = native(); if (!n) return;
  try {
    const cur = n.getDevice(), owner = n.getDeviceProfile();
    if (cur && (owner === profileId || owner === 'dev')) return;
    if (cur) { try { await (supabase as any).rpc('native_unregister', { _secret: cur }); } catch { /* ignore */ } n.clearDevice(); }   // another person's phone registration
    const { data, error } = await (supabase as any).rpc('native_register', { _label: navigator.userAgent.slice(0, 70) });
    if (!error && typeof data === 'string' && data) n.setDevice(data, profileId);
  } catch { /* retried on the next open */ }
}

export async function clearNativeDevice() {
  const n = native(); if (!n) return;
  try { const cur = n.getDevice(); if (cur) await (supabase as any).rpc('native_unregister', { _secret: cur }); } catch { /* ignore */ }
  n.clearDevice();
}
