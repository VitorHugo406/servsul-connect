import { useState } from 'react';
import { Megaphone, Loader2, Trash2, Power, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemBroadcasts } from '@/hooks/useSystemBroadcasts';
import { toast } from 'sonner';

export function SystemBroadcastsSection() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.some((r: any) => (r.role as string) === 'super_admin');
  const { broadcasts, loading, createBroadcast, setActive, removeBroadcast } = useSystemBroadcasts();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [severity, setSeverity] = useState('info');
  const [saving, setSaving] = useState(false);

  if (!isSuperAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="font-display text-xl font-semibold text-foreground">Acesso Restrito</h3>
        <p className="mt-2 text-muted-foreground">Somente o super administrador pode emitir comunicados globais.</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha título e mensagem.');
      return;
    }
    setSaving(true);
    const { error } = await createBroadcast({ title: title.trim(), content: content.trim(), severity });
    setSaving(false);
    if (error) {
      toast.error('Não foi possível publicar o comunicado.');
      return;
    }
    setTitle('');
    setContent('');
    toast.success('Comunicado global publicado para todas as empresas.');
  };

  const severityLabel: Record<string, string> = {
    info: 'Informativo',
    warning: 'Atenção',
    critical: 'Crítico',
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Megaphone className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Comunicados Globais</h2>
          <p className="text-muted-foreground">Avisos exibidos para todos os usuários de todas as empresas</p>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Novo comunicado</CardTitle>
          <CardDescription>Use para quedas, manutenções e atualizações do sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input className="rounded-xl" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea className="rounded-xl" rows={4} placeholder="Mensagem" value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-full rounded-xl sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Informativo</SelectItem>
                <SelectItem value="warning">Atenção</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleCreate} disabled={saving} className="gap-2 sm:ml-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              Publicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Comunicados publicados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full rounded-2xl glass-shimmer" />
              <Skeleton className="h-20 w-full rounded-2xl glass-shimmer" />
            </>
          ) : broadcasts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum comunicado global publicado.</p>
          ) : (
            broadcasts.map((b) => (
              <div key={b.id} className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{b.title}</p>
                    <Badge variant={b.severity === 'critical' ? 'destructive' : 'secondary'}>{severityLabel[b.severity] || b.severity}</Badge>
                    {!b.is_active && <Badge variant="outline">Inativo</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{b.content}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setActive(b.id, !b.is_active)}>
                    <Power className="h-3.5 w-3.5" />
                    {b.is_active ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => removeBroadcast(b.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
