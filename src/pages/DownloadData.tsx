// Landing page of the "download your company data" e-mail link. The e-mail points here instead of straight at the storage
// (whose raw JSON error showed up when the 7-day link had expired). A valid link starts the download; an expired or broken
// one explains what to do in plain language.
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Parsed = { state: 'ok' | 'expired' | 'invalid'; url?: string; expires?: Date };

function parse(u: string): Parsed {
  try {
    const url = new URL(decodeURIComponent(escape(atob(u.replace(/-/g, '+').replace(/_/g, '/')))));
    // Only files of the private exports bucket of this project (never an open redirect).
    if (url.origin !== SUPABASE_URL || !url.pathname.startsWith('/storage/v1/object/sign/company-exports/')) return { state: 'invalid' };
    const token = url.searchParams.get('token') || '';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const expires = new Date(Number(payload.exp) * 1000);
    if (!Number.isFinite(expires.getTime())) return { state: 'invalid' };
    return { state: expires.getTime() > Date.now() ? 'ok' : 'expired', url: url.toString(), expires };
  } catch { return { state: 'invalid' }; }
}

export default function DownloadData() {
  const [params] = useSearchParams();
  const res = useMemo(() => parse(params.get('u') || ''), [params]);
  useEffect(() => {
    if (res.state !== 'ok' || !res.url) return;
    const t = window.setTimeout(() => { window.location.assign(res.url as string); }, 900);
    return () => window.clearTimeout(t);
  }, [res]);
  const when = res.expires?.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-3xl"><CardContent className="p-8 text-center">
        {res.state === 'ok' ? (
          <>
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
            <h1 className="text-xl font-bold">Seus dados estão prontos</h1>
            <p className="mt-2 text-sm text-muted-foreground">O download começa em instantes. Se não começar, use o botão abaixo. O link vale até {when}.</p>
            <Button className="mt-5" onClick={() => window.location.assign(res.url as string)}>Baixar os dados (ZIP)</Button>
          </>
        ) : res.state === 'expired' ? (
          <>
            <Clock className="mx-auto mb-3 h-12 w-12 text-amber-600" />
            <h1 className="text-xl font-bold">Este link venceu</h1>
            <p className="mt-2 text-sm text-muted-foreground">Por segurança, o link de download dos dados vale por 7 dias e este já passou do prazo{when ? ` (venceu em ${when})` : ''}. Seus dados continuam guardados.</p>
            <p className="mt-2 text-sm text-muted-foreground">Entre no ewvon com o e-mail que criou a empresa para gerar um novo arquivo.</p>
            <Button className="mt-5" onClick={() => window.location.assign('/auth')}>Entrar no ewvon</Button>
          </>
        ) : (
          <>
            <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-red-600" />
            <h1 className="text-xl font-bold">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">Não conseguimos abrir este link. Entre no ewvon com o e-mail que criou a empresa para gerar um novo arquivo, ou escreva para ewvonsuporte@gmail.com.</p>
            <Button className="mt-5" onClick={() => window.location.assign('/auth')}>Entrar no ewvon</Button>
          </>
        )}
      </CardContent></Card>
    </div>
  );
}
