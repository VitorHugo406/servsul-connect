// Reconhecimento: public praise wall (elogios with a company value, colleagues can applaud) + private feedback
// (only the two people and the person's managers see it). The person is notified. feedbacks / feedback_cheers
// (migration 20261121010000).
import { useCallback, useEffect, useState } from 'react';
import { Heart, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';
import { Av, db, fmtDH, pname, usePeople } from './rhShared';
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
  return (
    <div className="flex flex-col">
      <div className="dk-bar">
        <nav className="dk-tb rh-sub" aria-label="Ver">
          {([['wall', 'Mural de elogios'], ['received', 'Recebidos'], ['sent', 'Enviados']] as const).map(([k, l]) => <button key={k} type="button" aria-current={view === k ? 'true' : undefined} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}
        </nav>
        <div className="dk-flt"><button type="button" className="dk-btn pri" onClick={() => { setKind('elogio'); setPub(true); setForm(true); }}><Plus size={16} />Elogiar alguém</button><button type="button" className="dk-btn" onClick={() => { setKind('feedback'); setPub(false); setForm(true); }}><Lock size={15} />Dar feedback</button></div>
      </div>
      {rows === null ? <div className="dk-empty"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : list.length ? (
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((f) => { const a = byId.get(f.from_id), b = byId.get(f.to_id), c = cheers.get(f.id); return (
            <article key={f.id} className="flex flex-col gap-2 rounded-[16px] border border-border bg-card p-4">
              <div className="flex items-center gap-2"><Av p={b} size={36} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{pname(b)}</div><div className="truncate text-xs text-muted-foreground">de {pname(a)} · {fmtDH(f.created_at)}</div></div>
                {f.kind === 'feedback' || f.visibility === 'private' ? <span className="dk-chp dk-c-n"><Lock className="mr-1 inline h-3 w-3" />{f.kind === 'feedback' ? 'Feedback' : 'Privado'}</span> : f.value_tag ? <span className="dk-chp dk-c-g">{f.value_tag}</span> : null}</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{f.message}</p>
              <div className="mt-auto flex items-center gap-2">
                {f.visibility === 'public' ? <button type="button" onClick={() => void cheer(f)} aria-pressed={!!c?.me} className={`inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-xs font-medium ${c?.me ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}><Heart className="h-3.5 w-3.5" fill={c?.me ? 'currentColor' : 'none'} />{c?.n || 0}</button> : null}
                <span className="flex-1" />
                {f.from_id === profile?.id || isAdmin ? <button type="button" className="cx-iconbtn" aria-label="Apagar" onClick={() => void del(f)}><Trash2 className="h-4 w-4" /></button> : null}
              </div>
            </article>); })}
        </div>
      ) : <div className="dk-empty">{view === 'wall' ? 'Ninguém foi elogiado ainda. Que tal começar?' : view === 'received' ? 'Você ainda não recebeu elogios ou feedbacks.' : 'Você ainda não enviou elogios ou feedbacks.'}</div>}
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
