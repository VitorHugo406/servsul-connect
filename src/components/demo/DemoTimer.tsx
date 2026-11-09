import { useEffect, useState } from 'react';
import { Timer, LogOut } from 'lucide-react';
import { IS_DEMO } from '@/lib/demo/bootDemo';
import { endDemoSession, formatRemaining, readDemoSession } from '@/lib/demo/demoSession';
import { appConfirm } from '@/lib/appDialog';

export function DemoTimer() {
  const [left, setLeft] = useState(() => { const s = readDemoSession(); return s ? s.expiresAt - Date.now() : 0; });
  useEffect(() => {
    if (!IS_DEMO) return;
    const id = setInterval(() => { const s = readDemoSession(); const l = s ? s.expiresAt - Date.now() : 0; setLeft(l); if (l <= 0) endDemoSession('expired'); }, 1000);
    return () => clearInterval(id);
  }, []);
  if (!IS_DEMO) return null;
  return (
    <div className="fixed top-2 left-1/2 z-[130] md:top-auto md:bottom-3 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-card/85 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-xl" role="timer" aria-label="Tempo restante do teste">
      <Timer className="h-3.5 w-3.5 text-primary" />
      <span>Modo teste</span>
      <span className="tabular-nums text-primary">{formatRemaining(left)}</span>
      <button onClick={async () => { if (await appConfirm({ title: 'Encerrar o teste?', message: 'Tudo que você criou será apagado.', confirmText: 'Encerrar', danger: true })) endDemoSession('ended'); }} className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Encerrar teste" title="Encerrar teste">
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
