// "Baixar aplicativo" box in Meu perfil. Only in the browser (never inside the installed app).
import { useEffect, useState } from 'react';
import type { EwApi } from './EwwonApp';
import { I } from './icons';
import { canPromptInstall, installApp, isInstalledApp, isIOS, onInstallChange } from '@/lib/appMode';

export function InstallAppBox({ api }: { api: EwApi }) {
  const [, tick] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => onInstallChange(() => tick((x) => x + 1)), []);
  if (isInstalledApp()) return null;
  const ios = isIOS();
  const android = /Android/i.test(navigator.userAgent);
  const install = async () => {
    const r = await installApp();
    if (r === 'installed') api.toast('Aplicativo instalado! Abra pelo ícone ewvon.');
    else if (r === 'manual') setHelp(true);
  };
  return (
    <div className="box ewx-install">
      <div className="ewx-install-h">
        <img src="/icons/logo-192.png?v=3" alt="" />
        <div><b>Baixe o aplicativo ewvon</b><small>Notificações na hora, abre direto no login e fica conectado neste aparelho.</small></div>
      </div>
      {android ? (
        <a className="btn full" href="/downloads/ewvon.apk" download="ewvon.apk" onClick={() => setHelp(true)}><I n="upload" />Baixar aplicativo (APK)</a>
      ) : (
        <button className="btn full" onClick={() => void install()}><I n="upload" />{canPromptInstall() || !ios ? 'Baixar aplicativo' : 'Como instalar'}</button>
      )}
      {android && help ? (
        <ol className="ewx-install-steps">
          <li>Quando o download terminar, toque em <b>Abrir</b> (ou abra o arquivo em <b>Downloads</b>).</li>
          <li>Se o Android pedir, permita <b>Instalar apps desta fonte</b> e volte.</li>
          <li>Toque em <b>Instalar</b>, abra o ewvon e <b>permita as notificações</b>.</li>
        </ol>
      ) : help || (ios && !canPromptInstall()) ? (
        <ol className="ewx-install-steps">
          {ios ? <>
            <li>Toque em <b>Compartilhar</b> (o quadrado com a seta, na barra do Safari).</li>
            <li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>
          </> : <>
            <li>Toque no menu <b>⋮</b> do Chrome, no canto superior.</li>
            <li>Escolha <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>) e confirme.</li>
          </>}
        </ol>
      ) : null}
    </div>
  );
}

type NativeApi = { status(): string; fixBattery(): void; openBackgroundSettings(): void };
/** Inside the Android app: shows whether notifications and calls can arrive with the app closed, and fixes it. */
export function NativeNotifBox() {
  const n = typeof window !== 'undefined' ? ((window as unknown as { EwvonNative?: NativeApi }).EwvonNative ?? null) : null;
  const [st, setSt] = useState<{ registered: boolean; battery: boolean; lastOkSecondsAgo: number; fullScreen: boolean } | null>(null);
  useEffect(() => {
    if (!n || !n.status) return;
    const read = () => { try { setSt(JSON.parse(n.status())); } catch { /* ignore */ } };
    read(); const t = window.setInterval(read, 3000);
    return () => window.clearInterval(t);
  }, [n]);
  if (!n || !st) return null;
  const ok = st.registered && st.battery && st.lastOkSecondsAgo >= 0 && st.lastOkSecondsAgo < 90;
  return (
    <div className="box ewx-install">
      <div className="ewx-install-h"><div>
        <b>{ok ? 'Notificações e ligações com o app fechado: ativas' : 'Notificações com o app fechado: precisa de ajuste'}</b>
        <small>{!st.registered ? 'Entre na sua conta para registrar este aparelho.' : !st.battery ? 'O Android pode pausar o app quando o celular dorme. Libere o uso em segundo plano.' : st.lastOkSecondsAgo < 0 || st.lastOkSecondsAgo >= 90 ? 'Conectando ao servidor…' : st.fullScreen ? 'Tudo certo: mensagens e ligações chegam mesmo com o app fechado.' : 'Ative a tela cheia de ligações nas configurações do aplicativo.'}</small>
      </div></div>
      {!st.battery ? <button className="btn full" onClick={() => n.fixBattery()}>Liberar uso em segundo plano</button> : null}
      <button className="btn full" style={{ marginTop: 8 }} onClick={() => n.openBackgroundSettings()}>Ajustes de início automático do aparelho</button>
    </div>
  );
}
