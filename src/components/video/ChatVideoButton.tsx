// Voice and video call buttons for chat headers (PC), WhatsApp style. Only for plans with video calls.
import { Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { planHasFeature } from '@/lib/planAccess';
import { startChatCall } from './VideoCallHost';

export function ChatVideoButton({ conv, target }: { conv: 'dm' | 'group' | 'sector'; target?: string | null }) {
  const { plan } = useCompanyPlan();
  if (!target || !plan || !planHasFeature(plan, 'video_calls')) return null;
  return (
    <>
      <Button variant="ghost" size="icon" title="Chamada de voz" aria-label="Chamada de voz" onClick={() => startChatCall(conv, target, true)}><Phone className="h-5 w-5" /></Button>
      <Button variant="ghost" size="icon" title="Chamada de vídeo" aria-label="Chamada de vídeo" onClick={() => startChatCall(conv, target)}><Video className="h-5 w-5" /></Button>
    </>
  );
}
