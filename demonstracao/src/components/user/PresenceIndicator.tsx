import { cn } from '@/lib/utils';

interface PresenceIndicatorProps {
  isOnline: boolean;
  lastHeartbeat?: Date | null;
  className?: string;
}

const INACTIVE_THRESHOLD = 120000; // 2 minutes without heartbeat = inactive

/**
 * 🟢 Green = Online (active heartbeat)
 * 🔴 Red = Inactive (online but no recent heartbeat)  
 * ⚫ Gray = Offline
 */
export function PresenceIndicator({ isOnline, lastHeartbeat, className }: PresenceIndicatorProps) {
  let color = 'bg-gray-400'; // offline
  let title = 'Offline';

  if (isOnline && lastHeartbeat) {
    const timeSinceHeartbeat = Date.now() - lastHeartbeat.getTime();
    if (timeSinceHeartbeat < INACTIVE_THRESHOLD) {
      color = 'bg-green-500';
      title = 'Online';
    } else {
      color = 'bg-red-500';
      title = 'Inativo';
    }
  } else if (isOnline) {
    color = 'bg-green-500';
    title = 'Online';
  }

  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
        color,
        className
      )}
      title={title}
    />
  );
}
