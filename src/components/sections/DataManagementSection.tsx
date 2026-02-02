import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Trash2, 
  AlertTriangle, 
  MessageSquare, 
  Megaphone, 
  Users, 
  Database,
  Shield,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAIL = 'adminservchat@servsul.com.br';

interface DeletionOption {
  id: string;
  title: string;
  description: string;
  icon: typeof MessageSquare;
  confirmText: string;
  dangerLevel: 'medium' | 'high' | 'critical';
  action: () => Promise<void>;
}

export function DataManagementSection() {
  const { isAdmin, user } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedOption, setSelectedOption] = useState<DeletionOption | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Only allow main admin to access this section
  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="font-display text-xl font-semibold text-foreground">Acesso Restrito</h3>
        <p className="mt-2 text-muted-foreground">
          Apenas administradores podem acessar esta seção.
        </p>
      </div>
    );
  }

  const deleteAllMessages = async () => {
    // Delete sector messages
    const { error: msgError } = await supabase
      .from('messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (msgError) throw msgError;

    // Delete direct messages
    const { error: dmError } = await supabase
      .from('direct_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (dmError) throw dmError;

    // Delete private group messages
    const { error: pgmError } = await supabase
      .from('private_group_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (pgmError) throw pgmError;
  };

  const deleteAllAnnouncements = async () => {
    // Delete announcement comments first
    const { error: commentsError } = await supabase
      .from('announcement_comments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (commentsError) throw commentsError;

    // Delete announcement reads
    const { error: readsError } = await supabase
      .from('announcement_reads')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (readsError) throw readsError;

    // Delete announcements
    const { error: annError } = await supabase
      .from('announcements')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (annError) throw annError;
  };

  const deleteAllUsers = async () => {
    // First get the main admin's profile to exclude it
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (!adminProfile) {
      throw new Error('Não foi possível encontrar o perfil do administrador principal');
    }

    // Delete user-related data for non-admin users
    const { error: permError } = await supabase
      .from('user_permissions')
      .delete()
      .neq('user_id', adminProfile.user_id);

    if (permError) throw permError;

    const { error: rolesError } = await supabase
      .from('user_roles')
      .delete()
      .neq('user_id', adminProfile.user_id);

    if (rolesError) throw rolesError;

    const { error: presenceError } = await supabase
      .from('user_presence')
      .delete()
      .neq('user_id', adminProfile.user_id);

    if (presenceError) throw presenceError;

    const { error: facialError } = await supabase
      .from('user_facial_data')
      .delete()
      .neq('user_id', adminProfile.user_id);

    if (facialError) throw facialError;

    const { error: additionalSectorsError } = await supabase
      .from('user_additional_sectors')
      .delete()
      .neq('user_id', adminProfile.user_id);

    if (additionalSectorsError) throw additionalSectorsError;

    // Note: We cannot delete from profiles directly as that requires auth.users deletion
    // which needs service role. We'll mark users as inactive instead.
    const { error: profilesError } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .neq('email', ADMIN_EMAIL);

    if (profilesError) throw profilesError;

    toast.info('Usuários foram desativados. Para exclusão completa, acesse o painel administrativo.');
  };

  const deleteAllData = async () => {
    // Delete in order to respect foreign keys
    await deleteAllMessages();
    await deleteAllAnnouncements();
    
    // Delete attachments
    const { error: attachError } = await supabase
      .from('attachments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (attachError) throw attachError;

    // Delete user notifications
    const { error: notifError } = await supabase
      .from('user_notifications')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (notifError) throw notifError;

    // Delete private groups
    const { error: pgmrError } = await supabase
      .from('private_group_message_reads')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (pgmrError) throw pgmrError;

    const { error: pgmembersError } = await supabase
      .from('private_group_members')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (pgmembersError) throw pgmembersError;

    const { error: pgError } = await supabase
      .from('private_groups')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (pgError) throw pgError;

    // Delete users (excluding main admin)
    await deleteAllUsers();
  };

  const deletionOptions: DeletionOption[] = [
    {
      id: 'messages',
      title: 'Excluir Todas as Mensagens',
      description: 'Remove todas as mensagens de setores, mensagens diretas e mensagens de grupos privados.',
      icon: MessageSquare,
      confirmText: 'EXCLUIR MENSAGENS',
      dangerLevel: 'high',
      action: deleteAllMessages,
    },
    {
      id: 'announcements',
      title: 'Excluir Todos os Avisos',
      description: 'Remove todos os avisos, comentários e registros de leitura.',
      icon: Megaphone,
      confirmText: 'EXCLUIR AVISOS',
      dangerLevel: 'high',
      action: deleteAllAnnouncements,
    },
    {
      id: 'users',
      title: 'Excluir Todos os Usuários',
      description: 'Desativa todos os usuários do sistema, exceto o administrador principal.',
      icon: Users,
      confirmText: 'EXCLUIR USUARIOS',
      dangerLevel: 'critical',
      action: deleteAllUsers,
    },
    {
      id: 'all',
      title: 'Limpar Todo o Banco de Dados',
      description: 'Remove TODOS os dados do sistema, mantendo apenas o administrador principal. Esta ação é IRREVERSÍVEL!',
      icon: Database,
      confirmText: 'LIMPAR TUDO',
      dangerLevel: 'critical',
      action: deleteAllData,
    },
  ];

  const handleOptionClick = (option: DeletionOption) => {
    setSelectedOption(option);
    setConfirmInput('');
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedOption || confirmInput !== selectedOption.confirmText) return;

    setLoading(true);
    try {
      await selectedOption.action();
      toast.success(`${selectedOption.title} - Concluído com sucesso!`);
      setShowConfirmDialog(false);
    } catch (error) {
      console.error('Error during deletion:', error);
      toast.error(`Erro ao executar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const getDangerLevelColor = (level: DeletionOption['dangerLevel']) => {
    switch (level) {
      case 'medium':
        return 'border-warning/50 bg-warning/5';
      case 'high':
        return 'border-orange-500/50 bg-orange-500/5';
      case 'critical':
        return 'border-destructive/50 bg-destructive/5';
    }
  };

  const getDangerButtonColor = (level: DeletionOption['dangerLevel']) => {
    switch (level) {
      case 'medium':
        return 'bg-warning text-warning-foreground hover:bg-warning/90';
      case 'high':
        return 'bg-orange-500 text-white hover:bg-orange-600';
      case 'critical':
        return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 space-y-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <Trash2 className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Gerenciamento de Dados
          </h2>
          <p className="text-muted-foreground">
            Exclusão de informações do sistema
          </p>
        </div>
      </div>

      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Atenção!</AlertTitle>
        <AlertDescription>
          As ações nesta seção são <strong>irreversíveis</strong>. Todos os dados excluídos não poderão ser recuperados.
          O administrador principal ({ADMIN_EMAIL}) nunca será excluído.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {deletionOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Card 
              key={option.id} 
              className={`transition-all hover:shadow-lg ${getDangerLevelColor(option.dangerLevel)}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                    <Icon className="h-5 w-5 text-destructive" />
                  </div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4 min-h-[48px]">
                  {option.description}
                </CardDescription>
                <Button 
                  variant="outline"
                  className={`w-full gap-2 ${getDangerButtonColor(option.dangerLevel)}`}
                  onClick={() => handleOptionClick(option)}
                >
                  <Trash2 className="h-4 w-4" />
                  Executar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Você está prestes a <strong>{selectedOption?.title?.toLowerCase()}</strong>.
                Esta ação é <strong>irreversível</strong>!
              </p>
              <div className="space-y-2">
                <Label htmlFor="confirm-input">
                  Digite <code className="bg-muted px-1 py-0.5 rounded text-destructive font-mono text-sm">
                    {selectedOption?.confirmText}
                  </code> para confirmar:
                </Label>
                <Input
                  id="confirm-input"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Digite o texto de confirmação"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={confirmInput !== selectedOption?.confirmText || loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Confirmar Exclusão
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
