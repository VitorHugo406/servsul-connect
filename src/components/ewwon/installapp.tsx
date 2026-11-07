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
      <button className="btn full" onClick={() => void install()}><I n="upload" />{canPromptInstall() || !ios ? 'Baixar aplicativo' : 'Como instalar'}</button>
      {help || (ios && !canPromptInstall()) ? (
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
