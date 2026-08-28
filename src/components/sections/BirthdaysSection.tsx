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
  1: { name: 'Verão Corporativo', emoji: '☀️', accent: [234, 88, 12] }, 2: { name: 'Carnaval de Conquistas', emoji: '🎭', accent: [37, 99, 235] }, 3: { name: 'Ciclo de Renovação', emoji: '🌿', accent: [22, 163, 74] }, 4: { name: 'Celebração Especial', emoji: '🎁', accent: [168, 85, 247] }, 5: { name: 'Mês de Reconhecimento', emoji: '🌟', accent: [202, 138, 4] }, 6: { name: 'Festa Junina', emoji: '🌽', accent: [234, 88, 12] }, 7: { name: 'Arraiá de Talentos', emoji: '🎊', accent: [220, 38, 38] }, 8: { name: 'Mês de Excelência', emoji: '🏆', accent: [37, 99, 235] }, 9: { name: 'Primavera', emoji: '🌸', accent: [219, 39, 119] }, 10: { name: 'Energia da Equipe', emoji: '⚡', accent: [245, 158, 11] }, 11: { name: 'Gratidão e Parceria', emoji: '🤝', accent: [13, 148, 136] }, 12: { name: 'Natal', emoji: '🎄', accent: [22, 163, 74] },
};

const pdfThemes = [
  { id: 'corporate', name: 'Corporativo', accent: [42, 49, 73] as [number, number, number], soft: [232, 236, 244] as [number, number, number], highlight: [86, 101, 138] as [number, number, number] },
  { id: 'junina', name: 'Festa Junina', accent: [154, 91, 54] as [number, number, number], soft: [248, 238, 220] as [number, number, number], highlight: [91, 123, 82] as [number, number, number] },
  { id: 'christmas', name: 'Natal', accent: [47, 91, 68] as [number, number, number], soft: [239, 244, 239] as [number, number, number], highlight: [161, 93, 91] as [number, number, number] },
  { id: 'newyear', name: 'Ano Novo', accent: [112, 92, 55] as [number, number, number], soft: [247, 244, 235] as [number, number, number], highlight: [76, 82, 91] as [number, number, number] },
  { id: 'spring', name: 'Primavera', accent: [126, 76, 104] as [number, number, number], soft: [248, 240, 246] as [number, number, number], highlight: [91, 123, 103] as [number, number, number] },
];

