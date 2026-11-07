// "Tickets" tab: support desk for users of the system (master) company.
// Lists every support ticket from every company, shows who is handling it,
// lets the attendant take the ticket and change its status.
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as D from './data';
import type { DeskTicket } from './data';
import { Seg } from './EwwonApp';
import { I } from './icons';
import { fmtTime, relDays } from './util';
import * as N from './notify';

const FILTERS = ['Abertos', 'Prazo', 'Meus', 'Concluídos', 'Todos'];
const SLA_H = 24;
const WARN_H = 20;
const isOpen = (t: DeskTicket) => t.status === 'Recebido' || t.status === 'Em análise';
const ageH = (t: DeskTicket) => (Date.now() - new Date(t.createdAt).getTime()) / 36e5;
/** Open tickets near (>= 20h) or past the 24h limit. */
const slaState = (t: DeskTicket): 'late' | 'warn' | null => (!isOpen(t) ? null : ageH(t) >= SLA_H ? 'late' : ageH(t) >= WARN_H ? 'warn' : null);
function slaLabel(t: DeskTicket) {
  const h = ageH(t);
  if (h >= SLA_H) { const over = Math.floor(h - SLA_H); return over < 1 ? 'Prazo de 24h estourado' : `Prazo estourado há ${over}h`; }
  const left = SLA_H - h;
  return left < 1 ? `Faltam ${Math.max(1, Math.round(left * 60))} min` : `Faltam ${Math.floor(left)}h${String(Math.round((left % 1) * 60)).padStart(2, '0')}`;
}

