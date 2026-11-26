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
import { Av, daysBetween, db, fmtD, pname, today, usePeople } from './rhShared';

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

  const row = (r: Req, actions: React.ReactNode) => {
    const p = byId.get(r.profile_id); const [lbl, cls] = ST[r.status] || ['—', 'dk-c-n'];
    return (
      <tr key={r.id}>
        <td><div className="flex items-center gap-2.5"><Av p={p} size={30} /><div><div className="dk-ti">{pname(p)}</div>{r.note ? <div className="dk-su">{r.note}</div> : null}</div></div></td>
        <td>{KINDS[r.kind] || r.kind}</td>
        <td>{fmtD(r.start_date)} – {fmtD(r.end_date)}<div className="dk-sub">{daysBetween(r.start_date, r.end_date)} dia(s)</div></td>
        <td><span className={`dk-chp ${cls}`}>{lbl}</span>{r.decision_note ? <div className="dk-sub">{r.decision_note}</div> : null}</td>
        <td className="dk-ac">{actions}</td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col">
      {/* resumo: cartões simples — rótulo, número e uma linha que explica o número; só o que pede ação ganha cor */}
      <div className="rh-kp">
        {([
          ['Ausentes hoje', outToday.length, outToday.length ? (outToday.length === 1 ? 'pessoa fora hoje' : 'pessoas fora hoje') : 'todos presentes', false],
          ['Meus pedidos', mine.filter((r) => r.status === 'pending').length, 'aguardando resposta', false],
          ...(isManager ? [['Para responder', pendingTeam.length, pendingTeam.length ? 'pedidos da equipe' : 'nada pendente', pendingTeam.length > 0] as const] : []),
          ['Ausências no mês', abs.length, 'aprovadas no calendário', false],
        ] as const).map(([l, v, h, hot]) => (
          <div key={l} className={'rh-k' + (hot ? ' rh-hot' : '') + (v ? '' : ' rh-zero')}>
            <span className="rh-kl">{l}</span>
            <b className="rh-kv">{v}</b>
            <span className="rh-kh">{h}</span>
          </div>
        ))}
      </div>
      <div className="dk-bar">
        <div className="dk-ti" style={{ fontSize: 15 }}>Meus pedidos</div>
        <div className="dk-flt"><button type="button" className="dk-btn pri" onClick={() => { setKind('ferias'); setFrom(today()); setTo(today()); setNote(''); setForm(true); }}><Plus size={16} />Solicitar ausência</button></div>
      </div>
      {reqs === null ? <div className="dk-empty"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : mine.length ? (
        <div className="dk-scroll"><table className="dk-table"><thead><tr><th>Pessoa</th><th>Tipo</th><th>Período</th><th>Situação</th><th /></tr></thead>
          <tbody>{mine.map((r) => row(r, <span className="inline-flex items-center gap-1.5">{r.status === 'pending' || (r.status === 'approved' && r.start_date > todayIso) ? <button type="button" className="dk-btn" onClick={() => void cancel(r)}>Cancelar</button> : null}{trash(r)}</span>))}</tbody></table></div>
      ) : <div className="dk-empty">Você ainda não pediu nenhuma ausência.</div>}
      {isManager ? <>
        <div className="dk-bar">
          <div className="dk-ti" style={{ fontSize: 15 }}>Pedidos da equipe</div>
          <div className="dk-flt"><ExportMenu className="dk-btn" getData={() => ({ name: 'ausencias-equipe', sheet: 'Ausências', headers: ['Pessoa', 'Tipo', 'Início', 'Fim', 'Dias', 'Situação', 'Observação', 'Resposta'], rows: team.map((r) => [pname(byId.get(r.profile_id)), KINDS[r.kind] || r.kind, fmtD(r.start_date), fmtD(r.end_date), daysBetween(r.start_date, r.end_date), ST[r.status]?.[0] || r.status, r.note || '', r.decision_note || '']) })} /></div>
        </div>
        {team.length ? <div className="dk-scroll"><table className="dk-table"><thead><tr><th>Pessoa</th><th>Tipo</th><th>Período</th><th>Situação</th><th /></tr></thead>
          <tbody>{[...pendingTeam, ...team.filter((r) => r.status !== 'pending')].slice(0, 120).map((r) => row(r, <span className="inline-flex items-center gap-1.5">{r.status === 'pending' ? <><button type="button" className="dk-btn pri" onClick={() => void decide(r, true)}>Aprovar</button><button type="button" className="dk-btn" onClick={() => void decide(r, false)}>Recusar</button></> : null}{trash(r)}</span>))}</tbody></table></div>
          : <div className="dk-empty">Nenhum pedido da equipe.</div>}
      </> : null}
      <div className="dk-bar">
        <div className="dk-ti" style={{ fontSize: 15 }}>Calendário da equipe</div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="dk-ic bg" aria-label="Mês anterior" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
          <b className="min-w-[150px] text-center">{((m) => m.charAt(0).toUpperCase() + m.slice(1))(month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</b>
          <button type="button" className="dk-ic bg" aria-label="Próximo mês" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11.5px] font-semibold text-muted-foreground">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <span key={d} className="py-1">{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            if (!d) return <div key={i} />;
            const out = abs.filter((a) => a.start_date <= d && a.end_date >= d);
            return (
              <div key={d} className={`min-h-[78px] rounded-[10px] border p-1.5 text-left ${d === todayIso ? 'border-primary' : 'border-border'}`}>
                <div className="text-[11px] font-semibold text-muted-foreground">{Number(d.slice(8))}</div>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {out.slice(0, 3).map((a) => <span key={a.id} title={`${a.name} · ${KINDS[a.kind] || a.kind}`} className="truncate rounded-[6px] bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-medium text-primary">{a.name.split(' ')[0]}{a.kind !== 'ausente' ? ` · ${KINDS[a.kind]}` : ''}</span>)}
                  {out.length > 3 ? <span className="text-[10px] text-muted-foreground">+{out.length - 3}</span> : null}
                </div>
              </div>
            );
          })}
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
