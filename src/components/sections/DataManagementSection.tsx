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
   Loader2,
   ScanFace
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
   type: string;
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

   const executeDelete = async (type: string) => {
     const { data: sessionData } = await supabase.auth.getSession();
     if (!sessionData.session) {
       throw new Error('Sessão não encontrada');
     }
 
     const response = await supabase.functions.invoke('delete-data', {
       body: { type },
     });
 
     if (response.error) {
       throw new Error(response.error.message || 'Erro ao executar exclusão');
     }
 
     if (response.data?.error) {
       throw new Error(response.data.error);
     }
 
     return response.data;
   };

   const deletionOptions: DeletionOption[] = [
     {
       id: 'messages',
       title: 'Excluir Todas as Mensagens',
       description: 'Remove todas as mensagens de setores, mensagens diretas e mensagens de grupos privados.',
       icon: MessageSquare,
       confirmText: 'EXCLUIR MENSAGENS',
       dangerLevel: 'high',
       type: 'messages',
     },
     {
       id: 'announcements',
       title: 'Excluir Todos os Avisos',
       description: 'Remove todos os avisos, comentários e registros de leitura.',
       icon: Megaphone,
       confirmText: 'EXCLUIR AVISOS',
       dangerLevel: 'high',
       type: 'announcements',
     },
     {
       id: 'facial',
       title: 'Excluir Dados Faciais',
       description: 'Remove todos os dados de reconhecimento facial cadastrados, exceto do administrador principal.',
       icon: ScanFace,
       confirmText: 'EXCLUIR FACIAIS',
       dangerLevel: 'high',
       type: 'facial',
     },
     {
       id: 'users',
       title: 'Excluir Todos os Usuários',
       description: 'Desativa todos os usuários do sistema, exceto o administrador principal.',
       icon: Users,
       confirmText: 'EXCLUIR USUARIOS',
       dangerLevel: 'critical',
       type: 'users',
     },
     {
       id: 'all',
       title: 'Limpar Todo o Banco de Dados',
       description: 'Remove TODOS os dados do sistema, mantendo apenas o administrador principal. Esta ação é IRREVERSÍVEL!',
       icon: Database,
       confirmText: 'LIMPAR TUDO',
       dangerLevel: 'critical',
       type: 'all',
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
       const result = await executeDelete(selectedOption.type);
       toast.success(result.message || `${selectedOption.title} - Concluído com sucesso!`);
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