export function TicketsDesk({ meId, toast, active, onCount, onChat }: { meId: string; toast: (t: string) => void; active: boolean; onCount: (n: number) => void; onChat: (t: DeskTicket) => void }) {
  const [list, setList] = useState<DeskTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState(0);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setList(await D.listDeskTickets());
    } catch (e) {
      console.warn(e);
      setErr('Não foi possível carregar os tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const unsub = D.subscribeTickets((row, isNew) => {
      void load();
      if (isNew && row?.profile_id !== meId) {
        void N.deliver({ type: 'notice', urgent: true, title: 'Novo ticket de suporte', body: String(row?.description || '').slice(0, 80), data: { type: 'ticket' } });
      }
    });
    return unsub;
  }, [load, meId]);

  const openCount = useMemo(() => list.filter((t) => t.status === 'Recebido').length, [list]);
  const [, tick] = useState(0);
  useEffect(() => { const i = window.setInterval(() => tick((x) => x + 1), 60000); return () => window.clearInterval(i); }, []);
  const late = list.filter((t) => slaState(t) === 'late');
  const warn = list.filter((t) => slaState(t) === 'warn');
  useEffect(() => { onCount(openCount); }, [openCount, onCount]);

  const shown = list.filter((t) => {
    const ok = f === 0 ? isOpen(t) : f === 1 ? !!slaState(t) : f === 2 ? t.assigneeId === meId : f === 3 ? t.status === 'Resolvido' || t.status === 'Fechado' : true;
    const s = q.trim().toLowerCase();
    return ok && (!s || [t.label, t.companyName, t.reporterName, t.description, t.assigneeName || ''].some((x) => x.toLowerCase().includes(s)));
  });

  const update = async (t: DeskTicket, status: string | null, take: boolean) => {
    setBusy(t.id);
    try {
      const r = await D.updateDeskTicket(t.id, status, take);
      setList((ls) => ls.map((x) => (x.id === t.id ? { ...x, status: r.status, assigneeId: r.assignee_profile_id, assigneeName: r.assignee_name, updatedAt: r.updated_at } : x)));
      toast(take ? 'Você está atendendo este ticket' : `Status: ${status}`);
    } catch (e) {
      console.warn(e);
      toast('Não foi possível atualizar o ticket.');
    } finally {
      setBusy(null);
    }
  };

  const shot = async (path: string) => {
    const url = await D.ticketScreenshotUrl(path);
    if (url) window.open(url, '_blank', 'noopener'); else toast('Captura indisponível');
  };

  if (!active && loading) return null;
  return (
    <>
      <h1>Tickets</h1>
      <p className="sub">Suporte de todas as empresas</p>
      <div className="g2 mn ewx-tk-stats">
        <div className="mini"><b>{openCount}</b><span>novos aguardando</span></div>
        <div className="mini"><b>{list.filter((t) => t.status === 'Em análise').length}</b><span>em atendimento</span></div>
      </div>
      {late.length || warn.length ? (
        <button className={'ewx-sla' + (late.length ? ' late' : '')} onClick={() => setF(1)}>
          <span className="ewx-sla-ic"><I n="clock" /></span>
          <span className="ewx-sla-tx">
            <b>{late.length ? `${late.length} ${late.length === 1 ? 'chamado passou' : 'chamados passaram'} de 24h` : `${warn.length} ${warn.length === 1 ? 'chamado perto' : 'chamados perto'} do limite de 24h`}</b>
            <small>{late.length && warn.length ? `+ ${warn.length} perto do limite · ` : ''}Toque para ver e priorizar</small>
          </span>
        </button>
      ) : null}
      <Seg id="tkf" items={FILTERS} value={f} onChange={setF} />
      <label className="srch" style={{ margin: '12px 0' }}><I n="search" /><input placeholder="Buscar por empresa, pessoa ou número" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {loading ? <div className="hint" style={{ padding: 30 }}>Carregando…</div> : null}
      {err ? <div className="hint" style={{ padding: 30 }}>{err} <button className="btn sm sec" onClick={() => void load()}>Tentar de novo</button></div> : null}
      {!loading && !err && !shown.length ? <div className="hint" style={{ padding: 30 }}>Nenhum ticket aqui</div> : null}
      <div className="ewx-tk-list">
        {shown.map((t) => {
          const isOpen = open === t.id;
          const mine = t.assigneeId === meId;
          return (
            <div key={t.id} className={'card ewx-tk' + (isOpen ? ' open' : '')}>
              <button className="ewx-tk-head" onClick={() => setOpen(isOpen ? null : t.id)}>
                <div className="ewx-tk-top">
                  <b>{t.label}</b>
                  <span className="tst"><i style={{ background: D.TICKET_COLOR[t.status] || '#7cc6ff' }} />{t.status}</span>
                </div>
                <div className="ewx-tk-title">{t.description}</div>
                <div className="ewx-tk-meta">
                  <span>{t.companyName}</span><span>·</span><span>{t.reporterName}</span><span>·</span><span>{relDays(t.createdAt)}</span>
                </div>
                {slaState(t) ? <div className={'ewx-tk-sla ' + slaState(t)}><I n="clock" />{slaLabel(t)}</div> : null}
                <div className="ewx-tk-who">{t.assigneeName ? <>Atendido por <b>{mine ? 'você' : t.assigneeName}</b></> : <span className="ewx-tk-free">Sem atendente</span>}</div>
              </button>
              {isOpen ? (
                <div className="ewx-tk-body">
                  <div className="cr"><span>Categoria</span><b>{t.category}</b></div>
                  <div className="cr"><span>Área</span><b>{t.area}</b></div>
                  <div className="cr"><span>Gravidade</span><b>{t.severity}</b></div>
                  <div className="cr"><span>Empresa</span><b>{t.companyName}</b></div>
                  <div className="cr"><span>Quem reportou</span><b>{t.reporterName}</b></div>
                  {t.reporterEmail ? <div className="cr"><span>E-mail</span><b>{t.reporterEmail}</b></div> : null}
                  <div className="cr"><span>Aberto em</span><b>{new Date(t.createdAt).toLocaleDateString('pt-BR')} {fmtTime(t.createdAt).includes(':') ? fmtTime(t.createdAt) : ''}</b></div>
                  {t.device ? <div className="cr"><span>Aparelho</span><b>{[t.device.platform, t.device.screen, t.device.app && 'v' + t.device.app].filter(Boolean).join(' · ')}</b></div> : null}
                  <p className="ewx-tk-desc">{t.description}</p>
                  {t.screenshotPath ? <button className="btn sm sec" onClick={() => void shot(t.screenshotPath as string)}><I n="upload" />Ver captura de tela</button> : null}
                  <button className="btn sec full" onClick={() => onChat(t)}><I n="chat" />Conversar com {t.reporterName.split(' ')[0]}</button>
                  {!mine ? <button className="btn full" disabled={busy === t.id} onClick={() => void update(t, t.status === 'Recebido' ? 'Em análise' : null, true)}>{t.assigneeName ? 'Assumir atendimento' : 'Atender este ticket'}</button> : null}
                  <div className="sl">Status</div>
                  <Seg id={'tks' + t.id} items={D.TICKET_STATUS} value={Math.max(0, D.TICKET_STATUS.indexOf(t.status))} onChange={(v) => { if (D.TICKET_STATUS[v] !== t.status) void update(t, D.TICKET_STATUS[v], false); }} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
