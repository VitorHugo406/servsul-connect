// Public check of an evaluation document (QR code in the PDF). Shows only that the document exists and when it was issued;
// no personal data is exposed.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

type Result = { valid: boolean; company?: string; number?: number; kind?: string; phase?: number | null; issued_at?: string; status?: string; version?: number };
const STATUS: Record<string, string> = { draft: 'Rascunho', sent: 'Aguardando ciência do colaborador', contested: 'Revisão pedida', finalized: 'Concluída' };

export default function ValidateDocument() {
  const [params] = useSearchParams();
  const key = (params.get('k') || '').trim();
  const [res, setRes] = useState<Result | null | undefined>(undefined);
  useEffect(() => {
    if (!key) { setRes({ valid: false }); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any).rpc('validate_evaluation_doc', { _key: key }).then(({ data, error }: { data: Result | null; error: unknown }) => setRes(error ? { valid: false } : data));
  }, [key]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-3xl"><CardContent className="p-8 text-center">
        {res === undefined ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /> : res?.valid ? (
          <>
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
            <h1 className="text-xl font-bold">Documento autêntico</h1>
            <p className="mt-1 text-sm text-muted-foreground">Este documento foi emitido pelo ewvon.</p>
            <dl className="mt-5 space-y-2 rounded-2xl bg-muted p-4 text-left text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Empresa</dt><dd className="font-medium">{res.company}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Documento</dt><dd className="font-medium">Avaliação {res.kind === 'experience' ? `de experiência${res.phase ? ` (${res.phase} dias)` : ''}` : res.kind === 'development' ? 'de desempenho e desenvolvimento' : ''} · cód. {String(res.number ?? 0).padStart(5, '0')}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Emitido em</dt><dd className="font-medium">{res.issued_at ? new Date(res.issued_at).toLocaleDateString('pt-BR') : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Situação</dt><dd className="font-medium">{STATUS[res.status || ''] || res.status}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Versão</dt><dd className="font-medium">{res.version}.0</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Por privacidade, nomes e notas não são exibidos aqui.</p>
          </>
        ) : (
          <>
            <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">Documento não encontrado</h1>
            <p className="mt-1 text-sm text-muted-foreground">A chave informada não corresponde a nenhum documento emitido. Confira se o QR Code está legível ou fale com o RH.</p>
          </>
        )}
      </CardContent></Card>
    </div>
  );
}
