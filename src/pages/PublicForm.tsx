// /f/<token>: public form of a mural (no login). Shows the company's name/logo/colour, the questions configured in
// board_forms and sends the answers to public_form_submit(), which creates the card. A hidden "_hp" honeypot field
// stops simple bots; the server also limits submissions per minute/day.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Q = { id: string; label: string; type: 'text' | 'long' | 'email' | 'phone' | 'date' | 'select' | 'number'; required?: boolean; options?: string[] };
type F = { title: string; intro: string | null; questions: Q[]; thank_you: string | null; color: string | null; company: string | null; logo: string | null; board: string };
const cleanErr = (m: string) => (m.match(/FORM_[A-Z]+:(.*)$/)?.[1] || 'Não foi possível enviar. Tente de novo.').trim();
const toCss = (c: string | null) => { if (!c) return '#2f6fed'; if (/^#|^rgb|^hsl\(/.test(c)) return c; return `hsl(${c})`; };

export default function PublicForm() {
  const { token } = useParams();
  const [f, setF] = useState<F | null | undefined>(undefined);
  const [a, setA] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState<number | null>(null);
  useEffect(() => { void (async () => { const { data, error } = await (supabase as any).rpc('public_form_view', { _token: token || '' }); setF(error ? null : (data as F) || null); })(); }, [token]);
  useEffect(() => { if (f) document.title = `${f.title} | ${f.company || 'ewvon'}`; }, [f]);
  if (f === undefined) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!f) return <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center"><b className="text-lg">Formulário indisponível</b><p className="text-sm text-muted-foreground">Este formulário foi pausado ou o link está errado.</p></div>;
  const color = toCss(f.color);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const { data, error } = await (supabase as any).rpc('public_form_submit', { _token: token, _answers: a });
    setBusy(false);
    if (error) { setErr(cleanErr(error.message || '')); return; }
    setDone((data as { number?: number })?.number ?? 0);
  };
  const set = (id: string, v: string) => setA((x) => ({ ...x, [id]: v }));
  const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--fc)] focus:ring-2 focus:ring-[var(--fc)]/20';
  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8" style={{ ['--fc' as string]: color }}>
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-2" style={{ background: color }} />
        <div className="p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            {f.logo ? <img src={f.logo} alt="" className="h-10 w-10 rounded-lg bg-white object-contain p-1 shadow-sm" /> : null}
            <span className="text-sm font-medium text-muted-foreground">{f.company}</span>
          </div>
          {done !== null ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12" style={{ color }} />
              <h1 className="mb-2 text-xl font-semibold">Recebido!</h1>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{f.thank_you || 'Obrigado. Sua solicitação foi registrada e a equipe vai dar retorno.'}</p>
              {done ? <p className="mt-3 text-xs text-muted-foreground">Número do pedido: #{done}</p> : null}
              <button type="button" className="mt-6 text-sm font-medium underline" onClick={() => { setA({}); setDone(null); }}>Enviar outra resposta</button>
            </div>
          ) : (
            <form onSubmit={(e) => void send(e)} className="space-y-4">
              <div><h1 className="text-2xl font-semibold">{f.title}</h1>{f.intro ? <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{f.intro}</p> : null}</div>
              {f.questions.map((q) => (
                <label key={q.id} className="block space-y-1.5">
                  <span className="text-sm font-medium">{q.label}{q.required ? <span className="ml-0.5" style={{ color }}>*</span> : null}</span>
                  {q.type === 'long' ? <textarea className={field} rows={4} required={q.required} maxLength={5000} value={a[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />
                    : q.type === 'select' ? (
                      <div className="flex flex-wrap gap-2">{(q.options || []).map((o) => { const on = a[q.id] === o; return <button key={o} type="button" onClick={() => set(q.id, on ? '' : o)} className="rounded-full border px-3 py-1.5 text-sm" style={on ? { background: color, borderColor: color, color: '#fff' } : undefined}>{o}</button>; })}</div>)
                    : <input className={field} required={q.required} maxLength={500} value={a[q.id] || ''} onChange={(e) => set(q.id, e.target.value)}
                        type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : q.type === 'date' ? 'date' : q.type === 'number' ? 'number' : 'text'} />}
                </label>))}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" value={a._hp || ''} onChange={(e) => set('_hp', e.target.value)} />
              {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}
              <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: color }}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enviar</button>
            </form>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Formulário criado com <a href="/" className="font-semibold">ewvon</a> · <a href="/privacidade" className="underline">Privacidade</a></p>
    </div>
  );
}
