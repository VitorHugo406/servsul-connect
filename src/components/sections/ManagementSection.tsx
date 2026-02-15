import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Shield, 
  KeyRound, 
  Plus,
  Search,
  Edit,
  MoreVertical,
  Power,
  Trash2,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserRegistrationDialog } from '@/components/management/UserRegistrationDialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  registration_number: string | null;
  profile_type: string;
  is_active: boolean;
  sector_id: string | null;
  birth_date: string | null;
  autonomy_level: string;
  created_at: string;
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

interface UserPermission {
  id: string;
  user_id: string;
  can_post_announcements: boolean;
  can_delete_messages: boolean;
  can_access_management: boolean;
  can_access_password_change: boolean;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'gerente' | 'supervisor' | 'colaborador';
}

export function ManagementSection() {
  const { isAdmin, canAccess, profile } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [permissions, setPermissions] = useState<Record<string, UserPermission>>({});
  const [roles, setRoles] = useState<Record<string, UserRole>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<Profile | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordUser, setPasswordUser] = useState<Profile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<Profile | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch sectors
      const { data: sectorsData, error: sectorsError } = await supabase
        .from('sectors')
        .select('*')
        .order('name');

      if (sectorsError) throw sectorsError;
      setSectors(sectorsData || []);

      // Fetch all permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('*');

      if (!permissionsError && permissionsData) {
        const permMap: Record<string, UserPermission> = {};
        permissionsData.forEach((p) => {
          permMap[p.user_id] = p;
        });
        setPermissions(permMap);
      }

      // Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (!rolesError && rolesData) {
        const roleMap: Record<string, UserRole> = {};
        rolesData.forEach((r) => {
          roleMap[r.user_id] = r as UserRole;
        });
        setRoles(roleMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('user_id', userId);

      if (error) throw error;
      
      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, is_active: isActive } : u
      ));
      toast.success(`Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Erro ao atualizar status do usuário');
    }
  };

  const updatePermission = async (
    userId: string, 
    permission: keyof Omit<UserPermission, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    value: boolean
  ) => {
    // Optimistically update the UI
    const previousPermissions = { ...permissions };
    setPermissions({
      ...permissions,
      [userId]: {
        ...permissions[userId],
        user_id: userId,
        [permission]: value,
      } as UserPermission,
    });

    try {
      // Map frontend permission names to backend format
      const permissionMap: Record<string, string> = {
        can_post_announcements: 'canPostAnnouncements',
        can_delete_messages: 'canDeleteMessages',
        can_access_management: 'canAccessManagement',
        can_access_password_change: 'canAccessPasswordChange',
      };

      // Build the full permissions object
      const currentPerm = permissions[userId] as Partial<UserPermission> || {};
      const updatedPermissions = {
        canPostAnnouncements: permission === 'can_post_announcements' ? value : (currentPerm.can_post_announcements ?? false),
        canDeleteMessages: permission === 'can_delete_messages' ? value : (currentPerm.can_delete_messages ?? false),
        canAccessManagement: permission === 'can_access_management' ? value : (currentPerm.can_access_management ?? false),
        canAccessPasswordChange: permission === 'can_access_password_change' ? value : (currentPerm.can_access_password_change ?? false),
      };

      // Call the edge function to update permissions
      const response = await supabase.functions.invoke('update-user-permissions', {
        body: {
          userId,
          permissions: updatedPermissions,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      toast.success('Permissão salva com sucesso');
    } catch (error) {
      console.error('Error updating permission:', error);
      // Rollback on error
      setPermissions(previousPermissions);
      toast.error('Erro ao atualizar permissão');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSectorName = (sectorId: string | null) => {
    if (!sectorId) return 'Não definido';
    const sector = sectors.find(s => s.id === sectorId);
    return sector?.name || 'Não encontrado';
  };

  const getSectorColor = (sectorId: string | null) => {
    if (!sectorId) return '#6b7280';
    const sector = sectors.find(s => s.id === sectorId);
    return sector?.color || '#6b7280';
  };

  const getRoleBadge = (userId: string) => {
    const role = roles[userId]?.role || 'colaborador';
    const labels: Record<string, string> = {
      admin: 'Administrador',
      gerente: 'Gerente',
      supervisor: 'Supervisor',
      colaborador: 'Colaborador',
    };
    const colors: Record<string, string> = {
      admin: 'bg-red-500/10 text-red-500',
      gerente: 'bg-blue-500/10 text-blue-500',
      supervisor: 'bg-yellow-500/10 text-yellow-500',
      colaborador: 'bg-gray-500/10 text-gray-500',
    };
    return (
      <Badge className={colors[role]}>
        {labels[role]}
      </Badge>
    );
  };

  const hasManagementAccess = isAdmin 
    || profile?.autonomy_level === 'diretoria'
    || canAccess('can_access_management');

  if (!hasManagementAccess) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Acesso Restrito</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Você não tem permissão para acessar esta área.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleOpenPermissions = (user: Profile) => {
    setPermissionsUser(user);
    setShowPermissionsDialog(true);
  };




  const handleChangePassword = (user: Profile) => {
    setPasswordUser(user);
    setShowPasswordDialog(true);
  };

  const handleDeleteUser = (user: Profile) => {
    if (user.email === 'adminservchat@servsul.com.br') {
      toast.error('Não é possível excluir o administrador principal');
      return;
    }
    setDeleteTargetUser(user);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    try {
      const response = await supabase.functions.invoke('delete-data', {
        body: { type: 'delete-single-user', userId: deleteTargetUser.user_id },
      });
      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }
      toast.success(`Usuário ${deleteTargetUser.name} excluído com sucesso`);
      setShowDeleteConfirm(false);
      setDeleteTargetUser(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário: ' + (error.message || 'Erro desconhecido'));
    }
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="h-full overflow-auto p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Mobile Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">Usuários</h1>
              <p className="text-sm text-muted-foreground">{filteredUsers.length} usuários</p>
            </div>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Mobile User Cards */}
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-3 pr-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="mb-2 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const sector = sectors.find(s => s.id === user.sector_id);
                  const role = roles[user.user_id]?.role || 'colaborador';
                  const roleLabels: Record<string, string> = {
                    admin: 'Admin',
                    gerente: 'Gerente',
                    supervisor: 'Supervisor',
                    colaborador: 'Colaborador',
                  };

                  return (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border"
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-11 w-11">
                          <AvatarFallback
                            className="text-sm text-white"
                            style={{ backgroundColor: sector?.color || 'hsl(var(--primary))' }}
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
                          <span className="font-medium text-foreground truncate text-sm">{user.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                            {roleLabels[role]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {sector?.name || 'Sem setor'}
                        </p>
                      </div>

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={() => {
                              setEditingUser(user);
                              setShowEditDialog(true);
                            }} 
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Editar usuário
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenPermissions(user)} className="gap-2">
                            <Shield className="h-4 w-4" />
                            Permissões
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleChangePassword(user)}
                            className="gap-2"
                          >
                            <KeyRound className="h-4 w-4" />
                            Alterar Senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => updateUserStatus(user.user_id, !user.is_active)}
                            className={`gap-2 ${user.is_active ? 'text-destructive' : 'text-green-600'}`}
                          >
                            <Power className="h-4 w-4" />
                            {user.is_active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteUser(user)}
                            className="gap-2 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir Usuário
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Mobile Dialogs */}
          <UserRegistrationDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            sectors={sectors}
            onSuccess={() => {
              fetchData();
              setShowCreateDialog(false);
            }}
          />

          {editingUser && (
            <EditUserDialog
              open={showEditDialog}
              onOpenChange={setShowEditDialog}
              user={editingUser}
              sectors={sectors}
              currentRole={roles[editingUser.user_id]?.role}
              onSuccess={() => {
                fetchData();
                setShowEditDialog(false);
                setEditingUser(null);
              }}
            />
          )}

          {/* Permissions Dialog for Mobile */}
          {permissionsUser && (
            <MobilePermissionsDialog
              open={showPermissionsDialog}
              onOpenChange={setShowPermissionsDialog}
              user={permissionsUser}
              permissions={permissions[permissionsUser.user_id]}
              isUserAdmin={roles[permissionsUser.user_id]?.role === 'admin'}
              onUpdatePermission={updatePermission}
            />
          )}

          {/* Password Change Dialog */}
          {passwordUser && (
            <ChangePasswordDialog
              open={showPasswordDialog}
              onOpenChange={setShowPasswordDialog}
              user={passwordUser}
            />
          )}

          {/* Delete Confirm Dialog */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir permanentemente o usuário <strong>{deleteTargetUser?.name}</strong>? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={confirmDeleteUser}>Excluir</Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="h-full overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Gerenciamento
            </h1>
            <p className="text-muted-foreground">
              Controle de usuários, permissões e configurações do sistema
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Senhas
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Config
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Usuários do Sistema</CardTitle>
                    <CardDescription>
                      Gerencie todos os usuários cadastrados
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuários..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64 pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="flex items-center justify-center gap-2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              Carregando...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="h-3 w-3 rounded-full" 
                                  style={{ backgroundColor: getSectorColor(user.sector_id) }}
                                />
                                {getSectorName(user.sector_id)}
                              </div>
                            </TableCell>
                            <TableCell>{getRoleBadge(user.user_id)}</TableCell>
                            <TableCell>
                              <Badge variant={user.is_active ? 'default' : 'secondary'}>
                                {user.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setShowEditDialog(true);
                                  }}
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleChangePassword(user)}
                                  title="Alterar senha"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                                <Switch
                                  checked={user.is_active}
                                  onCheckedChange={(checked) => updateUserStatus(user.user_id, checked)}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUser(user)}
                                  title="Excluir usuário"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Permissões de Usuários</CardTitle>
                <CardDescription>
                  Configure as permissões individuais de cada usuário
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="text-center">Postar Avisos</TableHead>
                        <TableHead className="text-center">Excluir Mensagens</TableHead>
                        <TableHead className="text-center">Gerenciamento</TableHead>
                        <TableHead className="text-center">Alterar Senhas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => {
                        const userPerm: Partial<UserPermission> = permissions[user.user_id] || {};
                        const isUserAdmin = roles[user.user_id]?.role === 'admin';
                        
                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={isUserAdmin || userPerm.can_post_announcements || false}
                                disabled={isUserAdmin}
                                onCheckedChange={(checked) => 
                                  updatePermission(user.user_id, 'can_post_announcements', checked)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={isUserAdmin || userPerm.can_delete_messages || false}
                                disabled={isUserAdmin}
                                onCheckedChange={(checked) => 
                                  updatePermission(user.user_id, 'can_delete_messages', checked)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={isUserAdmin || userPerm.can_access_management || false}
                                disabled={isUserAdmin}
                                onCheckedChange={(checked) => 
                                  updatePermission(user.user_id, 'can_access_management', checked)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={isUserAdmin || userPerm.can_access_password_change || false}
                                disabled={isUserAdmin}
                                onCheckedChange={(checked) => 
                                  updatePermission(user.user_id, 'can_access_password_change', checked)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <PasswordSettingsCard />
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <FileUploadSettingsCard />
          </TabsContent>
        </Tabs>

        {/* Create User Dialog */}
        <UserRegistrationDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          sectors={sectors}
          onSuccess={() => {
            fetchData();
            setShowCreateDialog(false);
          }}
        />

        {/* Edit User Dialog */}
        {editingUser && (
          <EditUserDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            user={editingUser}
            sectors={sectors}
            currentRole={roles[editingUser.user_id]?.role}
            onSuccess={() => {
              fetchData();
              setShowEditDialog(false);
              setEditingUser(null);
            }}
          />
        )}

          {/* Password Change Dialog */}
          {passwordUser && (
            <ChangePasswordDialog
              open={showPasswordDialog}
              onOpenChange={setShowPasswordDialog}
              user={passwordUser}
            />
          )}

          {/* Delete Confirm Dialog */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir permanentemente o usuário <strong>{deleteTargetUser?.name}</strong>? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={confirmDeleteUser}>Excluir</Button>
              </div>
            </DialogContent>
          </Dialog>
      </motion.div>
    </div>
  );
}

function PasswordSettingsCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCurrentPassword();
  }, []);

  const fetchCurrentPassword = async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'registration_password')
      .single();
    
    if (data) {
      setCurrentPassword(data.value);
    }
  };

  const updatePassword = async () => {
    if (!newPassword.trim()) {
      toast.error('Digite uma nova senha');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: newPassword })
        .eq('key', 'registration_password');

      if (error) throw error;

      setCurrentPassword(newPassword);
      setNewPassword('');
      toast.success('Senha de cadastro atualizada com sucesso');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Senha de Autorização de Cadastro</CardTitle>
        <CardDescription>
          Configure a senha necessária para criar novos usuários no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Senha atual</Label>
          <Input
            type="text"
            value={currentPassword}
            readOnly
            className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label>Nova senha</Label>
          <Input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Digite a nova senha de cadastro"
          />
        </div>
        <Button onClick={updatePassword} disabled={loading}>
          {loading ? 'Salvando...' : 'Atualizar Senha'}
        </Button>
      </CardContent>
    </Card>
  );
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile;
  sectors: Sector[];
  currentRole?: string;
  onSuccess: () => void;
}

function EditUserDialog({ open, onOpenChange, user, sectors, currentRole, onSuccess }: EditUserDialogProps) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [company, setCompany] = useState(user.company || '');
  const [registrationNumber, setRegistrationNumber] = useState(user.registration_number || '');
  const [sectorId, setSectorId] = useState(user.sector_id || '');
  const [role, setRole] = useState(currentRole || 'colaborador');
  const [additionalSectorIds, setAdditionalSectorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAdditional, setLoadingAdditional] = useState(true);

  // Fetch additional sectors when dialog opens
  useEffect(() => {
    if (open && user.user_id) {
      fetchAdditionalSectors();
    }
  }, [open, user.user_id]);

  const fetchAdditionalSectors = async () => {
    setLoadingAdditional(true);
    const { data, error } = await supabase
      .from('user_additional_sectors')
      .select('sector_id')
      .eq('user_id', user.user_id);

    if (!error && data) {
      setAdditionalSectorIds(data.map(s => s.sector_id));
    }
    setLoadingAdditional(false);
  };

  const toggleAdditionalSector = (sectorId: string) => {
    setAdditionalSectorIds(prev => 
      prev.includes(sectorId)
        ? prev.filter(id => id !== sectorId)
        : [...prev, sectorId]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name,
          phone: phone || null,
          company: company || null,
          registration_number: registrationNumber || null,
          sector_id: sectorId || null,
        })
        .eq('user_id', user.user_id);

      if (profileError) throw profileError;

      // Update autonomy_level on profile to match role
      const autonomyMap: Record<string, string> = {
        admin: 'admin',
        gerente: 'gerente',
        supervisor: 'supervisor',
        colaborador: 'colaborador',
        gestor: 'gestor',
        diretoria: 'diretoria',
      };
      const { error: autonomyError } = await supabase
        .from('profiles')
        .update({ autonomy_level: autonomyMap[role] || 'colaborador' })
        .eq('user_id', user.user_id);
      if (autonomyError) console.error('Error updating autonomy_level:', autonomyError);

      // Update role if changed
      if (role !== currentRole) {
        // Delete existing role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.user_id);

        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: user.user_id,
            role: role as 'admin' | 'gerente' | 'supervisor' | 'colaborador',
          });

        if (roleError) throw roleError;
      }

      // Update additional sectors
      // First delete all existing
      await supabase
        .from('user_additional_sectors')
        .delete()
        .eq('user_id', user.user_id);

      // Then insert new ones
      if (additionalSectorIds.length > 0) {
        const { error: sectorsError } = await supabase
          .from('user_additional_sectors')
          .insert(
            additionalSectorIds.map(sectorId => ({
              user_id: user.user_id,
              sector_id: sectorId,
            }))
          );

        if (sectorsError) throw sectorsError;
      }

      toast.success('Usuário atualizado com sucesso');
      onSuccess();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setLoading(false);
    }
  };

  // Filter out Geral sector and the user's primary sector from additional sectors options
  const availableAdditionalSectors = sectors.filter(
    s => s.id !== '00000000-0000-0000-0000-000000000001' && s.id !== sectorId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize as informações do usuário
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Setor Principal</Label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {sectors.filter(s => s.id !== '00000000-0000-0000-0000-000000000001').map((sector) => (
                  <SelectItem key={sector.id} value={sector.id}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Sectors */}
          <div className="space-y-2">
            <Label>Setores Adicionais</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Selecione os setores extras que este usuário terá acesso
            </p>
            {loadingAdditional ? (
              <div className="flex items-center gap-2 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Carregando...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md">
                {availableAdditionalSectors.map((sector) => (
                  <label
                    key={sector.id}
                    className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={additionalSectorIds.includes(sector.id)}
                      onChange={() => toggleAdditionalSector(sector.id)}
                      className="rounded border-gray-300"
                    />
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: sector.color }}
                    />
                    <span className="text-sm">{sector.name}</span>
                  </label>
                ))}
                {availableAdditionalSectors.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-2">
                    Selecione um setor principal primeiro
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo de Perfil</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Mobile Permissions Dialog
interface MobilePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile;
  permissions?: UserPermission;
  isUserAdmin: boolean;
  onUpdatePermission: (userId: string, permission: keyof Omit<UserPermission, 'id' | 'user_id' | 'created_at' | 'updated_at'>, value: boolean) => void;
}

function MobilePermissionsDialog({ open, onOpenChange, user, permissions, isUserAdmin, onUpdatePermission }: MobilePermissionsDialogProps) {
  const userPerm = permissions || {} as Partial<UserPermission>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Permissões</DialogTitle>
          <DialogDescription>{user.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label>Postar Avisos</Label>
            <Switch
              checked={isUserAdmin || userPerm.can_post_announcements || false}
              disabled={isUserAdmin}
              onCheckedChange={(checked) => onUpdatePermission(user.user_id, 'can_post_announcements', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Excluir Mensagens</Label>
            <Switch
              checked={isUserAdmin || userPerm.can_delete_messages || false}
              disabled={isUserAdmin}
              onCheckedChange={(checked) => onUpdatePermission(user.user_id, 'can_delete_messages', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Gerenciamento</Label>
            <Switch
              checked={isUserAdmin || userPerm.can_access_management || false}
              disabled={isUserAdmin}
              onCheckedChange={(checked) => onUpdatePermission(user.user_id, 'can_access_management', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Alterar Senhas</Label>
            <Switch
              checked={isUserAdmin || userPerm.can_access_password_change || false}
              disabled={isUserAdmin}
              onCheckedChange={(checked) => onUpdatePermission(user.user_id, 'can_access_password_change', checked)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Change Password Dialog
interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile;
}

function ChangePasswordDialog({ open, onOpenChange, user }: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const response = await supabase.functions.invoke('delete-data', {
        body: { type: 'change-password', userId: user.user_id, newPassword },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }

      toast.success(`Senha de ${user.name} alterada com sucesso`);
      setNewPassword('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error('Erro ao alterar senha: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar Senha</DialogTitle>
          <DialogDescription>
            Definir nova senha para <strong>{user.name}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
