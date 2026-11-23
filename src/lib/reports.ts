// Shared printable report template (Ewwon visual). Every report in the system
// (task board, task completion, calendar day, logs, evaluations…) is described
// as blocks and rendered here, so they all look the same. All text is escaped.
import { getCachedBrand } from '@/lib/branding';

export type Tone = 'good' | 'bad' | 'warn' | 'info' | 'neutral';
export type Cell = string | number | null | undefined | { text: string | number; tone?: Tone; strong?: boolean; sub?: string };

export type ReportBlock =
  | { type: 'kpis'; items: { label: string; value: string | number; tone?: Tone; hint?: string }[] }
  | { type: 'badge'; text: string; tone?: Tone }
  | { type: 'info'; title?: string; items: { label: string; value: string | number | null | undefined }[] }
  | { type: 'table'; title?: string; headers: string[]; rows: Cell[][]; empty?: string; widths?: string[] }
  | { type: 'text'; title?: string; body: string }
  | { type: 'timeline'; title?: string; items: { time: string; title?: string; text: string }[] }
  | { type: 'checklist'; title?: string; items: { done: boolean; text: string }[] }
  | { type: 'bars'; title?: string; items: { label: string; value: number; max?: number; suffix?: string; tone?: Tone }[] }
  | { type: 'signatures'; items: string[] }
  | { type: 'empty'; text: string };

export interface ReportSpec {
  eyebrow: string;
  title: string;
  subtitle?: string;
  meta?: string[];
  blocks: ReportBlock[];
  landscape?: boolean;
  fileName?: string;
}

export const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// [background, text, border] — the status-pill colours of the design reports.
const TONE: Record<Tone, [string, string, string]> = {
  good: ['#E9F7EE', '#0A6B3D', '#A8D8BC'], bad: ['#FFF1E6', '#9A3412', '#F0B48A'], warn: ['#FEF5E4', '#7A4300', '#F2CF8E'], info: ['#EDF3FD', '#164A8F', '#A9C0E8'], neutral: ['#F0F2F5', '#303A48', '#B9C0CB'],
};

function cell(c: Cell): string {
  if (c && typeof c === 'object') {
    const inner = `${c.strong ? '<b>' : ''}${esc(c.text)}${c.strong ? '</b>' : ''}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}`;
    if (!c.tone) return inner;
    const [bg, fg, bd] = TONE[c.tone];
    return `<span class="pill" style="color:${fg};border-color:${bd};background:${bg}">${inner}</span>`;
  }
  return c === null || c === undefined || c === '' ? '<span class="mu">—</span>' : esc(c);
}

