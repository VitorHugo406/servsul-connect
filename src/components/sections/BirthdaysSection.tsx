import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cake, PartyPopper, Calendar, CheckCircle2, Download, Send, Sparkles, Users, QrCode, Image as ImageIcon, Upload, X } from 'lucide-react';
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
import { createCompanyLogoUrl } from '@/lib/companyLogo';
import { canManageBirthdayPresentation, upcomingBirthdayPeople } from '@/lib/birthdayPresentation';

const monthThemes: Record<number, { name: string; emoji: string }> = {
  1: { name: 'Verão Corporativo', emoji: '☀️' }, 2: { name: 'Carnaval de Conquistas', emoji: '🎭' }, 3: { name: 'Ciclo de Renovação', emoji: '🌿' }, 4: { name: 'Celebração Especial', emoji: '🎁' }, 5: { name: 'Mês de Reconhecimento', emoji: '🌟' }, 6: { name: 'Festa Junina', emoji: '🌽' }, 7: { name: 'Arraiá de Talentos', emoji: '🎊' }, 8: { name: 'Mês de Excelência', emoji: '🏆' }, 9: { name: 'Primavera', emoji: '🌸' }, 10: { name: 'Energia da Equipe', emoji: '⚡' }, 11: { name: 'Gratidão e Parceria', emoji: '🤝' }, 12: { name: 'Natal', emoji: '🎄' },
};