type BirthdayPerson = ReturnType<typeof useBirthdays>['birthdayPeople'][number];
type PdfTheme = typeof pdfThemes[number];

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
  const formatBirthday = (dateStr: string) => { const [, month, day] = dateStr.split('-').map(Number); return new Date(new Date().getFullYear(), month - 1, day, 12).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }); };

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
      return await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result)); reader.readAsDataURL(blob); });
    } catch { return null; }
  };

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const truncateText = (doc: jsPDF, text: string, maxWidth: number) => {
    let value = text || '';
    while (doc.getTextWidth(value) > maxWidth && value.length > 1) value = value.slice(0, -1);
    return value !== text ? `${value.slice(0, -1)}...` : value;
  };

  const setText = (doc: jsPDF, rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (doc: jsPDF, rgb: [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (doc: jsPDF, rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const drawThemeDetails = (doc: jsPDF, selected: PdfTheme) => {
    const [h1, h2, h3] = selected.highlight;
    setFill(doc, selected.soft);
    if (selected.id === 'junina') {
      for (let x = 18; x < PAGE_W - 12; x += 20) doc.triangle(x, 5, x + 7, 5, x + 3.5, 11, 'F');
      setDraw(doc, selected.highlight); doc.setLineWidth(0.45); doc.line(MARGIN, 12, PAGE_W - MARGIN, 12);
    } else if (selected.id === 'christmas') {
      doc.circle(PAGE_W - 25, 17, 5.5, 'F');
      setDraw(doc, selected.highlight); doc.setLineWidth(0.5); doc.line(MARGIN, 11, PAGE_W - MARGIN, 11);
    } else if (selected.id === 'newyear') {
      const cx = PAGE_W - 25, cy = 17;
      setDraw(doc, selected.highlight); doc.setLineWidth(0.4);
      for (let i = 0; i < 12; i += 1) { const a = (Math.PI * 2 * i) / 12; doc.line(cx, cy, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); }
      doc.circle(cx, cy, 1.8, 'F');
    } else if (selected.id === 'spring') {
      for (let x = 18; x < PAGE_W - 12; x += 26) { doc.circle(x, 8, 1.5, 'F'); doc.circle(x + 2.5, 6.5, 1, 'F'); doc.circle(x + 2.5, 9.5, 1, 'F'); }
    } else {
      doc.circle(PAGE_W - 22, 16, 4.5, 'F');
    }
    setFill(doc, [248, 249, 251]); doc.rect(0, PAGE_H - 6, PAGE_W, 6, 'F');
    setFill(doc, selected.accent); doc.rect(0, PAGE_H - 2, 42, 2, 'F');
    setFill(doc, [h1, h2, h3]); doc.rect(42, PAGE_H - 2, 20, 2, 'F');
  };

  const drawLogo = async (doc: jsPDF, logoUrl: string | null, companyName: string, selected: PdfTheme) => {
    const logo = logoUrl ? await loadImage(logoUrl) : null;
    if (logo) { try { doc.addImage(logo, 'PNG', MARGIN, 18, 25, 19, undefined, 'FAST'); return; } catch {} }
    setFill(doc, selected.soft); doc.roundedRect(MARGIN, 18, 25, 19, 4, 4, 'F');
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(getInitials(companyName || 'Nuvexa'), MARGIN + 12.5, 30, { align: 'center' });
  };

  const drawHeader = async (doc: jsPDF, monthName: string, count: number, selected: PdfTheme) => {
    await drawLogo(doc, company?.logo_url ? getCompanyLogoUrl(company.logo_url) : null, company?.name || 'Nuvexa', selected);
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(truncateText(doc, company?.name || 'Nuvexa', 92), MARGIN + 32, 25);
    setText(doc, [120, 126, 137]); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text('RELATORIO INTERNO • ANIVERSARIANTES', MARGIN + 32, 31);
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Aniversariantes', PAGE_W - MARGIN, 25, { align: 'right' });
    setText(doc, [120, 126, 137]); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(monthName, PAGE_W - MARGIN, 31, { align: 'right' });
    setDraw(doc, [226, 228, 233]); doc.setLineWidth(0.4); doc.line(MARGIN, 43, PAGE_W - MARGIN, 43);
    setText(doc, [86, 92, 104]); doc.setFontSize(8); doc.text(`${count} aniversariante${count === 1 ? '' : 's'}`, MARGIN, 51); doc.text(`Tema: ${selected.name}`, PAGE_W - MARGIN, 51, { align: 'right' });
    return 61;
  };

  const drawSectionLabel = (doc: jsPDF, selected: PdfTheme, y: number) => {
    setFill(doc, selected.accent); doc.roundedRect(MARGIN, y, 3, 14, 1.5, 1.5, 'F');
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Equipe que celebra neste mês', MARGIN + 8, y + 6);
    setText(doc, [130, 136, 147]); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3); doc.text('Uma apresentação limpa para mural, impressão e compartilhamento interno.', MARGIN + 8, y + 11);
  };

  const drawBirthdayRow = async (doc: jsPDF, person: BirthdayPerson, y: number, selected: PdfTheme, index: number) => {
    const rowH = 31;
    setFill(doc, index % 2 === 0 ? [250, 251, 253] : [255, 255, 255]);
    doc.roundedRect(MARGIN, y, CONTENT_W, rowH, 4, 4, 'F');
    setFill(doc, selected.soft); doc.circle(MARGIN + 14, y + rowH / 2, 10, 'F');
    const avatar = await loadImage(person.avatar);
    if (avatar) { try { doc.addImage(avatar, 'JPEG', MARGIN + 5, y + 6.5, 18, 18, undefined, 'FAST'); } catch {} }
    else { setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(getInitials(person.name), MARGIN + 14, y + 18.5, { align: 'center' }); }
    setText(doc, [42, 47, 58]); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text(truncateText(doc, person.name, 88), MARGIN + 30, y + 10);
    setText(doc, [117, 124, 137]); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(truncateText(doc, person.sector || 'Sem departamento', 88), MARGIN + 30, y + 17);
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(formatBirthday(person.birthDate), MARGIN + 30, y + 25);
    setText(doc, [150, 155, 165]); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.text('ANIVERSARIO', MARGIN + 30, y + 29);
    setFill(doc, selected.soft); doc.roundedRect(PAGE_W - MARGIN - 35, y + 8, 29, 15, 7.5, 7.5, 'F');
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(String(person.birthDay).padStart(2, '0'), PAGE_W - MARGIN - 20.5, y + 15, { align: 'center' });
    setText(doc, [120, 126, 138]); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.text('DIA', PAGE_W - MARGIN - 20.5, y + 19, { align: 'center' });
    setDraw(doc, [235, 237, 241]); doc.setLineWidth(0.25); doc.line(MARGIN + 30, y + 27.5, PAGE_W - MARGIN - 42, y + 27.5);
  };

  const drawFooter = (doc: jsPDF, pageNum: number, totalPages: number, selected: PdfTheme) => {
    const y = PAGE_H - 15;
    setDraw(doc, [225, 228, 233]); doc.setLineWidth(0.35); doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    setText(doc, [135, 141, 151]); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text(company?.name || 'Nuvexa', MARGIN, y + 6); doc.text('Uso interno • Relatório de aniversariantes', PAGE_W / 2, y + 6, { align: 'center' }); doc.text(`${pageNum}/${totalPages}`, PAGE_W - MARGIN, y + 6, { align: 'right' });
    setFill(doc, selected.accent); doc.circle(PAGE_W - MARGIN - 24, y + 5.2, 1.1, 'F');
  };

  const generateMonthlyPdf = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      let y = await drawHeader(doc, monthName, birthdayPeople.length, pdfTheme);
      drawThemeDetails(doc, pdfTheme);
      drawSectionLabel(doc, pdfTheme, y);
      y += 20;

      for (let i = 0; i < birthdayPeople.length; i += 1) {
        if (y + 31 > PAGE_H - 28) {
          doc.addPage();
          drawThemeDetails(doc, pdfTheme);
          y = await drawHeader(doc, monthName, birthdayPeople.length, pdfTheme);
          y += 8;
        }
        await drawBirthdayRow(doc, birthdayPeople[i], y, pdfTheme, i);
        y += 35;
      }

      if (birthdayPeople.length === 0) {
        setFill(doc, pdfTheme.soft); doc.roundedRect(MARGIN, y + 8, CONTENT_W, 45, 6, 6, 'F');
        setText(doc, pdfTheme.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Nenhum aniversariante neste mês', PAGE_W / 2, y + 30, { align: 'center' });
      }

      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) { doc.setPage(page); drawFooter(doc, page, pages, pdfTheme); }
      const companySlug = (company?.name || 'nuvexa').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const monthSlug = monthName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
      doc.save(`aniversariantes_${companySlug}_${monthSlug}_${pdfTheme.id}.pdf`);
      toast.success(`PDF ${pdfTheme.name} gerado com sucesso!`);
    } catch (error) {
      console.error('Erro ao gerar PDF de aniversariantes:', error);
      toast.error('Não foi possível gerar o PDF.');
    } finally { setGeneratingPdf(false); }
  };

  if (loading) return <div className="p-4 md:p-6 space-y-6"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-64 rounded-md" /><Skeleton className="h-3.5 w-80 rounded-md" /></div></div><StatsSkeleton count={4} /><CardGridSkeleton count={4} columns="lg:grid-cols-2" cardHeight="h-24" /></div>;

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6">
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-secondary/15 via-card to-primary/5 p-5 shadow-sm sm:p-6">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-secondary/20 blur-2xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3.5"><div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl gradient-secondary shadow-glow text-xl">{theme.emoji}</div><div className="min-w-0"><h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">Painel de Aniversariantes</h2><p className="text-sm text-muted-foreground truncate">{theme.name} • mensagens antecipadas em fins de semana e feriados</p></div></div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[250px]"><div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-background/60 p-1.5">{pdfThemes.map((item) => <button key={item.id} type="button" onClick={() => setSelectedPdfTheme(item.id)} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all', selectedPdfTheme === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted')}><span>{item.id === 'corporate' ? '◈' : item.id === 'junina' ? '◆' : item.id === 'christmas' ? '✦' : item.id === 'newyear' ? '✧' : '○'}</span>{item.name}</button>)}</div><Button onClick={generateMonthlyPdf} disabled={generatingPdf || birthdayPeople.length === 0} className="w-full gap-2 rounded-xl sm:w-auto"><Download className="h-4 w-4" /> {generatingPdf ? 'Gerando...' : `Baixar PDF • ${pdfTheme.name}`}</Button></div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon={Users} label="No mês" value={birthdayPeople.length} /><Metric icon={PartyPopper} label="Hoje" value={todayBirthdays.length} /><Metric icon={Sparkles} label="Mensagem hoje" value={celebrationToday.length} /><Metric icon={Calendar} label="Setores" value={sectorCount} /></div>
    {celebrationToday.length > 0 && <section className="space-y-3"><SectionTitle icon={PartyPopper} title="Felicitações para enviar hoje" subtitle="Se o aniversário cair em sábado, domingo ou feriado, a mensagem aparece antecipada." /><div className="grid gap-4 lg:grid-cols-2">{celebrationToday.map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><Card className="overflow-hidden rounded-2xl border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-card shadow-sm"><CardContent className="space-y-4 p-4 sm:p-5"><BirthdayRow person={person} getInitials={getInitials} badge="Mensagem hoje" highlight /><Textarea value={messages[person.id] || ''} onChange={(e) => setMessages((prev) => ({ ...prev, [person.id]: e.target.value }))} placeholder={`Escreva uma mensagem para ${person.name}...`} className="min-h-[88px] rounded-xl" /><Button onClick={() => sendGreeting(person)} disabled={sendingId === person.id} className="w-full gap-2 rounded-xl"><Send className="h-4 w-4" /> Enviar no chat Geral</Button></CardContent></Card></motion.div>)}</div></section>}
    <section className="space-y-3"><SectionTitle icon={Calendar} title="Todos os aniversariantes do mês" subtitle="Visão completa para planejamento das felicitações e ações internas." />{birthdayPeople.length === 0 ? <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center"><div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><span className="text-3xl">🎂</span></div><h4 className="font-display text-lg font-semibold text-foreground">Nenhum aniversariante</h4><p className="text-sm text-muted-foreground">Não há aniversariantes neste mês com data cadastrada.</p></div> : <div className="grid gap-3 xl:grid-cols-2">{[...todayBirthdays, ...upcomingBirthdays, ...pastBirthdays].map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}><Card className="rounded-2xl border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><CardContent className="p-4"><BirthdayRow person={person} getInitials={getInitials} badge={person.isToday ? 'Hoje' : formatBirthday(person.birthDate)} /></CardContent></Card></motion.div>)}</div>}</section>
  </motion.div>;
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) { return <Card className="rounded-2xl border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex items-center gap-3 p-3.5 sm:p-4"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><div className="min-w-0"><p className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function SectionTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) { return <div className="flex items-center gap-3"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div><div className="min-w-0"><h3 className="font-display text-base sm:text-lg font-semibold text-foreground">{title}</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>; }
function BirthdayRow({ person, getInitials, badge, highlight }: { person: BirthdayPerson; getInitials: (name: string) => string; badge: string; highlight?: boolean }) { return <div className="flex items-center gap-4"><div className="relative flex-shrink-0"><Avatar className={cn(highlight ? 'h-16 w-16 ring-4 ring-secondary/30' : 'h-12 w-12 ring-2 ring-border/50')}><AvatarImage src={person.avatar} /><AvatarFallback className="bg-secondary font-bold text-secondary-foreground">{getInitials(person.name)}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm shadow ring-1 ring-border/50">🎂</div></div><div className="min-w-0 flex-1"><h4 className="truncate font-semibold text-foreground">{person.name}</h4><p className="truncate text-sm text-muted-foreground">{person.sector}</p><div className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant={highlight ? 'default' : 'outline'} className="rounded-full"><Cake className="mr-1 h-3 w-3" />{badge}</Badge>{person.celebrationDate && <Badge variant="secondary" className="rounded-full"><CheckCircle2 className="mr-1 h-3 w-3" />Mensagem: {formatShortDate(person.celebrationDate)}</Badge>}</div></div></div>; }
