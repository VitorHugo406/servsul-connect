import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, UserPlus, UserMinus, ChevronDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeams, Team } from '@/hooks/useTeams';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TeamManagerProps {
  onTeamChange?: (team: Team | null) => void;
}

export function TeamManager({ onTeamChange }: TeamManagerProps) {
  const { user } = useAuth();
  const { teams, selectedTeam, selectedTeamId, setSelectedTeamId, createTeam, updateTeam, deleteTeam, addMember, removeMember, loading } = useTeams();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [searchMember, setSearchMember] = useState('');

  useEffect(() => {
    if (onTeamChange) onTeamChange(selectedTeam);
  }, [selectedTeam, onTeamChange]);

  const fetchAllProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, name, display_name, email, avatar_url').eq('is_active', true).order('name');
    setAllProfiles(data || []);
  };

  const handleCreate = async () => {
    if (!teamName.trim()) { toast.error('Informe o nome da equipe.'); return; }
    await createTeam(teamName.trim(), teamDesc.trim() || undefined);
    setTeamName('');
    setTeamDesc('');
    setShowCreateDialog(false);
  };

  const handleEdit = async () => {
    if (!selectedTeamId || !teamName.trim()) return;
    await updateTeam(selectedTeamId, { name: teamName.trim(), description: teamDesc.trim() || undefined });
    setShowEditDialog(false);
  };

  const handleDelete = async () => {
    if (!selectedTeamId) return;
    await deleteTeam(selectedTeamId);
    setShowDeleteConfirm(false);
  };

  const openEdit = () => {
    if (!selectedTeam) return;
    setTeamName(selectedTeam.name);
    setTeamDesc(selectedTeam.description || '');
    setShowEditDialog(true);
  };

  const openAddMember = () => {
    fetchAllProfiles();
    setSearchMember('');
    setShowAddMember(true);
  };

  const existingIds = new Set(selectedTeam?.members.map(m => m.profile_id) || []);
  const filteredProfiles = allProfiles.filter(p => {
    if (existingIds.has(p.id)) return false;
    const q = searchMember.toLowerCase();
    return !q || (p.display_name || p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Equipes
          </CardTitle>
          <div className="flex items-center gap-2">
            {teams.length > 0 && (
              <Select value={selectedTeamId || ''} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[200px] h-8 text-sm">
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" onClick={() => { setTeamName(''); setTeamDesc(''); setShowCreateDialog(true); }} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedTeam ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Crie uma equipe para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-foreground">{selectedTeam.name}</h4>
                {selectedTeam.description && <p className="text-xs text-muted-foreground">{selectedTeam.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openAddMember}><UserPlus className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <div className="space-y-1">
              {selectedTeam.members.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro. Adicione colaboradores à equipe.</p>
              ) : (
                selectedTeam.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={m.profile?.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{(m.profile?.display_name || m.profile?.name || '?')[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.profile?.display_name || m.profile?.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.profile?.email}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeMember(m.id)}>
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Equipe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Equipe</Label>
              <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ex: Equipe Comercial" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="Descrição da equipe" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Equipe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={teamName} onChange={e => setTeamName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Membro</DialogTitle></DialogHeader>
          <Input placeholder="Buscar por nome ou email..." value={searchMember} onChange={e => setSearchMember(e.target.value)} className="mb-2" />
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1">
              {filteredProfiles.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => { if (selectedTeamId) addMember(selectedTeamId, p.id); }}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={p.avatar_url || ''} />
                      <AvatarFallback className="text-xs">{(p.display_name || p.name || '?')[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{p.display_name || p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.email}</p>
                    </div>
                  </div>
                  <Plus className="h-4 w-4 text-primary" />
                </div>
              ))}
              {filteredProfiles.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum colaborador encontrado.</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-destructive">Excluir Equipe</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação é irreversível. Todos os membros serão removidos.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
