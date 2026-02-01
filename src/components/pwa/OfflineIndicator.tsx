import { WifiOff } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export function OfflineIndicator() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium">
      <WifiOff className="w-4 h-4" />
      <span>Você está offline. Algumas funcionalidades podem não estar disponíveis.</span>
    </div>
  );
}
