import React, { useState } from 'react';
import { Bot, Clock, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useScheduledSummaries, SUMMARY_METRICS, WEEKDAYS, type ScheduledSummary } from '@/hooks/useScheduledSummaries';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ScheduledSummaryConfigProps {
  targetType: 'group' | 'sector';
  targetId: string;
  targetName: string;
}

export function ScheduledSummaryConfig({ targetType, targetId, targetName }: ScheduledSummaryConfigProps) {
  const { summaries, loading, createSummary, deleteSummary, toggleSummary } = useScheduledSummaries(targetType, targetId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [frequency, setFrequency] = useState<string>('daily');
  const [sendTime, setSendTime] = useState('08:00');
  const [weekday, setWeekday] = useState<number>(1);
  const [monthDay, setMonthDay] = useState<number>(1);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [format, setFormat] = useState<string>('visual');
  const [creating, setCreating] = useState(false);

  const resetForm = () => {
    setFrequency('daily');
    setSendTime('08:00');
    setWeekday(1);
    setMonthDay(1);
    setSelectedMetrics([]);
    setFormat('visual');
  };

  const handleCreate = async () => {
    if (selectedMetrics.length === 0) {
      toast.error('Selecione ao menos uma métrica');
      return;
    }
    setCreating(true);
    const { error } = await createSummary({
      frequency,
      send_time: sendTime,
      weekday: frequency === 'weekly' ? weekday : undefined,
      month_day: frequency === 'monthly' ? monthDay : undefined,
      metrics: selectedMetrics,
      format,
    });
    setCreating(false);
    if (error) {
      toast.error('Erro ao criar automação');
    } else {
      toast.success('Automação criada com sucesso!');
      setShowCreateDialog(false);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await deleteSummary(deleteId);
    if (error) toast.error('Erro ao excluir');
    else toast.success('Automação excluída');
    setDeleteId(null);
  };

  const handleToggle = async (s: ScheduledSummary) => {
    const { error } = await toggleSummary(s.id, !s.is_active);
    if (error) toast.error('Erro ao atualizar');
  };

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metricId) ? prev.filter(m => m !== metricId) : [...prev, metricId]
    );
  };

  const getFrequencyLabel = (s: ScheduledSummary) => {
    if (s.frequency === 'daily') return `Diário às ${s.send_time}`;
    if (s.frequency === 'weekly') return `Semanal - ${WEEKDAYS.find(w => w.value === s.weekday)?.label || ''} às ${s.send_time}`;
    if (s.frequency === 'monthly') return `Mensal - Dia ${s.month_day} às ${s.send_time}`;
    return s.frequency;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-sm">Resumos Automáticos</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { resetForm(); setShowCreateDialog(true); }}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova
        </Button>
      </div>

      {summaries.length === 0 && !loading && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma automação configurada</p>
          <p className="text-xs mt-1">Crie uma para enviar resumos automaticamente</p>
        </div>
      )}

      <div className="space-y-2">
        {summaries.map(s => (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-colors",
              s.is_active ? "bg-card border-border" : "bg-muted/50 border-dashed opacity-60"
            )}
          >
            <div className="flex-shrink-0">
              <Zap className={cn("h-4 w-4", s.is_active ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{getFrequencyLabel(s)}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(s.metrics as string[]).map(m => {
                  const metric = SUMMARY_METRICS.find(sm => sm.id === m);
                  return metric ? (
                    <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {metric.icon} {metric.label.split(' ').slice(0, 2).join(' ')}
                    </Badge>
                  ) : null;
                })}
              </div>
              <Badge variant="outline" className="mt-1 text-[10px]">
                {s.format === 'visual' ? '📊 Visual' : '📝 Texto'}
              </Badge>
            </div>
            <Switch checked={s.is_active} onCheckedChange={() => handleToggle(s)} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteId(s.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Nova Automação de Resumo
            </DialogTitle>
            <DialogDescription>
              Configure o envio automático de resumo da equipe para "{targetName}"
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-5 pr-4">
              {/* Frequency */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Frequência</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Horário (Brasília)
                </Label>
                <Input
                  type="time"
                  value={sendTime}
                  onChange={e => setSendTime(e.target.value)}
                />
              </div>

              {/* Weekday for weekly */}
              {frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Dia da Semana</Label>
                  <Select value={String(weekday)} onValueChange={v => setWeekday(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map(w => (
                        <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Month day for monthly */}
              {frequency === 'monthly' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Dia do Mês</Label>
                  <Select value={String(monthDay)} onValueChange={v => setMonthDay(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              {/* Metrics */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Métricas do Resumo</Label>
                <p className="text-xs text-muted-foreground">Selecione as informações que deseja incluir</p>
                {SUMMARY_METRICS.map(metric => (
                  <div
                    key={metric.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedMetrics.includes(metric.id)
                        ? "bg-primary/5 border-primary/30"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleMetric(metric.id)}
                  >
                    <Checkbox
                      checked={selectedMetrics.includes(metric.id)}
                      onCheckedChange={() => toggleMetric(metric.id)}
                    />
                    <span className="text-base">{metric.icon}</span>
                    <span className="text-sm">{metric.label}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Format */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Formato da Mensagem</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visual">📊 Tabela visual estilizada</SelectItem>
                    <SelectItem value="text">📝 Texto formatado simples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || selectedMetrics.length === 0} className="gap-1.5">
              {creating ? 'Criando...' : (
                <>
                  <Zap className="h-4 w-4" />
                  Criar Automação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Automação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta automação de resumo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
