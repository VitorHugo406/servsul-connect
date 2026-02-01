import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

export function InstallPrompt() {
  const { canInstall, promptInstall } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show prompt after a delay if can install and not dismissed
    if (canInstall && !dismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, dismissed]);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    // Remember dismissal for this session
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  useEffect(() => {
    // Check if already dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) {
      setDismissed(true);
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 md:left-auto md:right-6 md:bottom-6 md:w-96">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">Instalar ServChat</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione o app à tela inicial para acesso rápido e notificações
            </p>
            
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleInstall}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Instalar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
              >
                Agora não
              </Button>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
