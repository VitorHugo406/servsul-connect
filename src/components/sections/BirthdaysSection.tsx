import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, PartyPopper, Calendar, CheckCircle2, Download, Send, Sparkles, Users, QrCode, Image as ImageIcon, Upload, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { buildBirthdayPdf } from '@/lib/pdf/birthdayPdf';
import { circularPhoto, companyLogoImage, ewvonLogoImage } from '@/lib/pdf/pdfAssets';
import { Skeleton } from '@/components/ui/skeleton';
import { CardGridSkeleton, StatsSkeleton } from '@/components/ui/skeletons';
import { useBirthdays } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { GERAL_SECTOR_ID, formatShortDate } from '@/lib/birthdayUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { withCompany } from '@/lib/companyScope';
import { canManageBirthdayPresentation, upcomingBirthdayPeople } from '@/lib/birthdayPresentation';

const monthThemes: Record<number, { name: string; emoji: string }> = {
  1: { name: 'Verão Corporativo', emoji: '☀️' }, 2: { name: 'Carnaval de Conquistas', emoji: '🎭' }, 3: { name: 'Ciclo de Renovação', emoji: '🌿' }, 4: { name: 'Celebração Especial', emoji: '🎁' }, 5: { name: 'Mês de Reconhecimento', emoji: '🌟' }, 6: { name: 'Festa Junina', emoji: '🌽' }, 7: { name: 'Arraiá de Talentos', emoji: '🎊' }, 8: { name: 'Mês de Excelência', emoji: '🏆' }, 9: { name: 'Primavera', emoji: '🌸' }, 10: { name: 'Energia da Equipe', emoji: '⚡' }, 11: { name: 'Gratidão e Parceria', emoji: '🤝' }, 12: { name: 'Natal', emoji: '🎄' },
};

type BirthdayPerson = ReturnType<typeof useBirthdays>['birthdayPeople'][number];

