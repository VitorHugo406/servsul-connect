import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface WarRoomAlarmOverlayProps {
  isAlarming: boolean;
  pendingWarRoomId: string | null;
  onOpenWarRoom: () => void;
}

export function WarRoomAlarmOverlay({ isAlarming, pendingWarRoomId, onOpenWarRoom }: WarRoomAlarmOverlayProps) {
  if (!isAlarming || !pendingWarRoomId) return null;

  return (
    <>
      {/* Red flashing overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-[9998] animate-pulse"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(220, 38, 38, 0.12) 100%)',
          animation: 'warRoomFlash 2s ease-in-out infinite',
        }}
      />
      
      {/* Alert banner */}
      <div 
        className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 py-3 px-4 cursor-pointer"
        style={{
          background: 'linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.85))',
          color: 'hsl(var(--destructive-foreground))',
          animation: 'warRoomBannerPulse 1.5s ease-in-out infinite',
        }}
        onClick={onOpenWarRoom}
      >
        <span className="text-xl animate-bounce">🚨</span>
        <span className="font-bold text-sm md:text-base">WAR ROOM ATIVA — Clique para acessar</span>
        <span className="text-xl animate-bounce">🚨</span>
      </div>

      <style>{`
        @keyframes warRoomFlash {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes warRoomBannerPulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
