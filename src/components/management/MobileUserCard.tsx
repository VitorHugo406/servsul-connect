import { MoreVertical, Edit, Power, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  sector_id: string | null;
  autonomy_level: string;
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

interface MobileUserCardProps {
  user: Profile;
  sector: Sector | undefined;
  role: string;
  onEdit: () => void;
  onToggleStatus: () => void;
  onManagePermissions: () => void;
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  colaborador: 'Colaborador',
};

const roleColors: Record<string, string> = {
  admin: 'bg-destructive/10 text-destructive',
  gerente: 'bg-primary/10 text-primary',
  supervisor: 'bg-warning/10 text-warning',
  colaborador: 'bg-muted text-muted-foreground',
};

export function MobileUserCard({
  user,
  sector,
  role,
  onEdit,
  onToggleStatus,
  onManagePermissions,
}: MobileUserCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarFallback
            className="text-sm text-white"
            style={{ backgroundColor: sector?.color || '#6366f1' }}
          >
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
            user.is_active ? 'bg-green-500' : 'bg-muted-foreground'
          }`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{user.name}</span>
          <Badge className={`${roleColors[role]} text-[10px] px-1.5 py-0`}>
            {roleLabels[role]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{sector?.name || 'Sem setor'}</p>
      </div>

      {/* Actions Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit} className="gap-2">
            <Edit className="h-4 w-4" />
            Editar usuário
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onManagePermissions} className="gap-2">
            <Shield className="h-4 w-4" />
            Permissões
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={onToggleStatus}
            className={`gap-2 ${user.is_active ? 'text-destructive' : 'text-green-600'}`}
          >
            <Power className="h-4 w-4" />
            {user.is_active ? 'Desativar' : 'Ativar'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
