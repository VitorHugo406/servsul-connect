import { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Loader2,
  Palette,
  Image as ImageIcon,
  ShieldAlert,
  Users,
  ShieldCheck,
  Save,
  UserPlus,
  BarChart3,
  Briefcase,
  FileSpreadsheet,
  ExternalLink,
  MessageSquare,
  Bell,
  ListTodo,
  Calendar as CalIcon,
  StickyNote,
  Cake,
  Award,
  Siren,
  Users2,
  LayoutDashboard,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface CompanyStats {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  is_system: boolean;
  enabled_modules: string[];
  total_users: number;
  active_users: number;
  admins: number;
  supervisors: number;
  colaboradores: number;
}

interface CompanyUser {
  profile_id: string;
  user_id: string;
  name: string;
  display_name: string | null;
  email: string;
  autonomy_level: string;
  is_active: boolean;
  roles: string[];
}

const MODULES: { id: string; label: string; icon: any; group: 'core' | 'shortcut' }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, group: 'core' },
  { id: 'announcements', label: 'Avisos', icon: Bell, group: 'core' },
  { id: 'tasks', label: 'Tarefas', icon: ListTodo, group: 'core' },
  { id: 'calendar', label: 'Calendário', icon: CalIcon, group: 'core' },
  { id: 'notes', label: 'Anotações', icon: StickyNote, group: 'core' },
  { id: 'birthdays', label: 'Aniversários', icon: Cake, group: 'core' },
  { id: 'evaluations', label: 'Avaliações', icon: Award, group: 'core' },
  { id: 'war_room', label: 'War Room', icon: Siren, group: 'core' },
  { id: 'teams', label: 'Equipes', icon: Users2, group: 'core' },
  { id: 'my_dashboard', label: 'Meu Painel', icon: LayoutDashboard, group: 'core' },
  { id: 'bi', label: 'Dash BI', icon: BarChart3, group: 'shortcut' },
  { id: 'bh', label: 'Banco de Horas', icon: Briefcase, group: 'shortcut' },
  { id: 'fechamento', label: 'Fechamento', icon: FileSpreadsheet, group: 'shortcut' },
  { id: 'orbs', label: 'Orbs', icon: ExternalLink, group: 'shortcut' },
];

