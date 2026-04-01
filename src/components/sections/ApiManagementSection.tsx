import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, Plus, Copy, Eye, EyeOff, RefreshCw, Trash2, Power, PowerOff, History, Shield, AlertTriangle, Check, X, Search, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface Integration {
  id: string;
  name: string;
  is_active: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

interface NewCredentials {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  api_token: string;
  is_active: boolean;
  created_at: string;
}

interface HistoryEntry {
  id: string;
  action: string;
  performed_by_name: string;
  details: string | null;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function apiCall(path: string, method = 'GET', body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/api-integrations?path=${encodeURIComponent(path)}`, {
    method,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return res.json();
}

export function ApiManagementSection() {
  const { isAdmin, profile } = useAuth();
  const isMobile = useIsMobile();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newIntegrationName, setNewIntegrationName] = useState('');
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(null);
  const [credentialsCopied, setCredentialsCopied] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/admin/integrations');
      if (result.status === 'success') {
        setIntegrations(result.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleCreate = async () => {
    if (!newIntegrationName.trim()) {
      toast.error('Informe um nome para a integração.');
      return;
    }
    setActionLoading('create');
    try {
      const result = await apiCall('/admin/integrations', 'POST', { name: newIntegrationName.trim() });
      if (result.status === 'success') {
        setNewCredentials(result.data);
        setShowCreateDialog(false);
        setShowCredentialsDialog(true);
        setNewIntegrationName('');
        fetchIntegrations();
        toast.success('Integração criada com sucesso!');
      } else {
        toast.error(result.message || 'Erro ao criar integração.');
      }
    } catch (e) {
      toast.error('Erro ao criar integração.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (id: string, activate: boolean) => {
    setActionLoading(id);
    try {
      const result = await apiCall(`/admin/integrations/${id}/${activate ? 'activate' : 'deactivate'}`, 'PATCH');
      if (result.status === 'success') {
        toast.success(activate ? 'Integração ativada.' : 'Integração desativada.');
        fetchIntegrations();
      }
    } catch (e) {
      toast.error('Erro ao alterar status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async (id: string) => {
    setActionLoading(id);
    try {
      const result = await apiCall(`/admin/integrations/${id}/regenerate`, 'PATCH');
      if (result.status === 'success') {
        setNewCredentials({
          id,
          name: integrations.find(i => i.id === id)?.name || '',
          base_url: result.data.base_url,
          api_key: result.data.api_key,
          api_token: result.data.api_token,
          is_active: true,
          created_at: new Date().toISOString(),
        });
        setShowCredentialsDialog(true);
        fetchIntegrations();
        toast.success('Credenciais regeneradas.');
      }
    } catch (e) {
      toast.error('Erro ao regenerar credenciais.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const result = await apiCall(`/admin/integrations/${id}`, 'DELETE');
      if (result.status === 'success') {
        toast.success('Integração excluída.');
        setShowDeleteConfirm(null);
        fetchIntegrations();
      }
    } catch (e) {
      toast.error('Erro ao excluir.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewHistory = async (id: string) => {
    setHistoryLoading(true);
    setShowHistoryDialog(true);
    try {
      const result = await apiCall(`/admin/integrations/${id}/history`);
      if (result.status === 'success') {
        setHistory(result.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCredentialsCopied(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setCredentialsCopied(prev => ({ ...prev, [key]: false })), 2000);
    toast.success('Copiado!');
  };

  const filteredIntegrations = integrations.filter(i => {
    if (filterStatus === 'active' && !i.is_active) return false;
    if (filterStatus === 'inactive' && i.is_active) return false;
    if (searchQuery && !i.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const actionLabels: Record<string, string> = {
    created: 'Criação',
    activated: 'Ativação',
    deactivated: 'Desativação',
    regenerated: 'Regeneração',
    deleted: 'Exclusão',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" />
            API de Integração
          </h3>
          <p className="text-muted-foreground text-sm mt-1">Gerencie integrações externas para acesso a métricas e dados do sistema</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Integração
        </Button>
      </div>

      {/* Security notice */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Shield className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">Aviso de Segurança</p>
            <p className="text-muted-foreground mt-1">
              As credenciais da API (Key e Token) são exibidas <strong>apenas uma vez</strong> no momento da criação.
              Copie e armazene-as em local seguro. Não será possível visualizá-las novamente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className={cn("flex gap-3", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar integração..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <Button key={s} variant={filterStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : 'Inativas'}
            </Button>
          ))}
        </div>
      </div>

      {/* Integrations List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredIntegrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Key className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h4 className="text-lg font-semibold text-foreground">Nenhuma integração encontrada</h4>
            <p className="text-muted-foreground mt-1 max-w-md">
              Crie uma nova integração para permitir que sistemas externos acessem métricas do ServChat.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredIntegrations.map(integration => (
            <Card key={integration.id} className={cn("transition-all", !integration.is_active && "opacity-60")}>
              <CardContent className={cn("flex items-center gap-4", isMobile ? "flex-col p-4" : "p-4")}>
                <div className={cn("flex items-center gap-3 flex-1 min-w-0", isMobile && "w-full")}>
                  <div className={cn("rounded-full p-2", integration.is_active ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground")}>
                    <Key className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{integration.name}</p>
                      <Badge variant={integration.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {integration.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Criado por {integration.created_by_name} em {new Date(integration.created_at).toLocaleDateString('pt-BR')}
                      {integration.last_used_at && ` • Último uso: ${new Date(integration.last_used_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                </div>

                <div className={cn("flex gap-1.5 flex-shrink-0", isMobile && "w-full justify-end")}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title={integration.is_active ? 'Desativar' : 'Ativar'}
                    disabled={actionLoading === integration.id}
                    onClick={() => handleToggle(integration.id, !integration.is_active)}
                  >
                    {integration.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Regenerar credenciais"
                    disabled={actionLoading === integration.id}
                    onClick={() => handleRegenerate(integration.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="Histórico"
                    onClick={() => handleViewHistory(integration.id)}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Excluir"
                    disabled={actionLoading === integration.id}
                    onClick={() => setShowDeleteConfirm(integration.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* API Docs quick reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Referência Rápida dos Endpoints
          </CardTitle>
          <CardDescription>Endpoints disponíveis para integrações ativas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['GET', '/metrics/general', 'Métricas gerais do sistema'],
                  ['GET', '/metrics/users', 'Métricas por usuário'],
                  ['GET', '/metrics/users/:id', 'Métricas de um usuário específico'],
                  ['GET', '/metrics/departments', 'Métricas por departamento'],
                  ['GET', '/metrics/departments/:id', 'Métricas de um departamento'],
                  ['GET', '/metrics/teams', 'Métricas por equipe'],
                  ['GET', '/metrics/teams/:id', 'Métricas de uma equipe'],
                  ['GET', '/tasks/summary', 'Resumo de tarefas'],
                  ['GET', '/messages/summary', 'Resumo de mensagens'],
                ].map(([method, path, desc]) => (
                  <TableRow key={path}>
                    <TableCell><Badge variant="outline" className="text-xs font-mono">{method}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{path}</TableCell>
                    <TableCell className="text-sm">{desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs space-y-1">
            <p className="font-medium">Headers obrigatórios:</p>
            <p className="font-mono">X-API-KEY: sua_api_key</p>
            <p className="font-mono">X-API-TOKEN: seu_api_token</p>
            <p className="mt-2 font-medium">Filtros disponíveis (query params):</p>
            <p className="font-mono">?start_date=2024-01-01&end_date=2024-12-31&status=completed</p>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Integração</DialogTitle>
            <DialogDescription>
              Crie uma nova integração para gerar credenciais de acesso à API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Integração</Label>
              <Input
                placeholder="Ex: Dashboard BI, Sistema ERP..."
                value={newIntegrationName}
                onChange={e => setNewIntegrationName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={actionLoading === 'create'} className="gap-2">
              {actionLoading === 'create' ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Key className="h-4 w-4" />}
              Gerar Integração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={(open) => { if (!open) { setShowCredentialsDialog(false); setNewCredentials(null); setCredentialsCopied({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Integração Criada
            </DialogTitle>
            <DialogDescription>
              <span className="text-destructive font-semibold">⚠️ ATENÇÃO:</span> Estas credenciais serão exibidas <strong>apenas agora</strong>. Copie e armazene em local seguro.
            </DialogDescription>
          </DialogHeader>
          {newCredentials && (
            <div className="space-y-3">
              {[
                { label: 'Nome', value: newCredentials.name, key: 'name' },
                { label: 'URL Base', value: newCredentials.base_url, key: 'url' },
                { label: 'API Key', value: newCredentials.api_key, key: 'apikey' },
                { label: 'API Token', value: newCredentials.api_token, key: 'token' },
              ].map(({ label, value, key }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <div className="flex gap-2">
                    <Input value={value} readOnly className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => copyToClipboard(value, key)}
                    >
                      {credentialsCopied[key] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                className="w-full mt-2"
                onClick={() => {
                  const all = `Nome: ${newCredentials.name}\nURL: ${newCredentials.base_url}\nAPI Key: ${newCredentials.api_key}\nAPI Token: ${newCredentials.api_token}`;
                  copyToClipboard(all, 'all');
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Tudo
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setShowCredentialsDialog(false); setNewCredentials(null); }}>
              Entendi, já copiei as credenciais
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Alterações
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum histórico encontrado.</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {history.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                    <div className="rounded-full p-1.5 bg-primary/10 text-primary mt-0.5">
                      <History className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          {actionLabels[entry.action] || entry.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{entry.performed_by_name}</span>
                      </div>
                      {entry.details && <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(entry.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Integração
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todas as credenciais serão invalidadas imediatamente e sistemas que usam esta integração perderão o acesso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)} disabled={actionLoading === showDeleteConfirm}>
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
