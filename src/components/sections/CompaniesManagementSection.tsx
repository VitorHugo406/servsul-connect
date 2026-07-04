import { useEffect, useState } from 'react';
import { Building2, Plus, Loader2, Palette, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  is_system: boolean;
}

export function CompaniesManagementSection() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.some((r: any) => (r.role as string) === 'super_admin');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  // New company form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [primary, setPrimary] = useState('#2E5AAC');
  const [secondary, setSecondary] = useState('#FF6B00');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('companies').select('*').order('name');
    if (!error && data) setCompanies(data as Company[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

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
    const { error } = await supabase.from('companies').insert({
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
    setName('');
    setSlug('');
    setPrimary('#2E5AAC');
    setSecondary('#FF6B00');
    setOpen(false);
    load();
  };

  const toggleActive = async (c: Company) => {
    const { error } = await supabase.from('companies').update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Empresas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie tenants do ServChat, cores de marca e status.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Nova empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova empresa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Grupo ServSul" />
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
            <Card key={c.id} className={c.is_active ? '' : 'opacity-60'}>
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
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-primary/10 text-primary">
                    Sistema
                  </span>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 h-6 rounded" style={{ background: c.primary_color }} />
                  <div className="flex-1 h-6 rounded" style={{ background: c.secondary_color }} />
                </div>
                {!c.is_system && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ativa</span>
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