function block(b: ReportBlock): string {
  const title = 'title' in b && b.title ? `<h3>${esc(b.title)}</h3>` : '';
  switch (b.type) {
    case 'kpis':
      return `<section class="kp">${b.items.map((k) => `<div class="k${k.tone ? ' t-' + k.tone : ''}"><div class="l">${esc(k.label)}</div><div class="v">${esc(k.value)}</div>${k.hint ? `<div class="d">${esc(k.hint)}</div>` : ''}</div>`).join('')}</section>`;
    case 'badge': {
      const fg = TONE[b.tone || 'neutral'][1];
      return `<span class="badge" style="color:${fg};border-color:${TONE[b.tone || 'neutral'][2]};background:${TONE[b.tone || 'neutral'][0]}">${esc(b.text)}</span>`;
    }
    case 'info':
      return `<section>${title}<div class="gi">${b.items.filter((i) => i.value !== null && i.value !== undefined && i.value !== '').map((i) => `<div><span>${esc(i.label)}</span><b>${esc(i.value)}</b></div>`).join('')}</div></section>`;
    case 'table':
      return `<section>${title}${b.rows.length ? `<table>${b.widths ? `<colgroup>${b.widths.map((w) => `<col style="width:${w}">`).join('')}</colgroup>` : ''}<thead><tr>${b.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<p class="empty">${esc(b.empty || 'Nada para mostrar.')}</p>`}</section>`;
    case 'text':
      return `<section>${title}<div class="text">${esc(b.body)}</div></section>`;
    case 'timeline':
      return `<section>${title}<ol class="tl">${b.items.map((i) => `<li><time>${esc(i.time)}</time><div>${i.title ? `<b>${esc(i.title)}</b> ` : ''}${esc(i.text)}</div></li>`).join('')}</ol></section>`;
    case 'checklist':
      return `<section>${title}<ul class="ck">${b.items.map((i) => `<li class="${i.done ? 'ok' : ''}"><i>${i.done ? '✓' : ''}</i>${esc(i.text)}</li>`).join('')}</ul></section>`;
    case 'bars':
      return `<section>${title}<div class="bars">${b.items.map((i) => {
        const max = i.max || Math.max(...b.items.map((x) => x.value), 1);
        const pct = Math.max(2, Math.min(100, (i.value / max) * 100));
        const fg = i.tone ? TONE[i.tone][1] : '#1B2340';
        return `<div class="bar"><span>${esc(i.label)}</span><div><i style="width:${pct}%;background:${fg}"></i></div><b>${esc(i.value)}${esc(i.suffix || '')}</b></div>`;
      }).join('')}</div></section>`;
    case 'signatures':
      return `<section class="sign">${b.items.map((s) => `<div><i></i><span>${esc(s)}</span></div>`).join('')}</section>`;
    case 'empty':
      return `<p class="empty">${esc(b.text)}</p>`;
  }
}

export function renderReport(spec: ReportSpec): string {
  // Same visual standard as the design reports (designReports.ts: Relatório do dia / conclusão de tarefa): IBM Plex
  // Sans, full ewvon logo on the left, navy rule, KPI strip with dividers, uppercase section titles and a footer.
  const brand = getCachedBrand();
  const company = brand?.name || '';
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const generated = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const origin = typeof location !== 'undefined' ? location.origin : '';
  const W = spec.landscape ? 1123 : 794, H = spec.landscape ? 794 : 1123;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(spec.fileName || spec.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0}body{background:#EDEFF2}
.pg{font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:12.5px;line-height:1.5;color:#1C2430;background:#fff;width:${W}px;min-height:${H}px;padding:44px 44px 34px;display:flex;flex-direction:column;gap:20px;margin:0 auto}
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding-bottom:16px;border-bottom:2px solid #1B2340}
.br img{display:block;height:26px;width:auto}
.br small{display:block;font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#4A5563;margin-top:8px}
.rt{text-align:right}
.rt span{display:block;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4A5563}
.rt b{display:block;font-size:15px;font-weight:600;color:#1B2340;margin-top:3px}
.ti{display:flex;flex-direction:column;gap:8px}
.ti .ey{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#4A5563}
.ti h1{margin:0;font-size:26px;font-weight:600;letter-spacing:-.01em;color:#1B2340;line-height:1.2}
.ti p{margin:0;color:#3C4756}
.meta{display:flex;flex-wrap:wrap;gap:6px}
.meta span{padding:2px 10px;border-radius:999px;border:1px solid #C5CBD5;background:#F0F2F5;color:#303A48;font-size:11px;font-weight:600}
.kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));border-top:1px solid #D3D8E0;border-bottom:1px solid #D3D8E0}
.k{padding:14px 16px;border-right:1px solid #E3E6EB}
.k:first-child{padding-left:0}.k:last-child{border-right:0}
.k .l{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#4A5563}
.k .v{font-size:28px;font-weight:600;margin-top:6px;font-variant-numeric:tabular-nums;color:#1B2340;line-height:1}
.k .d{margin-top:6px;font-size:11.5px;color:#4A5563}
.k.t-good .v{color:#0A6B3D}.k.t-bad .v{color:#B93A0E}.k.t-warn .v{color:#8A4B00}.k.t-info .v{color:#164A8F}
.badge{align-self:flex-start;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;border-radius:999px;padding:4px 12px;border:1px solid}
.badge::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
section{break-inside:avoid-page}
h3{margin:0 0 8px;font-size:12.5px;font-weight:600;color:#1B2340;text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid #1B2340}
.gi{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #C5CBD5}
.gi>div{padding:10px 14px;border-right:1px solid #C5CBD5;border-bottom:1px solid #C5CBD5;margin-bottom:-1px;margin-right:-1px}
.gi span{display:block;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4A5563;margin-bottom:3px}
.gi b{font-weight:600;color:#1B2340}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#4A5563;padding:6px 8px;border-bottom:1px solid #1B2340}
td{padding:9px 8px;border-bottom:1px solid #E3E6EB;vertical-align:top;font-variant-numeric:tabular-nums}
td b{font-weight:600}
thead{display:table-header-group}tr{break-inside:avoid}
td small{display:block;color:#4A5563;font-size:11px;margin-top:1px}
.pill{display:inline-block;font-size:11px;font-weight:600;border-radius:999px;border:1px solid;padding:2px 9px;white-space:nowrap}
.mu{color:#8A93A0}
.text{white-space:pre-wrap;color:#3C4756;line-height:1.55}
.tl{list-style:none;margin:0;padding:0}
.tl li{display:grid;grid-template-columns:140px 1fr;gap:12px;padding:7px 0;border-bottom:1px solid #E3E6EB}
.tl time{color:#4A5563;font-size:11.5px;font-variant-numeric:tabular-nums}
.tl b{font-weight:600}
.ck{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ck li{display:flex;align-items:center;gap:8px}
.ck i{width:15px;height:15px;border:1.5px solid #6B7482;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:10px;font-weight:700;color:#fff;flex:none}
.ck li.ok i{background:#0A6B3D;border-color:#0A6B3D}
.ck li.ok{color:#4A5563}
.bars{display:grid;gap:9px}
.bar{display:grid;grid-template-columns:minmax(110px,30%) 1fr 64px;align-items:center;gap:12px}
.bar div{height:9px;border-radius:5px;background:#E4E7EC;overflow:hidden}
.bar i{display:block;height:100%;border-radius:5px}
.bar b{text-align:right;font-weight:600;color:#1B2340;font-variant-numeric:tabular-nums}
.sign{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:40px;margin-top:30px}
.sign i{display:block;border-top:1px solid #1C2430;margin-bottom:5px}
.sign span{font-size:11px;color:#4A5563}
.empty{color:#4A5563;padding:10px 0 4px}
.ft{margin-top:auto;padding-top:10px;border-top:1px solid #D3D8E0;display:flex;justify-content:space-between;gap:16px;font-size:10.5px;color:#5A6472}
@page{size:A4 ${spec.landscape ? 'landscape' : 'portrait'};margin:0}
@media print{body{background:#fff}.pg{margin:0;width:${spec.landscape ? '297mm' : '210mm'};min-height:${spec.landscape ? '210mm' : '297mm'}}}
</style></head><body><div class="pg">
<header class="hd"><div class="br"><img src="${esc(origin)}/ewwon/img/receipt-logo.png" alt="ewvon">${company ? `<small>${esc(company)}</small>` : ''}</div><div class="rt"><span>${esc(spec.eyebrow)}</span><b>${esc(generated)}</b></div></header>
<section class="ti"><div class="ey">${esc(spec.eyebrow)}</div><h1>${esc(spec.title)}</h1>${spec.subtitle ? `<p>${esc(spec.subtitle)}</p>` : ''}${spec.meta?.length ? `<div class="meta">${spec.meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}</section>
${spec.blocks.map(block).join('\n')}
<footer class="ft"><span>${company ? esc(company) + ' · ' : ''}relatório gerado automaticamente pelo ewvon em ${esc(generated)}</span><span>© ${now.getFullYear()} ewvon</span></footer>
</div><script>(function(){var imgs=[].slice.call(document.images).map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r})});
Promise.all([document.fonts?document.fonts.ready:0].concat(imgs)).then(function(){setTimeout(function(){window.print()},300)});})();</script></body></html>`;
}

/** Opens the report in a new tab and starts printing (user saves as PDF). */
export function openReport(spec: ReportSpec): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(renderReport(spec));
  w.document.close();
  return true;
}

export const priorityLabel = (p?: string | null) => (p === 'urgent' ? 'Urgente' : p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : p === 'low' ? 'Baixa' : '—');
export const priorityTone = (p?: string | null): Tone => (p === 'urgent' ? 'bad' : p === 'high' ? 'warn' : p === 'medium' ? 'info' : 'neutral');
