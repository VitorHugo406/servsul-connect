 import { useState, useEffect } from 'react';
 import { motion } from 'framer-motion';
 import { 
   Sparkles, 
   Plus, 
   Trash2, 
   Eye, 
   X,
   Loader2,
   Calendar,
   Palette
 } from 'lucide-react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Shield } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { useAuth } from '@/contexts/AuthContext';
 import { cn } from '@/lib/utils';
 
 const BORDER_STYLES = [
   { id: 'gradient-blue', name: 'Azul Gradiente', className: 'border-2 border-blue-500 bg-gradient-to-r from-blue-500/10 to-cyan-500/10', emoji: '💙' },
   { id: 'gradient-red', name: 'Vermelho Urgente', className: 'border-2 border-red-500 bg-gradient-to-r from-red-500/10 to-orange-500/10', emoji: '🔴' },
   { id: 'gradient-green', name: 'Verde Sucesso', className: 'border-2 border-green-500 bg-gradient-to-r from-green-500/10 to-emerald-500/10', emoji: '💚' },
   { id: 'gradient-purple', name: 'Roxo Elegante', className: 'border-2 border-purple-500 bg-gradient-to-r from-purple-500/10 to-pink-500/10', emoji: '💜' },
   { id: 'gradient-gold', name: 'Dourado Premium', className: 'border-2 border-yellow-500 bg-gradient-to-r from-yellow-500/10 to-amber-500/10', emoji: '⭐' },
   { id: 'solid-blue', name: 'Azul Sólido', className: 'border-4 border-blue-500', emoji: '🔵' },
   { id: 'solid-red', name: 'Vermelho Sólido', className: 'border-4 border-red-500', emoji: '❤️' },
   { id: 'dashed-blue', name: 'Azul Tracejado', className: 'border-2 border-dashed border-blue-500', emoji: '💎' },
   { id: 'celebration', name: 'Celebração', className: 'border-2 border-pink-500 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10', emoji: '🎉' },
   { id: 'warning', name: 'Atenção', className: 'border-2 border-orange-500 bg-gradient-to-r from-orange-500/10 to-yellow-500/10', emoji: '⚠️' },
   { id: 'success', name: 'Sucesso', className: 'border-2 border-emerald-500 bg-gradient-to-r from-emerald-500/10 to-teal-500/10', emoji: '✅' },
   { id: 'info', name: 'Informativo', className: 'border-2 border-sky-500 bg-gradient-to-r from-sky-500/10 to-blue-500/10', emoji: 'ℹ️' },
 ];
 
 const EMOJIS = ['📢', '🎉', '⭐', '🔔', '💡', '🎯', '🚀', '💪', '🏆', '📌', '❗', '✨', '🌟', '💼', '📋', '🎁'];
 
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
 
 export function ImportantAnnouncementsSection() {
   const { isAdmin, user } = useAuth();
   const [announcements, setAnnouncements] = useState<ImportantAnnouncement[]>([]);
   const [loading, setLoading] = useState(true);
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [showPreview, setShowPreview] = useState(false);
   const [newTitle, setNewTitle] = useState('');
   const [newContent, setNewContent] = useState('');
   const [newBorderStyle, setNewBorderStyle] = useState('gradient-blue');
   const [selectedEmoji, setSelectedEmoji] = useState('📢');
   const [newStartAt, setNewStartAt] = useState('');
   const [newExpireAt, setNewExpireAt] = useState('');
   const [creating, setCreating] = useState(false);
 
   useEffect(() => {
     if (!isAdmin) return;
     fetchAnnouncements();
   }, [isAdmin]);
 
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
     setLoading(false);
   };
 
   const createAnnouncement = async () => {
     if (!newTitle.trim() || !newContent.trim()) {
       toast.error('Título e conteúdo são obrigatórios');
       return;
     }
     
     setCreating(true);
     try {
       const titleWithEmoji = `${selectedEmoji} ${newTitle.trim()}`;
       const { data, error } = await supabase
         .from('important_announcements')
         .insert({
           title: titleWithEmoji,
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
       resetForm();
       setShowCreateDialog(false);
     } catch (error) {
       console.error('Error creating announcement:', error);
       toast.error('Erro ao criar comunicado');
     } finally {
       setCreating(false);
     }
   };
 
   const resetForm = () => {
     setNewTitle('');
     setNewContent('');
     setNewBorderStyle('gradient-blue');
     setSelectedEmoji('📢');
     setNewStartAt('');
     setNewExpireAt('');
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
 
   return (
     <motion.div
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       className="p-4 md:p-6 space-y-6"
     >
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
             <Sparkles className="h-6 w-6 text-primary" />
           </div>
           <div>
             <h2 className="font-display text-2xl font-bold text-foreground">
               Comunicados Importantes
             </h2>
             <p className="text-muted-foreground">
               Avisos exibidos como modal ao abrir o app
             </p>
           </div>
         </div>
         <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
           <Plus className="h-4 w-4" />
           <span className="hidden sm:inline">Novo Comunicado</span>
         </Button>
       </div>
 
       {loading ? (
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
         <div className="grid gap-4 md:grid-cols-2">
           {announcements.map((announcement) => (
             <Card 
               key={announcement.id} 
               className={`overflow-hidden transition-all hover:shadow-lg ${getBorderClassName(announcement.border_style)}`}
             >
               <CardHeader className="pb-2">
                 <div className="flex items-start justify-between gap-2">
                   <div className="flex-1 min-w-0">
                     <CardTitle className="text-lg truncate">{announcement.title}</CardTitle>
                     <div className="flex flex-wrap items-center gap-2 mt-1">
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
                 </div>
               </CardHeader>
               <CardContent>
                 <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                   {announcement.content}
                 </p>
                 <div className="flex flex-wrap gap-2">
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
               </CardContent>
             </Card>
           ))}
         </div>
       )}
 
       {/* Create Dialog */}
       <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
         <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Sparkles className="h-5 w-5 text-primary" />
               Novo Comunicado Importante
             </DialogTitle>
             <DialogDescription>
               Este comunicado aparecerá como modal quando os usuários abrirem o app
             </DialogDescription>
           </DialogHeader>
           
           <div className="space-y-4 py-4">
             {/* Emoji Selector */}
             <div className="space-y-2">
               <Label>Emoji</Label>
               <div className="flex flex-wrap gap-2">
                 {EMOJIS.map((emoji) => (
                   <button
                     key={emoji}
                     onClick={() => setSelectedEmoji(emoji)}
                     className={cn(
                       'text-2xl p-2 rounded-lg transition-all hover:bg-muted',
                       selectedEmoji === emoji && 'bg-primary/20 ring-2 ring-primary'
                     )}
                   >
                     {emoji}
                   </button>
                 ))}
               </div>
             </div>
 
             <div className="space-y-2">
               <Label>Título *</Label>
               <div className="flex gap-2">
                 <span className="flex items-center justify-center w-10 text-xl">{selectedEmoji}</span>
                 <Input
                   value={newTitle}
                   onChange={(e) => setNewTitle(e.target.value)}
                   placeholder="Título do comunicado"
                   className="flex-1"
                 />
               </div>
             </div>
 
             <div className="space-y-2">
               <Label>Conteúdo *</Label>
               <Textarea
                 value={newContent}
                 onChange={(e) => setNewContent(e.target.value)}
                 placeholder="Escreva o comunicado aqui..."
                 rows={4}
               />
             </div>
 
             {/* Border Style Selector */}
             <div className="space-y-2">
               <Label className="flex items-center gap-2">
                 <Palette className="h-4 w-4" />
                 Estilo da Borda
               </Label>
               <ScrollArea className="h-32">
                 <div className="grid grid-cols-2 gap-2 pr-4">
                   {BORDER_STYLES.map((style) => (
                     <button
                       key={style.id}
                       onClick={() => setNewBorderStyle(style.id)}
                       className={cn(
                         'p-3 rounded-lg text-left text-sm transition-all',
                         style.className,
                         newBorderStyle === style.id && 'ring-2 ring-primary ring-offset-2'
                       )}
                     >
                       <span className="mr-2">{style.emoji}</span>
                       {style.name}
                     </button>
                   ))}
                 </div>
               </ScrollArea>
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="flex items-center gap-2">
                   <Calendar className="h-4 w-4" />
                   Data de Início
                 </Label>
                 <Input
                   type="datetime-local"
                   value={newStartAt}
                   onChange={(e) => setNewStartAt(e.target.value)}
                 />
               </div>
               <div className="space-y-2">
                 <Label className="flex items-center gap-2">
                   <Calendar className="h-4 w-4" />
                   Data de Expiração
                 </Label>
                 <Input
                   type="datetime-local"
                   value={newExpireAt}
                   onChange={(e) => setNewExpireAt(e.target.value)}
                 />
               </div>
             </div>
 
             {/* Preview */}
             {(newTitle || newContent) && (
               <div className="space-y-2">
                 <Label>Pré-visualização</Label>
                 <div className={cn('p-4 rounded-xl', getBorderClassName(newBorderStyle))}>
                   <h3 className="font-semibold text-lg">{selectedEmoji} {newTitle || 'Título'}</h3>
                   <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                     {newContent || 'Conteúdo do comunicado...'}
                   </p>
                 </div>
               </div>
             )}
           </div>
 
           <DialogFooter className="flex-col sm:flex-row gap-2">
             <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full sm:w-auto">
               Cancelar
             </Button>
             <Button onClick={createAnnouncement} disabled={creating} className="w-full sm:w-auto">
               {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
               Criar Comunicado
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </motion.div>
   );
 }