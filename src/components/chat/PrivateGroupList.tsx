 import { useState } from 'react';
 import { motion } from 'framer-motion';
 import { Search, Users, Plus, Loader2 } from 'lucide-react';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { 
   Dialog, 
   DialogContent, 
   DialogDescription, 
   DialogFooter, 
   DialogHeader, 
   DialogTitle 
 } from '@/components/ui/dialog';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { usePrivateGroups, PrivateGroup } from '@/hooks/usePrivateGroups';
 import { cn } from '@/lib/utils';
 import { toast } from 'sonner';
 
 interface PrivateGroupListProps {
   selectedGroupId: string | null;
   onSelectGroup: (groupId: string) => void;
 }
 
 export function PrivateGroupList({ selectedGroupId, onSelectGroup }: PrivateGroupListProps) {
   const [searchQuery, setSearchQuery] = useState('');
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [newName, setNewName] = useState('');
   const [newDescription, setNewDescription] = useState('');
   const [creating, setCreating] = useState(false);
   const { groups, loading, createGroup } = usePrivateGroups();
 
   const filteredGroups = groups.filter((group) =>
     group.name.toLowerCase().includes(searchQuery.toLowerCase())
   );
 
   const getInitials = (name: string) => {
     return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
   };
 
   const handleCreateGroup = async () => {
     if (!newName.trim()) {
       toast.error('Digite o nome do grupo');
       return;
     }
 
     setCreating(true);
     const { error } = await createGroup(newName.trim(), newDescription.trim() || undefined);
     setCreating(false);
 
     if (error) {
       toast.error('Erro ao criar grupo');
     } else {
       toast.success('Grupo criado com sucesso!');
       setShowCreateDialog(false);
       setNewName('');
       setNewDescription('');
     }
   };
 
   return (
     <div className="flex h-full flex-col border-r border-border bg-card">
       {/* Header */}
       <div className="border-b border-border p-4">
         <div className="flex items-center justify-between mb-3">
           <h3 className="font-display text-lg font-semibold text-foreground">
             Grupos Privados
           </h3>
           <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1">
             <Plus className="h-4 w-4" />
             Novo
           </Button>
         </div>
         <div className="relative">
           <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
           <Input
             placeholder="Buscar grupos..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="pl-9"
           />
         </div>
       </div>
 
       {/* Content */}
       <ScrollArea className="flex-1">
         {loading ? (
           <div className="flex items-center justify-center py-8">
             <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
           </div>
         ) : filteredGroups.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-8 text-center px-4">
             <Users className="mb-2 h-8 w-8 text-muted-foreground" />
             <p className="text-sm text-muted-foreground">
               {groups.length === 0 ? 'Nenhum grupo ainda' : 'Nenhum grupo encontrado'}
             </p>
             {groups.length === 0 && (
               <button
                 onClick={() => setShowCreateDialog(true)}
                 className="mt-2 text-sm text-primary hover:underline"
               >
                 Criar primeiro grupo
               </button>
             )}
           </div>
         ) : (
           <div className="p-2">
             {filteredGroups.map((group) => (
               <motion.button
                 key={group.id}
                 onClick={() => onSelectGroup(group.id)}
                 whileHover={{ scale: 1.01 }}
                 whileTap={{ scale: 0.99 }}
                 className={cn(
                   'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
                   selectedGroupId === group.id
                     ? 'bg-primary/10'
                     : 'hover:bg-muted'
                 )}
               >
                 <Avatar className="h-10 w-10">
                   <AvatarImage src={group.avatar_url || ''} />
                   <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                     {getInitials(group.name)}
                   </AvatarFallback>
                 </Avatar>
                 <div className="flex-1 min-w-0">
                   <span className="font-medium text-foreground block truncate">
                     {group.name}
                   </span>
                   {group.description && (
                     <p className="text-xs text-muted-foreground truncate">
                       {group.description}
                     </p>
                   )}
                 </div>
               </motion.button>
             ))}
           </div>
         )}
       </ScrollArea>
 
       {/* Create Dialog */}
       <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Users className="h-5 w-5 text-primary" />
               Criar Novo Grupo
             </DialogTitle>
             <DialogDescription>
               Crie um grupo privado para conversar com membros selecionados
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Nome do Grupo *</Label>
               <Input
                 value={newName}
                 onChange={(e) => setNewName(e.target.value)}
                 placeholder="Ex: Time de Projeto"
               />
             </div>
             <div className="space-y-2">
               <Label>Descrição (opcional)</Label>
               <Textarea
                 value={newDescription}
                 onChange={(e) => setNewDescription(e.target.value)}
                 placeholder="Descreva o propósito do grupo..."
                 rows={3}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
               Cancelar
             </Button>
             <Button onClick={handleCreateGroup} disabled={creating}>
               {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
               Criar Grupo
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }