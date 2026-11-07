// First access in the installed app: notifications must be allowed (and the
// microphone, used for voice messages, is requested). Shown again on every launch
// while notifications are not allowed. Never shown in the normal browser.
import { useCallback, useEffect, useState } from 'react';
import { I } from './icons';
import * as N from './notify';
import { isInstalledApp } from '@/lib/appMode';

type St = 'granted' | 'denied' | 'prompt' | 'unsupported';

const notifState = (): St => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission === 'default' ? 'prompt' : (Notification.permission as St));
async function notifStateLive(): Promise<St> {
  const base = notifState();
  if (base === 'granted' || base === 'unsupported') return base;
  try { const q = await navigator.permissions?.query({ name: 'notifications' as PermissionName }); if (q?.state === 'granted') return 'granted'; } catch { /* ignore */ }
  return base;
}
async function micState(): Promise<St> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const p = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    return p ? (p.state as St) : 'prompt';
  } catch { return 'prompt'; }
}

export function PermissionGate({ onDone }: { onDone: () => void }) {
  const [notif, setNotif] = useState<St>(notifState());
  const [mic, setMic] = useState<St>('prompt');
  const [busy, setBusy] = useState(false);
  const recheck = useCallback(async () => { setNotif(await notifStateLive()); setMic(await micState()); }, []);
  useEffect(() => {
    void recheck();
    const f = () => { if (!document.hidden) void recheck(); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [recheck]);
  useEffect(() => { if (notif === 'granted' && mic !== 'prompt') { void N.subscribeWebPush(); } }, [notif, mic]);

  const askNotif = async () => { setBusy(true); try { await N.ensurePermission(); } finally { setBusy(false); void recheck(); } };
  const askMic = async () => {
    setBusy(true);
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); } catch { /* denied */ }
    finally { setBusy(false); void recheck(); }
  };
  const ok = notif === 'granted' || notif === 'unsupported';
  const Row = ({ icon, t, d, st, onAsk }: { icon: string; t: string; d: string; st: St; onAsk: () => void }) => (
    <div className={'ewx-pg-row ' + st}>
      <span className="ewx-pg-ic"><I n={icon} /></span>
      <span className="ewx-pg-tx"><b>{t}</b><small>{st === 'denied' ? 'Bloqueado. Libere nas configurações do aparelho (veja abaixo).' : d}</small></span>
      {st === 'granted' ? <span className="ewx-pg-ok"><I n="check" /></span> : st === 'unsupported' ? <small className="ewx-pg-na">Indisponível</small> : <button className="btn sm" disabled={busy || st === 'denied'} onClick={onAsk}>Permitir</button>}
    </div>
  );
  return (
    <div className="ewx-pg" role="dialog" aria-label="Permissões do aplicativo">
      <img src="/icons/logo-192.png?v=3" alt="" className="ewx-pg-logo" />
      <h2>Antes de começar</h2>
      <p>Para não perder nenhuma mensagem ou aviso, o ewvon precisa destas permissões.</p>
      <div className="ewx-pg-list">
        <Row icon="bell" t="Notificações" d="Mensagens, avisos e lembretes mesmo com o app fechado. Obrigatório." st={notif} onAsk={() => void askNotif()} />
        <Row icon="mic" t="Microfone" d="Para gravar e enviar mensagens de áudio." st={mic} onAsk={() => void askMic()} />
      </div>
      {notif === 'denied' || mic === 'denied' ? (
        <div className="ewx-pg-help"><b>Como liberar:</b> Configurações do celular → Apps → ewvon → Permissões / Notificações → permita e volte para o app.
          <button className="btn sm sec" onClick={() => void recheck()}>Já liberei, verificar</button></div>
      ) : null}
      <button className="btn full" disabled={!ok} onClick={onDone}>{ok ? 'Continuar' : 'Ative as notificações para continuar'}</button>
    </div>
  );
}

/** True when the installed app still needs the first-access permissions. */
export function needsPermissionGate() {
  return isInstalledApp() && typeof Notification !== 'undefined' && Notification.permission !== 'granted';
}
