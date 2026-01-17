import { motion } from 'framer-motion';
import { Pin, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  const { announcements, loading, deleteAnnouncement } = useAnnouncements();
  const { sectors } = useSectors();
  const { profile } = useAuth();

  const canDelete = (authorId: string) => {
    return profile?.id === authorId || profile?.autonomy_level === 'admin';
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
      await deleteAnnouncement(id);
    }
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
      <div className="mb-6">
        <h3 className="font-display text-2xl font-bold text-foreground">Avisos Gerais</h3>
        <p className="text-muted-foreground">Comunicados oficiais do Grupo Servsul</p>
      </div>

      {announcements.length === 0 ? (
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
          {announcements.map((announcement, index) => {
            const author = announcement.author;
            const authorSector = sectors.find((s) => s.id === author?.sector_id);
            const priority = announcement.priority as keyof typeof priorityStyles;
            
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
                    priorityStyles[priority]?.border || priorityStyles.normal.border,
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
                          className={cn(priorityStyles[priority]?.badge || priorityStyles.normal.badge)}
                        >
                          {priority === 'urgent' && (
                            <AlertTriangle className="mr-1 h-3 w-3" />
                          )}
                          {priorityLabels[priority] || 'Normal'}
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
