// Reconhecimento: public praise wall (elogios with a company value, colleagues can applaud) + private feedback
// (only the two people and the person's managers see it). The person is notified. feedbacks / feedback_cheers
// (migration 20261121010000).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';
import { Av, RhEmpty, RhHead, RhSec, db, fmtDH, pname, usePeople } from './rhShared';
import '@/styles/chat-extras.css';

type F = { id: string; from_id: string; to_id: string; kind: 'elogio' | 'feedback'; visibility: 'public' | 'private'; value_tag: string | null; message: string; created_at: string };
const VALUES = ['Colaboração', 'Resultado', 'Atendimento', 'Inovação', 'Iniciativa', 'Aprendizado', 'Liderança', 'Organização'];

export function FeedbackTab() {
  const { profile, isAdmin } = useAuth();
  const { list: people, byId } = usePeople();
  const [rows, setRows] = useState<F[] | null>(null);
  const [cheers, setCheers] = useState<Map<string, { n: number; me: boolean }>>(new Map());
  const [view, setView] = useState<'wall' | 'received' | 'sent'>('wall');
  const [form, setForm] = useState(false);
  const [to, setTo] = useState(''); const [kind, setKind] = useState<'elogio' | 'feedback'>('elogio'); const [pub, setPub] = useState(true); const [tag, setTag] = useState(''); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await db.from('feedbacks').select('*').order('created_at', { ascending: false }).limit(200);
    setRows(data || []);
    const ids = ((data || []) as F[]).filter((f) => f.visibility === 'public').map((f) => f.id);
    if (ids.length) {
      const { data: c } = await db.from('feedback_cheers').select('feedback_id,profile_id').in('feedback_id', ids);
      const m = new Map<string, { n: number; me: boolean }>();
      for (const r of (c || []) as { feedback_id: string; profile_id: string }[]) { const x = m.get(r.feedback_id) || { n: 0, me: false }; x.n += 1; if (r.profile_id === profile?.id) x.me = true; m.set(r.feedback_id, x); }
      setCheers(m);
    }
  }, [profile?.id]);
  useEffect(() => { void load(); }, [load]);
  const list = (rows || []).filter((f) => (view === 'wall' ? f.visibility === 'public' : view === 'received' ? f.to_id === profile?.id : f.from_id === profile?.id));
  const send = async () => {
    if (!to || !msg.trim()) return;
    setBusy(true);
    const { error } = await db.from('feedbacks').insert({ to_id: to, kind, visibility: kind === 'feedback' ? 'private' : pub ? 'public' : 'private', value_tag: kind === 'elogio' && tag ? tag : null, message: msg.trim() });
    setBusy(false);
    if (error) { toast.error('Não foi possível enviar.'); return; }
    toast.success(kind === 'elogio' ? 'Elogio enviado' : 'Feedback enviado'); setForm(false); setTo(''); setMsg(''); setTag(''); void load();
  };
  const cheer = async (f: F) => {
    const c = cheers.get(f.id);
    const { error } = c?.me ? await db.from('feedback_cheers').delete().eq('feedback_id', f.id).eq('profile_id', profile?.id) : await db.from('feedback_cheers').insert({ feedback_id: f.id });
    if (!error) void load();
  };
  const del = async (f: F) => {
    if (!(await appConfirm({ title: 'Apagar este registro?', message: 'Ele sai do mural e do histórico.', confirmText: 'Apagar', danger: true }))) return;
    const { error } = await db.from('feedbacks').delete().eq('id', f.id);
    if (error) toast.error('Não foi possível apagar.'); else void load();
  };
  const openForm = (k: 'elogio' | 'feedback') => { setKind(k); setPub(k === 'elogio'); setForm(true); };
  const since = Date.now() - 30 * 864e5;
  const top = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of rows || []) if (f.kind === 'elogio' && f.visibility === 'public' && +new Date(f.created_at) >= since) m.set(f.to_id, (m.get(f.to_id) || 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);
  }, [rows, since]);
  const counts = { wall: (rows || []).filter((f) => f.visibility === 'public').length, received: (rows || []).filter((f) => f.to_id === profile?.id).length, sent: (rows || []).filter((f) => f.from_id === profile?.id).length };
  const ago = (d: string) => { const m = Math.round((Date.now() - +new Date(d)) / 6e4); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : m < 10080 ? `há ${Math.round(m / 1440)} ${Math.round(m / 1440) === 1 ? 'dia' : 'dias'}` : fmtDH(d); };
  return (
    <div className="rh-area">
      <RhHead title="Reconhecimento" desc="Elogie colegas publicamente no mural ou dê um feedback privado. A pessoa recebe um aviso.">
        <button type="button" className="dk-btn" onClick={() => openForm('feedback')}><Lock size={15} />Dar feedback</button>
        <button type="button" className="dk-btn pri" onClick={() => openForm('elogio')}><Plus size={16} />Elogiar alguém</button>
      </RhHead>
      <nav className="dk-tb rh-sub" aria-label="Ver">
        {([['wall', 'Mural de elogios'], ['received', 'Recebidos'], ['sent', 'Enviados']] as const).map(([k, l]) => <button key={k} type="button" aria-current={view === k ? 'true' : undefined} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}{counts[k] ? <span className="rh-cnt">{counts[k]}</span> : null}</button>)}
      </nav>
      <div className="rh-grid">
        <div className="rh-col">
          {rows === null ? <div className="rh-empty"><Loader2 className="h-5 w-5 animate-spin" /></div> : list.length ? (
            <div className="rh-feed">
              {list.map((f) => { const a = byId.get(f.from_id), b = byId.get(f.to_id), c = cheers.get(f.id); const priv = f.kind === 'feedback' || f.visibility === 'private'; return (
                <article key={f.id} className="rh-fi">
                  <Av p={b} size={40} />
                  <div className="rh-main">
                    <div className="rh-fh">
                      <span><b>{f.to_id === profile?.id ? 'Você' : pname(b)}</b> {f.kind === 'feedback' ? 'recebeu um feedback de' : 'foi elogiado(a) por'} <b>{f.from_id === profile?.id ? 'você' : pname(a)}</b></span>
                      <span className="rh-sp" />
                      <time>{ago(f.created_at)}</time>
                    </div>
                    {priv || f.value_tag ? <div className="rh-tags">{priv ? <span className="rh-tag"><Lock size={11} />{f.kind === 'feedback' ? 'Feedback privado' : 'Privado'}</span> : null}{f.value_tag ? <span className="rh-tag v">{f.value_tag}</span> : null}</div> : null}
                    <p className="rh-msg">{f.message}</p>
                    <div className="rh-ff">
                      {f.visibility === 'public' ? <button type="button" onClick={() => void cheer(f)} aria-pressed={!!c?.me} className={'rh-heart' + (c?.me ? ' on' : '')}><Heart size={14} fill={c?.me ? 'currentColor' : 'none'} />{c?.n ? c.n : 'Aplaudir'}</button> : null}
                      <span className="rh-sp" />
                      {f.from_id === profile?.id || isAdmin ? <button type="button" className="dk-ic" aria-label="Apagar" title="Apagar" onClick={() => void del(f)}><Trash2 size={15} /></button> : null}
                    </div>
                  </div>
                </article>); })}
            </div>
          ) : <RhEmpty title={view === 'wall' ? 'O mural ainda está vazio' : view === 'received' ? 'Nada recebido ainda' : 'Nada enviado ainda'} text={view === 'wall' ? 'Reconheça alguém que fez um bom trabalho. O elogio aparece aqui para toda a empresa.' : view === 'received' ? 'Os elogios e feedbacks que você receber ficam guardados aqui.' : 'Os elogios e feedbacks que você der ficam guardados aqui.'} action={view !== 'received' ? <button type="button" className="dk-btn" onClick={() => openForm('elogio')}><Plus size={16} />Elogiar alguém</button> : null} />}
        </div>
        <div className="rh-col">
          <RhSec title="Mais elogiados nos últimos 30 dias">
            {top.length ? <div className="rh-list">{top.map(([pid, n], i) => (
              <div key={pid} className="rh-row"><span className="rh-rank">{i + 1}</span><Av p={byId.get(pid)} size={30} /><div className="rh-main"><div className="rh-t">{pname(byId.get(pid))}</div></div><span className="rh-m" style={{ marginTop: 0 }}>{n} {n === 1 ? 'elogio' : 'elogios'}</span></div>
            ))}</div> : <RhEmpty title="Sem elogios no período" text="Os elogios públicos dos últimos 30 dias aparecem aqui." />}
          </RhSec>
          <div className="rh-card rh-note"><b>Feedback privado</b><span>Só você, a pessoa e os gestores dela veem. Use para orientar com gentileza: o que aconteceu, o impacto e uma sugestão.</span></div>
        </div>
      </div>
      <Dialog open={form} onOpenChange={(o) => { if (!busy) setForm(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{kind === 'elogio' ? 'Elogiar alguém' : 'Dar feedback'}</DialogTitle><DialogDescription>{kind === 'elogio' ? 'Reconheça o trabalho de um colega. O elogio público aparece no mural.' : 'O feedback é privado: só vocês dois e os gestores da pessoa veem.'}</DialogDescription></DialogHeader>
          <div className="cx-form">
            <div><label className="cx-l">Para quem</label><Sel className="ui-sel w-full" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Pessoa"><option value="">Escolha a pessoa</option>{people.filter((p) => p.id !== profile?.id).map((p) => <option key={p.id} value={p.id}>{pname(p)}</option>)}</Sel></div>
            {kind === 'elogio' ? <>
              <div><label className="cx-l">Valor</label><div className="flex flex-wrap gap-1.5">{VALUES.map((v) => <button key={v} type="button" className="ui-chip" aria-pressed={tag === v} onClick={() => setTag(tag === v ? '' : v)}>{v}</button>)}</div></div>
              <div className="cx-checks"><label><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />Mostrar no mural da empresa</label></div>
            </> : null}
            <div><label className="cx-l" htmlFor="fb-msg">Mensagem</label><Textarea id="fb-msg" rows={4} maxLength={1500} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={kind === 'elogio' ? 'Ex.: Obrigado por resolver o problema do cliente tão rápido!' : 'Seja específico e gentil: o que aconteceu, o impacto e uma sugestão.'} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setForm(false)} disabled={busy}>Cancelar</Button><Button onClick={() => void send()} disabled={busy || !to || !msg.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