export function BirthdaysSection() {
  const { profile, roles } = useAuth();
  const canManage = canManageBirthdayPresentation(roles);
  const { company } = useCompany();
  const { birthdayPeople, loading, currentDay } = useBirthdays();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const currentMonth = new Date().getMonth() + 1;
  const theme = monthThemes[currentMonth];
  const todayBirthdays = birthdayPeople.filter(p => p.isToday);
  const celebrationToday = birthdayPeople.filter(p => p.isCelebrationToday);
  const upcomingBirthdays = birthdayPeople.filter(p => !p.isToday && p.birthDay > currentDay);
  const pastBirthdays = birthdayPeople.filter(p => !p.isToday && p.birthDay < currentDay);
  const sectorCount = useMemo(() => new Set(birthdayPeople.map(p => p.sector)).size, [birthdayPeople]);
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

  if (loading) return <div className="p-4 md:p-6 space-y-6"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-64 rounded-md" /><Skeleton className="h-3.5 w-80 rounded-md" /></div></div>{canManage && <StatsSkeleton count={4} />}<CardGridSkeleton count={4} columns="lg:grid-cols-2" cardHeight="h-24" /></div>;
  if (!canManage) {
    const upcoming = upcomingBirthdayPeople(birthdayPeople, currentDay);
    return <div className="space-y-6 p-4 md:p-6">
      <PageHeader icon={<Cake />} title="Aniversariantes" subtitle="Próximos aniversários do mês." />
      {upcoming.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Nenhum próximo aniversariante neste mês.</p> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{upcoming.map(person => <Card key={person.id}><CardContent className="flex items-center gap-3 p-5"><Avatar className="h-11 w-11 shrink-0"><AvatarImage src={person.avatar} alt={person.name} /><AvatarFallback className="bg-muted text-muted-foreground">{getInitials(person.name)}</AvatarFallback></Avatar><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-foreground">{person.name}</h3><p className="break-words text-xs text-muted-foreground">{person.sector || 'Sem departamento'}</p></div></CardContent></Card>)}</div>}
    </div>;
  }
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6"><PageHeader icon={<Cake />} title="Aniversariantes" subtitle="Felicitações do mês. Quando o aniversário cai em fim de semana ou feriado, a mensagem é antecipada." actions={<><Button onClick={generateMonthlyPdf} disabled={generatingPdf || birthdayPeople.length === 0} className="h-9 gap-2"><Download className="h-4 w-4" />{generatingPdf ? 'Gerando...' : 'Baixar PDF'}</Button></>} /><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon={Users} label="No mês" value={birthdayPeople.length} /><Metric icon={PartyPopper} label="Hoje" value={todayBirthdays.length} /><Metric icon={Sparkles} label="Mensagem hoje" value={celebrationToday.length} /><Metric icon={Calendar} label="Setores" value={sectorCount} /></div>{celebrationToday.length > 0 && <section className="space-y-3"><SectionTitle icon={PartyPopper} title="Felicitações para enviar hoje" subtitle="Se o aniversário cair em sábado, domingo ou feriado, a mensagem aparece antecipada." /><div className="grid gap-4 lg:grid-cols-2">{celebrationToday.map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><Card className="overflow-hidden rounded-2xl border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-card shadow-sm"><CardContent className="space-y-4 p-4 sm:p-5"><BirthdayRow person={person} getInitials={getInitials} badge="Mensagem hoje" highlight /><Textarea value={messages[person.id] || ''} onChange={e => setMessages(prev => ({ ...prev, [person.id]: e.target.value }))} placeholder={`Escreva uma mensagem para ${person.name}...`} className="min-h-[88px] rounded-xl" /><Button onClick={() => sendGreeting(person)} disabled={sendingId === person.id} className="w-full gap-2 rounded-xl"><Send className="h-4 w-4" /> Enviar no chat Geral</Button></CardContent></Card></motion.div>)}</div></section>}<section className="space-y-3"><SectionTitle icon={Calendar} title="Próximos aniversariantes do mês" subtitle="Quem ainda vai fazer aniversário este mês. Quem já fez aparece logo abaixo, em anteriores." />{todayBirthdays.length + upcomingBirthdays.length === 0 && birthdayPeople.length > 0 ? <p className="rounded-2xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">Todos os aniversariantes deste mês já comemoraram.</p> : birthdayPeople.length === 0 ? <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center"><div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Cake className="h-6 w-6 text-muted-foreground" /></div><h4 className="font-display text-lg font-semibold text-foreground">Nenhum aniversariante</h4><p className="text-sm text-muted-foreground">Não há aniversariantes neste mês com data cadastrada.</p></div> : <div className="grid gap-3 xl:grid-cols-2">{[...todayBirthdays, ...upcomingBirthdays].map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}><Card className="rounded-2xl border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><CardContent className="p-4"><BirthdayRow person={person} getInitials={getInitials} badge={person.isToday ? 'Hoje' : formatBirthday(person.birthDate)} /></CardContent></Card></motion.div>)}</div>}</section>{pastBirthdays.length > 0 && <section className="space-y-3"><SectionTitle icon={Calendar} title="Aniversariantes anteriores" subtitle="Já comemoraram neste mês." /><div className="grid gap-3 opacity-70 xl:grid-cols-2">{[...pastBirthdays].sort((a, b) => b.birthDay - a.birthDay).map(person => <Card key={person.id} className="rounded-2xl border-border/60"><CardContent className="p-4"><BirthdayRow person={person} getInitials={getInitials} badge={formatBirthday(person.birthDate)} /></CardContent></Card>)}</div></section>}</motion.div>;
}

function Metric({ label, value }: { icon: LucideIcon; label: string; value: number }) { return <Card><CardContent className="p-4"><p className="text-[13px] text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p></CardContent></Card>; }
function SectionTitle({ title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) { return <div className="min-w-0"><h3 className="text-[15px] font-semibold text-foreground">{title}</h3><p className="text-[13px] text-muted-foreground">{subtitle}</p></div>; }
function BirthdayRow({ person, getInitials, badge, highlight }: { person: BirthdayPerson; getInitials: (name: string) => string; badge: string; highlight?: boolean }) { return <div className="flex items-center gap-4"><div className="relative flex-shrink-0"><Avatar className={cn(highlight ? 'h-16 w-16 ring-4 ring-secondary/30' : 'h-12 w-12 ring-2 ring-border/50')}><AvatarImage src={person.avatar} /><AvatarFallback className="bg-secondary font-bold text-secondary-foreground">{getInitials(person.name)}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm shadow ring-1 ring-border/50"><Cake className="h-3.5 w-3.5 text-muted-foreground" /></div></div><div className="min-w-0 flex-1"><h4 className="truncate font-semibold text-foreground">{person.name}</h4><p className="truncate text-sm text-muted-foreground">{person.sector}</p><div className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant={highlight ? 'default' : 'outline'} className="rounded-full"><Cake className="mr-1 h-3 w-3" />{badge}</Badge>{person.celebrationDate && <Badge variant="secondary" className="rounded-full"><CheckCircle2 className="mr-1 h-3 w-3" />Mensagem: {formatShortDate(person.celebrationDate)}</Badge>}</div></div></div>; }