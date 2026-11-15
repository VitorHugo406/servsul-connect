import { useMemo, useState } from 'react';
import { Download, Send, Gift, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { buildBirthdayPdf } from '@/lib/pdf/birthdayPdf';
import { circularPhoto, companyLogoImage, ewvonLogoImage } from '@/lib/pdf/pdfAssets';
import { Skeleton } from '@/components/ui/skeleton';
import { useBirthdays } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { GERAL_SECTOR_ID, formatShortDate } from '@/lib/birthdayUtils';
import { toast } from 'sonner';
import { withCompany } from '@/lib/companyScope';
import { canManageBirthdayPresentation, upcomingBirthdayPeople } from '@/lib/birthdayPresentation';


type BirthdayPerson = ReturnType<typeof useBirthdays>['birthdayPeople'][number];

export function BirthdaysSection() {
  const { profile, roles } = useAuth();
  const canManage = canManageBirthdayPresentation(roles);
  const { company } = useCompany();
  const { birthdayPeople, loading, currentDay } = useBirthdays();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [tab, setTab] = useState<'all' | 'today' | 'next' | 'past'>('all');
  const [q, setQ] = useState('');
  const [sectorF, setSectorF] = useState('all');
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const todayBirthdays = birthdayPeople.filter(p => p.isToday);
  const celebrationToday = birthdayPeople.filter(p => p.isCelebrationToday);
  const upcomingBirthdays = birthdayPeople.filter(p => !p.isToday && p.birthDay > currentDay);
  const pastBirthdays = birthdayPeople.filter(p => !p.isToday && p.birthDay < currentDay);
  const sectors = useMemo(() => Array.from(new Set(birthdayPeople.map(p => p.sector || 'Sem setor'))).sort(), [birthdayPeople]);
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const formatBirthday = (dateStr: string) => { const [, month, day] = dateStr.split('-').map(Number); return new Date(new Date().getFullYear(), month - 1, day, 12).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }); };

  const sendGreeting = async (person: BirthdayPerson) => { if (!profile) return; const message = messages[person.id]?.trim(); if (!message) { toast.error('Escreva uma mensagem antes de enviar.'); return; } setSendingId(person.id); const content = `🎉 Feliz aniversário, ${person.name}!\n\n${message}\n\n— ${profile.display_name || profile.name}`; const { error } = await supabase.from('messages').insert(withCompany({ content, author_id: profile.id, sector_id: GERAL_SECTOR_ID })); setSendingId(null); if (error) { toast.error('Não foi possível enviar no chat Geral.'); return; } setMessages(prev => ({ ...prev, [person.id]: '' })); toast.success('Mensagem enviada no chat Geral!'); };

  // One standard model for every company (see src/lib/pdf/birthdayPdf.ts): logo watermark, company color, small QR, numbered pages.
  const encodeShareData = (people: BirthdayPerson[]) => { const sectors = Array.from(new Set(people.map(p => p.sector || 'Sem setor'))); return { c: company?.name || 'Empresa', m: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), t: 'Padrão', g: new Date().toISOString(), x: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString(), s: sectors, p: people.map(p => [p.id.replace(/-/g, ''), p.name, sectors.indexOf(p.sector || 'Sem setor'), p.birthDate, p.celebrationDate || '', p.avatar || '']) }; };
  /** Short link (small, easy-to-scan QR). Falls back to the long self-contained link if the short one cannot be created. */
  const getShareUrl = async (people: BirthdayPerson[]) => {
    const payload = encodeShareData(people);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('create_birthday_share', { _payload: payload, _expires: payload.x });
      if (!error && typeof data === 'string' && data) return `${window.location.origin}/b/${data}`;
    } catch { /* fallback below */ }
    const bytes = new TextEncoder().encode(JSON.stringify(payload)); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    return `${window.location.origin}/birthday-report?data=${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
  };

  const generateMonthlyPdf = async () => {
    if (!canManage) return;
    setGeneratingPdf(true);
    try {
      const now = new Date();
      const [logo, ewvonLogo, url] = await Promise.all([companyLogoImage(company?.logo_url), ewvonLogoImage(), getShareUrl(birthdayPeople)]);
      const people = await Promise.all(birthdayPeople.map(async (p) => ({ name: p.name, sector: p.sector, day: p.birthDay, avatar: await circularPhoto(p.avatar) })));
      const doc = await buildBirthdayPdf({ companyName: company?.name || 'Empresa', primaryColor: company?.primary_color, secondaryColor: company?.secondary_color, logo, ewvonLogo, month: now.getMonth() + 1, year: now.getFullYear(), people, url });
      const slug = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      doc.save(`aniversariantes_${slug(company?.name || 'empresa')}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`);
      toast.success('PDF gerado!');
    } catch (error) { console.error('Erro ao gerar PDF de aniversariantes:', error); toast.error('Não foi possível gerar o PDF.'); }
    finally { setGeneratingPdf(false); }
  };

  const PASTEL = ['#DDE6F8', '#F6E3D3', '#DCEBDD', '#F3DDE6', '#E4DDF3'];
  const pastel = (name: string) => PASTEL[Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % PASTEL.length];
  const dayOf = (p: BirthdayPerson) => { const [, m, d] = p.birthDate.split('-').map(Number); return new Date(new Date().getFullYear(), m - 1, d, 12); };
  const wk = (p: BirthdayPerson) => dayOf(p).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const Avatar2 = ({ p }: { p: BirthdayPerson }) => <div className="dk-av" style={{ background: pastel(p.name) }}>{p.avatar ? <img src={p.avatar} alt="" /> : getInitials(p.name)}</div>;

  if (loading) return <div className="dk-pg"><div className="dk-panel" style={{ padding: 24 }}><Skeleton className="h-10 w-full rounded-full" /><div className="mt-4 space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div></div></div>;

  /* Colaborador comum: só nome e departamento dos próximos aniversariantes (regra de exibição; o acesso ao banco não muda). */
  if (!canManage) {
    const upcoming = upcomingBirthdayPeople(birthdayPeople, currentDay);
    return <div className="dk-pg"><div className="dk-panel">
      <div className="dk-bar"><div><div className="dk-ti" style={{ fontSize: 16 }}>Aniversariantes</div><div className="dk-sub">Próximos aniversários do mês.</div></div></div>
      {upcoming.length === 0 ? <div className="dk-empty">Nenhum próximo aniversariante neste mês.</div> : upcoming.map(p => <div key={p.id} className="dk-it"><div className="dk-db"><b>{String(p.birthDay).padStart(2, '0')}</b><span>{wk(p)}</span></div><Avatar2 p={p} /><div className="dk-nm"><div className="dk-ti">{p.name}</div><div className="dk-su">{p.sector || 'Sem departamento'}</div></div></div>)}
    </div></div>;
  }

  const match = (p: BirthdayPerson) => (sectorF === 'all' || (p.sector || 'Sem setor') === sectorF) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const hoje = birthdayPeople.filter(p => p.isToday && match(p));
  const proximos = upcomingBirthdays.filter(match).sort((a, b) => a.birthDay - b.birthDay);
  const passados = pastBirthdays.filter(match).sort((a, b) => a.birthDay - b.birthDay);
  const counts = { all: birthdayPeople.length, today: birthdayPeople.filter(p => p.isToday).length, next: upcomingBirthdays.length, past: pastBirthdays.length };
  const show = { past: tab === 'all' || tab === 'past', today: tab === 'all' || tab === 'today', next: tab === 'all' || tab === 'next' };
  const todayLabel = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  const msgCelebrate = (p: BirthdayPerson) => celebrationToday.some(c => c.id === p.id);

  /* mini calendário do mês */
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate(), prevDays = new Date(y, mo, 0).getDate();
  const bdays = new Set(birthdayPeople.map(p => p.birthDay));
  const cells: { d: number; cls: string }[] = [];
  for (let i = first - 1; i >= 0; i--) cells.push({ d: prevDays - i, cls: 'p' });
  for (let d = 1; d <= days; d++) cells.push({ d, cls: d === currentDay ? 't' : bdays.has(d) ? 'b' : '' });
  while (cells.length % 7) cells.push({ d: cells.length - first - days + 1, cls: 'p' });
  const nextPerson = proximos[0] || upcomingBirthdays.slice().sort((a, b) => a.birthDay - b.birthDay)[0];

  const Row = ({ p, kind }: { p: BirthdayPerson; kind: 'past' | 'today' | 'next' }) => (
    <>
      <div className={`dk-it${kind === 'today' ? ' hoje' : ''}${kind === 'past' ? ' dk-pas' : ''}`}>
        <div className="dk-db"><b>{String(p.birthDay).padStart(2, '0')}</b><span>{wk(p)}</span></div>
        <Avatar2 p={p} />
        <div className="dk-nm"><div className="dk-ti">{p.name}</div><div className="dk-su">{p.sector || 'Sem setor'}</div></div>
        {kind === 'past' && <span className="dk-done"><Check size={15} />Já comemorou</span>}
        {kind === 'today' && <button className="dk-btn pri" onClick={() => setOpenMsg(openMsg === p.id ? null : p.id)}><Gift size={16} />Enviar parabéns</button>}
        {kind === 'next' && <span className="dk-su" style={{ margin: 0 }}>{p.celebrationDate ? `Mensagem em ${formatShortDate(p.celebrationDate)}` : formatBirthday(p.birthDate)}</span>}
      </div>
      {kind === 'today' && openMsg === p.id && <div className="dk-msg"><textarea value={messages[p.id] || ''} onChange={e => setMessages(prev => ({ ...prev, [p.id]: e.target.value }))} placeholder={`Escreva uma mensagem para ${p.name}...`} /><button className="dk-btn pri" disabled={sendingId === p.id} onClick={() => sendGreeting(p)}><Send size={15} />Enviar no chat Geral</button></div>}
    </>
  );
  const group = (label: string, color: string, list: BirthdayPerson[], kind: 'past' | 'today' | 'next') => list.length ? <div key={kind}><div className="dk-gh"><span style={{ background: color }} />{label} ({list.length})</div>{list.map(p => <Row key={p.id} p={p} kind={kind} />)}</div> : null;
  const nothing = (show.past ? passados.length : 0) + (show.today ? hoje.length : 0) + (show.next ? proximos.length : 0) === 0;

  return (
    <div className="dk-pg dk-split">
      <div className="dk-panel">
        <div className="dk-bar">
          <div className="dk-tabs" role="group" aria-label="Período">
            {([['all', 'Todos'], ['today', 'Hoje'], ['next', 'Próximos'], ['past', 'Já passaram']] as const).map(([k, l]) => <button key={k} aria-pressed={tab === k} className={`dk-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}<b>{counts[k]}</b></button>)}
          </div>
          <div className="dk-flt">
            <input type="text" placeholder="Buscar colaborador" aria-label="Buscar colaborador" value={q} onChange={e => setQ(e.target.value)} />
            <select aria-label="Setor" value={sectorF} onChange={e => setSectorF(e.target.value)}><option value="all">Setor: todos</option>{sectors.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <button className="dk-btn" onClick={generateMonthlyPdf} disabled={generatingPdf || birthdayPeople.length === 0}><Download size={15} />{generatingPdf ? 'Gerando...' : 'Baixar PDF'}</button>
          </div>
        </div>
        {birthdayPeople.length === 0 ? <div className="dk-empty"><b>Nenhum aniversariante</b><div className="dk-sub" style={{ marginTop: 6 }}>Não há aniversariantes neste mês com data cadastrada.</div></div>
          : nothing ? <div className="dk-empty">Nenhum colaborador encontrado.</div> : <>
            {show.past && group('Já passaram', '#5A6472', passados, 'past')}
            {show.today && group(`Hoje · ${todayLabel}`, '#0F4C81', hoje, 'today')}
            {show.next && group('Próximos', '#0A6B3D', proximos, 'next')}
          </>}
        <div className="dk-ft"><span>Quando o aniversário cai em fim de semana ou feriado, a mensagem é antecipada.</span><span>{birthdayPeople.length} no mês</span></div>
      </div>
      <div className="dk-panel">
        <div className="dk-cal">
          <div className="dk-ch2"><button className="dk-ic bg" aria-label="Mês anterior" disabled style={{ opacity: .4, cursor: 'default' }}><ChevronLeft size={17} /></button><strong>{now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}</strong><button className="dk-ic bg" aria-label="Próximo mês" disabled style={{ opacity: .4, cursor: 'default' }}><ChevronRight size={17} /></button></div>
          <div className="dk-wk">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="dk-gr">{cells.map((c, i) => <div key={i} className={`dk-d ${c.cls}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.d}</div>)}</div>
          <div className="dk-lg"><span><i />Dia com aniversário</span></div>
        </div>
        {nextPerson && <div className="dk-hl"><span className="k">Próximo aniversariante</span><span className="v">{nextPerson.name} · {String(nextPerson.birthDay).padStart(2, '0')}/{String(new Date().getMonth() + 1).padStart(2, '0')}</span></div>}
      </div>
    </div>
  );
}