const pdfThemes = [
  { id: 'corporate', name: 'Corporativo', accent: [24,56,91] as [number,number,number], soft: [244,241,233] as [number,number,number], highlight: [177,137,73] as [number,number,number], photo: null },
  { id: 'junina', name: 'Festa Junina', accent: [112,72,45] as [number,number,number], soft: [250,241,222] as [number,number,number], highlight: [78,113,75] as [number,number,number], photo: 'https://images.unsplash.com/photo-1688948871859-e3673c0b36bc?auto=format&fit=crop&w=1800&q=84' },
  { id: 'christmas', name: 'Natal', accent: [42,82,61] as [number,number,number], soft: [241,244,239] as [number,number,number], highlight: [160,76,69] as [number,number,number], photo: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1800&q=84' },
  { id: 'newyear', name: 'Ano Novo', accent: [89,70,39] as [number,number,number], soft: [246,243,235] as [number,number,number], highlight: [113,91,55] as [number,number,number], photo: 'https://images.unsplash.com/photo-1512248805576-c1b31f6fcab1?auto=format&fit=crop&w=1800&q=84' },
  { id: 'spring', name: 'Primavera', accent: [94,82,104] as [number,number,number], soft: [247,242,247] as [number,number,number], highlight: [89,128,95] as [number,number,number], photo: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1800&q=84' },
];

type BirthdayPerson = ReturnType<typeof useBirthdays>['birthdayPeople'][number];
type PdfTheme = typeof pdfThemes[number];

export function BirthdaysSection() {
  const { profile, roles } = useAuth();
  const canManage = canManageBirthdayPresentation(roles);
  const { company } = useCompany();
  const { birthdayPeople, loading, currentDay } = useBirthdays();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [selectedPdfTheme, setSelectedPdfTheme] = useState('corporate');
  const companyImageKey = `ewvor:birthday-pdf:corporate-image:${company?.id || 'default'}`;
  const [corporateImage, setCorporateImage] = useState<string | null>(() => { try { return localStorage.getItem(companyImageKey); } catch { return null; } });
  const currentMonth = new Date().getMonth() + 1;
  const theme = monthThemes[currentMonth];
  const pdfTheme = pdfThemes.find(x => x.id === selectedPdfTheme) ?? pdfThemes[0];
  const todayBirthdays = birthdayPeople.filter(p => p.isToday);
  const celebrationToday = birthdayPeople.filter(p => p.isCelebrationToday);
  const upcomingBirthdays = birthdayPeople.filter(p => !p.isToday && p.birthDay > currentDay);
  const pastBirthdays = birthdayPeople.filter(p => !p.isToday && p.birthDay < currentDay);
  const sectorCount = useMemo(() => new Set(birthdayPeople.map(p => p.sector)).size, [birthdayPeople]);
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const formatBirthday = (dateStr: string) => { const [, month, day] = dateStr.split('-').map(Number); return new Date(new Date().getFullYear(), month - 1, day, 12).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }); };

  const sendGreeting = async (person: BirthdayPerson) => { if (!profile) return; const message = messages[person.id]?.trim(); if (!message) { toast.error('Escreva uma mensagem antes de enviar.'); return; } setSendingId(person.id); const content = `🎉 Feliz aniversário, ${person.name}!\n\n${message}\n\n— ${profile.display_name || profile.name}`; const { error } = await supabase.from('messages').insert(withCompany({ content, author_id: profile.id, sector_id: GERAL_SECTOR_ID })); setSendingId(null); if (error) { toast.error('Não foi possível enviar no chat Geral.'); return; } setMessages(prev => ({ ...prev, [person.id]: '' })); toast.success('Mensagem enviada no chat Geral!'); };

  const loadImage = async (src: string) => { if (!src) return null; try { const response = await fetch(src); const blob = await response.blob(); return await new Promise<string>(resolve => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result)); reader.readAsDataURL(blob); }); } catch { return null; } };
  const loadImageElement = async (src: string) => await new Promise<HTMLImageElement | null>(resolve => { if (!src) return resolve(null); const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = src; });
  const handleCorporateImage = (file: File | null) => { if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Use uma imagem JPG, PNG ou WEBP.'); return; } if (file.size > 3 * 1024 * 1024) { toast.error('A imagem deve ter no máximo 3MB.'); return; } const reader = new FileReader(); reader.onload = () => { const value = String(reader.result); try { localStorage.setItem(companyImageKey, value); setCorporateImage(value); toast.success('Imagem corporativa salva para este relatório.'); } catch { toast.error('Não foi possível salvar a imagem.'); } }; reader.readAsDataURL(file); };
  const clearCorporateImage = () => { try { localStorage.removeItem(companyImageKey); } catch {} setCorporateImage(null); toast.success('Imagem corporativa removida.'); };

  const encodeShareData = (people: BirthdayPerson[]) => { const sectors = Array.from(new Set(people.map(p => p.sector || 'Sem setor'))); const compact = { c: company?.name || 'Empresa', m: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), t: pdfTheme.name, g: new Date().toISOString(), x: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString(), s: sectors, p: people.map(p => [p.id.replace(/-/g, ''), p.name, sectors.indexOf(p.sector || 'Sem setor'), p.birthDate, p.celebrationDate || '', p.avatar || '']) }; const bytes = new TextEncoder().encode(JSON.stringify(compact)); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); };
  const getShareUrl = (people: BirthdayPerson[]) => `${window.location.origin}/birthday-report?data=${encodeShareData(people)}`;
  const loadQrImage = (url: string) => loadImageElement(`https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=360&margin=2&ecLevel=M`);

  const PAGE_W = 210, PAGE_H = 297, MARGIN = 14, CONTENT_W = PAGE_W - MARGIN * 2;
  const setText = (doc: jsPDF, rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (doc: jsPDF, rgb: [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (doc: jsPDF, rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const truncate = (doc: jsPDF, text: string, width: number) => { let v = text || ''; while (doc.getTextWidth(v) > width && v.length > 1) v = v.slice(0, -1); return v !== text ? `${v.slice(0, -1)}…` : v; };

  // ---- PDF layout (redesigned): dark photo band, horizontal cards, QR footer ----
  const HERO_H = 70;
  const prepareHeroPhoto = async (src: string) => {
    const image = await loadImageElement(src);
    if (!image) return null;
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 600;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height); const drawW = image.width * scale; const drawH = image.height * scale;
    ctx.drawImage(image, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
    const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
    g.addColorStop(0, 'rgba(10,10,14,0.92)'); g.addColorStop(0.5, 'rgba(10,10,14,0.72)'); g.addColorStop(1, 'rgba(10,10,14,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', 0.86);
  };

  const makeCircularAvatar = async (src: string | null | undefined) => {
    if (!src) return null; const image = await loadImageElement(src); if (!image) return null;
    const size = 200; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    const scale = Math.max(size / image.width, size / image.height); const w = image.width * scale; const h = image.height * scale; ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL('image/png');
  };

  const drawBackgroundPhoto = async (doc: jsPDF, selected: PdfTheme, imageData?: string | null) => {
    setFill(doc, [246, 246, 248]); doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    const source = imageData || (selected.photo ? await loadImage(selected.photo) : null);
    let painted = false;
    if (source) { try { const prepared = await prepareHeroPhoto(source); if (prepared) { doc.addImage(prepared, 'JPEG', 0, 0, PAGE_W, HERO_H, undefined, 'FAST'); painted = true; } } catch { /* fallback below */ } }
    if (!painted) { setFill(doc, [14, 14, 18]); doc.rect(0, 0, PAGE_W, HERO_H, 'F'); setFill(doc, selected.accent); doc.circle(PAGE_W - 18, 8, 42, 'F'); setFill(doc, [14, 14, 18]); doc.circle(PAGE_W - 18, 8, 30, 'F'); }
  };

  const drawLogo = async (doc: jsPDF, selected: PdfTheme) => {
    const logoUrl = company?.logo_url ? await createCompanyLogoUrl(company.logo_url) : null; const logo = logoUrl ? await loadImage(logoUrl) : null;
    setFill(doc, [255, 255, 255]); doc.roundedRect(MARGIN, 10, 24, 17, 4, 4, 'F');
    if (logo) { try { doc.addImage(logo, 'PNG', MARGIN + 2, 11.5, 20, 14, undefined, 'FAST'); return; } catch { /* initials */ } }
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(getInitials(company?.name || 'Ewwon'), MARGIN + 12, 20.5, { align: 'center' });
  };

  const drawHeader = async (doc: jsPDF, monthName: string, count: number, selected: PdfTheme) => {
    await drawLogo(doc, selected);
    setText(doc, [255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(truncate(doc, company?.name || 'Ewwon', 90), MARGIN + 29, 17.5);
    setText(doc, [200, 200, 210]); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.text('Comunicação interna', MARGIN + 29, 22.5);
    const month = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    setText(doc, [210, 210, 220]); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(month.toUpperCase(), MARGIN, 42, { charSpace: 0.6 });
    setText(doc, [255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.text('Aniversariantes', MARGIN, 55);
    setText(doc, [200, 200, 210]); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text('Celebrar a vida é reconhecer as histórias que nos inspiram todos os dias.', MARGIN, 62.5);
    const pill = `${count} ${count === 1 ? 'pessoa' : 'pessoas'} celebrando`;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); const pw = doc.getTextWidth(pill) + 10;
    setFill(doc, selected.accent); doc.roundedRect(PAGE_W - MARGIN - pw, 12, pw, 9, 4.5, 4.5, 'F');
    setText(doc, [255, 255, 255]); doc.text(pill, PAGE_W - MARGIN - pw / 2, 17.8, { align: 'center' });
  };

  const drawPerson = async (doc: jsPDF, person: BirthdayPerson, x: number, y: number, w: number, h: number, selected: PdfTheme, compact: boolean) => {
    const today = person.isToday;
    setFill(doc, [255, 255, 255]); doc.roundedRect(x, y, w, h, 4, 4, 'F');
    if (today) { setDraw(doc, selected.accent); doc.setLineWidth(0.7); } else { setDraw(doc, [228, 228, 233]); doc.setLineWidth(0.3); }
    doc.roundedRect(x, y, w, h, 4, 4, 'S');
    const av = Math.min(h - 7, compact ? 11 : 13); const avX = x + 4; const avY = y + (h - av) / 2;
    const avatar = await makeCircularAvatar(person.avatar);
    if (avatar) { try { doc.addImage(avatar, 'PNG', avX, avY, av, av, undefined, 'FAST'); } catch { /* initials */ } }
    else { setFill(doc, selected.soft); doc.circle(avX + av / 2, avY + av / 2, av / 2, 'F'); setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 5.5 : 6.5); doc.text(getInitials(person.name), avX + av / 2, avY + av / 2 + 1.6, { align: 'center' }); }
    const dW = compact ? 11 : 13; const dH = h - 7; const dX = x + w - dW - 3.5; const dY = y + 3.5;
    setFill(doc, today ? selected.accent : [244, 244, 246]); doc.roundedRect(dX, dY, dW, dH, 3, 3, 'F');
    setText(doc, today ? [255, 255, 255] : [20, 20, 26]); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 9 : 11);
    doc.text(String(person.birthDay).padStart(2, '0'), dX + dW / 2, dY + dH / 2 + 0.6, { align: 'center' });
    doc.setFontSize(compact ? 4.2 : 4.8); doc.setFont('helvetica', 'bold');
    doc.text((formatBirthday(person.birthDate).split(' de ')[1] || '').slice(0, 3).toUpperCase(), dX + dW / 2, dY + dH / 2 + (compact ? 4.6 : 5.6), { align: 'center' });
    const tx = avX + av + 3.5; const tw = dX - tx - 2.5;
    setText(doc, [14, 14, 18]); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 6.4 : 7.6); doc.text(truncate(doc, person.name, tw), tx, y + h / 2 - (today ? 1.6 : 0.4));
    setText(doc, [110, 110, 122]); doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 4.8 : 5.6); doc.text(truncate(doc, person.sector || 'Sem departamento', tw), tx, y + h / 2 + (today ? 2.4 : 3.6));
    if (today) { setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 4.6 : 5.2); doc.text('HOJE', tx, y + h / 2 + 6.2); }
  };

  const drawFixedQrFooter = async (doc: jsPDF, url: string, selected: PdfTheme) => {
    const qr = await loadQrImage(url); const footerH = 32; const y = PAGE_H - footerH - 10; const qrSize = 25;
    setFill(doc, [14, 14, 18]); doc.roundedRect(MARGIN, y, CONTENT_W, footerH, 6, 6, 'F');
    setFill(doc, [255, 255, 255]); doc.roundedRect(MARGIN + 4, y + 3.5, qrSize, qrSize, 3, 3, 'F');
    if (qr) { try { doc.addImage(qr, 'PNG', MARGIN + 5, y + 4.5, qrSize - 2, qrSize - 2, undefined, 'FAST'); } catch { /* no qr */ } }
    setText(doc, [255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Consulte no celular', MARGIN + qrSize + 10, y + 10.5);
    setText(doc, [200, 200, 210]); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4);
    doc.text('Leia o QR Code para ver os aniversariantes e filtrar por setor.', MARGIN + qrSize + 10, y + 16.5);
    doc.text('O botão de mensagem aparece no período de celebração (é preciso entrar no Ewwon).', MARGIN + qrSize + 10, y + 21.5);
    setFill(doc, selected.accent); doc.circle(PAGE_W - MARGIN - 9, y + footerH / 2, 4, 'F');
  };

  const generateMonthlyPdf = async () => {
    if (!canManage) return;
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      await drawBackgroundPhoto(doc, pdfTheme, pdfTheme.id === 'corporate' ? corporateImage : null);
      await drawHeader(doc, monthName, birthdayPeople.length, pdfTheme);
      const n = birthdayPeople.length;
      const cols = n > 16 ? 3 : 2;
      const compact = cols === 3;
      const gap = 3;
      const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
      const gridY = HERO_H + 8;
      const footerTop = PAGE_H - 46;
      const rows = Math.max(1, Math.ceil(n / cols));
      const cardH = Math.max(15, Math.min(22, (footerTop - gridY - gap * (rows - 1)) / rows));
      if (n === 0) {
        setFill(doc, [255, 255, 255]); doc.roundedRect(MARGIN, gridY, CONTENT_W, 30, 5, 5, 'F'); setText(doc, [110, 110, 122]); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Nenhum aniversariante neste mês', PAGE_W / 2, gridY + 17, { align: 'center' });
      } else {
        for (let i = 0; i < n; i++) {
          const col = i % cols; const row = Math.floor(i / cols);
          await drawPerson(doc, birthdayPeople[i], MARGIN + col * (cardW + gap), gridY + row * (cardH + gap), cardW, cardH, pdfTheme, compact);
        }
      }
      await drawFixedQrFooter(doc, getShareUrl(birthdayPeople), pdfTheme);
      setText(doc, [150, 150, 160]); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.text(`${company?.name || 'Ewwon'} · uso interno · gerado pelo ewwon`, PAGE_W - MARGIN, PAGE_H - 5, { align: 'right' });
      const companySlug = (company?.name || 'ewvor').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const monthSlug = monthName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
      doc.save(`aniversariantes_${companySlug}_${monthSlug}_${pdfTheme.id}.pdf`);
      toast.success(`PDF ${pdfTheme.name} gerado!`);
    } catch (error) { console.error('Erro ao gerar PDF de aniversariantes:', error); toast.error('Não foi possível gerar o PDF.'); }
    finally { setGeneratingPdf(false); }
  };

  if (loading) return <div className="p-4 md:p-6 space-y-6"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-64 rounded-md" /><Skeleton className="h-3.5 w-80 rounded-md" /></div></div>{canManage && <StatsSkeleton count={4} />}<CardGridSkeleton count={4} columns="lg:grid-cols-2" cardHeight="h-24" /></div>;
  if (!canManage) {
    const upcoming = upcomingBirthdayPeople(birthdayPeople, currentDay);
    return <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Cake className="h-5 w-5" /></div><h2 className="text-xl font-semibold text-foreground">Aniversariantes</h2></header>
      {upcoming.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Nenhum próximo aniversariante neste mês.</p> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{upcoming.map(person => <Card key={person.id}><CardContent className="flex items-center gap-3 p-5"><Avatar className="h-11 w-11 shrink-0"><AvatarImage src={person.avatar} alt={person.name} /><AvatarFallback className="bg-muted text-muted-foreground">{getInitials(person.name)}</AvatarFallback></Avatar><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-foreground">{person.name}</h3><p className="break-words text-xs text-muted-foreground">{person.sector || 'Sem departamento'}</p></div></CardContent></Card>)}</div>}
    </div>;
  }
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6"><div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-secondary/15 via-card to-primary/5 p-5 shadow-sm"><div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3.5"><div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl gradient-secondary shadow-glow text-xl">{theme.emoji}</div><div className="min-w-0"><span className="text-xs font-medium uppercase tracking-[.16em] text-zinc-500">Pessoas</span><h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Painel de Aniversariantes</h2><p className="text-sm text-muted-foreground truncate">{theme.name} • mensagens antecipadas em fins de semana e feriados</p></div></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[250px]"><div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-background/60 p-1.5">{pdfThemes.map(item => <button key={item.id} type="button" onClick={() => setSelectedPdfTheme(item.id)} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all', selectedPdfTheme === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted')}><span>{item.id === 'corporate' ? '◈' : item.id === 'junina' ? '◆' : item.id === 'christmas' ? '✦' : item.id === 'newyear' ? '✧' : '○'}</span>{item.name}</button>)}</div>{selectedPdfTheme === 'corporate' && <div className="rounded-xl border border-border/60 bg-background/60 p-2.5"><div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Imagem de fundo corporativa</p><p className="text-[11px] text-muted-foreground">Foto JPG, PNG ou WEBP • até 3MB</p></div><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"><Upload className="h-3.5 w-3.5" />Anexar<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleCorporateImage(e.target.files?.[0] || null)} /></label>{corporateImage && <button type="button" onClick={clearCorporateImage} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Remover imagem"><X className="h-4 w-4" /></button>}</div>{corporateImage && <img src={corporateImage} alt="Pré-visualização da foto corporativa" className="mt-2 h-14 w-full rounded-lg object-cover opacity-90" />}</div>}<Button onClick={generateMonthlyPdf} disabled={generatingPdf || birthdayPeople.length === 0} className="w-full gap-2 rounded-xl sm:w-auto"><Download className="h-4 w-4" />{generatingPdf ? 'Gerando...' : `Baixar PDF • ${pdfTheme.name}`}<QrCode className="h-3.5 w-3.5 opacity-70" /></Button></div></div></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon={Users} label="No mês" value={birthdayPeople.length} /><Metric icon={PartyPopper} label="Hoje" value={todayBirthdays.length} /><Metric icon={Sparkles} label="Mensagem hoje" value={celebrationToday.length} /><Metric icon={Calendar} label="Setores" value={sectorCount} /></div>{celebrationToday.length > 0 && <section className="space-y-3"><SectionTitle icon={PartyPopper} title="Felicitações para enviar hoje" subtitle="Se o aniversário cair em sábado, domingo ou feriado, a mensagem aparece antecipada." /><div className="grid gap-4 lg:grid-cols-2">{celebrationToday.map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><Card className="overflow-hidden rounded-2xl border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-card shadow-sm"><CardContent className="space-y-4 p-4 sm:p-5"><BirthdayRow person={person} getInitials={getInitials} badge="Mensagem hoje" highlight /><Textarea value={messages[person.id] || ''} onChange={e => setMessages(prev => ({ ...prev, [person.id]: e.target.value }))} placeholder={`Escreva uma mensagem para ${person.name}...`} className="min-h-[88px] rounded-xl" /><Button onClick={() => sendGreeting(person)} disabled={sendingId === person.id} className="w-full gap-2 rounded-xl"><Send className="h-4 w-4" /> Enviar no chat Geral</Button></CardContent></Card></motion.div>)}</div></section>}<section className="space-y-3"><SectionTitle icon={Calendar} title="Todos os aniversariantes do mês" subtitle="Visão completa para planejamento das felicitações e ações internas." />{birthdayPeople.length === 0 ? <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center"><div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><span className="text-3xl">🎂</span></div><h4 className="font-display text-lg font-semibold text-foreground">Nenhum aniversariante</h4><p className="text-sm text-muted-foreground">Não há aniversariantes neste mês com data cadastrada.</p></div> : <div className="grid gap-3 xl:grid-cols-2">{[...todayBirthdays, ...upcomingBirthdays, ...pastBirthdays].map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}><Card className="rounded-2xl border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><CardContent className="p-4"><BirthdayRow person={person} getInitials={getInitials} badge={person.isToday ? 'Hoje' : formatBirthday(person.birthDate)} /></CardContent></Card></motion.div>)}</div>}</section></motion.div>;
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) { return <Card className="rounded-2xl border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex items-center gap-3 p-3.5 sm:p-4"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><div className="min-w-0"><p className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function SectionTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) { return <div className="flex items-center gap-3"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div><div className="min-w-0"><h3 className="font-display text-base sm:text-lg font-semibold text-foreground">{title}</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>; }
function BirthdayRow({ person, getInitials, badge, highlight }: { person: BirthdayPerson; getInitials: (name: string) => string; badge: string; highlight?: boolean }) { return <div className="flex items-center gap-4"><div className="relative flex-shrink-0"><Avatar className={cn(highlight ? 'h-16 w-16 ring-4 ring-secondary/30' : 'h-12 w-12 ring-2 ring-border/50')}><AvatarImage src={person.avatar} /><AvatarFallback className="bg-secondary font-bold text-secondary-foreground">{getInitials(person.name)}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm shadow ring-1 ring-border/50">🎂</div></div><div className="min-w-0 flex-1"><h4 className="truncate font-semibold text-foreground">{person.name}</h4><p className="truncate text-sm text-muted-foreground">{person.sector}</p><div className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant={highlight ? 'default' : 'outline'} className="rounded-full"><Cake className="mr-1 h-3 w-3" />{badge}</Badge>{person.celebrationDate && <Badge variant="secondary" className="rounded-full"><CheckCircle2 className="mr-1 h-3 w-3" />Mensagem: {formatShortDate(person.celebrationDate)}</Badge>}</div></div></div>; }