import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Shield, 
  Building2, 
  KeyRound, 
  Plus,
  Search,
  Edit,
  Trash2,
  Check,
  X,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserRegistrationDialog } from '@/components/management/UserRegistrationDialog';

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
  const { isAdmin } = useAuth();
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

  if (!isAdmin) {
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
          <TabsList className="grid w-full max-w-md grid-cols-3">
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
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Switch
                                  checked={user.is_active}
                                  onCheckedChange={(checked) => updateUserStatus(user.user_id, checked)}
                                />
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
  const [loading, setLoading] = useState(false);

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

      toast.success('Usuário atualizado com sucesso');
      onSuccess();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
            <Label>Setor</Label>
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
