// After login: asks the person to accept the current Termos + Política de Privacidade (company admins also accept the DPA
// for the company). The acceptance (document, version, date) is saved in legal_acceptances. If the check cannot run
// (offline, demo/test mode, old database) it never blocks the app.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LEGAL, LEGAL_DOCS, LEGAL_PATH, requiredDocs, type LegalDocId } from '@/lib/legal';

const db = supabase as any;
export function LegalGate() {
  const { profile, isAdmin } = useAuth();
  const [missing, setMissing] = useState<LegalDocId[]>([]);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const pid = (profile as any)?.id as string | undefined;

  useEffect(() => {
    setMissing([]); setChecked(false);
    if (!pid) return;
    try { if (localStorage.getItem('nuvexa:demo:session')) return; } catch { /* ignore */ }   // test mode: nothing to register
    let alive = true;
    (async () => {
      try {
        const need = requiredDocs(isAdmin);
        const { data, error } = await db.from('legal_acceptances').select('doc').eq('profile_id', pid).eq('version', LEGAL.version);
        if (error) throw error;
        const have = new Set((data || []).map((r: any) => r.doc));
        if (alive) setMissing(need.filter((d) => !have.has(d)));
      } catch { if (alive) setMissing([]); }
    })();
    return () => { alive = false; };
  }, [pid, isAdmin]);

  if (!pid || !missing.length) return null;
  const accept = async () => {
    if (!checked || saving) return;
    setSaving(true); setErr('');
    const { error } = await db.rpc('accept_legal_documents', { _version: LEGAL.version, _docs: missing });
    setSaving(false);
    if (error) { setErr('Não foi possível registrar o aceite. Tente novamente.'); return; }
    setMissing([]);
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Termos e privacidade">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 text-card-foreground shadow-2xl">
        <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Termos e privacidade</h2></div>
        <p className="text-sm text-muted-foreground">Para continuar usando o ewvon, leia e aceite {missing.length > 1 ? 'os documentos abaixo' : 'o documento abaixo'}. Atualizados em {LEGAL.updated}.</p>
        <ul className="my-4 space-y-2 text-sm">
          {missing.map((d) => <li key={d}><Link to={LEGAL_PATH[d]} target="_blank" className="font-medium text-primary underline">{LEGAL_DOCS[d].title}</Link>{d === 'dpa' ? <span className="text-muted-foreground"> · em nome da sua empresa</span> : null}</li>)}
        </ul>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} /><span>Li e aceito {missing.length > 1 ? 'os documentos acima' : 'o documento acima'}.</span></label>
        {err ? <p className="mt-2 text-sm text-destructive">{err}</p> : null}
        <button type="button" disabled={!checked || saving} onClick={() => void accept()} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Aceitar e continuar</button>
      </div>
    </div>
  );
}
