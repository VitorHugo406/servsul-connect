import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Database, RefreshCw, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'adminservchat@servsul.com.br';

// Free tier limits
const DB_LIMIT_MB = 500; // 500MB database
const STORAGE_LIMIT_MB = 1024; // 1GB storage

interface StorageInfo {
  dbSizeMb: number;
  storageSizeMb: number;
  tableStats: { name: string; rows: number }[];
  bucketStats: { name: string; count: number }[];
}

export function StorageMonitoringSection() {
  const { isAdmin, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<StorageInfo>({
    dbSizeMb: 0,
    storageSizeMb: 0,
    tableStats: [],
    bucketStats: [],
  });

  const isMainAdmin = isAdmin && profile?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (isMainAdmin) fetchStorageInfo();
  }, [isMainAdmin]);

  const fetchStorageInfo = async () => {
    setLoading(true);
    try {
      // Get row counts for main tables
      const tables = [
        'profiles', 'messages', 'direct_messages', 'private_group_messages',
        'announcements', 'attachments', 'tasks', 'audit_logs',
        'user_facial_data', 'task_boards', 'private_groups', 'sectors',
      ];

      const tableStats: { name: string; rows: number }[] = [];
      for (const table of tables) {
        const { count } = await supabase
          .from(table as any)
          .select('*', { count: 'exact', head: true });
        tableStats.push({ name: table, rows: count || 0 });
      }
      // Sort by rows desc
      tableStats.sort((a, b) => b.rows - a.rows);

      // Get bucket file counts
      const bucketNames = ['attachments', 'avatars', 'face-images'];
      const bucketStats: { name: string; count: number }[] = [];
      for (const bucket of bucketNames) {
        try {
          const { data } = await supabase.storage.from(bucket).list('', { limit: 1000 });
          bucketStats.push({ name: bucket, count: data?.length || 0 });
        } catch {
          bucketStats.push({ name: bucket, count: 0 });
        }
      }

      // Estimate DB size from row counts (rough approximation)
      const totalRows = tableStats.reduce((sum, t) => sum + t.rows, 0);
      // Average row ~0.5KB for typical tables
      const estimatedDbMb = Math.max((totalRows * 0.5) / 1024, 0.1);

      // Estimate storage size from attachment counts
      const totalFiles = bucketStats.reduce((sum, b) => sum + b.count, 0);
      // Average file ~200KB
      const estimatedStorageMb = Math.max((totalFiles * 200) / 1024, 0.01);

      setInfo({
        dbSizeMb: Math.round(estimatedDbMb * 100) / 100,
        storageSizeMb: Math.round(estimatedStorageMb * 100) / 100,
        tableStats,
        bucketStats,
      });
    } catch (error) {
      console.error('Error fetching storage info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isMainAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="font-display text-xl font-semibold text-foreground">Acesso Restrito</h3>
        <p className="mt-2 text-muted-foreground">
          Apenas o administrador principal pode acessar esta seção.
        </p>
      </div>
    );
  }

  const tableLabels: Record<string, string> = {
    profiles: 'Perfis de Usuários',
    messages: 'Mensagens de Setores',
    direct_messages: 'Mensagens Diretas',
    private_group_messages: 'Mensagens de Grupos',
    announcements: 'Avisos',
    attachments: 'Anexos',
    tasks: 'Tarefas',
    audit_logs: 'Logs de Auditoria',
    user_facial_data: 'Dados Faciais',
    task_boards: 'Quadros de Tarefas',
    private_groups: 'Grupos Privados',
    sectors: 'Setores',
  };

  const dbPercent = Math.min((info.dbSizeMb / DB_LIMIT_MB) * 100, 100);
  const storagePercent = Math.min((info.storageSizeMb / STORAGE_LIMIT_MB) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <HardDrive className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Armazenamento
            </h2>
            <p className="text-muted-foreground">
              Monitoramento do uso do banco de dados
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStorageInfo} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Usage Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Banco de Dados</CardTitle>
            </div>
            <CardDescription>Estimativa de uso do banco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uso estimado</span>
              <span className="font-semibold">{info.dbSizeMb} MB / {DB_LIMIT_MB} MB</span>
            </div>
            <Progress value={dbPercent} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {dbPercent < 50 ? '✅ Uso normal' : dbPercent < 80 ? '⚠️ Atenção - uso moderado' : '🔴 Uso alto - considere limpar dados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Armazenamento de Arquivos</CardTitle>
            </div>
            <CardDescription>Estimativa de uso do storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uso estimado</span>
              <span className="font-semibold">{info.storageSizeMb} MB / {STORAGE_LIMIT_MB} MB</span>
            </div>
            <Progress value={storagePercent} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {storagePercent < 50 ? '✅ Uso normal' : storagePercent < 80 ? '⚠️ Atenção - uso moderado' : '🔴 Uso alto - considere limpar arquivos'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Tabela</CardTitle>
          <CardDescription>Quantidade de registros em cada tabela</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {info.tableStats.map((table) => {
              const label = tableLabels[table.name] || table.name;
              const maxRows = Math.max(...info.tableStats.map(t => t.rows), 1);
              const pct = (table.rows / maxRows) * 100;
              return (
                <div key={table.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{label}</span>
                    <span className="text-muted-foreground font-mono">{table.rows.toLocaleString()} registros</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bucket Details */}
      <Card>
        <CardHeader>
          <CardTitle>Buckets de Armazenamento</CardTitle>
          <CardDescription>Arquivos armazenados por bucket</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {info.bucketStats.map((bucket) => (
              <div key={bucket.name} className="rounded-xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-primary">{bucket.count}</p>
                <p className="text-sm text-muted-foreground capitalize">{bucket.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
