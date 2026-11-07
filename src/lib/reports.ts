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

const TONE: Record<Tone, [string, string]> = {
  good: ['#e9f9ef', '#15803d'], bad: ['#fdeceb', '#c2410c'], warn: ['#fff6e5', '#b45309'], info: ['#eaf2ff', '#1d4ed8'], neutral: ['#f1f2f5', '#3f3f46'],
};

function cell(c: Cell): string {
  if (c && typeof c === 'object') {
    const inner = `${c.strong ? '<b>' : ''}${esc(c.text)}${c.strong ? '</b>' : ''}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}`;
    if (!c.tone) return inner;
    const [bg, fg] = TONE[c.tone];
    return `<span class="pill" style="background:${bg};color:${fg}">${inner}</span>`;
  }
  return c === null || c === undefined || c === '' ? '<span class="mu">—</span>' : esc(c);
}

function block(b: ReportBlock): string {
  const title = 'title' in b && b.title ? `<h2>${esc(b.title)}</h2>` : '';
  switch (b.type) {
    case 'kpis':
      return `<div class="kpis">${b.items.map((k) => `<div class="kpi${k.tone ? ' t-' + k.tone : ''}"><span>${esc(k.label)}</span><b>${esc(k.value)}</b>${k.hint ? `<small>${esc(k.hint)}</small>` : ''}</div>`).join('')}</div>`;
    case 'badge': {
      const [bg, fg] = TONE[b.tone || 'neutral'];
      return `<div><span class="badge" style="background:${bg};color:${fg}">${esc(b.text)}</span></div>`;
    }
    case 'info':
      return `<section>${title}<div class="info">${b.items.filter((i) => i.value !== null && i.value !== undefined && i.value !== '').map((i) => `<div><span>${esc(i.label)}</span><b>${esc(i.value)}</b></div>`).join('')}</div></section>`;
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
        const fg = TONE[i.tone || 'neutral'][1];
        return `<div class="bar"><span>${esc(i.label)}</span><div><i style="width:${pct}%;background:${fg}"></i></div><b>${esc(i.value)}${esc(i.suffix || '')}</b></div>`;
      }).join('')}</div></section>`;
    case 'signatures':
      return `<section class="sign">${b.items.map((s) => `<div><i></i><span>${esc(s)}</span></div>`).join('')}</section>`;
    case 'empty':
      return `<p class="empty">${esc(b.text)}</p>`;
  }
}

export function renderReport(spec: ReportSpec): string {
  const brand = getCachedBrand();
  const company = brand?.name || 'ewvon';
  const accent = brand?.primary_color || '#0b0b0f';
  const now = new Date();
  const generated = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const logo = brand?.logo_url ? `<img src="${esc(brand.logo_url)}" alt="">` : `<span class="mono">${esc(company.charAt(0))}</span>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(spec.fileName || spec.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page { size: A4 ${spec.landscape ? 'landscape' : 'portrait'}; margin: 14mm 12mm 16mm; }
*{box-sizing:border-box} html,body{margin:0}
body{font-family:"Plus Jakarta Sans",Inter,system-ui,sans-serif;color:#0b0b0f;font-size:12px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
.page{max-width:${spec.landscape ? '1080px' : '820px'};margin:0 auto;padding:28px 8px 40px}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-radius:18px;background:#0b0b0f;color:#fff}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:13px}
.brand img{width:30px;height:30px;border-radius:9px;object-fit:contain;background:#fff}
.brand .mono{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:${esc(accent)};color:#fff;font-weight:800}
.top small{color:rgba(255,255,255,.6);font-size:11px}
.hero{padding:26px 4px 10px}
.eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#71717a}
h1{font-size:28px;letter-spacing:-.035em;line-height:1.1;margin:6px 0 6px;font-weight:800}
.sub{color:#52525b;font-size:13px;margin:0}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.meta span{padding:4px 10px;border-radius:999px;background:#f4f4f5;color:#3f3f46;font-size:11px;font-weight:600}
section{margin-top:22px;break-inside:avoid-page}
h2{font-size:13.5px;font-weight:800;letter-spacing:-.01em;margin:0 0 10px;display:flex;align-items:center;gap:8px}
h2::before{content:"";width:4px;height:14px;border-radius:2px;background:${esc(accent)}}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:18px}
.kpi{border:1px solid #e4e4e7;border-radius:16px;padding:12px 14px;background:#fafafa}
.kpi span{display:block;font-size:10.5px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.kpi b{display:block;font-size:24px;letter-spacing:-.03em;margin-top:2px}
.kpi small{color:#71717a;font-size:10.5px}
.kpi.t-good b{color:#15803d}.kpi.t-bad b{color:#c2410c}.kpi.t-warn b{color:#b45309}.kpi.t-info b{color:#1d4ed8}
.badge{display:inline-block;margin-top:14px;padding:6px 12px;border-radius:999px;font-weight:700;font-size:11.5px}
.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.info div{border:1px solid #ececef;border-radius:12px;padding:9px 12px}
.info span{display:block;font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.info b{font-size:12.5px}
table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden}
th{background:#f4f4f5;color:#3f3f46;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:9px 12px}
td{padding:9px 12px;border-top:1px solid #f0f0f2;vertical-align:top;font-size:11.5px}
tr:nth-child(even) td{background:#fcfcfd}
td small{display:block;color:#71717a;font-size:10.5px;margin-top:2px}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:700;font-size:10.5px}
.mu{color:#a1a1aa}
.text{white-space:pre-wrap;border:1px solid #ececef;border-radius:14px;padding:12px 14px;background:#fafafa}
.tl{list-style:none;margin:0;padding:0;border-left:2px solid #e4e4e7}
.tl li{position:relative;padding:0 0 10px 16px}
.tl li::before{content:"";position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid ${esc(accent)}}
.tl time{display:block;font-size:10.5px;color:#71717a;font-weight:600}
.ck{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ck li{display:flex;align-items:center;gap:8px}
.ck i{width:16px;height:16px;border-radius:5px;border:1.5px solid #d4d4d8;display:grid;place-items:center;font-style:normal;font-size:11px;font-weight:800;color:#fff}
.ck li.ok i{background:#15803d;border-color:#15803d}
.ck li.ok{color:#52525b;text-decoration:line-through}
.bars{display:grid;gap:8px}
.bar{display:grid;grid-template-columns:minmax(110px,30%) 1fr 64px;align-items:center;gap:10px}
.bar div{height:9px;border-radius:9px;background:#f0f0f2;overflow:hidden}
.bar i{display:block;height:100%;border-radius:9px}
.bar b{text-align:right}
.sign{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:40px;margin-top:56px}
.sign i{display:block;border-top:1px solid #a1a1aa;margin-bottom:6px}
.sign span{font-size:11px;color:#52525b}
.empty{color:#a1a1aa;text-align:center;padding:28px 0;font-size:13px}
.foot{margin-top:34px;padding-top:12px;border-top:1px solid #ececef;display:flex;justify-content:space-between;color:#a1a1aa;font-size:10px}
@media print{.page{padding:0}}
</style></head><body><div class="page">
<div class="top"><div class="brand">${logo}<span>${esc(company)}</span></div><small>Gerado em ${esc(generated)}</small></div>
<div class="hero"><div class="eyebrow">${esc(spec.eyebrow)}</div><h1>${esc(spec.title)}</h1>${spec.subtitle ? `<p class="sub">${esc(spec.subtitle)}</p>` : ''}${spec.meta?.length ? `<div class="meta">${spec.meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}</div>
${spec.blocks.map(block).join('\n')}
<div class="foot"><span>${esc(company)} · relatório gerado pelo ewvon</span><span>${esc(now.toLocaleDateString('pt-BR'))}</span></div>
</div><script>document.fonts&&document.fonts.ready.then(function(){setTimeout(function(){window.print()},250)});</script></body></html>`;
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
