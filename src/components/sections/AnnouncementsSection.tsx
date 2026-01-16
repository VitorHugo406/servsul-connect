import { motion } from 'framer-motion';
import { Pin, AlertTriangle, Clock, User } from 'lucide-react';
import { announcements } from '@/data/mockData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

const priorityLabels = {
  normal: 'Normal',
  important: 'Importante',
  urgent: 'Urgente',
};

export function AnnouncementsSection() {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

      <div className="space-y-4">
        {announcements.map((announcement, index) => (
          <motion.div
            key={announcement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={cn(
                'overflow-hidden border-2 transition-all hover:shadow-lg',
                priorityStyles[announcement.priority].border,
                announcement.isPinned && 'ring-2 ring-secondary/50'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {announcement.isPinned && (
                      <Pin className="h-4 w-4 text-secondary animate-pulse-soft" />
                    )}
                    <h4 className="font-display text-lg font-semibold text-foreground">
                      {announcement.title}
                    </h4>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(priorityStyles[announcement.priority].badge)}
                  >
                    {announcement.priority === 'urgent' && (
                      <AlertTriangle className="mr-1 h-3 w-3" />
                    )}
                    {priorityLabels[announcement.priority]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {announcement.content}
                </p>
                
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={announcement.author.avatar} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(announcement.author.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {announcement.author.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {announcement.author.sector.name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(announcement.timestamp)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
