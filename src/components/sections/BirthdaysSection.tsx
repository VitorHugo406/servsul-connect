import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, PartyPopper, Calendar, CheckCircle2, Download, Send, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import { Skeleton } from '@/components/ui/skeleton';
import { CardGridSkeleton, StatsSkeleton } from '@/components/ui/skeletons';
import { useBirthdays } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { GERAL_SECTOR_ID, formatShortDate } from '@/lib/birthdayUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import appLogo from '@/assets/nuvexa-logo.png';

const monthThemes: Record<number, { name: string; emoji: string; accent: [number, number, number] }> = {
  1: { name: 'Verão Corporativo', emoji: '☀️', accent: [234, 88, 12] },
  2: { name: 'Carnaval de Conquistas', emoji: '🎭', accent: [37, 99, 235] },
  3: { name: 'Ciclo de Renovação', emoji: '🌿', accent: [22, 163, 74] },
  4: { name: 'Celebração Especial', emoji: '🎁', accent: [168, 85, 247] },
  5: { name: 'Mês de Reconhecimento', emoji: '🌟', accent: [202, 138, 4] },
  6: { name: 'Festa Junina Nuvexa', emoji: '🎊', accent: [234, 88, 12] },
  7: { name: 'Arraiá de Talentos', emoji: '🔥', accent: [220, 38, 38] },
  8: { name: 'Mês de Excelência', emoji: '🏆', accent: [37, 99, 235] },
  9: { name: 'Primavera de Resultados', emoji: '🌸', accent: [219, 39, 119] },
  10: { name: 'Energia da Equipe', emoji: '⚡', accent: [245, 158, 11] },
  11: { name: 'Gratidão e Parceria', emoji: '🤝', accent: [13, 148, 136] },
  12: { name: 'Celebração de Fim de Ano', emoji: '🎄', accent: [22, 163, 74] },
};

type BirthdayPerson = ReturnType<typeof useBirthdays>['birthdayPeople'][number];

