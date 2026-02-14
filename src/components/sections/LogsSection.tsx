import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Trash2,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface AuditLog {
  id: string;
  table_name: string;
  action: string;
  record_id: string | null;
  record_data: any;
  description: string | null;
  performed_by: string | null;
  performed_by_email: string | null;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  profiles: 'Perfis',
  messages: 'Mensagens',
  announcements: 'Avisos',
  direct_messages: 'Mensagens Diretas',
  tasks: 'Tarefas',
  sectors: 'Setores',
  task_boards: 'Quadros',
  private_groups: 'Grupos',
  important_announcements: 'Comunicados',
  user_roles: 'Cargos',
  user_permissions: 'Permissões',
  attachments: 'Anexos',
};

const ACTION_LABELS: Record<string, string> = {
  DELETE: 'Exclusão',
  INSERT: 'Criação',
  UPDATE: 'Atualização',
  SYSTEM: 'Sistema',
};

const ACTION_COLORS: Record<string, string> = {
  DELETE: 'bg-destructive/10 text-destructive',
  INSERT: 'bg-green-500/10 text-green-600',
  UPDATE: 'bg-blue-500/10 text-blue-600',
  SYSTEM: 'bg-yellow-500/10 text-yellow-600',
};

export function LogsSection() {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTable, setFilterTable] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.performed_by_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTable = filterTable === 'all' || log.table_name === filterTable;
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesTable && matchesAction;
  });

  const deleteAllLogs = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      setLogs([]);
      toast.success('Todos os logs foram excluídos');
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting logs:', error);
      toast.error('Erro ao excluir logs');
    } finally {
      setDeleting(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const data = filteredLogs.map((log) => ({
        'Data/Hora': format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
        'Ação': ACTION_LABELS[log.action] || log.action,
        'Tabela': TABLE_LABELS[log.table_name] || log.table_name,
        'Descrição': log.description || '-',
        'Executado por': log.performed_by_email || 'Sistema',
        'ID do Registro': log.record_id || '-',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Logs');
      XLSX.writeFile(wb, `logs_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
      toast.success('Relatório Excel exportado com sucesso');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Erro ao exportar Excel');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Count stats
      const totalLogs = filteredLogs.length;
      const deletions = filteredLogs.filter(l => l.action === 'DELETE').length;
      const insertions = filteredLogs.filter(l => l.action === 'INSERT').length;
      const updates = filteredLogs.filter(l => l.action === 'UPDATE').length;

      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || 'Desconhecido';

      // Try to get IP address
      let userIp = 'Indisponivel';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        userIp = ipData.ip || 'Indisponivel';
      } catch { /* ignore */ }

      const tableRows = filteredLogs.map((log) => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        ACTION_LABELS[log.action] || log.action,
        TABLE_LABELS[log.table_name] || log.table_name,
        (log.description || '-').substring(0, 60),
        log.performed_by_email || 'Sistema',
      ]);

      const headers = ['Data/Hora', 'Ação', 'Tabela', 'Descrição', 'Executado por'];

      let html = `<html><head><meta charset="utf-8"><title>Relatório de Logs do Sistema</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; background: #fff; color: #1a1a1a; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; border-bottom: 3px solid #3b82f6; padding-bottom: 16px; }
        .header h1 { font-size: 24px; margin: 0; color: #1e293b; }
        .header .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
        .meta-info { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 12px; color: #475569; display: flex; gap: 24px; flex-wrap: wrap; }
        .meta-info strong { color: #1e293b; }
        .stats { display: flex; gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center; }
        .stat-card .number { font-size: 24px; font-weight: 700; color: #3b82f6; }
        .stat-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 16px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th { background: #1e293b; color: white; padding: 12px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        tr:nth-child(even) { background: #f8fafc; }
        tr:last-child td { border-bottom: none; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 10px; text-align: center; }
        @media print { body { padding: 20px; } }
      </style></head><body>`;

      html += `<div class="header"><div><h1>📋 Logs do Sistema</h1><div class="subtitle">Relatório gerado em ${new Date().toLocaleString('pt-BR')}</div></div></div>`;
      html += `<div class="meta-info"><div><strong>Gerado por:</strong> ${userEmail}</div><div><strong>IP:</strong> ${userIp}</div><div><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</div></div>`;
      html += `<div class="stats">`;
      html += `<div class="stat-card"><div class="number">${totalLogs}</div><div class="label">Total de Registros</div></div>`;
      html += `<div class="stat-card"><div class="number" style="color:#ef4444">${deletions}</div><div class="label">Exclusões</div></div>`;
      html += `<div class="stat-card"><div class="number" style="color:#22c55e">${insertions}</div><div class="label">Criações</div></div>`;
      html += `<div class="stat-card"><div class="number" style="color:#3b82f6">${updates}</div><div class="label">Atualizações</div></div>`;
      html += `</div>`;

      html += '<table><thead><tr>';
      headers.forEach(h => { html += `<th>${h}</th>`; });
      html += '</tr></thead><tbody>';
      tableRows.forEach(row => {
        html += '<tr>';
        row.forEach(c => { html += `<td>${c || '-'}</td>`; });
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += `<div class="footer">Relatório gerado automaticamente pelo ServChat • ${new Date().toLocaleDateString('pt-BR')}</div></body></html>`;

      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
      toast.success('Relatório PDF gerado!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const uniqueTables = [...new Set(logs.map((l) => l.table_name))];

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4 md:space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Logs do Sistema
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''} encontrado{filteredLogs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting || filteredLogs.length === 0}>
                  <Download className="h-4 w-4 mr-1" />
                  Exportar
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileText className="h-4 w-4 mr-2" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF (.pdf)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar Logs
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterTable} onValueChange={setFilterTable}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tabelas</SelectItem>
                  {uniqueTables.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TABLE_LABELS[t] || t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="DELETE">Exclusão</SelectItem>
                  <SelectItem value="INSERT">Criação</SelectItem>
                  <SelectItem value="UPDATE">Atualização</SelectItem>
                  <SelectItem value="SYSTEM">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table / Cards */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">Nenhum log encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Os logs de exclusão aparecerão aqui automaticamente.
                </p>
              </div>
            ) : isMobile ? (
              <ScrollArea className="h-[calc(100vh-340px)]">
                <div className="space-y-2 p-3">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-border p-3 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex items-center justify-between">
                        <Badge className={ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground'}>
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {log.description || 'Sem descrição'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{TABLE_LABELS[log.table_name] || log.table_name}</span>
                        <span>{log.performed_by_email || 'Sistema'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="h-[calc(100vh-340px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Data/Hora</TableHead>
                      <TableHead className="w-[100px]">Ação</TableHead>
                      <TableHead className="w-[120px]">Tabela</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[180px]">Executado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground'}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {TABLE_LABELS[log.table_name] || log.table_name}
                        </TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate">
                          {log.description || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.performed_by_email || 'Sistema'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Limpar todos os logs
            </DialogTitle>
            <DialogDescription>
              Esta ação irá excluir permanentemente todos os {logs.length} registros de log.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteAllLogs} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir todos os logs'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">
                    {format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ação</p>
                  <Badge className={ACTION_COLORS[selectedLog.action]}>
                    {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Tabela</p>
                  <p className="font-medium">{TABLE_LABELS[selectedLog.table_name] || selectedLog.table_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Executado por</p>
                  <p className="font-medium">{selectedLog.performed_by_email || 'Sistema'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Descrição</p>
                <p className="text-sm font-medium">{selectedLog.description || '-'}</p>
              </div>
              {selectedLog.record_data && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Dados do registro</p>
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedLog.record_data, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
