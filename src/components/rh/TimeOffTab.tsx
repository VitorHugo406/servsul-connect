// Ausências: the person asks for férias / folga / atestado / licença / home office; their managers (team supervisors,
// sector manager; company admins when nobody manages them) get a bell notification and approve or refuse; the team
// calendar shows approved absences of the month (colleagues see only "Ausente", managers see the kind).
// time_off_requests + time_off_decide/time_off_cancel/company_absences (migration 20261121010000).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { appConfirm, appPrompt } from '@/lib/appDialog';
import { Av, RhDate, RhEmpty, RhHead, RhSec, RhSt, daysBetween, db, fmtD, pname, today, usePeople } from './rhShared';

type Req = { id: string; profile_id: string; kind: string; start_date: string; end_date: string; note: string | null; status: string; decision_note: string | null; created_at: string };
type Abs = { id: string; profile_id: string; name: string; avatar_url: string | null; sector: string | null; kind: string; start_date: string; end_date: string };
export const KINDS: Record<string, string> = { ferias: 'Férias', folga: 'Folga', atestado: 'Atestado', licenca: 'Licença', home_office: 'Home office', outro: 'Outro', ausente: 'Ausente' };
const ST: Record<string, [string, string]> = { pending: ['Aguardando', 'dk-c-a'], approved: ['Aprovado', 'dk-c-g'], rejected: ['Recusado', 'dk-c-r'], cancelled: ['Cancelado', 'dk-c-n'] };
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function TimeOffTab({ isManager }: { isManager: boolean }) {
  const { profile, isAdmin } = useAuth();
  const { byId } = usePeople();
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [abs, setAbs] = useState<Abs[]>([]);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [form, setForm] = useState(false);
  const [kind, setKind] = useState('ferias'); const [from, setFrom] = useState(today()); const [to, setTo] = useState(today()); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await db.from('time_off_requests').select('id,profile_id,kind,start_date,end_date,note,status,decision_note,created_at').order('created_at', { ascending: false }).limit(300);
    setReqs(data || []);
  }, []);
  const loadMonth = useCallback(async () => {
    const a = new Date(month), b = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const { data } = await db.rpc('company_absences', { _from: iso(a), _to: iso(b) });
    setAbs(data || []);
  }, [month]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMonth(); }, [loadMonth]);

  const mine = (reqs || []).filter((r) => r.profile_id === profile?.id);
  const team = (reqs || []).filter((r) => r.profile_id !== profile?.id);
  const pendingTeam = team.filter((r) => r.status === 'pending');
  const todayIso = today();
  const outToday = abs.filter((a) => a.start_date <= todayIso && a.end_date >= todayIso);

  const submit = async () => {
    if (to < from) { toast.error('O fim precisa ser no mesmo dia ou depois do início.'); return; }
    setBusy(true);
    const { error } = await db.from('time_off_requests').insert({ kind, start_date: from, end_date: to, note: note.trim() || null });
    setBusy(false);
    if (error) { toast.error('Não foi possível enviar o pedido.'); return; }
    toast.success('Pedido enviado. Seu gestor foi avisado.'); setForm(false); setNote(''); void load();
  };
  const decide = async (r: Req, approve: boolean) => {
    const msg = approve ? '' : await appPrompt({ title: 'Recusar o pedido', message: 'Explique o motivo (opcional). A pessoa recebe esta resposta.', placeholder: 'Ex.: período de fechamento, podemos ver outra data?', confirmText: 'Recusar', maxLength: 500 });
    if (msg === null) return;
    const { error } = await db.rpc('time_off_decide', { _id: r.id, _approve: approve, _note: msg || null });
    if (error) toast.error(/TIMEOFF_CLOSED/.test(error.message) ? 'Esse pedido já foi respondido.' : 'Você não pode responder este pedido.');
    else { toast.success(approve ? 'Pedido aprovado' : 'Pedido recusado'); void load(); void loadMonth(); }
  };
  const cancel = async (r: Req) => {
    if (!(await appConfirm({ title: 'Cancelar o pedido?', message: 'Seu gestor verá que o pedido foi cancelado.', confirmText: 'Cancelar pedido' }))) return;
    const { error } = await db.rpc('time_off_cancel', { _id: r.id });
    if (error) toast.error('Não foi possível cancelar.'); else { void load(); void loadMonth(); }
  };

  // delete (migration 20261123030000): own requests except an approved absence that has not ended yet (cancel it
  // instead); managers and admins can delete their team's requests
  const canDel = (r: Req) => r.profile_id === profile?.id ? !(r.status === 'approved' && r.end_date >= todayIso) : (isManager || isAdmin);
  const del = async (r: Req) => {
    if (!(await appConfirm({ title: 'Excluir este pedido?', message: r.status === 'approved' ? 'A ausência sai do histórico e do calendário da equipe.' : 'O pedido some da lista de vocês.', confirmText: 'Excluir', danger: true }))) return;
    const { error, count } = await db.from('time_off_requests').delete({ count: 'exact' }).eq('id', r.id);
    if (error || count === 0) toast.error(r.status === 'approved' && r.end_date >= todayIso ? 'Cancele a ausência aprovada antes de excluir.' : 'Não foi possível excluir.');
    else { toast.success('Pedido excluído'); void load(); void loadMonth(); }
  };
  const trash = (r: Req) => (canDel(r) ? <button type="button" className="dk-ic" aria-label="Excluir pedido" title="Excluir" onClick={() => void del(r)}><Trash2 size={16} /></button> : null);

  const grid = useMemo(() => {
    const first = new Date(month); const startDow = (first.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= days; d++) cells.push(iso(new Date(month.getFullYear(), month.getMonth(), d)));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);

  const [day, setDay] = useState(todayIso);
  const outOn = (d: string) => abs.filter((a) => a.start_date <= d && a.end_date >= d);
  const outDay = outOn(day);
  const openForm = () => { setKind('ferias'); setFrom(today()); setTo(today()); setNote(''); setForm(true); };
  const period = (r: { start_date: string; end_date: string }) => {
    const n = daysBetween(r.start_date, r.end_date);
    return `${r.start_date === r.end_date ? fmtD(r.start_date) : `${fmtD(r.start_date)} a ${fmtD(r.end_date)}`} · ${n} ${n === 1 ? 'dia' : 'dias'}`;
  };
  const stOf = (r: Req) => (r.status === 'approved' ? (r.end_date < todayIso ? <RhSt k="mut">Concluída</RhSt> : r.start_date <= todayIso ? <RhSt k="blue">Em andamento</RhSt> : <RhSt k="ok">Aprovado</RhSt>)
    : r.status === 'pending' ? <RhSt k="wait">Aguardando gestor</RhSt> : r.status === 'rejected' ? <RhSt k="no">Recusado</RhSt> : <RhSt k="mut">Cancelado</RhSt>);
  const monthName = ((m) => m.charAt(0).toUpperCase() + m.slice(1))(month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  const pendingIds = new Set(pendingTeam.map((r) => r.id));
  const history = team.filter((r) => !pendingIds.has(r.id)).slice(0, 120);

  return (
    <div className="flex flex-col">
      <div className="dk-kp" style={{ marginTop: 16 }}>
        <div className="dk-k"><span className="l">Ausentes hoje</span><span className="v">{outToday.length}</span></div>
        <div className="dk-k"><span className="l">Meus pedidos aguardando</span><span className="v">{mine.filter((r) => r.status === 'pending').length}</span></div>
        {isManager ? <div className="dk-k"><span className="l">Pedidos da equipe para responder</span><span className="v">{pendingTeam.length}</span></div> : null}
        <div className="dk-k"><span className="l">Ausências no mês</span><span className="v">{abs.length}</span></div>
      </div>
      <div className="rh-area" style={{ paddingTop: 6 }}>
        <RhHead title="Ausências" desc="Peça férias, folga, atestado ou home office. Seu gestor responde aqui e a ausência aparece no calendário da equipe.">
          <button type="button" className="dk-btn pri" onClick={openForm}><Plus size={16} />Solicitar ausência</button>
        </RhHead>
        <div className="rh-grid">
          <div className="rh-col">
            {isManager && pendingTeam.length ? (
              <RhSec title="Aguardando sua resposta" n={pendingTeam.length} attn>
                <div className="rh-list">
                  {pendingTeam.map((r) => { const p = byId.get(r.profile_id); return (
                    <div key={r.id} className="rh-row">
                      <Av p={p} size={36} />
                      <div className="rh-main">
                        <div className="rh-t">{pname(p)} · {KINDS[r.kind] || r.kind}</div>
                        <div className="rh-m">{period(r)} · pedido em {fmtD(r.created_at)}</div>
                        {r.note ? <div className="rh-q">“{r.note}”</div> : null}
                      </div>
                      <div className="rh-end">
                        <button type="button" className="dk-btn" onClick={() => void decide(r, false)}>Recusar</button>
                        <button type="button" className="dk-btn pri" onClick={() => void decide(r, true)}>Aprovar</button>
                      </div>
                    </div>
                  ); })}
                </div>
              </RhSec>
            ) : null}
            <RhSec title="Meus pedidos" n={mine.length || undefined}>
              {reqs === null ? <div className="rh-empty"><Loader2 className="h-5 w-5 animate-spin" /></div> : mine.length ? (
                <div className="rh-list">
                  {mine.map((r) => (
                    <div key={r.id} className="rh-row">
                      <RhDate d={r.start_date} />
                      <div className="rh-main">
                        <div className="rh-t">{KINDS[r.kind] || r.kind}</div>
                        <div className="rh-m">{period(r)}</div>
                        {r.note ? <div className="rh-q">{r.note}</div> : null}
                        {r.decision_note ? <div className="rh-q"><b>Resposta:</b> {r.decision_note}</div> : null}
                      </div>
                      <div className="rh-end">
                        {stOf(r)}
                        {r.status === 'pending' || (r.status === 'approved' && r.start_date > todayIso) ? <button type="button" className="rh-link" onClick={() => void cancel(r)}>Cancelar</button> : null}
                        {trash(r)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <RhEmpty title="Nenhum pedido ainda" text="Quando precisar se ausentar, faça o pedido aqui. Você acompanha a resposta nesta lista." action={<button type="button" className="dk-btn" onClick={openForm}><Plus size={16} />Solicitar ausência</button>} />}
            </RhSec>
            {isManager ? (
              <RhSec title="Histórico da equipe" n={history.length || undefined} right={history.length ? <ExportMenu className="dk-btn" getData={() => ({ name: 'ausencias-equipe', sheet: 'Ausências', headers: ['Pessoa', 'Tipo', 'Início', 'Fim', 'Dias', 'Situação', 'Observação', 'Resposta'], rows: team.map((r) => [pname(byId.get(r.profile_id)), KINDS[r.kind] || r.kind, fmtD(r.start_date), fmtD(r.end_date), daysBetween(r.start_date, r.end_date), ST[r.status]?.[0] || r.status, r.note || '', r.decision_note || '']) })} /> : null}>
                {history.length ? (
                  <div className="rh-list">
                    {history.map((r) => { const p = byId.get(r.profile_id); return (
                      <div key={r.id} className="rh-row">
                        <Av p={p} size={32} />
                        <div className="rh-main">
                          <div className="rh-t">{pname(p)} · {KINDS[r.kind] || r.kind}</div>
                          <div className="rh-m">{period(r)}{r.decision_note ? ` · ${r.decision_note}` : ''}</div>
                        </div>
                        <div className="rh-end">{stOf(r)}{trash(r)}</div>
                      </div>
                    ); })}
                  </div>
                ) : <RhEmpty title="Sem pedidos respondidos" text="Os pedidos da sua equipe que você aprovar ou recusar ficam guardados aqui." />}
              </RhSec>
            ) : null}
          </div>
          <div className="rh-col">
            <div className="rh-card">
              <div className="rh-sh" style={{ marginBottom: 8 }}>
                <h3>{monthName}</h3><span className="rh-sp" />
                <button type="button" className="dk-ic" aria-label="Mês anterior" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
                <button type="button" className="dk-ic" aria-label="Próximo mês" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
              </div>
              <div className="rh-cal">
                {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
                {grid.map((d, i) => d ? (
                  <button key={d} type="button" className={(d === day ? 'sel' : '') + (d === todayIso ? ' td' : '')} onClick={() => setDay(d)} aria-label={`${fmtD(d)}: ${outOn(d).length} ausente(s)`}>
                    {Number(d.slice(8))}{outOn(d).length ? <i /> : null}
                  </button>
                ) : <span key={i} />)}
              </div>
            </div>
            <RhSec title={day === todayIso ? 'Fora hoje' : `Fora em ${fmtD(day)}`} n={outDay.length || undefined}>
              {outDay.length ? (
                <div className="rh-list">
                  {outDay.map((a) => (
                    <div key={a.id} className="rh-row">
                      <Av p={{ id: a.profile_id, name: a.name, avatar_url: a.avatar_url }} size={32} />
                      <div className="rh-main">
                        <div className="rh-t">{a.name}</div>
                        <div className="rh-m">{[a.kind !== 'ausente' ? KINDS[a.kind] : null, a.sector, a.start_date === a.end_date ? null : `até ${fmtD(a.end_date)}`].filter(Boolean).join(' · ') || 'Ausente'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <RhEmpty title="Ninguém ausente" text="Escolha um dia no calendário. Os dias com ponto têm alguém fora." />}
            </RhSec>
          </div>
        </div>
      </div>
      <Dialog open={form} onOpenChange={(o) => { if (!busy) setForm(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Solicitar ausência</DialogTitle><DialogDescription>Seu gestor recebe o pedido e responde aqui mesmo.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-3">
            <div><label className="mb-1 block text-xs font-semibold">Tipo</label><Sel className="ui-sel w-full" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo">{Object.entries(KINDS).filter(([k]) => k !== 'ausente').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="mb-1 block text-xs font-semibold" htmlFor="to-from">Início</label><Input id="to-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} /></div>
              <div><label className="mb-1 block text-xs font-semibold" htmlFor="to-to">Fim</label><Input id="to-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <p className="text-xs text-muted-foreground">{to >= from ? `${daysBetween(from, to)} dia(s)` : 'Período inválido'}</p>
            <div><label className="mb-1 block text-xs font-semibold" htmlFor="to-note">Observação</label><Textarea id="to-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setForm(false)} disabled={busy}>Cancelar</Button><Button onClick={() => void submit()} disabled={busy || to < from}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enviar pedido</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
