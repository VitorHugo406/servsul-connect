// "Videochamada" button for chat headers (PC). Only shown when the company's plan includes video calls.
import { Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { planHasFeature } from '@/lib/planAccess';
import { appConfirm } from '@/lib/appDialog';
import { startChatCall } from './VideoCallHost';

export function ChatVideoButton({ conv, target, className }: { conv: 'dm' | 'group' | 'sector'; target?: string | null; className?: string }) {
  const { plan } = useCompanyPlan();
  if (!target || !plan || !planHasFeature(plan, 'video_calls')) return null;
  const start = async () => {
    if (!(await appConfirm({ title: 'Iniciar chamada de vídeo?', message: 'Todos desta conversa recebem um aviso no chat para entrar.', confirmText: 'Iniciar chamada' }))) return;
    startChatCall(conv, target);
  };
  return <Button variant="ghost" size="icon" title="Chamada de vídeo" aria-label="Chamada de vídeo" className={className} onClick={() => void start()}><Video className="h-5 w-5" /></Button>;
}
