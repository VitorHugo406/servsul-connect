// Inside the Android app: when a newer APK is published (public/downloads/version.json), asks to update as soon as the app opens.
import { useEffect, useState } from 'react';

const installed = () => /EwvonApp\/(\d+(?:\.\d+)*)/.exec(typeof navigator !== 'undefined' ? navigator.userAgent : '')?.[1] ?? null;
const cmp = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 4; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };

export function UpdatePrompt() {
  const [info, setInfo] = useState<{ version: string; notes?: string; required?: boolean } | null>(null);
  useEffect(() => {
    const cur = installed(); if (!cur) return;
    let alive = true;
    fetch(`/downloads/version.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!alive || !j?.version || cmp(j.version, cur) <= 0) return;
      try { const until = Number(localStorage.getItem('ewvon:update-later:' + j.version) || 0); if (!j.required && until > Date.now()) return; } catch { /* ignore */ }
      setInfo(j);
    }).catch(() => { /* offline: no prompt */ });
    return () => { alive = false; };
  }, []);
  if (!info) return null;
  const later = () => { try { localStorage.setItem('ewvon:update-later:' + info.version, String(Date.now() + 12 * 3600_000)); } catch { /* ignore */ } setInfo(null); };
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Atualização disponível">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 text-card-foreground shadow-2xl">
        <h2 className="text-lg font-semibold">Nova versão do ewvon</h2>
        <p className="mt-1 text-sm text-muted-foreground">Versão {info.version} disponível. {info.notes || 'Atualize para receber as novidades e correções.'}</p>
        <a href="/downloads/ewvon.apk" download="ewvon.apk" onClick={() => { if (!info.required) later(); }} className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">Atualizar agora</a>
        <p className="mt-2 text-xs text-muted-foreground">Ao terminar o download, toque em Abrir e depois em Instalar.</p>
        {!info.required ? <button type="button" onClick={later} className="mt-2 h-10 w-full rounded-lg text-sm text-muted-foreground">Agora não</button> : null}
      </div>
    </div>
  );
}
