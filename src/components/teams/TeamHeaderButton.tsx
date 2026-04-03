import { useState } from 'react';
import { Users, ChevronDown, Plus, Edit2, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/contexts/AuthContext';

export function TeamHeaderButton() {
  const { profile } = useAuth();
  const { userTeams, loading } = useTeams();
  const [open, setOpen] = useState(false);

  if (loading || !profile) return null;
  if (userTeams.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Minhas Equipes">
          <Users className="h-5 w-5" />
          {userTeams.length > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-primary p-0 text-xs">
              {userTeams.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Minhas Equipes</h3>
          <p className="text-xs text-muted-foreground mt-1">Equipes das quais você faz parte</p>
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="p-2 space-y-2">
            {userTeams.map(team => (
              <div key={team.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-foreground">{team.name}</h4>
                  <Badge variant="outline" className="text-[10px]">{team.members.length} membros</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {team.members.slice(0, 6).map(m => (
                    <div key={m.id} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={m.profile?.avatar_url || ''} />
                        <AvatarFallback className="text-[8px]">
                          {(m.profile?.display_name || m.profile?.name || '?')[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[80px]">{m.profile?.display_name || m.profile?.name}</span>
                    </div>
                  ))}
                  {team.members.length > 6 && (
                    <span className="text-[10px] text-muted-foreground">+{team.members.length - 6}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