export function BirthdaysSection() {
  const { profile } = useAuth();
  const { birthdayPeople, loading, currentDay } = useBirthdays();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const theme = monthThemes[currentMonth];

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
    const { error } = await supabase.from('messages').insert(withCompany({
      content,
      author_id: profile.id,
      sector_id: GERAL_SECTOR_ID,
    }));
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
    } catch {
      return null;
    }
  };

  // Brand colors
  const BRAND_PRIMARY: [number, number, number] = [61, 47, 214]; // #3D2FD6
  const BRAND_SECONDARY: [number, number, number] = [18, 194, 240]; // #12C2F0
  const PAGE_W = 210;
  const MARGIN = 14;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const truncateText = (doc: jsPDF, text: string, maxWidth: number) => {
    let t = text || '';
    while (doc.getTextWidth(t) > maxWidth && t.length > 1) {
      t = t.slice(0, -1);
    }
    if (t !== text) t = t.slice(0, -1) + '…';
    return t;
  };

  const drawBirthdaysHeader = (doc: jsPDF, monthName: string, count: number) => {
    // Branded band with gradient-like two-tone strip
    doc.setFillColor(...BRAND_PRIMARY);
    doc.rect(0, 0, PAGE_W, 30, 'F');
    doc.setFillColor(...BRAND_SECONDARY);
    doc.rect(0, 28, PAGE_W, 2, 'F');

    try { doc.addImage(appLogo, 'PNG', MARGIN, 6, 16, 16); } catch { doc.setFillColor(255, 255, 255); doc.circle(MARGIN + 8, 14, 8, 'F'); }

    doc.setFontSize(14); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text('Nuvexa', MARGIN + 22, 13);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Plataforma de Gestão', MARGIN + 22, 19);

    doc.setFontSize(11);
    const title = `Aniversariantes de ${monthName}`;
    doc.text(title, PAGE_W - MARGIN, 13, { align: 'right' });
    doc.setFontSize(8);
    doc.text(`${count} pessoa(s)`, PAGE_W - MARGIN, 19, { align: 'right' });

    let y = 40;
    doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'normal');
    doc.text(`${theme.name} ${theme.emoji}`, MARGIN, y);
    doc.setTextColor(150, 150, 150);
    doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, PAGE_W - MARGIN, y, { align: 'right' });
    y += 5;
    doc.setDrawColor(...BRAND_SECONDARY); doc.setLineWidth(0.8); doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    return y + 8;
  };

  const drawBirthdaysFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
    doc.line(MARGIN, h - 14, PAGE_W - MARGIN, h - 14);
    doc.setFontSize(7); doc.setTextColor(140, 140, 140); doc.setFont('helvetica', 'normal');
    doc.text('Nuvexa • Painel de Aniversariantes', MARGIN, h - 9);
    doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_W - MARGIN, h - 9, { align: 'right' });
  };

  const generateMonthlyPdf = async () => {
    setGeneratingPdf(true);
    const doc = new jsPDF('p', 'mm', 'a4');
    const [r, g, b] = theme.accent;
    const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    let y = drawBirthdaysHeader(doc, monthName, birthdayPeople.length);

    let x = MARGIN;
    const gap = 8;
    const cardW = (CONTENT_W - gap) / 2;
    const cardH = 38;
    const bottomLimit = 280;

    for (const person of birthdayPeople) {
      if (y + cardH > bottomLimit) { doc.addPage(); y = drawBirthdaysHeader(doc, monthName, birthdayPeople.length); x = MARGIN; }
      doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, cardW, cardH, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.roundedRect(x, y, cardW, cardH, 3, 3, 'S');
      const img = await loadImage(person.avatar);
      if (img) doc.addImage(img, 'JPEG', x + 4, y + 6, 22, 22);
      else { doc.setFillColor(r, g, b); doc.circle(x + 15, y + 17, 11, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.text(getInitials(person.name), x + 10, y + 19); }
      doc.setFillColor(...BRAND_SECONDARY); doc.circle(x + 24, y + 28, 5, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.text(theme.emoji, x + 21.8, y + 30);

      const textX = x + 31;
      const textMaxW = cardW - 33;
      doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(truncateText(doc, person.name, textMaxW), textX, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8); doc.setTextColor(100, 116, 139);
      doc.text(truncateText(doc, person.sector, textMaxW), textX, y + 21);
      doc.setTextColor(...BRAND_PRIMARY);
      doc.text(truncateText(doc, `Aniversário: ${formatBirthday(person.birthDate)}`, textMaxW), textX, y + 28);
      if (person.celebrationDate && formatShortDate(person.celebrationDate) !== formatShortDate(new Date(new Date().getFullYear(), person.birthMonth - 1, person.birthDay))) {
        doc.setFontSize(7); doc.setTextColor(100, 116, 139);
        doc.text(truncateText(doc, `Mensagem antecipada: ${formatShortDate(person.celebrationDate)}`, textMaxW), textX, y + 34);
      }
      x = x === MARGIN ? MARGIN + cardW + gap : MARGIN;
      if (x === MARGIN) y += cardH + gap;
    }

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { doc.setPage(i); drawBirthdaysFooter(doc, i, pages); }
    doc.save(`aniversariantes_${monthName.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF mensal de aniversariantes gerado!');
    setGeneratingPdf(false);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64 rounded-md" />
            <Skeleton className="h-3.5 w-80 rounded-md" />
          </div>
        </div>
        <StatsSkeleton count={4} />
        <CardGridSkeleton count={4} columns="lg:grid-cols-2" cardHeight="h-24" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-secondary/15 via-card to-primary/5 p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-secondary/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl gradient-secondary shadow-glow text-xl">
              {theme.emoji}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">Painel de Aniversariantes</h2>
              <p className="text-sm text-muted-foreground truncate">{theme.name} • mensagens antecipadas em fins de semana e feriados</p>
            </div>
          </div>
          <Button onClick={generateMonthlyPdf} disabled={generatingPdf || birthdayPeople.length === 0} className="w-full gap-2 rounded-xl sm:w-auto">
            <Download className="h-4 w-4" /> {generatingPdf ? 'Gerando...' : 'Baixar PDF do mês'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={Users} label="No mês" value={birthdayPeople.length} />
        <Metric icon={PartyPopper} label="Hoje" value={todayBirthdays.length} />
        <Metric icon={Sparkles} label="Mensagem hoje" value={celebrationToday.length} />
        <Metric icon={Calendar} label="Setores" value={sectorCount} />
      </div>

      {celebrationToday.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={PartyPopper} title="Felicitações para enviar hoje" subtitle="Se o aniversário cair em sábado, domingo ou feriado, a mensagem aparece antecipada." />
          <div className="grid gap-4 lg:grid-cols-2">
            {celebrationToday.map((person, index) => (
              <motion.div key={person.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <Card className="overflow-hidden rounded-2xl border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-card shadow-sm">
                  <CardContent className="space-y-4 p-4 sm:p-5">
                    <BirthdayRow person={person} getInitials={getInitials} badge="Mensagem hoje" highlight />
                    <Textarea
                      value={messages[person.id] || ''}
                      onChange={(e) => setMessages((prev) => ({ ...prev, [person.id]: e.target.value }))}
                      placeholder={`Escreva uma mensagem para ${person.name}...`}
                      className="min-h-[88px] rounded-xl"
                    />
                    <Button onClick={() => sendGreeting(person)} disabled={sendingId === person.id} className="w-full gap-2 rounded-xl">
                      <Send className="h-4 w-4" /> Enviar no chat Geral
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle icon={Calendar} title="Todos os aniversariantes do mês" subtitle="Visão completa para planejamento das felicitações e ações internas." />
        {birthdayPeople.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
            <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <span className="text-3xl">🎂</span>
            </div>
            <h4 className="font-display text-lg font-semibold text-foreground">Nenhum aniversariante</h4>
            <p className="text-sm text-muted-foreground">Não há aniversariantes neste mês com data cadastrada.</p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {[...todayBirthdays, ...upcomingBirthdays, ...pastBirthdays].map((person, index) => (
              <motion.div key={person.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}>
                <Card className="rounded-2xl border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <CardContent className="p-4">
                    <BirthdayRow person={person} getInitials={getInitials} badge={person.isToday ? 'Hoje' : formatBirthday(person.birthDate)} />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-base sm:text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function BirthdayRow({ person, getInitials, badge, highlight }: { person: BirthdayPerson; getInitials: (name: string) => string; badge: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <Avatar className={cn(highlight ? 'h-16 w-16 ring-4 ring-secondary/30' : 'h-12 w-12 ring-2 ring-border/50')}>
          <AvatarImage src={person.avatar} />
          <AvatarFallback className="bg-secondary font-bold text-secondary-foreground">{getInitials(person.name)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm shadow ring-1 ring-border/50">
          🎂
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-semibold text-foreground">{person.name}</h4>
        <p className="truncate text-sm text-muted-foreground">{person.sector}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge variant={highlight ? 'default' : 'outline'} className="rounded-full">
            <Cake className="mr-1 h-3 w-3" />{badge}
          </Badge>
          {person.celebrationDate && (
            <Badge variant="secondary" className="rounded-full">
              <CheckCircle2 className="mr-1 h-3 w-3" />Mensagem: {formatShortDate(person.celebrationDate)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
