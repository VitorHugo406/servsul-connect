import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, PartyPopper, Calendar, CheckCircle2, Download, Send, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import jsPDF from 'jspdf';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { withCompany } from '@/lib/companyScope';
import { getCompanyLogoUrl } from '@/lib/companyLogo';

const monthThemes: Record<number, { name: string; emoji: string; accent: [number, number, number] }> = {
  1: { name: 'Verão Corporativo', emoji: '☀️', accent: [234, 88, 12] },
  2: { name: 'Carnaval de Conquistas', emoji: '🎭', accent: [37, 99, 235] },
  3: { name: 'Ciclo de Renovação', emoji: '🌿', accent: [22, 163, 74] },
  4: { name: 'Celebração Especial', emoji: '🎁', accent: [168, 85, 247] },
  5: { name: 'Mês de Reconhecimento', emoji: '🌟', accent: [202, 138, 4] },
  6: { name: 'Festa Junina', emoji: '🌽', accent: [234, 88, 12] },
  7: { name: 'Arraiá de Talentos', emoji: '🎊', accent: [220, 38, 38] },
  8: { name: 'Mês de Excelência', emoji: '🏆', accent: [37, 99, 235] },
  9: { name: 'Primavera', emoji: '🌸', accent: [219, 39, 119] },
  10: { name: 'Energia da Equipe', emoji: '⚡', accent: [245, 158, 11] },
  11: { name: 'Gratidão e Parceria', emoji: '🤝', accent: [13, 148, 136] },
  12: { name: 'Natal', emoji: '🎄', accent: [22, 163, 74] },
};

const pdfThemes = [
  { id: 'corporate', name: 'Corporativo', emoji: '✦', accent: [61, 47, 214] as [number, number, number], secondary: [18, 194, 240] as [number, number, number] },
  { id: 'junina', name: 'Festa Junina', emoji: '🌽', accent: [234, 88, 12] as [number, number, number], secondary: [22, 163, 74] as [number, number, number] },
  { id: 'christmas', name: 'Natal', emoji: '🎄', accent: [22, 120, 70] as [number, number, number], secondary: [185, 28, 28] as [number, number, number] },
  { id: 'newyear', name: 'Ano Novo', emoji: '✨', accent: [180, 130, 25] as [number, number, number], secondary: [30, 41, 59] as [number, number, number] },
  { id: 'spring', name: 'Primavera', emoji: '🌸', accent: [219, 39, 119] as [number, number, number], secondary: [124, 58, 237] as [number, number, number] },
];

type BirthdayPerson = ReturnType<typeof useBirthdays>['birthdayPeople'][number];