export function CompaniesManagementSection() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.some((r: any) => (r.role as string) === 'super_admin');

  const [companies, setCompanies] = useState<CompanyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CompanyStats | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  // New company modal
  const [creating, setCreating] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [primary, setPrimary] = useState('#2E5AAC');
  const [secondary, setSecondary] = useState('#FF6B00');

  // New admin modal
  const [openNewAdmin, setOpenNewAdmin] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('list_companies_with_stats');
    if (error) {
      console.error('list_companies_with_stats error', error);
      toast.error('Erro ao carregar empresas: ' + error.message);
      setCompanies([]);
    } else if (data) {
      setCompanies((data as any[]).map((c) => ({ ...c, enabled_modules: c.enabled_modules ?? [] })) as CompanyStats[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!selected) {
      setUsers([]);
      return;
    }
    (async () => {
      setLoadingUsers(true);
      const { data, error } = await (supabase as any).rpc('list_company_users', {
        _company_id: selected.id,
      });
      if (!error && data) setUsers(data as CompanyUser[]);
      setLoadingUsers(false);
    })();
  }, [selected]);

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 mx-auto text-destructive" />
            <p className="text-lg font-semibold">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">
              Esta área é exclusiva do super-administrador do sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error('Nome e slug são obrigatórios');
      return;
    }
    setCreating(true);
    const { error } = await (supabase as any).from('companies').insert({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      primary_color: primary,
      secondary_color: secondary,
      is_active: true,
      is_system: false,
    });
    setCreating(false);
    if (error) {
      toast.error('Erro ao criar empresa: ' + error.message);
      return;
    }
    toast.success('Empresa criada');
    setName(''); setSlug(''); setPrimary('#2E5AAC'); setSecondary('#FF6B00');
    setOpenNew(false);
    load();
  };

  const toggleActive = async (c: CompanyStats) => {
    const { error } = await (supabase as any)
      .from('companies')
      .update({ is_active: !c.is_active })
      .eq('id', c.id);
    if (error) toast.error(error.message);
    else load();
  };

  const updateSelected = (patch: Partial<CompanyStats>) => {
    if (!selected) return;
    setSelected({ ...selected, ...patch });
  };

  const toggleModule = (mod: string) => {
    if (!selected) return;
    const has = selected.enabled_modules.includes(mod);
    const next = has
      ? selected.enabled_modules.filter((m) => m !== mod)
      : [...selected.enabled_modules, mod];
    updateSelected({ enabled_modules: next });
  };

  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('companies')
      .update({
        primary_color: selected.primary_color,
        secondary_color: selected.secondary_color,
        logo_url: selected.logo_url,
        enabled_modules: selected.enabled_modules,
      })
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Empresa atualizada');
    load();
  };

  const handleUploadLogo = async (file: File) => {
    if (!selected) return;
    const ext = file.name.split('.').pop() || 'png';
    const path = `${selected.slug}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('company-logos')
      .upload(path, file, { upsert: true });
    if (upErr) {
      toast.error('Erro no upload: ' + upErr.message);
      return;
    }
    const { data } = supabase.storage.from('company-logos').getPublicUrl(path);
    updateSelected({ logo_url: data.publicUrl });
    toast.success('Logo enviado — salve para aplicar');
  };

  const handleCreateAdmin = async () => {
    if (!selected) return;
    if (!adminName.trim() || !adminEmail.trim() || adminPassword.length < 6) {
      toast.error('Preencha todos os campos (senha ≥ 6 caracteres)');
      return;
    }
    setCreatingAdmin(true);
    const { data, error } = await supabase.functions.invoke('create-company-admin', {
      body: {
        company_id: selected.id,
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
        name: adminName.trim(),
      },
    });
    setCreatingAdmin(false);
    if (error || (data as any)?.error) {
      let details = (data as any)?.error || error?.message || 'Falha ao criar administrador';
      if (error instanceof FunctionsHttpError) {
        try {
          const body = await error.context.json();
          details = body?.error || details;
        } catch {
          // Keep the SDK fallback when the function did not return JSON.
        }
      }
      toast.error('Erro: ' + details);
      return;
    }
    toast.success('Admin criado com sucesso');
    setAdminName(''); setAdminEmail(''); setAdminPassword('');
    setOpenNewAdmin(false);
    load();
    // reload users
    const { data: u } = await (supabase as any).rpc('list_company_users', { _company_id: selected.id });
    if (u) setUsers(u as CompanyUser[]);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Empresas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Metadados, cores, módulos habilitados e administradores por empresa.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nova empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nuvexa" />
              </div>
              <div>
                <Label>Slug (identificador)</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="grupo-servsul" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1"><Palette className="w-3 h-3" /> Primária</Label>
                  <div className="flex gap-2">
                    <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-12 h-10 rounded border" />
                    <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Palette className="w-3 h-3" /> Secundária</Label>
                  <div className="flex gap-2">
                    <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="w-12 h-10 rounded border" />
                    <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} />
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar empresa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <Card key={c.id} className={`cursor-pointer hover:shadow-md transition ${c.is_active ? '' : 'opacity-60'}`} onClick={() => setSelected(c)}>
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white overflow-hidden"
                  style={{ background: `linear-gradient(140deg, ${c.primary_color}, ${c.secondary_color})` }}
                >
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{c.name}</CardTitle>
                  <p className="text-xs text-muted-foreground truncate">{c.slug}</p>
                </div>
                {c.is_system && (
                  <Badge variant="secondary" className="text-[10px] uppercase">Sistema</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 h-6 rounded" style={{ background: c.primary_color }} />
                  <div className="flex-1 h-6 rounded" style={{ background: c.secondary_color }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Ativos" value={c.active_users} />
                  <Stat label="Total" value={c.total_users} />
                  <Stat label="Admins" value={c.admins} />
                </div>
                {!c.is_system && (
                  <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm text-muted-foreground">Ativa</span>
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Company details dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                    style={{ background: `linear-gradient(140deg, ${selected.primary_color}, ${selected.secondary_color})` }}
                  >
                    {selected.logo_url ? (
                      <img src={selected.logo_url} alt={selected.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <div>{selected.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">{selected.slug}</div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="branding" className="mt-2">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="branding"><Palette className="w-4 h-4 mr-1.5" /> Marca</TabsTrigger>
                  <TabsTrigger value="modules"><ShieldCheck className="w-4 h-4 mr-1.5" /> Módulos</TabsTrigger>
                  <TabsTrigger value="users"><Users className="w-4 h-4 mr-1.5" /> Usuários</TabsTrigger>
                </TabsList>

                <TabsContent value="branding" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Cor primária</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={selected.primary_color}
                          onChange={(e) => updateSelected({ primary_color: e.target.value })}
                          className="w-12 h-10 rounded border"
                        />
                        <Input
                          value={selected.primary_color}
                          onChange={(e) => updateSelected({ primary_color: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Cor secundária</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={selected.secondary_color}
                          onChange={(e) => updateSelected({ secondary_color: e.target.value })}
                          className="w-12 h-10 rounded border"
                        />
                        <Input
                          value={selected.secondary_color}
                          onChange={(e) => updateSelected({ secondary_color: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Logo</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <div
                        className="w-16 h-16 rounded-xl overflow-hidden border flex items-center justify-center"
                        style={{ background: `linear-gradient(140deg, ${selected.primary_color}, ${selected.secondary_color})` }}
                      >
                        {selected.logo_url ? (
                          <img src={selected.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleUploadLogo(e.target.files[0])}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="modules" className="pt-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold mb-2">Módulos principais</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {MODULES.filter((m) => m.group === 'core').map((m) => {
                        const Icon = m.icon;
                        const enabled = selected.enabled_modules.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleModule(m.id)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition ${
                              enabled
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground'
                            }`}
                          >
                            <span className="flex items-center gap-2 text-sm">
                              <Icon className="w-4 h-4" /> {m.label}
                            </span>
                            <Switch checked={enabled} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">Atalhos externos</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {MODULES.filter((m) => m.group === 'shortcut').map((m) => {
                        const Icon = m.icon;
                        const enabled = selected.enabled_modules.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleModule(m.id)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition ${
                              enabled
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground'
                            }`}
                          >
                            <span className="flex items-center gap-2 text-sm">
                              <Icon className="w-4 h-4" /> {m.label}
                            </span>
                            <Switch checked={enabled} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="users" className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      {users.length} usuário{users.length === 1 ? '' : 's'}
                    </p>
                    {!selected.is_system && (
                      <Button size="sm" onClick={() => setOpenNewAdmin(true)}>
                        <UserPlus className="w-4 h-4 mr-1.5" /> Criar admin
                      </Button>
                    )}
                  </div>
                  {loadingUsers ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Nenhum usuário nesta empresa
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {users.map((u) => (
                        <div key={u.profile_id} className="flex items-center gap-3 p-2.5 rounded-lg border">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {u.display_name || u.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {u.roles.length > 0 ? (
                              u.roles.map((r) => (
                                <Badge key={r} variant={r === 'super_admin' ? 'default' : r === 'admin' ? 'secondary' : 'outline'} className="text-[10px]">
                                  {r}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-[10px]">{u.autonomy_level}</Badge>
                            )}
                            {!u.is_active && <Badge variant="destructive" className="text-[10px]">inativo</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
                <Button onClick={saveSelected} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar alterações
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New admin dialog */}
      <Dialog open={openNewAdmin} onOpenChange={setOpenNewAdmin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar admin da empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleCreateAdmin} disabled={creatingAdmin}>
              {creatingAdmin && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar admin
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 py-1.5">
      <p className="text-base font-bold leading-none">{value}</p>
      <p className="text-[10px] uppercase text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
