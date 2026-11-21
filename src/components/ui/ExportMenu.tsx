// "Exportar" button used on table screens: opens Excel (.xlsx) or CSV. `getData` is called only on click so the
// screen does not prepare rows it may never export.
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportCsv, exportXlsx, type Cell } from '@/lib/exportTable';

export type ExportData = { name: string; headers: string[]; rows: Cell[][]; sheet?: string };

export function ExportMenu({ getData, className, label = 'Exportar', disabled }: { getData: () => ExportData | Promise<ExportData>; className?: string; label?: string; disabled?: boolean }) {
  const run = async (kind: 'xlsx' | 'csv') => {
    try {
      const d = await getData();
      if (!d.rows.length) { toast.info('Não há linhas para exportar.'); return; }
      if (kind === 'xlsx') await exportXlsx(d.name, d.headers, d.rows, d.sheet); else exportCsv(d.name, d.headers, d.rows);
    } catch { toast.error('Não foi possível gerar o arquivo.'); }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={className || 'bvx-btn'} disabled={disabled} title="Exportar para Excel ou CSV" aria-label={label || 'Exportar'}><Download className="h-4 w-4" />{label}</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => void run('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run('csv')}>CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
