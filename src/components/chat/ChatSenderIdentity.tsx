import { CosmicBlob } from '@/components/common/CosmicBlob';
import { isSystemAvatar, isSystemSender } from '@/lib/systemSender';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function ChatSenderAvatar({ name, avatarUrl, id }: { name: string; avatarUrl?: string | null; id?: string | null }) {
  if (isSystemSender(id) || isSystemAvatar(avatarUrl)) return <CosmicBlob size={36} className="shrink-0" />;
  return <Avatar className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"><AvatarImage src={avatarUrl || ''} alt={name} /><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback></Avatar>;
}

export function ChatSenderLabel({ name, department }: { name: string; department?: string | null }) {
  return <div className="mb-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5"><span className="break-words text-xs font-semibold">{name}</span>{department && <span className="break-words text-[10px] opacity-75">{department}</span>}</div>;
}