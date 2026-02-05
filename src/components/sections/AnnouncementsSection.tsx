import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, AlertTriangle, Clock, Trash2, Plus, X, Send, CalendarClock, Calendar, Edit2, Sparkles } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useImportantAnnouncements } from '@/hooks/useImportantAnnouncements';
import { useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const priorityStyles = {
  normal: {
    badge: 'bg-muted text-muted-foreground',
    border: 'border-border',
  },
  important: {
    badge: 'bg-secondary/20 text-secondary border-secondary',
    border: 'border-secondary/30',
  },
  urgent: {
    badge: 'bg-destructive/20 text-destructive border-destructive',
    border: 'border-destructive/30',
  },
};

const priorityLabels: Record<string, string> = {
  normal: 'Normal',
  important: 'Importante',
  urgent: 'Urgente',
};

export function AnnouncementsSection() {
  const { 
    announcements, 
    scheduledAnnouncements, 
    expiredAnnouncements,
    loading, 
    createAnnouncement, 
    deleteAnnouncement,
    canManageAnnouncements 
  } = useAnnouncements();
  const { sectors } = useSectors();
  const { profile, isAdmin } = useAuth();
  const { allAnnouncements: importantAnnouncements } = useImportantAnnouncements();
  const { markAllAnnouncementsAsRead, refetch: refetchNotifications } = useNotifications();
  const [activeTab, setActiveTab] = useState('active');

  // Mark all announcements as read when component mounts and refetch notifications
  useEffect(() => {
    markAllAnnouncementsAsRead();
    refetchNotifications();
  }, [markAllAnnouncementsAsRead, refetchNotifications]);
  
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [isPinned, setIsPinned] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [expireAt, setExpireAt] = useState('');

  const canDelete = (authorId: string) => {
    return profile?.id === authorId || isAdmin;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return 'Sem data';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este aviso?')) {
      const { error } = await deleteAnnouncement(id);
      if (error) {
        toast.error('Erro ao excluir aviso');
      } else {
        toast.success('Aviso excluído com sucesso');
        refetchNotifications();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha o título e o conteúdo');
      return;
    }

    if (!startAt) {
      toast.error('Data de início é obrigatória');
      return;
    }

    setFormLoading(true);
    const { error } = await createAnnouncement(
      title, 
      content, 
      priority, 
      isPinned,
      new Date(startAt).toISOString(),
      expireAt ? new Date(expireAt).toISOString() : null
    );
    
    if (error) {
      console.error('Error creating announcement:', error);
      toast.error('Erro ao criar aviso. Verifique suas permissões.');
    } else {
      toast.success(new Date(startAt) > new Date() ? 'Aviso agendado com sucesso!' : 'Aviso publicado com sucesso!');
      setTitle('');
      setContent('');
      setPriority('normal');
      setIsPinned(false);
      setStartAt('');
      setExpireAt('');
      setShowForm(false);
    }
    setFormLoading(false);
  };

  // Set default start date to now when opening form
  useEffect(() => {
    if (showForm && !startAt) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setStartAt(now.toISOString().slice(0, 16));
    }
  }, [showForm]);

  const renderAnnouncementCard = (announcement: any, showScheduleInfo = false, isExpired = false) => {
    const author = announcement.author;
    const authorSector = sectors.find((s) => s.id === author?.sector_id);
    const priorityKey = announcement.priority as keyof typeof priorityStyles;
    
    return (
      <motion.div
        key={announcement.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(isExpired && 'opacity-60')}
      >
        <Card
          className={cn(
            'overflow-hidden border-2 transition-all hover:shadow-lg',
            priorityStyles[priorityKey]?.border || priorityStyles.normal.border,
            announcement.is_pinned && 'ring-2 ring-secondary/50',
            isExpired && 'border-muted'
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                {announcement.is_pinned && (
                  <Pin className="h-4 w-4 text-secondary flex-shrink-0" />
                )}
                <h4 className="font-display text-lg font-semibold text-foreground line-clamp-1">
                  {announcement.title}
                </h4>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {showScheduleInfo && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                    <Calendar className="h-3 w-3 mr-1" />
                    Agendado
                  </Badge>
                )}
                {isExpired && (
                  <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                    Expirado
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn(priorityStyles[priorityKey]?.badge || priorityStyles.normal.badge)}
                >
                  {priorityKey === 'urgent' && (
                    <AlertTriangle className="mr-1 h-3 w-3" />
                  )}
                  {priorityLabels[priorityKey] || 'Normal'}
                </Badge>
                {canDelete(announcement.author_id) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(announcement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground line-clamp-3">
              {announcement.content}
            </p>
            
            {/* Schedule info */}
            {(showScheduleInfo || announcement.expire_at) && (
              <div className="mb-4 flex flex-wrap gap-3 text-xs">
                {showScheduleInfo && announcement.start_at && (
                  <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-600">
                    <CalendarClock className="h-3 w-3" />
                    Início: {formatDateShort(announcement.start_at)}
                  </div>
                )}
                {announcement.expire_at && (
                  <div className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-1",
                    isExpired ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-600"
                  )}>
                    <Clock className="h-3 w-3" />
                    {isExpired ? 'Expirou' : 'Expira'}: {formatDateShort(announcement.expire_at)}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={author?.avatar_url || ''} />
                  <AvatarFallback 
                    className="text-xs text-white"
                    style={{ backgroundColor: authorSector?.color || '#6366f1' }}
                  >
                    {getInitials(author?.display_name || author?.name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {author?.display_name || author?.name}
                  </p>
                  {authorSector && (
                    <p className="text-xs text-muted-foreground">
                      {authorSector.name}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDate(announcement.created_at)}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      <div className="p-4 sm:p-6 border-b border-border bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">Avisos Gerais</h3>
            <p className="text-sm text-muted-foreground">Comunicados oficiais do Grupo Servsul</p>
          </div>
          
          {canManageAnnouncements && (
            <Button
              onClick={() => setShowForm(!showForm)}
              className="gap-2 w-full sm:w-auto"
              variant={showForm ? 'outline' : 'default'}
            >
              {showForm ? (
                <>
                  <X className="h-4 w-4" />
                  Cancelar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Novo Aviso
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* Create Announcement Form */}
        <AnimatePresence>
          {showForm && canManageAnnouncements && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <h4 className="font-display text-lg font-semibold text-foreground">
                    Criar Novo Aviso
                  </h4>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Título *</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título do aviso"
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content">Conteúdo *</Label>
                      <Textarea
                        id="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Escreva o conteúdo do aviso..."
                        rows={4}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startAt">
                          <CalendarClock className="inline h-4 w-4 mr-1" />
                          Data/Hora de início *
                        </Label>
                        <Input
                          id="startAt"
                          type="datetime-local"
                          value={startAt}
                          onChange={(e) => setStartAt(e.target.value)}
                          className="h-11"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Agende para o futuro ou publique agora
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="expireAt">
                          <CalendarClock className="inline h-4 w-4 mr-1" />
                          Data/Hora de expiração
                        </Label>
                        <Input
                          id="expireAt"
                          type="datetime-local"
                          value={expireAt}
                          onChange={(e) => setExpireAt(e.target.value)}
                          className="h-11"
                        />
                        <p className="text-xs text-muted-foreground">Deixe em branco para não expirar</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="important">Importante</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-3 pt-0 sm:pt-6">
                        <Switch
                          id="pinned"
                          checked={isPinned}
                          onCheckedChange={setIsPinned}
                        />
                        <Label htmlFor="pinned" className="cursor-pointer">
                          <Pin className="inline h-4 w-4 mr-1" />
                          Fixar no topo
                        </Label>
                      </div>
                    </div>

                    <Button type="submit" disabled={formLoading} className="w-full gap-2 h-11">
                      {formLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {startAt && new Date(startAt) > new Date() ? 'Agendar Aviso' : 'Publicar Aviso'}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs for different announcement states */}
        {canManageAnnouncements ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-6">
              <TabsTrigger value="active" className="gap-1">
                Ativos
                {announcements.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {announcements.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="gap-1">
                Agendados
                {scheduledAnnouncements.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {scheduledAnnouncements.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="expired" className="gap-1">
                Expirados
                {expiredAnnouncements.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {expiredAnnouncements.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
              {announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 rounded-full bg-muted p-4">
                    <span className="text-4xl">📢</span>
                  </div>
                  <h4 className="font-display text-lg font-semibold text-foreground">Nenhum aviso ativo</h4>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Novo Aviso" para criar um comunicado
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => renderAnnouncementCard(announcement))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="scheduled" className="mt-0">
              {scheduledAnnouncements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 rounded-full bg-muted p-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h4 className="font-display text-lg font-semibold text-foreground">Nenhum aviso agendado</h4>
                  <p className="text-sm text-muted-foreground">
                    Avisos com data futura aparecerão aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledAnnouncements.map((announcement) => renderAnnouncementCard(announcement, true))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="expired" className="mt-0">
              {expiredAnnouncements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 rounded-full bg-muted p-4">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h4 className="font-display text-lg font-semibold text-foreground">Nenhum aviso expirado</h4>
                  <p className="text-sm text-muted-foreground">
                    Avisos expirados dos últimos 30 dias aparecerão aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {expiredAnnouncements.map((announcement) => renderAnnouncementCard(announcement, false, true))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          // Regular user view - show important announcements + active announcements
          <div className="space-y-6">
            {/* Important Announcements Section */}
            {importantAnnouncements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg font-bold text-foreground">Avisos Importantes</h3>
                  <Badge variant="secondary">{importantAnnouncements.length}</Badge>
                </div>
                <div className="space-y-3">
                  {importantAnnouncements.map((ia) => (
                    <Card key={ia.id} className={cn('overflow-hidden border-2 border-primary/30 bg-primary/5')}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                            <Sparkles className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground mb-1">{ia.title}</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ia.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(ia.created_at).toLocaleDateString('pt-BR', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Announcements */}
            {importantAnnouncements.length > 0 && announcements.length > 0 && (
              <div className="flex items-center gap-2">
                <Pin className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-display text-lg font-bold text-foreground">Avisos Gerais</h3>
                <Badge variant="secondary">{announcements.length}</Badge>
              </div>
            )}

            {announcements.length === 0 && importantAnnouncements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <span className="text-4xl">📢</span>
                </div>
                <h4 className="font-display text-lg font-semibold text-foreground">Nenhum aviso</h4>
                <p className="text-sm text-muted-foreground">
                  Não há avisos publicados ainda
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => renderAnnouncementCard(announcement))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}