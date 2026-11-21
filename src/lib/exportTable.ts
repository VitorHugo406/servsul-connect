// One export helper for every table screen: Excel (.xlsx, via the xlsx package, loaded only when used) or CSV
// (UTF-8 with BOM and ";" so Excel in Portuguese opens the columns correctly). Rows are plain arrays; dates/numbers
// should already be formatted the way the person reads them on screen.
export type Cell = string | number | boolean | null | undefined;
const clean = (name: string) => (name || 'exportacao').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-_ ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'exportacao';
const stamp = () => new Date().toISOString().slice(0, 10);

function download(blob: Blob, file: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = file; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportCsv(name: string, headers: string[], rows: Cell[][]) {
  const esc = (v: Cell) => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = '﻿' + [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  download(new Blob([text], { type: 'text/csv;charset=utf-8' }), `${clean(name)}-${stamp()}.csv`);
}

export async function exportXlsx(name: string, headers: string[], rows: Cell[][], sheet = 'Dados') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map((r) => r.map((v) => (v == null ? '' : v)))]);
  ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(60, Math.max(h.length, ...rows.slice(0, 200).map((r) => String(r[i] ?? '').length)) + 2) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${clean(name)}-${stamp()}.xlsx`);
}

/** Reads the first sheet of an .xlsx/.xls file as an array of rows (strings), for imports. */
export async function readSheet(file: File): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' }) as unknown[][];
  return rows.map((r) => r.map((c) => (c == null ? '' : String(c))));
}
