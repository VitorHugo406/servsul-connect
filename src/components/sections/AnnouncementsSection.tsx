import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, AlertTriangle, Clock, Trash2, Plus, X, Send, CalendarClock } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
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
  const { announcements, loading, createAnnouncement, deleteAnnouncement } = useAnnouncements();
  const { sectors } = useSectors();
  const { profile, isAdmin, canAccess } = useAuth();
  const { markAllAnnouncementsAsRead } = useNotifications();

  // Mark all announcements as read when component mounts
  useEffect(() => {
    markAllAnnouncementsAsRead();
  }, [markAllAnnouncementsAsRead]);
  
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [isPinned, setIsPinned] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [expireAt, setExpireAt] = useState('');

  // Check if user can post announcements
  const canPost = isAdmin || canAccess('can_post_announcements');

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

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este aviso?')) {
      const { error } = await deleteAnnouncement(id);
      if (error) {
        toast.error('Erro ao excluir aviso');
      } else {
        toast.success('Aviso excluído com sucesso');
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
      toast.success('Aviso publicado com sucesso!');
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
      className="p-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold text-foreground">Avisos Gerais</h3>
          <p className="text-muted-foreground">Comunicados oficiais do Grupo Servsul</p>
        </div>
        
        {canPost && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="gap-2"
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

      {/* Create Announcement Form */}
      <AnimatePresence>
        {showForm && canPost && (
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
                        required
                      />
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
                      />
                      <p className="text-xs text-muted-foreground">Deixe em branco para não expirar</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="important">Importante</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-3 pt-6">
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

                  <Button type="submit" disabled={formLoading} className="w-full gap-2">
                    {formLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Publicar Aviso
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <span className="text-4xl">📢</span>
          </div>
          <h4 className="font-display text-lg font-semibold text-foreground">Nenhum aviso</h4>
          <p className="text-sm text-muted-foreground">
            {canPost 
              ? 'Clique em "Novo Aviso" para criar o primeiro comunicado'
              : 'Não há avisos publicados ainda'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement, index) => {
            const author = announcement.author;
            const authorSector = sectors.find((s) => s.id === author?.sector_id);
            const priorityKey = announcement.priority as keyof typeof priorityStyles;
            
            return (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={cn(
                    'overflow-hidden border-2 transition-all hover:shadow-lg',
                    priorityStyles[priorityKey]?.border || priorityStyles.normal.border,
                    announcement.is_pinned && 'ring-2 ring-secondary/50'
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {announcement.is_pinned && (
                          <Pin className="h-4 w-4 text-secondary animate-pulse-soft" />
                        )}
                        <h4 className="font-display text-lg font-semibold text-foreground">
                          {announcement.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
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
                    <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                      {announcement.content}
                    </p>
                    
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
          })}
        </div>
      )}
    </motion.div>
  );
}