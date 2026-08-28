import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Cake, MessageCircle, Users, LogIn, CalendarDays, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type BirthdayItem = { id: string; name: string; sector: string; birthDate: string; birthDay: number; celebrationDate?: string | null };
type Snapshot = { companyName: string; monthName: string; theme: string; generatedAt: string; expiresAt: string; people: BirthdayItem[] };

function decodeSnapshot(value: string | null): Snapshot | null {
  if (!value) return null;
  try {
    const json = decodeURIComponent(escape(atob(value.replace(/-/g, '+').replace(/_/g, '/'))));
    return JSON.parse(json) as Snapshot;
  } catch {
    try { return JSON.parse(atob(value)) as Snapshot; } catch { return null; }
  }
}

export default function BirthdayShare() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const snapshot = useMemo(() => decodeSnapshot(params.get('data')), [params]);
  const sector = params.get('sector') || 'Todos';

  if (!snapshot) return <div className="min-h-screen bg-background p-6 flex items-center justify-center"><Card className="max-w-md rounded-3xl"><CardContent className="p-8 text-center"><Cake className="mx-auto mb-4 h-10 w-10 text-primary" /><h1 className="text-xl font-bold">Relatório indisponível</h1><p className="mt-2 text-sm text-muted-foreground">O QR Code não contém um relatório válido.</p></CardContent></Card></div>;

  const expired = snapshot.expiresAt ? Date.now() > new Date(snapshot.expiresAt).getTime() : false;
  if (expired) return <div className="min-h-screen bg-background p-6 flex items-center justify-center"><Card className="max-w-md rounded-3xl"><CardContent className="p-8 text-center"><CalendarDays className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-bold">Relatório encerrado</h1><p className="mt-2 text-sm text-muted-foreground">Este painel de aniversariantes não está mais disponível para leitura.</p></CardContent></Card></div>;

  const sectors = useMemo(() => ['Todos', ...Array.from(new Set(snapshot.people.map(p => p.sector).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [snapshot.people]);
  const filtered = sector === 'Todos' ? snapshot.people : snapshot.people.filter(p => p.sector === sector);
  const today = new Date();
  const isMessageWindowOpen = (person: BirthdayItem) => {
    const date = person.celebrationDate || person.birthDate;
    if (!date) return false;
    const target = new Date(date + 'T00:00:00');
    const end = new Date(target); end.setDate(end.getDate() + 1);
    return today >= target && today < end;
  };

  const openMessage = (person: BirthdayItem) => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    sessionStorage.setItem('birthday_message_target', JSON.stringify({ id: person.id, returnTo }));
    if (!user) { navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`); return; }
    navigate(`/?openChat=${encodeURIComponent(person.id)}`);
  };

  return <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 pb-10">
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-primary">{snapshot.companyName}</p><h1 className="truncate text-lg font-bold">Aniversariantes • {snapshot.monthName}</h1></div>
        {!user && <Button size="sm" className="shrink-0 rounded-full" onClick={() => navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}><LogIn className="mr-1.5 h-4 w-4" />Entrar</Button>}
      </div>
    </header>
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
      <Card className="overflow-hidden rounded-3xl border-primary/10 bg-card/80 shadow-sm"><CardContent className="p-5 sm:p-6"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10"><Cake className="h-6 w-6 text-primary" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">Celebrações do mês</h2><Badge variant="secondary" className="rounded-full">{snapshot.theme}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Consulte por setor e encontre rapidamente quem está celebrando.</p></div></div></CardContent></Card>
      <div className="flex gap-2 overflow-x-auto pb-1">{sectors.map(s => <Button key={s} size="sm" variant={s === sector ? 'default' : 'outline'} className="shrink-0 rounded-full" onClick={() => { const next = new URLSearchParams(params); next.set('sector', s); navigate(`${window.location.pathname}?${next.toString()}`); }}>{s}</Button>)}</div>
      <div className="grid gap-3">{filtered.map(person => <Card key={person.id} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="flex items-center gap-3 p-3.5"><Avatar className="h-12 w-12 shrink-0"><AvatarImage src={(person as BirthdayItem & { avatar?: string }).avatar || ''} /><AvatarFallback className="bg-primary/10 font-semibold text-primary">{person.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{person.name}</h3><p className="truncate text-sm text-muted-foreground">{person.sector}</p><p className="mt-0.5 text-xs font-medium text-primary">{new Date(person.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p></div>{isMessageWindowOpen(person) && <Button size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => openMessage(person)} aria-label={`Escrever mensagem para ${person.name}`}><MessageCircle className="h-4 w-4" /></Button>}</CardContent></Card>)}</div>
      {filtered.length === 0 && <Card className="rounded-2xl"><CardContent className="p-10 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-3 h-8 w-8" />Nenhum aniversariante neste setor.</CardContent></Card>}
      <div className="flex items-center justify-center gap-2 pt-2 text-center text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5" />Relatório digital gerado pelo Nuvexa</div>
    </main>
  </div>;
}
