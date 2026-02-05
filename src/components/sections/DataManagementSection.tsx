import { useState, useEffect } from 'react';
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
  ScanFace,
  UserX,
  Plus,
  Eye,
  Sparkles,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const ADMIN_EMAIL = 'adminservchat@servsul.com.br';

const BORDER_STYLES = [
  { id: 'gradient-blue', name: 'Azul Gradiente', className: 'border-2 border-blue-500 bg-gradient-to-r from-blue-500/10 to-cyan-500/10' },
  { id: 'gradient-red', name: 'Vermelho Urgente', className: 'border-2 border-red-500 bg-gradient-to-r from-red-500/10 to-orange-500/10' },
  { id: 'gradient-green', name: 'Verde Sucesso', className: 'border-2 border-green-500 bg-gradient-to-r from-green-500/10 to-emerald-500/10' },
  { id: 'gradient-purple', name: 'Roxo Elegante', className: 'border-2 border-purple-500 bg-gradient-to-r from-purple-500/10 to-pink-500/10' },
  { id: 'gradient-gold', name: 'Dourado Premium', className: 'border-2 border-yellow-500 bg-gradient-to-r from-yellow-500/10 to-amber-500/10' },
  { id: 'solid-blue', name: 'Azul Sólido', className: 'border-4 border-blue-500' },
  { id: 'solid-red', name: 'Vermelho Sólido', className: 'border-4 border-red-500' },
  { id: 'dashed-blue', name: 'Azul Tracejado', className: 'border-2 border-dashed border-blue-500' },
];

interface ImportantAnnouncement {
  id: string;
  title: string;
  content: string;
  border_style: string;
  created_at: string;
  start_at: string | null;
  expire_at: string | null;
  is_active: boolean;
}

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
  const [activeTab, setActiveTab] = useState('deletion');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedOption, setSelectedOption] = useState<DeletionOption | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Important announcements state
  const [announcements, setAnnouncements] = useState<ImportantAnnouncement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newBorderStyle, setNewBorderStyle] = useState('gradient-blue');
  const [newStartAt, setNewStartAt] = useState('');
  const [newExpireAt, setNewExpireAt] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch important announcements
  useEffect(() => {
    if (!isAdmin) return;
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from('important_announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching important announcements:', error);
      } else {
        setAnnouncements(data || []);
      }
      setLoadingAnnouncements(false);
    };
    
    fetchAnnouncements();
  }, [isAdmin]);

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

  const createAnnouncement = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }
    
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('important_announcements')
        .insert({
          title: newTitle.trim(),
          content: newContent.trim(),
          border_style: newBorderStyle,
          created_by: user?.id,
          start_at: newStartAt ? new Date(newStartAt).toISOString() : null,
          expire_at: newExpireAt ? new Date(newExpireAt).toISOString() : null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setAnnouncements(prev => [data, ...prev]);
      toast.success('Comunicado importante criado com sucesso!');
      setShowCreateDialog(false);
      setNewTitle('');
      setNewContent('');
      setNewBorderStyle('gradient-blue');
      setNewStartAt('');
      setNewExpireAt('');
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast.error('Erro ao criar comunicado');
    } finally {
      setCreating(false);
    }
  };

  const toggleAnnouncementActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('important_announcements')
      .update({ is_active: !isActive })
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao atualizar comunicado');
    } else {
      setAnnouncements(prev => 
        prev.map(a => a.id === id ? { ...a, is_active: !isActive } : a)
      );
      toast.success(isActive ? 'Comunicado desativado' : 'Comunicado ativado');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase
      .from('important_announcements')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Erro ao excluir comunicado');
    } else {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Comunicado excluído');
    }
  };

  const getBorderClassName = (styleId: string) => {
    return BORDER_STYLES.find(s => s.id === styleId)?.className || BORDER_STYLES[0].className;
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
        title: 'Inativar Todos os Usuários',
        description: 'Marca todos os usuários como inativos, impedindo o login, exceto o administrador principal.',
       icon: Users,
        confirmText: 'INATIVAR USUARIOS',
        dangerLevel: 'high',
       type: 'users',
     },
     {
        id: 'delete-users',
        title: 'Excluir Usuários Permanentemente',
        description: 'Remove PERMANENTEMENTE todos os usuários do sistema e suas autenticações, exceto o administrador principal.',
        icon: UserX,
        confirmText: 'EXCLUIR PERMANENTE',
        dangerLevel: 'critical',
        type: 'delete-users',
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="deletion" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Exclusão de Dados
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Comunicados Importantes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deletion" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="announcements" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Comunicados Importantes
              </h3>
              <p className="text-sm text-muted-foreground">
                Comunicados exibidos como modal ao abrir o app
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Comunicado
            </Button>
          </div>

          {loadingAnnouncements ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : announcements.length === 0 ? (
            <Card className="p-8 text-center">
              <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground">Nenhum comunicado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Crie um comunicado importante para exibir aos usuários
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <Card 
                  key={announcement.id} 
                  className={`overflow-hidden ${getBorderClassName(announcement.border_style)}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={announcement.is_active ? 'default' : 'secondary'}>
                            {announcement.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          {announcement.start_at && (
                            <span className="text-xs text-muted-foreground">
                              Início: {new Date(announcement.start_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                          {announcement.expire_at && (
                            <span className="text-xs text-muted-foreground">
                              Expira: {new Date(announcement.expire_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAnnouncementActive(announcement.id, announcement.is_active)}
                        >
                          {announcement.is_active ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteAnnouncement(announcement.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Announcement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Criar Comunicado Importante
            </DialogTitle>
            <DialogDescription>
              Este comunicado será exibido como modal ao abrir o app (apenas uma vez por usuário)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Atualização Importante"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Digite o conteúdo do comunicado..."
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Estilo da Borda</Label>
              <Select value={newBorderStyle} onValueChange={setNewBorderStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BORDER_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className={`mt-2 p-4 rounded-lg ${getBorderClassName(newBorderStyle)}`}>
                <p className="text-sm text-muted-foreground text-center">Pré-visualização do estilo</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startAt">Data de Início (opcional)</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={newStartAt}
                  onChange={(e) => setNewStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expireAt">Data de Expiração (opcional)</Label>
                <Input
                  id="expireAt"
                  type="datetime-local"
                  value={newExpireAt}
                  onChange={(e) => setNewExpireAt(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={createAnnouncement} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Comunicado'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
