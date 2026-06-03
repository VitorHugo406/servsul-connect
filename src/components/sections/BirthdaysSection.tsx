import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, PartyPopper, Calendar, CheckCircle2, Download, Send, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import jsPDF from 'jspdf';
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
import appLogo from '@/assets/app-logo.png';

const monthThemes: Record<number, { name: string; emoji: string; accent: [number, number, number] }> = {
  1: { name: 'Verão Corporativo', emoji: '☀️', accent: [234, 88, 12] },
  2: { name: 'Carnaval de Conquistas', emoji: '🎭', accent: [37, 99, 235] },
  3: { name: 'Ciclo de Renovação', emoji: '🌿', accent: [22, 163, 74] },
  4: { name: 'Celebração Especial', emoji: '🎁', accent: [168, 85, 247] },
  5: { name: 'Mês de Reconhecimento', emoji: '🌟', accent: [202, 138, 4] },
  6: { name: 'Festa Junina Servsul', emoji: '🎊', accent: [234, 88, 12] },
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
    const { error } = await supabase.from('messages').insert({
      content,
      author_id: profile.id,
      sector_id: GERAL_SECTOR_ID,
    });
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

  const generateMonthlyPdf = async () => {
    setGeneratingPdf(true);
    const doc = new jsPDF('p', 'mm', 'a4');
    const [r, g, b] = theme.accent;
    const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    try { doc.addImage(appLogo, 'PNG', 14, 10, 16, 16); } catch { doc.setFillColor(37, 99, 235); doc.circle(22, 18, 8, 'F'); }
    doc.setFontSize(8); doc.setTextColor(100); doc.text('ServChat', 32, 15); doc.text('Plataforma de Gestão', 32, 20);
    doc.setFontSize(18); doc.setTextColor(30, 41, 59); doc.text(`Aniversariantes de ${monthName}`, 14, 40);
    doc.setFontSize(9); doc.setTextColor(100); doc.text(`${theme.name} ${theme.emoji} • ${birthdayPeople.length} pessoa(s)`, 14, 47);
    doc.setDrawColor(r, g, b); doc.setLineWidth(1); doc.line(14, 51, 196, 51);

    let x = 14;
    let y = 60;
    const cardW = 86;
    const cardH = 38;
    for (const person of birthdayPeople) {
      if (y + cardH > 275) { doc.addPage(); x = 14; y = 18; }
      doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, cardW, cardH, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240); doc.roundedRect(x, y, cardW, cardH, 3, 3, 'S');
      const img = await loadImage(person.avatar);
      if (img) doc.addImage(img, 'JPEG', x + 4, y + 6, 22, 22);
      else { doc.setFillColor(r, g, b); doc.circle(x + 15, y + 17, 11, 'F'); doc.setTextColor(255); doc.setFontSize(8); doc.text(getInitials(person.name), x + 10, y + 19); }
      doc.setFillColor(r, g, b); doc.circle(x + 24, y + 28, 5, 'F'); doc.setTextColor(255); doc.setFontSize(8); doc.text(theme.emoji, x + 21.8, y + 30);
      doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.text(doc.splitTextToSize(person.name, 50), x + 31, y + 11);
      doc.setFontSize(8); doc.setTextColor(100); doc.text(person.sector, x + 31, y + 21);
      doc.setTextColor(r, g, b); doc.text(`Aniversário: ${formatBirthday(person.birthDate)}`, x + 31, y + 28);
      if (person.celebrationDate && formatShortDate(person.celebrationDate) !== formatShortDate(new Date(new Date().getFullYear(), person.birthMonth - 1, person.birthDay))) {
        doc.setFontSize(7); doc.text(`Mensagem antecipada: ${formatShortDate(person.celebrationDate)}`, x + 31, y + 34);
      }
      x = x === 14 ? 110 : 14;
      if (x === 14) y += cardH + 8;
    }
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140); doc.text(`ServChat • Página ${i}/${pages}`, 14, 288); }
    doc.save(`aniversariantes_${monthName.replace(/\s/g, '_')}.pdf`);
    toast.success('PDF mensal de aniversariantes gerado!');
    setGeneratingPdf(false);
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-secondary shadow-glow"><Cake className="h-6 w-6 text-secondary-foreground" /></div>
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Painel de Aniversariantes</h2>
            <p className="text-sm text-muted-foreground">{theme.name} • mensagens antecipadas em fins de semana e feriados</p>
          </div>
        </div>
        <Button onClick={generateMonthlyPdf} disabled={generatingPdf || birthdayPeople.length === 0} className="gap-2">
          <Download className="h-4 w-4" /> {generatingPdf ? 'Gerando...' : 'Baixar PDF do mês'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
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
                <Card className="overflow-hidden border-secondary/30 bg-secondary/5">
                  <CardContent className="p-4 space-y-4">
                    <BirthdayRow person={person} getInitials={getInitials} badge="Mensagem hoje" highlight />
                    <Textarea value={messages[person.id] || ''} onChange={(e) => setMessages((prev) => ({ ...prev, [person.id]: e.target.value }))} placeholder={`Escreva uma mensagem para ${person.name}...`} className="min-h-[88px]" />
                    <Button onClick={() => sendGreeting(person)} disabled={sendingId === person.id} className="w-full gap-2"><Send className="h-4 w-4" /> Enviar no chat Geral</Button>
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
          <div className="flex flex-col items-center justify-center py-16 text-center"><div className="mb-4 rounded-full bg-muted p-4"><span className="text-4xl">🎂</span></div><h4 className="font-display text-lg font-semibold text-foreground">Nenhum aniversariante</h4><p className="text-sm text-muted-foreground">Não há aniversariantes neste mês com data cadastrada.</p></div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {[...todayBirthdays, ...upcomingBirthdays, ...pastBirthdays].map((person, index) => (
              <motion.div key={person.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}>
                <Card className="transition-all hover:shadow-md"><CardContent className="p-4"><BirthdayRow person={person} getInitials={getInitials} badge={person.isToday ? 'Hoje' : formatBirthday(person.birthDate)} /></CardContent></Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div><div><h3 className="font-display text-lg font-semibold text-foreground">{title}</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>;
}

function BirthdayRow({ person, getInitials, badge, highlight }: { person: BirthdayPerson; getInitials: (name: string) => string; badge: string; highlight?: boolean }) {
  return <div className="flex items-center gap-4"><div className="relative"><Avatar className={highlight ? 'h-16 w-16 ring-4 ring-secondary/30' : 'h-12 w-12'}><AvatarImage src={person.avatar} /><AvatarFallback className="bg-secondary text-secondary-foreground font-bold">{getInitials(person.name)}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card shadow"><span>🎂</span></div></div><div className="min-w-0 flex-1"><h4 className="font-semibold text-foreground truncate">{person.name}</h4><p className="text-sm text-muted-foreground truncate">{person.sector}</p><div className="mt-1 flex flex-wrap gap-2"><Badge variant={highlight ? 'default' : 'outline'}><Cake className="mr-1 h-3 w-3" />{badge}</Badge>{person.celebrationDate && <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" />Mensagem: {formatShortDate(person.celebrationDate)}</Badge>}</div></div></div>;
}
