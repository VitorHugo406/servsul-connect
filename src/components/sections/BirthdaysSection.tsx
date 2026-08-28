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
import { getCompanyLogoUrl } from '@/lib/companyLogo';

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
  const { profile } = useAuth();
  const { company } = useCompany();
  const { birthdayPeople, loading, currentDay } = useBirthdays();
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [selectedPdfTheme, setSelectedPdfTheme] = useState('corporate');
  const companyImageKey = `nuvexa:birthday-pdf:corporate-image:${company?.id || 'default'}`;
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

  const encodeShareData = (people: BirthdayPerson[]) => { const sectors = Array.from(new Set(people.map(p => p.sector || 'Sem setor'))); const compact = { c: company?.name || 'Empresa', m: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), t: pdfTheme.name, g: new Date().toISOString(), x: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString(), s: sectors, p: people.map(p => [p.id.replace(/-/g, ''), p.name, sectors.indexOf(p.sector || 'Sem setor'), p.birthDate, p.celebrationDate || '']) }; const bytes = new TextEncoder().encode(JSON.stringify(compact)); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); };
  const getShareUrl = (people: BirthdayPerson[]) => `${window.location.origin}/birthday-report?data=${encodeShareData(people)}`;
  const loadQrImage = (url: string) => loadImageElement(`https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=300&margin=2&ecLevel=M`);

  const PAGE_W = 210, PAGE_H = 297, MARGIN = 14, CONTENT_W = PAGE_W - MARGIN * 2;
  const setText = (doc: jsPDF, rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (doc: jsPDF, rgb: [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (doc: jsPDF, rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const truncate = (doc: jsPDF, text: string, width: number) => { let v = text || ''; while (doc.getTextWidth(v) > width && v.length > 1) v = v.slice(0, -1); return v !== text ? `${v.slice(0, -1)}…` : v; };

  const prepareHeroPhoto = async (src: string) => {
    const image = await loadImageElement(src);
    if (!image) return null;
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 620;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height); const drawW = image.width * scale; const drawH = image.height * scale;
    ctx.drawImage(image, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, 'rgba(250,249,245,0.99)'); gradient.addColorStop(0.38, 'rgba(250,249,245,0.93)'); gradient.addColorStop(0.62, 'rgba(250,249,245,0.55)'); gradient.addColorStop(1, 'rgba(250,249,245,0.08)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', 0.88);
  };

  const makeCircularAvatar = async (src: string | null | undefined) => {
    if (!src) return null; const image = await loadImageElement(src); if (!image) return null;
    const size = 180; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    const scale = Math.max(size / image.width, size / image.height); const w = image.width * scale; const h = image.height * scale; ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const drawBackgroundPhoto = async (doc: jsPDF, selected: PdfTheme, imageData?: string | null) => {
    const source = imageData || (selected.photo ? await loadImage(selected.photo) : null); const heroH = 76;
    if (source) { try { const prepared = await prepareHeroPhoto(source); if (prepared) doc.addImage(prepared, 'JPEG', 0, 0, PAGE_W, heroH, undefined, 'FAST'); else doc.addImage(source, source.startsWith('data:image/png') ? 'PNG' : 'JPEG', 0, 0, PAGE_W, heroH, undefined, 'FAST'); } catch { setFill(doc, selected.soft); doc.rect(0, 0, PAGE_W, heroH, 'F'); } }
    else { setFill(doc, selected.soft); doc.rect(0, 0, PAGE_W, heroH, 'F'); }
    setFill(doc, [250, 249, 245]); doc.rect(0, heroH - 8, PAGE_W, 8, 'F'); setDraw(doc, [232, 228, 219]); doc.setLineWidth(0.35); doc.line(0, heroH, PAGE_W, heroH);
  };

  const drawLogo = async (doc: jsPDF, selected: PdfTheme) => {
    const logoUrl = company?.logo_url ? getCompanyLogoUrl(company.logo_url) : null; const logo = logoUrl ? await loadImage(logoUrl) : null;
    if (logo) { try { doc.addImage(logo, 'PNG', MARGIN, 8, 19, 14, undefined, 'FAST'); return; } catch {} }
    setFill(doc, selected.soft); doc.roundedRect(MARGIN, 8, 19, 14, 3.5, 3.5, 'F'); setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.text(getInitials(company?.name || 'Nuvexa'), MARGIN + 9.5, 17, { align: 'center' });
  };

  const drawHeader = async (doc: jsPDF, monthName: string, count: number, selected: PdfTheme) => {
    await drawLogo(doc, selected);
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(5.7); doc.text('COMUNICAÇÃO INTERNA', MARGIN + 24, 12);
    setText(doc, [177, 137, 73]); doc.setFont('times', 'italic'); doc.setFontSize(19.5); doc.text('Aniversariantes', MARGIN, 34);
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text('DO MÊS', MARGIN, 48);
    setText(doc, [157, 121, 67]); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.4); doc.text(monthName.toUpperCase().replace(' DE ', '  •  '), MARGIN + 1, 55);
    setText(doc, [71, 76, 84]); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.1); doc.text('Celebrar a vida é reconhecer histórias que inspiram todos os dias.', MARGIN + 1, 64);
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(truncate(doc, company?.name || 'Nuvexa', 58), PAGE_W - MARGIN, 13, { align: 'right' });
    setText(doc, [125, 130, 140]); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.4); doc.text(`${count} pessoa${count === 1 ? '' : 's'} celebrando`, PAGE_W - MARGIN, 19.5, { align: 'right' });
  };

  // Card vertical inspirado diretamente na referência: foto e data no topo, nome e setor abaixo.
  const drawPerson = async (doc: jsPDF, person: BirthdayPerson, x: number, y: number, w: number, h: number, selected: PdfTheme) => {
    const radius = 4.2;
    setFill(doc, [255, 254, 251]); doc.roundedRect(x, y, w, h, radius, radius, 'F');
    setDraw(doc, [226, 222, 213]); doc.setLineWidth(0.3); doc.roundedRect(x, y, w, h, radius, radius, 'S');
    const avatarSize = Math.min(16.5, h * 0.48, w * 0.38);
    const avatarX = x + 5.5; const avatarY = y + 5;
    setFill(doc, [238, 238, 234]); doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F');
    const avatar = await makeCircularAvatar(person.avatar);
    if (avatar) { try { doc.addImage(avatar, 'JPEG', avatarX, avatarY, avatarSize, avatarSize, undefined, 'FAST'); } catch {} }
    const dateW = 14.5; const dateH = Math.min(20.5, h * 0.62); const dateX = x + w - dateW - 5.5; const dateY = y + 5;
    setFill(doc, selected.accent); doc.roundedRect(dateX, dateY, dateW, dateH, 3.2, 3.2, 'F');
    setText(doc, [255,255,255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(String(person.birthDay).padStart(2, '0'), dateX + dateW / 2, dateY + 8.3, { align: 'center' });
    doc.setFontSize(4.1); doc.text(formatBirthday(person.birthDate).split(' de ')[1]?.toUpperCase() || '', dateX + dateW / 2, dateY + 14.2, { align: 'center' });
    const nameY = y + h - 8.2;
    setText(doc, [32, 37, 46]); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.text(truncate(doc, person.name, w - 11), x + 5.5, nameY);
    setText(doc, [116, 121, 130]); doc.setFont('helvetica', 'normal'); doc.setFontSize(4.6); doc.text(truncate(doc, person.sector || 'Sem departamento', w - 11), x + 5.5, nameY + 5.2);
  };

  // QR aprovado pelo usuário: apenas aumentamos a área para melhorar a leitura, mantendo a faixa e a posição no rodapé.
  const drawFixedQrFooter = async (doc: jsPDF, url: string, selected: PdfTheme) => {
    const qr = await loadQrImage(url); const y = PAGE_H - 40; const qrSize = 29;
    setFill(doc, [248, 249, 251]); doc.roundedRect(MARGIN, y, CONTENT_W, 27, 5, 5, 'F'); setDraw(doc, [226, 228, 233]); doc.setLineWidth(0.3); doc.roundedRect(MARGIN, y, CONTENT_W, 27, 5, 5, 'S');
    if (qr) { try { doc.addImage(qr, 'PNG', MARGIN + 3, y - 1, qrSize, qrSize, undefined, 'FAST'); } catch {} }
    setText(doc, selected.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text('Consulte no celular', MARGIN + 36, y + 8);
    setText(doc, [100, 106, 118]); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.7); doc.text('Leia o QR Code para filtrar por setor e ver os aniversariantes.', MARGIN + 36, y + 14); doc.text('O botão de mensagem aparece apenas no período de celebração.', MARGIN + 36, y + 19);
    setText(doc, [135, 141, 151]); doc.setFontSize(5.2); doc.text('É necessário entrar no Nuvexa para enviar uma mensagem.', MARGIN + 36, y + 23.5);
  };

  const generateMonthlyPdf = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      await drawBackgroundPhoto(doc, pdfTheme, pdfTheme.id === 'corporate' ? corporateImage : null);
      await drawHeader(doc, monthName, birthdayPeople.length, pdfTheme);
      const titleY = 76;
      const cols = 4;
      const gap = 4;
      const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
      const footerTop = PAGE_H - 44;
      const gridY = titleY + 5;
      const rows = Math.max(1, Math.ceil(birthdayPeople.length / cols));
      const available = footerTop - gridY - 3;
      const cardH = Math.max(25, Math.min(29, (available - gap * Math.max(0, rows - 1)) / rows));
      setText(doc, pdfTheme.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('CELEBRAÇÕES DO MÊS', MARGIN, titleY);
      setText(doc, [153, 157, 163]); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); doc.text('Uma lembrança especial para cada pessoa que faz parte da nossa equipe.', PAGE_W - MARGIN, titleY, { align: 'right' });
      if (birthdayPeople.length === 0) {
        setFill(doc, pdfTheme.soft); doc.roundedRect(MARGIN, gridY, CONTENT_W, 28, 5, 5, 'F'); setText(doc, pdfTheme.accent); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Nenhum aniversariante neste mês', PAGE_W / 2, gridY + 16, { align: 'center' });
      } else {
        for (let i = 0; i < birthdayPeople.length; i++) {
          const col = i % cols; const row = Math.floor(i / cols);
          const x = MARGIN + col * (cardW + gap); const y = gridY + row * (cardH + gap);
          await drawPerson(doc, birthdayPeople[i], x, y, cardW, cardH, pdfTheme);
        }
      }
      await drawFixedQrFooter(doc, getShareUrl(birthdayPeople), pdfTheme);
      setText(doc, [135, 141, 151]); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.3); doc.text(`${company?.name || 'Nuvexa'} • Uso interno • 1/1`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
      const companySlug = (company?.name || 'nuvexa').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const monthSlug = monthName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
      doc.save(`aniversariantes_${companySlug}_${monthSlug}_${pdfTheme.id}.pdf`);
      toast.success(`PDF ${pdfTheme.name} gerado em uma página com 4 aniversariantes por fileira!`);
    } catch (error) { console.error('Erro ao gerar PDF de aniversariantes:', error); toast.error('Não foi possível gerar o PDF.'); }
    finally { setGeneratingPdf(false); }
  };

  if (loading) return <div className="p-4 md:p-6 space-y-6"><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-64 rounded-md" /><Skeleton className="h-3.5 w-80 rounded-md" /></div></div><StatsSkeleton count={4} /><CardGridSkeleton count={4} columns="lg:grid-cols-2" cardHeight="h-24" /></div>;
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6"><div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-secondary/15 via-card to-primary/5 p-5 shadow-sm"><div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3.5"><div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl gradient-secondary shadow-glow text-xl">{theme.emoji}</div><div className="min-w-0"><h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">Painel de Aniversariantes</h2><p className="text-sm text-muted-foreground truncate">{theme.name} • mensagens antecipadas em fins de semana e feriados</p></div></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[250px]"><div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-background/60 p-1.5">{pdfThemes.map(item => <button key={item.id} type="button" onClick={() => setSelectedPdfTheme(item.id)} className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all', selectedPdfTheme === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted')}><span>{item.id === 'corporate' ? '◈' : item.id === 'junina' ? '◆' : item.id === 'christmas' ? '✦' : item.id === 'newyear' ? '✧' : '○'}</span>{item.name}</button>)}</div>{selectedPdfTheme === 'corporate' && <div className="rounded-xl border border-border/60 bg-background/60 p-2.5"><div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Imagem de fundo corporativa</p><p className="text-[11px] text-muted-foreground">Foto JPG, PNG ou WEBP • até 3MB</p></div><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"><Upload className="h-3.5 w-3.5" />Anexar<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleCorporateImage(e.target.files?.[0] || null)} /></label>{corporateImage && <button type="button" onClick={clearCorporateImage} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Remover imagem"><X className="h-4 w-4" /></button>}</div>{corporateImage && <img src={corporateImage} alt="Pré-visualização da foto corporativa" className="mt-2 h-14 w-full rounded-lg object-cover opacity-90" />}</div>}<Button onClick={generateMonthlyPdf} disabled={generatingPdf || birthdayPeople.length === 0} className="w-full gap-2 rounded-xl sm:w-auto"><Download className="h-4 w-4" />{generatingPdf ? 'Gerando...' : `Baixar PDF • ${pdfTheme.name}`}<QrCode className="h-3.5 w-3.5 opacity-70" /></Button></div></div></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon={Users} label="No mês" value={birthdayPeople.length} /><Metric icon={PartyPopper} label="Hoje" value={todayBirthdays.length} /><Metric icon={Sparkles} label="Mensagem hoje" value={celebrationToday.length} /><Metric icon={Calendar} label="Setores" value={sectorCount} /></div>{celebrationToday.length > 0 && <section className="space-y-3"><SectionTitle icon={PartyPopper} title="Felicitações para enviar hoje" subtitle="Se o aniversário cair em sábado, domingo ou feriado, a mensagem aparece antecipada." /><div className="grid gap-4 lg:grid-cols-2">{celebrationToday.map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><Card className="overflow-hidden rounded-2xl border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-card shadow-sm"><CardContent className="space-y-4 p-4 sm:p-5"><BirthdayRow person={person} getInitials={getInitials} badge="Mensagem hoje" highlight /><Textarea value={messages[person.id] || ''} onChange={e => setMessages(prev => ({ ...prev, [person.id]: e.target.value }))} placeholder={`Escreva uma mensagem para ${person.name}...`} className="min-h-[88px] rounded-xl" /><Button onClick={() => sendGreeting(person)} disabled={sendingId === person.id} className="w-full gap-2 rounded-xl"><Send className="h-4 w-4" /> Enviar no chat Geral</Button></CardContent></Card></motion.div>)}</div></section>}<section className="space-y-3"><SectionTitle icon={Calendar} title="Todos os aniversariantes do mês" subtitle="Visão completa para planejamento das felicitações e ações internas." />{birthdayPeople.length === 0 ? <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center"><div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-muted"><span className="text-3xl">🎂</span></div><h4 className="font-display text-lg font-semibold text-foreground">Nenhum aniversariante</h4><p className="text-sm text-muted-foreground">Não há aniversariantes neste mês com data cadastrada.</p></div> : <div className="grid gap-3 xl:grid-cols-2">{[...todayBirthdays, ...upcomingBirthdays, ...pastBirthdays].map((person, index) => <motion.div key={person.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}><Card className="rounded-2xl border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><CardContent className="p-4"><BirthdayRow person={person} getInitials={getInitials} badge={person.isToday ? 'Hoje' : formatBirthday(person.birthDate)} /></CardContent></Card></motion.div>)}</div>}</section></motion.div>;
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) { return <Card className="rounded-2xl border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex items-center gap-3 p-3.5 sm:p-4"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><div className="min-w-0"><p className="text-xl sm:text-2xl font-bold leading-tight text-foreground">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
function SectionTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) { return <div className="flex items-center gap-3"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></div><div className="min-w-0"><h3 className="font-display text-base sm:text-lg font-semibold text-foreground">{title}</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div></div>; }
function BirthdayRow({ person, getInitials, badge, highlight }: { person: BirthdayPerson; getInitials: (name: string) => string; badge: string; highlight?: boolean }) { return <div className="flex items-center gap-4"><div className="relative flex-shrink-0"><Avatar className={cn(highlight ? 'h-16 w-16 ring-4 ring-secondary/30' : 'h-12 w-12 ring-2 ring-border/50')}><AvatarImage src={person.avatar} /><AvatarFallback className="bg-secondary font-bold text-secondary-foreground">{getInitials(person.name)}</AvatarFallback></Avatar><div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-sm shadow ring-1 ring-border/50">🎂</div></div><div className="min-w-0 flex-1"><h4 className="truncate font-semibold text-foreground">{person.name}</h4><p className="truncate text-sm text-muted-foreground">{person.sector}</p><div className="mt-1.5 flex flex-wrap gap-1.5"><Badge variant={highlight ? 'default' : 'outline'} className="rounded-full"><Cake className="mr-1 h-3 w-3" />{badge}</Badge>{person.celebrationDate && <Badge variant="secondary" className="rounded-full"><CheckCircle2 className="mr-1 h-3 w-3" />Mensagem: {formatShortDate(person.celebrationDate)}</Badge>}</div></div></div>; }
