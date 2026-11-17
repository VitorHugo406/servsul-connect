// A4 reports ported from the owner's design "Tela_de_Avisos_11": "Relatório do dia" (Calendário) and
// "Relatório de conclusão de tarefa" (card). Same markup/CSS as the design; the "ewvon" text is replaced by the full
// logo image and the avatars use real profile photos when there is one. Opened in a new tab that starts printing
// (the person saves it as PDF), like the other reports.

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const ini = (n: string) => (n || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const pad = (n: number) => String(n).padStart(2, '0');
const dt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dts = (d: Date) => `${dt(d)}, ${hm(d)}:${pad(d.getSeconds())}`;
const genAt = (d: Date) => `${dt(d)} às ${hm(d)}`;
const logoUrl = () => `${location.origin}/ewwon/img/receipt-logo.png`;
const avatar = (cls: string, name: string, url?: string | null) =>
  `<div class="${cls}">${url ? `<img src="${esc(url)}" alt="" onerror="this.remove()">` : ''}<span>${esc(ini(name))}</span></div>`;

const BASE = `body{margin:0;background:#EDEFF2}
.pg{font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:12.5px;color:#1C2430;background:#fff;width:794px;min-height:1123px;box-sizing:border-box;padding:44px 44px 34px;display:flex;flex-direction:column;gap:20px;margin:0 auto}
.hd{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:16px;border-bottom:2px solid #1B2340}
.br{font-size:28px;font-weight:700;letter-spacing:-.03em;color:#1B2340;line-height:1}
.br img{display:block;height:26px;width:auto}
.br small{display:block;font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#4A5563;margin-top:8px}
.rt{text-align:right}
.rt span{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4A5563}
.kp{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #D3D8E0;border-bottom:1px solid #D3D8E0}
.k{padding:14px 16px;border-right:1px solid #E3E6EB}
.k:first-child{padding-left:0}.k:last-child{border-right:0}
.k .l{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#4A5563}
.k .v small{font-size:15px;font-weight:500;color:#4A5563}
table{width:100%;border-collapse:collapse}
td{padding:9px 8px;border-bottom:1px solid #E3E6EB;font-variant-numeric:tabular-nums}
thead{display:table-header-group}tr{break-inside:avoid}
.av{position:relative;overflow:hidden}
.av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%}
.ft{margin-top:auto;padding-top:10px;border-top:1px solid #D3D8E0;display:flex;justify-content:space-between;font-size:10.5px;color:#5A6472}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:0}
@media print{body{background:#fff}.pg{margin:0;width:210mm;min-height:297mm}}`;

function open(title: string, css: string, body: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${BASE}\n${css}</style></head><body>${body}
<script>(function(){var imgs=[].slice.call(document.images).map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r})});
Promise.all([document.fonts?document.fonts.ready:0].concat(imgs)).then(function(){setTimeout(function(){window.print()},300)});})();</script></body></html>`);
  w.document.close();
  return true;
}

/* ------------------------------------------------------------------ Relatório do dia ------------------------------ */
export interface DayEvent { start: Date; end: Date | null; allDay: boolean; title: string; sub?: string; people: number }
export interface DayTask { title: string; sub?: string; owner: string; priority: string | null; done: boolean; doing: boolean }
export interface DayReport { date: Date; person: { name: string; avatar?: string | null }; events: DayEvent[]; tasks: DayTask[]; generatedBy: string }

const DAY_CSS = `.rt b{display:block;font-size:22px;font-weight:600;color:#1B2340;margin-top:2px}
.pp{display:flex;align-items:center;gap:14px}
.pp .av{width:44px;height:44px;border-radius:50%;background:#1B2340;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:15px;flex:none}
.pp h2{margin:0;font-size:16px;font-weight:600}
.pp .s{color:#4A5563;margin-top:2px}
.mt{margin-left:auto;text-align:right;color:#4A5563;line-height:1.6;font-size:12px}
.mt b{color:#1C2430;font-weight:500}
.k .v{font-size:30px;font-weight:600;margin-top:6px;font-variant-numeric:tabular-nums;color:#1B2340;line-height:1}
.tx{display:flex;align-items:baseline;gap:12px}
.tx b{font-size:26px;font-weight:600;color:#1B2340;line-height:1}
.tx span{color:#4A5563}
.bar{position:relative;height:9px;background:#E4E7EC;border-radius:5px;margin-top:10px}
.bar i{position:absolute;left:0;top:0;bottom:0;background:#1B2340;border-radius:5px}
.bar u{position:absolute;top:-5px;bottom:-5px;width:2px;background:#C77700;text-decoration:none}
.sc{position:relative;display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:#4A5563;height:14px}
.sc em{position:absolute;transform:translateX(-50%);font-style:normal;color:#8A4B00;font-weight:600;white-space:nowrap}
h3{margin:0 0 8px;font-size:12.5px;font-weight:600;color:#1B2340;text-transform:uppercase;letter-spacing:.06em;display:flex;justify-content:space-between;align-items:baseline}
h3 span{font-size:11.5px;font-weight:400;color:#4A5563;text-transform:none;letter-spacing:0}
th{text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#4A5563;padding:6px 8px;border-bottom:1px solid #1B2340}
td{vertical-align:middle}
.tm{width:112px;font-weight:600;color:#1B2340}
.tt{font-weight:600}.sb{color:#4A5563;font-size:11.5px;margin-top:1px}
.st{font-size:11px;font-weight:600;border-radius:999px;border:1px solid;padding:2px 9px;white-space:nowrap}
.s-d{color:#0A6B3D;border-color:#A8D8BC;background:#E9F7EE}
.s-a{color:#164A8F;border-color:#A9C0E8;background:#EDF3FD}
.s-n{color:#303A48;border-color:#B9C0CB;background:#F0F2F5}
.pr{font-size:11px;font-weight:600;border-radius:5px;padding:2px 8px}
.p-u{background:#FDEEEC;color:#8E1B10}.p-a{background:#FEF5E4;color:#7A4300}.p-m{background:#EDF3FD;color:#164A8F}.p-b{background:#F0F2F5;color:#303A48}
.bx{width:15px;height:15px;border:1.5px solid #6B7482;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;vertical-align:middle}
.bx.ck{background:#0A6B3D;border-color:#0A6B3D;color:#fff}
.nt{display:flex;flex-direction:column}
.nt div{height:26px;border-bottom:1px solid #C5CBD5}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:6px}
.ln{border-top:1px solid #1C2430;padding-top:5px;font-size:11px;color:#4A5563}
.em{color:#4A5563;padding:10px 0 4px}`;

const PRIO: Record<string, [string, string]> = { urgent: ['Urgente', 'p-u'], high: ['Alta', 'p-a'], medium: ['Média', 'p-m'], low: ['Baixa', 'p-b'] };
const CHECK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>';

export function openDayReport(r: DayReport): boolean {
  const now = new Date();
  const dayStart = new Date(r.date.getFullYear(), r.date.getMonth(), r.date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const isToday = now >= dayStart && now < dayEnd;
  const evState = (e: DayEvent) => {
    const end = e.end || (e.allDay ? dayEnd : new Date(e.start.getTime() + 36e5));
    if (end <= now) return ['Concluída', 's-d'];
    if (e.start <= now) return ['Em andamento', 's-a'];
    return ['Agendada', 's-n'];
  };
  const evDone = r.events.filter((e) => evState(e)[0] === 'Concluída').length;
  const tDone = r.tasks.filter((t) => t.done).length;
  const total = r.events.length + r.tasks.length;
  const done = evDone + tDone;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const dayPct = isToday ? Math.round(((now.getTime() - dayStart.getTime()) / 864e5) * 100) : now >= dayEnd ? 100 : 0;
  const longDate = r.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const wd = r.date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const cap = wd.charAt(0).toUpperCase() + wd.slice(1);
  const nEv = r.events.length, nT = r.tasks.length;
  const until = isToday ? `até as ${hm(now)}` : now >= dayEnd ? 'no dia' : 'até agora';

  const evRows = r.events.map((e) => {
    const [st, cl] = evState(e);
    const time = e.allDay ? 'Dia inteiro' : `${hm(e.start)}${e.end ? ' – ' + hm(e.end) : ''}`;
    return `<tr><td class="tm">${time}</td><td><div class="tt">${esc(e.title)}</div>${e.sub ? `<div class="sb">${esc(e.sub)}</div>` : ''}</td><td>${e.people} ${e.people === 1 ? 'pessoa' : 'pessoas'}</td><td><span class="st ${cl}">${st}</span></td></tr>`;
  }).join('');
  const tRows = r.tasks.map((t) => {
    const p = PRIO[t.priority || ''] || ['—', 'p-b'];
    const [st, cl] = t.done ? ['Concluída', 's-d'] : t.doing ? ['Em andamento', 's-a'] : ['Pendente', 's-n'];
    return `<tr><td style="width:28px"><span class="bx${t.done ? ' ck' : ''}">${t.done ? CHECK : ''}</span></td><td><div class="tt">${esc(t.title)}</div>${t.sub ? `<div class="sb">${esc(t.sub)}</div>` : ''}</td><td>${esc(t.owner || '—')}</td><td><span class="pr ${p[1]}">${p[0]}</span></td><td><span class="st ${cl}">${st}</span></td></tr>`;
  }).join('');

  const body = `<div class="pg">
<header class="hd"><div class="br"><img src="${logoUrl()}" alt="ewvon"><small>Agenda · controle do dia</small></div><div class="rt"><span>Relatório do dia</span><b>${esc(longDate)}</b></div></header>
<section class="pp">${avatar('av', r.person.name, r.person.avatar)}<div><h2>${esc(r.person.name)}</h2><div class="s">${esc(cap)} · ${nEv} ${nEv === 1 ? 'reunião' : 'reuniões'} e ${nT} ${nT === 1 ? 'tarefa' : 'tarefas'} com prazo</div></div><div class="mt"><div>Gerado em: <b>${genAt(now)}</b></div><div>Período: <b>00:00 a 23:59</b></div></div></section>
<section class="kp"><div class="k"><div class="l">Eventos e reuniões</div><div class="v">${nEv}</div></div><div class="k"><div class="l">Tarefas com prazo</div><div class="v">${nT}</div></div><div class="k"><div class="l">Total de itens</div><div class="v">${total}</div></div><div class="k"><div class="l">Concluídos</div><div class="v">${done}<small>/${total}</small></div></div></section>
<section><h3>Andamento do dia</h3><div class="tx"><b>${pct}%</b><span>${done} de ${total} itens concluídos ${until}</span></div><div class="bar"><i style="width:${pct}%"></i>${isToday ? `<u style="left:${dayPct}%"></u>` : ''}</div><div class="sc"><span>0%</span>${isToday ? `<em style="left:${Math.min(80, Math.max(14, dayPct))}%">Hora atual do dia ${dayPct}%</em>` : ''}<span>100%</span></div></section>
<section><h3>Agenda do dia<span>Eventos e reuniões</span></h3>${nEv ? `<table><thead><tr><th>Horário</th><th>Evento</th><th>Participantes</th><th>Situação</th></tr></thead><tbody>${evRows}</tbody></table>` : '<div class="em">Nenhum evento ou reunião neste dia.</div>'}</section>
<section><h3>Tarefas com prazo ${isToday ? 'hoje' : 'no dia'}<span>Marque ao concluir</span></h3>${nT ? `<table><thead><tr><th></th><th>Tarefa</th><th>Responsável</th><th>Prioridade</th><th>Situação</th></tr></thead><tbody>${tRows}</tbody></table>` : '<div class="em">Nenhuma tarefa com prazo neste dia.</div>'}</section>
<section style="height:166px"><h3>Anotações do dia</h3><div class="nt"><div></div><div></div><div></div></div><div class="sg"><div class="ln">Conferido por</div><div class="ln">Data</div></div></section>
<footer class="ft"><span>${esc(r.generatedBy)} · relatório gerado automaticamente pelo ewvon em ${genAt(now)}</span><span>© ${now.getFullYear()} ewvon${total <= 12 ? ' · Página 1 de 1' : ''}</span></footer>
</div>`;
  return open(`Relatório do dia ${dt(r.date).replace(/\//g, '-')}`, DAY_CSS, body);
}

/* ------------------------------------------------------- Relatório de conclusão de tarefa ------------------------- */
export interface TaskReport {
  number: number | string; title: string; board?: string | null;
  createdAt: Date; completedAt: Date | null; dueDate: Date | null; late: boolean; delayDays: number;
  completedBy?: string | null; priority: string | null; owner?: { name: string; avatar?: string | null } | null;
  statusName: string; checklist: { done: number; total: number }; comments: number;
  columns: { name: string; color: string; enter: Date; exit: Date | null }[];
  activities: { at: Date; who: string; text: string; done: boolean }[];
  generatedBy: string;
}

const TASK_CSS = `.rt b{display:block;font-size:15px;font-weight:600;color:#1B2340;margin-top:3px}
.ti{display:flex;flex-direction:column;gap:10px}
.ti .ey{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#4A5563}
.ti h1{margin:0;font-size:26px;font-weight:600;letter-spacing:-.01em;color:#1B2340;line-height:1.2}
.ti h1 span{color:#6B7482;font-weight:500}
.ti p{margin:0;color:#3C4756;line-height:1.55}
.late,.ontime,.prog{align-self:flex-start;font-size:12px;font-weight:600;border-radius:999px;padding:4px 12px;display:inline-flex;align-items:center;gap:7px;border:1px solid}
.late{color:#9A3412;background:#FFF1E6;border-color:#F0B48A}
.ontime{color:#0A6B3D;background:#E9F7EE;border-color:#A8D8BC}
.prog{color:#164A8F;background:#EDF3FD;border-color:#A9C0E8}
.late::before,.ontime::before,.prog::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
.k .v{font-size:28px;font-weight:600;margin-top:6px;font-variant-numeric:tabular-nums;color:#1B2340;line-height:1}
.k .v.rd{color:#B93A0E}
.k .d{margin-top:6px;font-size:11.5px;color:#4A5563}
h3{margin:0 0 8px;font-size:12.5px;font-weight:600;color:#1B2340;text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid #1B2340}
.gi{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid #C5CBD5}
.gi>div{padding:10px 14px;border-right:1px solid #C5CBD5;border-bottom:1px solid #C5CBD5}
.gi>div:nth-child(3n){border-right:0}
.gi>div:nth-last-child(-n+3){border-bottom:0}
.gi>div>span{display:block;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#4A5563;margin-bottom:3px}
.gi b{font-weight:600;font-variant-numeric:tabular-nums}
.pr{font-size:11px;font-weight:600;border-radius:5px;padding:2px 8px;background:#EDF3FD;color:#164A8F}
.pr.p-u{background:#FDEEEC;color:#8E1B10}.pr.p-a{background:#FEF5E4;color:#7A4300}.pr.p-b{background:#F0F2F5;color:#303A48}
.pp{display:inline-flex;align-items:center;gap:7px}
.pp .av{width:20px;height:20px;border-radius:50%;background:#1B2340;color:#fff;font-size:8.5px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none}
.ok{color:#0A6B3D}.ip{color:#164A8F}
th{text-align:left;font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#4A5563;padding:6px 8px;border-bottom:1px solid #C5CBD5}
.cl{display:inline-flex;align-items:center;gap:8px;font-weight:600}
.cl i{width:9px;height:9px;border-radius:50%;display:inline-block}
.mb{display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
.mb i{display:block;width:70px;height:5px;background:#E4E7EC;border-radius:3px;position:relative;overflow:hidden}
.mb i::after{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--p);background:#1B2340}
.tm{display:flex;flex-direction:column}
.tl{display:grid;grid-template-columns:116px 22px 1fr;gap:0;position:relative;padding-bottom:14px;break-inside:avoid}
.tl:last-child{padding-bottom:0}
.tl .t{color:#4A5563;font-variant-numeric:tabular-nums;padding-top:1px}
.tl .d{position:relative;display:flex;justify-content:center}
.tl .d i{width:11px;height:11px;border-radius:50%;border:2px solid #1B2340;background:#fff;margin-top:3px;position:relative;z-index:1;box-sizing:border-box}
.tl .d i.g{background:#0A6B3D;border-color:#0A6B3D}
.tl .d::after{content:"";position:absolute;top:16px;bottom:-17px;left:50%;width:2px;margin-left:-1px;background:#D3D8E0}
.tl:last-child .d::after{display:none}
.tl .x b{font-weight:600}
.tl .x em{font-style:normal;font-weight:600;color:#1B2340}`;

/** "4d 3h 23min", "2h 5min", "13 s" */
export function fmtSpan(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d) return `${d}d ${h % 24}h ${m % 60}min`;
  if (h) return `${h}h ${m % 60}min`;
  return `${m}min`;
}

export function openTaskReport(r: TaskReport): boolean {
  const now = new Date();
  const end = r.completedAt || now;
  const totalMs = end.getTime() - r.createdAt.getTime();
  const td = Math.floor(totalMs / 864e5), th = Math.floor((totalMs % 864e5) / 36e5), tm = Math.floor((totalMs % 36e5) / 6e4);
  const totalHtml = td ? `${td}d ${th}<small>h</small>` : th ? `${th}h ${tm}<small>min</small>` : `${tm}<small>min</small>`;
  const p = PRIO[r.priority || ''] || ['—', 'p-b'];
  const badge = r.completedAt
    ? (r.late ? `<span class="late">Entregue com ${r.delayDays} dia(s) de atraso</span>` : '<span class="ontime">Entregue no prazo</span>')
    : '<span class="prog">Em andamento</span>';
  const sentence = r.completedAt
    ? `Tarefa ${r.board ? `do mural <b>${esc(r.board)}</b>, ` : ''}concluída em ${dt(r.completedAt)}${r.completedBy ? ` por ${esc(r.completedBy)}` : ''}${r.late && r.delayDays ? `, ${r.delayDays} dia${r.delayDays === 1 ? '' : 's'} após o prazo` : r.dueDate ? ', dentro do prazo' : ''}.`
    : `Tarefa ${r.board ? `do mural <b>${esc(r.board)}</b>, ` : ''}ainda em andamento${r.dueDate ? `, com prazo em ${dt(r.dueDate)}` : ''}.`;
  const maxMs = Math.max(1, ...r.columns.map((c) => ((c.exit || end).getTime() - c.enter.getTime())));
  const colRows = r.columns.map((c, i) => {
    const last = i === r.columns.length - 1;
    const ms = (c.exit || end).getTime() - c.enter.getTime();
    const perm = last && !c.exit ? 'Coluna atual' : `<div class="mb">${fmtSpan(ms)}<i style="--p:${Math.max(1, Math.round((ms / maxMs) * 100))}%"></i></div>`;
    return `<tr><td><span class="cl"><i style="background:${esc(c.color || '#6B7482')}"></i>${esc(c.name)}</span></td><td>${dts(c.enter)}</td><td>${c.exit ? dts(c.exit) : '—'}</td><td>${perm}</td></tr>`;
  }).join('');
  const emph = (s: string) => esc(s).replace(/&quot;(.+?)&quot;/g, '<em>$1</em>');
  const acts = r.activities.map((a) => `<div class="tl"><div class="t">${pad(a.at.getDate())}/${pad(a.at.getMonth() + 1)}, ${hm(a.at)}</div><div class="d"><i${a.done ? ' class="g"' : ''}></i></div><div class="x"><b>${esc(a.who)}</b> ${emph(a.text)}</div></div>`).join('');

  const body = `<div class="pg">
<header class="hd"><div class="br"><img src="${logoUrl()}" alt="ewvon"><small>Gestão de tarefas</small></div><div class="rt"><span>Gerado em</span><b>${genAt(now)}</b></div></header>
<section class="ti"><div class="ey">Relatório de conclusão de tarefa</div><h1><span>#${esc(r.number)} ·</span> ${esc(r.title)}</h1><p>${sentence}</p>${badge}</section>
<section class="kp">
<div class="k"><div class="l">Tempo total</div><div class="v">${totalHtml}</div><div class="d">${r.completedAt ? 'da criação à conclusão' : 'da criação até agora'}</div></div>
<div class="k"><div class="l">Checklist</div><div class="v">${r.checklist.total ? `${r.checklist.done}<small>/${r.checklist.total}</small>` : '—'}</div><div class="d">${r.checklist.total ? 'itens concluídos' : 'sem itens'}</div></div>
<div class="k"><div class="l">Comentários</div><div class="v">${r.comments}</div></div>
<div class="k"><div class="l">Atraso</div><div class="v${r.late && r.delayDays ? ' rd' : ''}">${r.late && r.delayDays ? `${r.delayDays}<small> dia(s)</small>` : '0'}</div><div class="d">${r.dueDate ? `prazo em ${dt(r.dueDate)}` : 'sem prazo'}</div></div>
</section>
<section><h3>Informações gerais</h3><div class="gi">
<div><span>Criada em</span><b>${dts(r.createdAt)}</b></div>
<div><span>Concluída em</span><b>${r.completedAt ? dts(r.completedAt) : '—'}</b></div>
<div><span>Prazo</span><b>${r.dueDate ? dt(r.dueDate) : '—'}</b></div>
<div><span>Prioridade</span><b class="pr ${p[1]}">${p[0]}</b></div>
<div><span>Responsável</span>${r.owner ? `<b class="pp">${avatar('av', r.owner.name, r.owner.avatar)}${esc(r.owner.name)}</b>` : '<b>—</b>'}</div>
<div><span>Situação final</span><b class="${r.completedAt ? 'ok' : 'ip'}">${r.completedAt ? 'Concluída' : esc(r.statusName || 'Em andamento')}</b></div>
</div></section>
${r.columns.length ? `<section><h3>Tempo por coluna</h3><table><thead><tr><th>Coluna</th><th>Entrada</th><th>Saída</th><th>Permanência</th></tr></thead><tbody>${colRows}</tbody></table></section>` : ''}
${r.activities.length ? `<section><h3>Histórico de atividades</h3><div class="tm">${acts}</div></section>` : ''}
<footer class="ft"><span>${esc(r.generatedBy)} · relatório gerado automaticamente pelo ewvon em ${genAt(now)}</span><span>© ${now.getFullYear()} ewvon${r.columns.length + r.activities.length <= 14 ? ' · Página 1 de 1' : ''}</span></footer>
</div>`;
  return open(`Tarefa ${r.number}`, TASK_CSS, body);
}
