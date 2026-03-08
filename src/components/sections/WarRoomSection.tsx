import { useState, useRef, useEffect } from 'react';
import { useWarRooms, useWarRoomDetail, WarRoom } from '@/hooks/useWarRooms';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Siren, Plus, Clock, MessageSquare, Users, AlertTriangle, 
  Send, XCircle, Shield, ChevronLeft, History
} from 'lucide-react';
import { cn } from '@/lib/utils';

function CreateWarRoomDialog({ onCreated }: { onCreated: (room: WarRoom) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const { createWarRoom } = useWarRooms();

  useEffect(() => {
    if (open) {
      supabase.from('profiles').select('id, name, display_name, avatar_url, is_active').eq('is_active', true).order('name').then(({ data }) => {
        if (data) setAllProfiles(data);
      });
    }
  }, [open]);

  const filteredProfiles = allProfiles.filter(p => 
    (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.display_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreate = async () => {
    if (!title.trim() || selectedProfiles.length === 0) return;
    setCreating(true);
    const room = await createWarRoom(title, description, selectedProfiles);
    setCreating(false);
    if (room) {
      setOpen(false);
      setTitle('');
      setDescription('');
      setSelectedProfiles([]);
      onCreated(room);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
          <Siren className="h-4 w-4" />
          Criar War Room
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Siren className="h-5 w-5" />
            Nova War Room
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 overflow-auto">
          <div>
            <label className="text-sm font-medium">Título do Incidente *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Queda do sistema de produção" />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o ocorrido..." rows={3} />
          </div>
          <div>
            <label className="text-sm font-medium">Responsáveis Convocados *</label>
            <Input 
              placeholder="Buscar funcionário..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="mt-1 mb-2"
            />
            <ScrollArea className="h-48 border rounded-md p-2">
              {filteredProfiles.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                  <Checkbox 
                    checked={selectedProfiles.includes(p.id)} 
                    onCheckedChange={(checked) => {
                      setSelectedProfiles(prev => checked ? [...prev, p.id] : prev.filter(id => id !== p.id));
                    }} 
                  />
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={p.avatar_url || ''} />
                    <AvatarFallback className="text-[10px]">{(p.display_name || p.name || '?')[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{p.display_name || p.name}</span>
                </label>
              ))}
            </ScrollArea>
            {selectedProfiles.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{selectedProfiles.length} selecionado(s)</p>
            )}
          </div>
        </div>
        <Button onClick={handleCreate} disabled={!title.trim() || selectedProfiles.length === 0 || creating} className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
          {creating ? 'Criando...' : 'Ativar War Room'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function WarRoomDetail({ room, onBack }: { room: WarRoom; onBack: () => void }) {
  const { members, timeline, messages, loading, acknowledge, addTimelineEntry, sendMessage } = useWarRoomDetail(room.id);
  const { user, profile } = useAuth();
  const { closeWarRoom } = useWarRooms();
  const [newTimeline, setNewTimeline] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('timeline');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentMember = members.find(m => m.user_id === user?.id);
  const needsAcknowledge = currentMember && !currentMember.has_acknowledged;

  useEffect(() => {
    if (needsAcknowledge) {
      acknowledge();
    }
  }, [needsAcknowledge]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAddTimeline = async () => {
    if (!newTimeline.trim()) return;
    await addTimelineEntry(newTimeline);
    setNewTimeline('');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    await sendMessage(newMessage);
    setNewMessage('');
  };

  const isActive = room.status === 'active';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-destructive/5">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-destructive" />
            <h2 className="font-bold text-lg">{room.title}</h2>
            <Badge variant={isActive ? 'destructive' : 'secondary'}>
              {isActive ? 'Ativa' : 'Encerrada'}
            </Badge>
          </div>
          {room.description && <p className="text-sm text-muted-foreground mt-0.5">{room.description}</p>}
          <p className="text-xs text-muted-foreground">Criada em {format(new Date(room.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
        {isActive && (user?.id === room.created_by || profile?.autonomy_level === 'admin') && (
          <Button variant="outline" size="sm" onClick={() => closeWarRoom(room.id)} className="gap-1 border-destructive text-destructive hover:bg-destructive/10">
            <XCircle className="h-4 w-4" /> Encerrar
          </Button>
        )}
      </div>

      {/* Members bar */}
      <div className="flex items-center gap-2 p-3 border-b border-border overflow-x-auto">
        <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground flex-shrink-0">Convocados:</span>
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-1.5 flex-shrink-0">
            <Avatar className="h-6 w-6">
              <AvatarImage src={m.profile?.avatar_url || ''} />
              <AvatarFallback className="text-[9px]">{(m.profile?.display_name || m.profile?.name || '?')[0]}</AvatarFallback>
            </Avatar>
            <span className="text-xs">{m.profile?.display_name || m.profile?.name}</span>
            {m.has_acknowledged ? (
              <span className="text-[9px] text-success">✓</span>
            ) : (
              <span className="text-[9px] text-destructive animate-pulse">●</span>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
          <TabsTrigger value="timeline" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="flex-1 flex flex-col overflow-hidden m-0 p-4">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-4">
              {timeline.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("w-3 h-3 rounded-full mt-1", i === 0 ? "bg-destructive" : "bg-muted-foreground/30")} />
                    {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm">{entry.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.creator_name} · {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          {isActive && (
            <div className="flex gap-2 pt-3 border-t border-border">
              <Input 
                value={newTimeline} 
                onChange={e => setNewTimeline(e.target.value)} 
                placeholder="Registrar novo incidente na timeline..."
                onKeyDown={e => e.key === 'Enter' && handleAddTimeline()}
              />
              <Button size="sm" onClick={handleAddTimeline} disabled={!newTimeline.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 p-4">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-4">
              {messages.map(msg => {
                const isOwn = msg.sender_id === profile?.id;
                return (
                  <div key={msg.id} className={cn("flex gap-2", isOwn && "flex-row-reverse")}>
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={msg.sender?.avatar_url || ''} />
                      <AvatarFallback className="text-[9px]">{(msg.sender?.display_name || msg.sender?.name || '?')[0]}</AvatarFallback>
                    </Avatar>
                    <div className={cn("max-w-[70%] rounded-xl px-3 py-2", isOwn ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      {!isOwn && <p className="text-[10px] font-semibold mb-0.5">{msg.sender?.display_name || msg.sender?.name}</p>}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={cn("text-[10px] mt-0.5", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          {isActive && (
            <div className="flex gap-2 pt-3 border-t border-border">
              <Input 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)} 
                placeholder="Mensagem..."
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              />
              <Button size="icon" onClick={handleSendMessage} disabled={!newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function WarRoomSection() {
  const { warRooms, loading, canCreateWarRoom } = useWarRooms();
  const [selectedRoom, setSelectedRoom] = useState<WarRoom | null>(null);
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');

  const filtered = warRooms.filter(r => {
    if (filter === 'active') return r.status === 'active';
    if (filter === 'closed') return r.status === 'closed';
    return true;
  });

  if (selectedRoom) {
    return <WarRoomDetail room={selectedRoom} onBack={() => setSelectedRoom(null)} />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-destructive" />
            War Room
          </h2>
          <p className="text-sm text-muted-foreground">Gestão de incidentes críticos e respostas de emergência</p>
        </div>
        {canCreateWarRoom && (
          <CreateWarRoomDialog onCreated={(room) => setSelectedRoom(room)} />
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button variant={filter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('active')} className="gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Ativas
          {warRooms.filter(r => r.status === 'active').length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{warRooms.filter(r => r.status === 'active').length}</Badge>
          )}
        </Button>
        <Button variant={filter === 'closed' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('closed')} className="gap-1.5">
          <History className="h-3.5 w-3.5" /> Histórico
        </Button>
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          Todas
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma War Room {filter === 'active' ? 'ativa' : filter === 'closed' ? 'no histórico' : ''}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {canCreateWarRoom ? 'Crie uma War Room quando houver um incidente crítico' : 'War Rooms aparecerão aqui quando forem criadas'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(room => (
            <Card 
              key={room.id} 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                room.status === 'active' && "border-destructive/50 bg-destructive/5"
              )}
              onClick={() => setSelectedRoom(room)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                  room.status === 'active' ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Siren className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{room.title}</h3>
                    <Badge variant={room.status === 'active' ? 'destructive' : 'secondary'} className="flex-shrink-0">
                      {room.status === 'active' ? 'Ativa' : 'Encerrada'}
                    </Badge>
                  </div>
                  {room.description && <p className="text-sm text-muted-foreground truncate">{room.description}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(room.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
