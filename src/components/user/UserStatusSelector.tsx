import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Disponível', color: 'bg-success' },
  { value: 'lunch', label: 'Almoçando', color: 'bg-yellow-500' },
  { value: 'meeting', label: 'Em reunião', color: 'bg-orange-500' },
  { value: 'away', label: 'Fora de expediente', color: 'bg-muted-foreground' },
  { value: 'vacation', label: 'De férias', color: 'bg-blue-500' },
  { value: 'leave', label: 'De afastamento', color: 'bg-red-500' },
] as const;

type StatusValue = typeof STATUS_OPTIONS[number]['value'];

interface UserStatusSelectorProps {
  currentStatus?: string;
  onStatusChange?: (status: string) => void;
  compact?: boolean;
}

export function UserStatusSelector({ 
  currentStatus = 'available', 
  onStatusChange,
  compact = false 
}: UserStatusSelectorProps) {
  const [status, setStatus] = useState<StatusValue>(currentStatus as StatusValue || 'available');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const currentOption = STATUS_OPTIONS.find(opt => opt.value === status) || STATUS_OPTIONS[0];

  const handleStatusChange = async (newStatus: StatusValue) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_status: newStatus })
        .eq('user_id', user.id);

      if (error) throw error;

      setStatus(newStatus);
      onStatusChange?.(newStatus);
      toast.success('Status atualizado');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size={compact ? 'sm' : 'default'}
          className={cn('gap-2', compact && 'h-8 px-2')}
          disabled={loading}
        >
          <span className={cn('h-2.5 w-2.5 rounded-full', currentOption.color)} />
          {!compact && <span className="text-sm">{currentOption.label}</span>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className="gap-2"
          >
            <span className={cn('h-2.5 w-2.5 rounded-full', option.color)} />
            <span className="flex-1">{option.label}</span>
            {status === option.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserStatusBadge({ status, showLabel = false }: { status?: string; showLabel?: boolean }) {
  const option = STATUS_OPTIONS.find(opt => opt.value === status) || STATUS_OPTIONS[0];
  
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', option.color)} />
      {showLabel && <span className="text-xs text-muted-foreground">{option.label}</span>}
    </div>
  );
}

export { STATUS_OPTIONS };
