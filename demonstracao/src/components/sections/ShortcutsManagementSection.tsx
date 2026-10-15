import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Link, Pencil, Plus, Save, Trash2, Users, Building2, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getShortcutIcon } from '@/components/layout/SystemShortcutBar';

const ICON_OPTIONS = [
  { id: 'Link', label: 'Link' }, { id: 'ExternalLink', label: 'Externo' }, { id: 'Plus', label: 'Adicionar' }, { id: 'Pencil', label: 'Editar' },
];

type Shortcut = { id: string; name: string; url: string; icon: string; is_active: boolean };
type Profile = { id: string; name: string; display_name: string | null; email: string; sector_id: string | null };
type Sector = { id: string; name: string; color: string };

export function ShortcutsManagementSection() {
  const { profile, isAdmin } = useAuth();
  const { company } = useCompany();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://');
  const [icon, setIcon] = useState('Link');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const load = async () => {
    if (!profile?.id || !company?.id || !isAdmin) return;
    const [{ data: shortcutData }, { data: profileData }, { data: sectorData }] = await Promise.all([
      (supabase as any).from('system_shortcuts').select('id,name,url,icon,is_active').eq('company_id', company.id).order('created_at', { ascending: true }),
      (supabase as any).from('profiles').select('id,name,display_name,email,sector_id').eq('company_id', company.id).order('name'),
      (supabase as any).from('sectors').select('id,name,color').eq('company_id', company.id).order('name'),
    ]);
    setShortcuts(shortcutData || []); setProfiles(profileData || []); setSectors(sectorData || []);
  };

  useEffect(() => { void load(); }, [profile?.id, company?.id, isAdmin]);

  const resetForm = () => { setEditingId(null); setName(''); setUrl('https://'); setIcon('Link'); setSelectedUsers([]); setSelectedSectors([]); };

  const editShortcut = async (shortcut: Shortcut) => {
    setEditingId(shortcut.id); setName(shortcut.name); setUrl(shortcut.url); setIcon(shortcut.icon);
    const [{ data: users }, { data: sectorRows }] = await Promise.all([
      (supabase as any).from('system_shortcut_users').select('user_id').eq('shortcut_id', shortcut.id),
      (supabase as any).from('system_shortcut_sectors').select('sector_id').eq('shortcut_id', shortcut.id),
    ]);
    setSelectedUsers((users || []).map((x: any) => x.user_id)); setSelectedSectors((sectorRows || []).map((x: any) => x.sector_id));
  };

  const saveShortcut = async () => {
    if (!company?.id || !profile?.id) return;
    const cleanName = name.trim(); const cleanUrl = url.trim();
    if (!cleanName) return toast.error('Informe o nome do atalho.');
    if (!/^https?:\/\//i.test(cleanUrl)) return toast.error('O hiperlink deve começar com http:// ou https://.');
    if (selectedUsers.length === 0 && selectedSectors.length === 0) return toast.error('Selecione pelo menos um usuário ou setor com acesso.');
    setSaving(true);
    try {
      let shortcutId = editingId;
      if (editingId) {
        const { error } = await (supabase as any).from('system_shortcuts').update({ name: cleanName, url: cleanUrl, icon, is_active: true }).eq('id', editingId).eq('company_id', company.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from('system_shortcuts').insert({ company_id: company.id, name: cleanName, url: cleanUrl, icon, created_by: profile.id, is_active: true }).select('id').single();
        if (error) throw error;
        shortcutId = data.id;
      }
      await Promise.all([
        (supabase as any).from('system_shortcut_users').delete().eq('shortcut_id', shortcutId),
        (supabase as any).from('system_shortcut_sectors').delete().eq('shortcut_id', shortcutId),
      ]);
      if (selectedUsers.length) { const { error } = await (supabase as any).from('system_shortcut_users').insert(selectedUsers.map(userId => ({ shortcut_id: shortcutId, user_id: userId }))); if (error) throw error; }
      if (selectedSectors.length) { const { error } = await (supabase as any).from('system_shortcut_sectors').insert(selectedSectors.map(sectorId => ({ shortcut_id: shortcutId, sector_id: sectorId }))); if (error) throw error; }
      toast.success(editingId ? 'Atalho atualizado.' : 'Atalho criado.'); resetForm(); await load(); window.dispatchEvent(new CustomEvent('nuvexa:shortcuts-changed'));
    } catch (error) { console.error(error); toast.error('Não foi possível salvar o atalho.'); }
    finally { setSaving(false); }
  };

  const deleteShortcut = async (id: string) => {
    if (!confirm('Excluir este atalho?')) return;
    const { error } = await (supabase as any).from('system_shortcuts').delete().eq('id', id);
    if (error) return toast.error('Não foi possível excluir o atalho.');
    toast.success('Atalho excluído.'); await load(); window.dispatchEvent(new CustomEvent('nuvexa:shortcuts-changed'));
  };

  const toggle = (value: string, list: string[], setList: (next: string[]) => void) => setList(list.includes(value) ? list.filter(x => x !== value) : [...list, value]);
  const profileLabel = (p: Profile) => p.display_name || p.name;
  const filteredProfiles = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p => `${p.name} ${p.display_name ?? ''} ${p.email}`.toLowerCase().includes(q));
  }, [profiles, userSearch]);
  const accessSummary = useMemo(() => `${selectedUsers.length} usuário(s) • ${selectedSectors.length} setor(es)`, [selectedUsers.length, selectedSectors.length]);

  if (!isAdmin) return null;
  return <div className="space-y-6 p-4 md:p-6">
    <div><h2 className="text-2xl font-bold">Atalhos do sistema</h2><p className="mt-1 text-sm text-muted-foreground">Crie atalhos personalizados para sistemas externos e escolha quem poderá vê-los no cabeçalho da tela inicial do PC.</p></div>
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card className="rounded-2xl border-border/60"><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />{editingId ? 'Editar atalho' : 'Novo atalho'}</CardTitle></CardHeader><CardContent className="space-y-5">
        <div className="space-y-2"><Label>Nome do atalho</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Banco de Horas" maxLength={60} /></div>
        <div className="space-y-2"><Label>Hiperlink</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://sistema.empresa.com" /></div>
        <div className="space-y-2"><Label>Ícone</Label><div className="grid grid-cols-2 gap-2">{ICON_OPTIONS.map(option => { const Icon = getShortcutIcon(option.id); return <button type="button" key={option.id} onClick={() => setIcon(option.id)} className={cn('flex items-center gap-2 rounded-xl border p-2.5 text-sm transition-colors', icon === option.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted')}><Icon className="h-4 w-4" />{option.label}</button>; })}</div></div>
        <Separator />
        <div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Usuários com acesso</Label><button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedUsers(selectedUsers.length === filteredProfiles.length ? [] : filteredProfiles.map(p => p.id))}>{selectedUsers.length === filteredProfiles.length && filteredProfiles.length > 0 ? 'Limpar' : 'Selecionar todos'}</button></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Pesquisar por nome ou e-mail" className="h-10 rounded-xl pl-9" /></div><div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">{filteredProfiles.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nenhum usuário encontrado.</p>}{filteredProfiles.map(p => <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted"><Checkbox checked={selectedUsers.includes(p.id)} onCheckedChange={() => toggle(p.id, selectedUsers, setSelectedUsers)} /><span className="min-w-0 flex-1 truncate text-sm">{profileLabel(p)}</span><span className="text-[10px] text-muted-foreground">{p.email}</span></label>)}</div></div>
        <div className="space-y-2"><Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Setores com acesso</Label><div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">{sectors.map(s => <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-muted"><Checkbox checked={selectedSectors.includes(s.id)} onCheckedChange={() => toggle(s.id, selectedSectors, setSelectedSectors)} /><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} /><span className="text-sm">{s.name}</span></label>)}</div></div>
        <p className="text-xs text-muted-foreground">Acesso selecionado: {accessSummary}. Se um usuário estiver selecionado diretamente ou pertencer a um setor selecionado, ele verá o atalho.</p>
        <div className="flex gap-2"><Button className="flex-1 gap-2" onClick={saveShortcut} disabled={saving}><Save className="h-4 w-4" />{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar atalho'}</Button>{editingId && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}</div>
      </CardContent></Card>
      <Card className="rounded-2xl border-border/60"><CardHeader><CardTitle>Atalhos cadastrados</CardTitle></CardHeader><CardContent className="space-y-3">{shortcuts.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum atalho criado ainda.</div> : shortcuts.map(shortcut => { const Icon = getShortcutIcon(shortcut.icon); return <div key={shortcut.id} className="flex items-center gap-3 rounded-2xl border border-border/60 p-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{shortcut.name}</p><p className="truncate text-xs text-muted-foreground">{shortcut.url}</p><Badge variant="secondary" className="mt-1">{shortcut.is_active ? 'Ativo' : 'Inativo'}</Badge></div><Button variant="ghost" size="icon" onClick={() => void editShortcut(shortcut)} title="Editar"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => void deleteShortcut(shortcut.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button><Button variant="ghost" size="icon" asChild title="Abrir"><a href={shortcut.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button></div>; })}</CardContent></Card>
    </div>
  </div>;
}
