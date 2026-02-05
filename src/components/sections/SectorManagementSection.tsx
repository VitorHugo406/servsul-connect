 import { useState } from 'react';
 import { motion } from 'framer-motion';
 import { 
   Building2, 
   Plus, 
   Trash2, 
   Edit, 
   Palette,
   Shield,
   Loader2,
   AlertTriangle
 } from 'lucide-react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { 
   Dialog, 
   DialogContent, 
   DialogDescription, 
   DialogFooter, 
   DialogHeader, 
   DialogTitle 
 } from '@/components/ui/dialog';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from '@/components/ui/alert-dialog';
 import { useSectorManagement } from '@/hooks/useSectorManagement';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from 'sonner';
 
 const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';
 
 const COLORS = [
   '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
   '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
 ];
 
 export function SectorManagementSection() {
   const { isAdmin } = useAuth();
   const { sectors, loading, createSector, updateSector, deleteSector } = useSectorManagement();
   
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [showEditDialog, setShowEditDialog] = useState(false);
   const [showDeleteDialog, setShowDeleteDialog] = useState(false);
   const [selectedSector, setSelectedSector] = useState<any>(null);
   const [newName, setNewName] = useState('');
   const [newColor, setNewColor] = useState('#3B82F6');
   const [submitting, setSubmitting] = useState(false);
 
   if (!isAdmin) {
     return (
       <div className="flex h-full flex-col items-center justify-center p-8 text-center">
         <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
         <h3 className="font-display text-xl font-semibold text-foreground">Acesso Restrito</h3>
         <p className="mt-2 text-muted-foreground">
           Apenas administradores podem gerenciar setores.
         </p>
       </div>
     );
   }
 
   const handleCreate = async () => {
     if (!newName.trim()) {
       toast.error('Digite o nome do setor');
       return;
     }
     
     setSubmitting(true);
     const { error } = await createSector(newName.trim(), newColor);
     setSubmitting(false);
     
     if (error) {
       toast.error('Erro ao criar setor');
     } else {
       toast.success('Setor criado com sucesso!');
       setShowCreateDialog(false);
       setNewName('');
       setNewColor('#3B82F6');
     }
   };
 
   const handleEdit = async () => {
     if (!selectedSector || !newName.trim()) return;
     
     setSubmitting(true);
     const { error } = await updateSector(selectedSector.id, { 
       name: newName.trim(), 
       color: newColor 
     });
     setSubmitting(false);
     
     if (error) {
       toast.error('Erro ao atualizar setor');
     } else {
       toast.success('Setor atualizado!');
       setShowEditDialog(false);
       setSelectedSector(null);
     }
   };
 
   const handleDelete = async () => {
     if (!selectedSector) return;
     
     setSubmitting(true);
     const { error } = await deleteSector(selectedSector.id);
     setSubmitting(false);
     
     if (error) {
       toast.error('Erro ao excluir setor. Verifique se não há usuários vinculados.');
     } else {
       toast.success('Setor excluído!');
       setShowDeleteDialog(false);
       setSelectedSector(null);
     }
   };
 
   const openEditDialog = (sector: any) => {
     setSelectedSector(sector);
     setNewName(sector.name);
     setNewColor(sector.color);
     setShowEditDialog(true);
   };
 
   const openDeleteDialog = (sector: any) => {
     setSelectedSector(sector);
     setShowDeleteDialog(true);
   };
 
   return (
     <motion.div
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       className="p-4 md:p-6 space-y-6"
     >
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
             <Building2 className="h-6 w-6 text-primary" />
           </div>
           <div>
             <h2 className="font-display text-2xl font-bold text-foreground">
               Gestão de Setores
             </h2>
             <p className="text-muted-foreground">
               Adicione ou remova departamentos
             </p>
           </div>
         </div>
         <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
           <Plus className="h-4 w-4" />
           Novo Setor
         </Button>
       </div>
 
       {loading ? (
         <div className="flex items-center justify-center py-12">
           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
         </div>
       ) : (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           {sectors.map((sector) => (
             <Card key={sector.id} className="overflow-hidden">
               <div 
                 className="h-2" 
                 style={{ backgroundColor: sector.color }} 
               />
               <CardHeader className="pb-2">
                 <div className="flex items-center justify-between">
                   <CardTitle className="text-lg flex items-center gap-2">
                     <span 
                       className="h-3 w-3 rounded-full" 
                       style={{ backgroundColor: sector.color }} 
                     />
                     {sector.name}
                   </CardTitle>
                   {sector.id === GERAL_SECTOR_ID && (
                     <Badge variant="secondary">Padrão</Badge>
                   )}
                 </div>
               </CardHeader>
               <CardContent>
                 {sector.id !== GERAL_SECTOR_ID && (
                   <div className="flex gap-2">
                     <Button 
                       variant="outline" 
                       size="sm" 
                       className="flex-1 gap-1"
                       onClick={() => openEditDialog(sector)}
                     >
                       <Edit className="h-3 w-3" />
                       Editar
                     </Button>
                     <Button 
                       variant="outline" 
                       size="sm" 
                       className="flex-1 gap-1 text-destructive hover:text-destructive"
                       onClick={() => openDeleteDialog(sector)}
                     >
                       <Trash2 className="h-3 w-3" />
                       Excluir
                     </Button>
                   </div>
                 )}
               </CardContent>
             </Card>
           ))}
         </div>
       )}
 
       {/* Create Dialog */}
       <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Novo Setor</DialogTitle>
             <DialogDescription>
               Adicione um novo departamento ao sistema
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Nome do Setor</Label>
               <Input
                 value={newName}
                 onChange={(e) => setNewName(e.target.value)}
                 placeholder="Ex: Recursos Humanos"
               />
             </div>
             <div className="space-y-2">
               <Label className="flex items-center gap-2">
                 <Palette className="h-4 w-4" />
                 Cor do Setor
               </Label>
               <div className="flex flex-wrap gap-2">
                 {COLORS.map((color) => (
                   <button
                     key={color}
                     type="button"
                     onClick={() => setNewColor(color)}
                     className={`h-8 w-8 rounded-full transition-transform ${
                       newColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                     }`}
                     style={{ backgroundColor: color }}
                   />
                 ))}
               </div>
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
               Cancelar
             </Button>
             <Button onClick={handleCreate} disabled={submitting}>
               {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
               Criar Setor
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Edit Dialog */}
       <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Editar Setor</DialogTitle>
             <DialogDescription>
               Altere as informações do setor
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Nome do Setor</Label>
               <Input
                 value={newName}
                 onChange={(e) => setNewName(e.target.value)}
                 placeholder="Ex: Recursos Humanos"
               />
             </div>
             <div className="space-y-2">
               <Label className="flex items-center gap-2">
                 <Palette className="h-4 w-4" />
                 Cor do Setor
               </Label>
               <div className="flex flex-wrap gap-2">
                 {COLORS.map((color) => (
                   <button
                     key={color}
                     type="button"
                     onClick={() => setNewColor(color)}
                     className={`h-8 w-8 rounded-full transition-transform ${
                       newColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                     }`}
                     style={{ backgroundColor: color }}
                   />
                 ))}
               </div>
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowEditDialog(false)}>
               Cancelar
             </Button>
             <Button onClick={handleEdit} disabled={submitting}>
               {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
               Salvar
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Delete Confirmation */}
       <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle className="flex items-center gap-2 text-destructive">
               <AlertTriangle className="h-5 w-5" />
               Excluir Setor
             </AlertDialogTitle>
             <AlertDialogDescription>
               Tem certeza que deseja excluir o setor "{selectedSector?.name}"?
               <br />
               Esta ação não pode ser desfeita. Certifique-se de que não há usuários vinculados a este setor.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancelar</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleDelete}
               disabled={submitting}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
               Excluir
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </motion.div>
   );
 }