export function BirthdaysSection() {
  const { profile } = useAuth();
  const { company } = useCompany();
  const { birthdayPeople, loading, currentDay } = useBirthdays();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [selectedPdfTheme, setSelectedPdfTheme] = useState('corporate');

  const currentMonth = new Date().getMonth() + 1;
  const theme = monthThemes[currentMonth];
  const pdfTheme = pdfThemes.find((item) => item.id === selectedPdfTheme) ?? pdfThemes[0];

  const todayBirthdays = birthdayPeople.filter((p) => p.isToday);
  const celebrationToday = birthdayPeople.filter((p) => p.isCelebrationToday);
  const upcomingBirthdays = birthdayPeople.filter((p) => !p.isToday && p.birthDay > currentDay);
  const pastBirthdays = birthdayPeople.filter((p) => !p.isToday && p.birthDay < currentDay);
  const sectorCount = useMemo(() => new Set(birthdayPeople.map((p) => p.sector)).size, [birthdayPeople]);

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  const formatBirthday = (dateStr: string) => {
    const [, month, day] = dateStr.split('-').map(Number);
    const date = new Date(new Date().getFullYear(), month - 1, day, 12);
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  };

  const sendGreeting = async (person: BirthdayPerson) => {
    if (!profile) return;
    const message = messages[person.id]?.trim();
    if (!message) { toast.error('Escreva uma mensagem antes de enviar.'); return; }
    setSendingId(person.id);
    const content = `🎉 Feliz aniversário, ${person.name}!\n\n${message}\n\n— ${profile.display_name || profile.name}`;
    const { error } = await supabase.from('messages').insert(withCompany({ content, author_id: profile.id, sector_id: GERAL_SECTOR_ID }));
    setSendingId(null);
    if (error) { toast.error('Não foi possível enviar no chat Geral.'); return; }
    setMessages((prev) => ({ ...prev, [person.id]: '' }));
    toast.success('Mensagem enviada no chat Geral!');
  };

  const loadImage = async (src: string) => {
    if (!src) return null;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const BRAND_PRIMARY: [number, number, number] = [61, 47, 214];
  const PAGE_W = 210;
  const MARGIN = 14;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const truncateText = (doc: jsPDF, text: string, maxWidth: number) => {
    let t = text || '';
    while (doc.getTextWidth(t) > maxWidth && t.length > 1) t = t.slice(0, -1);
    return t !== text ? t.slice(0, -1) + '…' : t;
  };

  const drawDecorations = (doc: jsPDF, id: string, accent: [number, number, number], secondary: [number, number, number]) => {
    const w = PAGE_W;
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(...accent);
    if (id === 'junina') {
      for (let x = 8; x < w; x += 20) { doc.setFillColor(...accent); doc.triangle(x, 7, x + 7, 7, x + 3.5, 14, 'F'); doc.setFillColor(...secondary); doc.triangle(x + 7, 7, x + 14, 7, x + 10.5, 14, 'F'); }
      doc.setDrawColor(...secondary); doc.setLineWidth(0.8); doc.line(0, 14, w, 14);
    } else if (id === 'christmas') {
      doc.setFillColor(...secondary); doc.circle(w - 18, 18, 9, 'F'); doc.setFillColor(255,255,255); doc.circle(w - 21, 15, 2, 'F');
      doc.setFillColor(...accent); doc.rect(0, 0, w, 5, 'F');
    } else if (id === 'newyear') {
      doc.setFillColor(...accent); doc.circle(w - 22, 22, 11, 'F'); doc.setFillColor(255,255,255); doc.circle(w - 26, 18, 1.2, 'F'); doc.circle(w - 18, 23, 1, 'F');
      doc.setDrawColor(...secondary); doc.setLineWidth(0.5); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; doc.line(w - 22, 22, w - 22 + Math.cos(a) * 16, 22 + Math.sin(a) * 16); }
    } else if (id === 'spring') {
      doc.setFillColor(...accent); for (let x = 8; x < w; x += 28) { doc.circle(x, 9, 2.2, 'F'); doc.circle(x + 3, 7, 1.7, 'F'); doc.circle(x + 3, 11, 1.7, 'F'); }
      doc.setFillColor(...secondary); doc.rect(0, 0, w, 3, 'F');
    } else {
      doc.setFillColor(...secondary); doc.rect(0, 0, w, 3, 'F');
      doc.setFillColor(...accent); doc.circle(w - 16, 16, 7, 'F');
    }
    doc.setFillColor(248, 250, 252); doc.rect(0, h - 7, w, 7, 'F');
  };

  const drawBirthdaysHeader = async (doc: jsPDF, monthName: string, count: number) => {
    const [accentR, accentG, accentB] = pdfTheme.accent;
    const [secondaryR, secondaryG, secondaryB] = pdfTheme.secondary;
    doc.setFillColor(accentR, accentG, accentB); doc.rect(0, 0, PAGE_W, 34, 'F');
    doc.setFillColor(secondaryR, secondaryG, secondaryB); doc.rect(0, 31, PAGE_W, 3, 'F');
    drawDecorations(doc, pdfTheme.id, pdfTheme.accent, pdfTheme.secondary);

    const logoUrl = company?.logo_url ? getCompanyLogoUrl(company.logo_url) : null;
    const logo = logoUrl ? await loadImage(logoUrl) : null;
    if (logo) {
      try { doc.addImage(logo, 'PNG', MARGIN, 7, 18, 18); } catch { /* fallback below */ }
    } else {
      doc.setFillColor(255, 255, 255); doc.circle(MARGIN + 9, 16, 9, 'F');
      doc.setTextColor(accentR, accentG, accentB); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text(getInitials(company?.name || 'Nuvexa'), MARGIN + 9, 18.5, { align: 'center' });
    }

    const companyName = company?.name || 'Nuvexa';
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(truncateText(doc, companyName, 70), MARGIN + 23, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text('Relatório de Aniversariantes', MARGIN + 23, 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(`Aniversariantes de ${monthName}`, PAGE_W - MARGIN, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(`${count} pessoa(s) • Tema: ${pdfTheme.name}`, PAGE_W - MARGIN, 20, { align: 'right' });

    let y = 43;
    doc.setTextColor(71, 85, 105); doc.setFontSize(8.5); doc.text(`${pdfTheme.emoji} ${pdfTheme.name}`, MARGIN, y);
    doc.setTextColor(150, 150, 150); doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, PAGE_W - MARGIN, y, { align: 'right' });
    y += 5; doc.setDrawColor(...pdfTheme.secondary); doc.setLineWidth(0.8); doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    return y + 8;
  };

  const drawBirthdaysFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(MARGIN, h - 14, PAGE_W - MARGIN, h - 14);
    doc.setFontSize(7); doc.setTextColor(140, 140, 140); doc.setFont('helvetica', 'normal');
    doc.text(`${company?.name || 'Nuvexa'} • Painel de Aniversariantes`, MARGIN, h - 9);
    doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, h - 9, { align: 'right' });
  };

  const generateMonthlyPdf = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const [r, g, b] = pdfTheme.accent;
      const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      let y = await drawBirthdaysHeader(doc, monthName, birthdayPeople.length);
      let x = MARGIN;
      const gap = 8;
      const cardW = (CONTENT_W - gap) / 2;
      const cardH = 40;
      const bottomLimit = 278;

      for (const person of birthdayPeople) {
        if (y + cardH > bottomLimit) { doc.addPage(); y = await drawBirthdaysHeader(doc, monthName, birthdayPeople.length); x = MARGIN; }
        doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, cardW, cardH, 4, 4, 'F');
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.35); doc.roundedRect(x, y, cardW, cardH, 4, 4, 'S');
        doc.setFillColor(r, g, b); doc.roundedRect(x, y, 2.5, cardH, 1, 1, 'F');
        const img = await loadImage(person.avatar);
        if (img) { try { doc.addImage(img, 'JPEG', x + 5, y + 7, 23, 23); } catch { /* fallback */ } }
        else { doc.setFillColor(r, g, b); doc.circle(x + 16.5, y + 18.5, 11.5, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.text(getInitials(person.name), x + 16.5, y + 20.5, { align: 'center' }); }
        doc.setFillColor(...pdfTheme.secondary); doc.circle(x + 26, y + 31, 5, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.text(pdfTheme.emoji, x + 26, y + 33, { align: 'center' });

        const textX = x + 33; const textMaxW = cardW - 36;
        doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(truncateText(doc, person.name, textMaxW), textX, y + 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(truncateText(doc, person.sector, textMaxW), textX, y + 21);
        doc.setTextColor(r, g, b); doc.text(truncateText(doc, `Aniversário: ${formatBirthday(person.birthDate)}`, textMaxW), textX, y + 29);
        if (person.celebrationDate && formatShortDate(person.celebrationDate) !== formatShortDate(new Date(new Date().getFullYear(), person.birthMonth - 1, person.birthDay))) {
          doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text(truncateText(doc, `Felicitação: ${formatShortDate(person.celebrationDate)}`, textMaxW), textX, y + 36);
        }
        x = x === MARGIN ? MARGIN + cardW + gap : MARGIN;
        if (x === MARGIN) y += cardH + gap;
      }

      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) { doc.setPage(i); drawBirthdaysFooter(doc, i, pages); }
      const safeTheme = pdfTheme.name.toLowerCase().replace(/[^a-z0-9áéíóúãõç]+/gi, '_');
      doc.save(`aniversariantes_${safeTheme}_${monthName.replace(/\s/g, '_')}.pdf`);
      toast.success(`PDF estilizado (${pdfTheme.name}) gerado com sucesso!`);
    } catch (error) {
      console.error('Erro ao gerar PDF de aniversariantes:', error);
      toast.error('Não foi possível gerar o PDF.');
    } finally { setGeneratingPdf(false); }
  };

  if (loading) {
    return <div className="p-4 md:p-6 space-y-6"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-64 rounded-md" /><Skeleton className="h-3.5 w-80 rounded-md" /></div></div><StatsSkeleton count={4} /><CardGridSkeleton count={4} columns="lg:grid-cols-2" cardHeight="h-24" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-secondary/15 via-card to-primary/5 p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-secondary/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5"><div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl gradient-secondary shadow-glow text-xl">{theme.emoji}</div><div className="min-w-0"><h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">Painel de Aniversariantes</h2><p className="text-sm text-muted-foreground truncate">{theme.name} • mensagens antecipadas em fins de semana e feriados</p></div></div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[250px]">
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-background/60 p-1.5">
              {pdfThemes.map((item) => <button key={item.id} type="button" onClick={() => setSelectedPdfTheme(item.id)} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all', selectedPdfTheme === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted')}><span>{item.emoji}</span>{item.name}</button>)}
            </div>
            <Button onClick={generateMonthlyPdf} disabled={generatingPdf || birthdayPeople.length === 0} className="w-full gap-2 rounded-xl sm:w-auto"><Download className="h-4 w-4" />{generatingPdf ? 'Gerando...' : `Baixar PDF • ${pdfTheme.name}`}</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon={Users} label="No mês" value={birthdayPeople.length} /><Metric icon={PartyPopper} label="Hoje" value={todayBirthdays.length} /><Metric icon={Sparkles} label="Mensagem hoje" value={celebrationToday.length} /><Metric icon={Calendar} label="Setores" value={sectorCount} /></div>

      {celebrationToday.length > 0 && <section className="space-y-3"><SectionTitle icon={PartyPopper} title="Felicitações para enviar hoje" subtitle="Se o aniversário cair em sábado, domingo ou feriado, a mensagem aparece antecipada." /><div className="grid gap-4 lg:grid-cols-2">{celebrationToday.map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><Card className="overflow-hidden rounded-2xl border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-card shadow-sm"><CardContent className="space-y-4 p-4 sm:p-5"><BirthdayRow person={person} getInitials={getInitials} badge="Mensagem hoje" highlight /><Textarea value={messages[person.id] || ''} onChange={(e) => setMessages((prev) => ({ ...prev, [person.id]: e.target.value }))} placeholder={`Escreva uma mensagem para ${person.name}...`} className="min-h-[88px] rounded-xl" /><Button onClick={() => sendGreeting(person)} disabled={sendingId === person.id} className="w-full gap-2 rounded-xl"><Send className="h-4 w-4" /> Enviar no chat Geral</Button></CardContent></Card></motion.div>)}</div></section>}

      <section className="space-y-3"><SectionTitle icon={Calendar} title="Todos os aniversariantes do mês" subtitle="Visão completa para planejamento das felicitações e ações internas." />{birthdayPeople.length === 0 ? <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center"><div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><span className="text-3xl">🎂</span></div><h4 className="font-display text-lg font-semibold text-foreground">Nenhum aniversariante</h4><p className="text-sm text-muted-foreground">Não há aniversariantes neste mês com data cadastrada.</p></div> : <div className="grid gap-3 xl:grid-cols-2">{[...todayBirthdays, ...upcomingBirthdays, ...pastBirthdays].map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}><Card className="rounded-2xl border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><CardContent className="p-4"><BirthdayRow person={person} getInitials={getInitials} badge={person.isToday ? 'Hoje' : formatBirthday(person.birthDate)} /></CardContent></Card></motion.div>)}</div>}</section>
    </motion.div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) { return <Card className="rounded-2xl border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex items-center gap-3 p-3.5 sm:p-4"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><div className="min-w-0"><p className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }

function SectionTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) { return <div className="flex items-center gap-3"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div><div className="min-w-0"><h3 className="font-display text-base sm:text-lg font-semibold text-foreground">{title}</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>; }

function BirthdayRow({ person, getInitials, badge, highlight }: { person: BirthdayPerson; getInitials: (name: string) => string; badge: string; highlight?: boolean }) { return <div className="flex items-center gap-4"><div className="relative flex-shrink-0"><Avatar className={cn(highlight ? 'h-16 w-16 ring-4 ring-secondary/30' : 'h-12 w-12 ring-2 ring-border/50')}><AvatarImage src={person.avatar} /><AvatarFallback className="bg-secondary font-bold text-secondary-foreground">{getInitials(person.name)}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm shadow ring-1 ring-border/50">🎂</div></div><div className="min-w-0 flex-1"><h4 className="truncate font-semibold text-foreground">{person.name}</h4><p className="truncate text-sm text-muted-foreground">{person.sector}</p><div className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant={highlight ? 'default' : 'outline'} className="rounded-full"><Cake className="mr-1 h-3 w-3" />{badge}</Badge>{person.celebrationDate && <Badge variant="secondary" className="rounded-full"><CheckCircle2 className="mr-1 h-3 w-3" />Mensagem: {formatShortDate(person.celebrationDate)}</Badge>}</div></div></div>; }
