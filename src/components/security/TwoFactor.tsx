// Verificação em duas etapas (TOTP, Supabase Auth MFA): any authenticator app (Google Authenticator, Microsoft
// Authenticator, Authy…). `TwoFactorPanel` turns it on/off in the profile; `MfaGate` asks for the 6-digit code after the
// password whenever the account has a verified factor and the session is still at level aal1 (PC and phone).
import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { appConfirm } from '@/lib/appDialog';

const mfa = () => (supabase.auth as any).mfa as any | undefined;
const clean = (v: string) => v.replace(/\D/g, '').slice(0, 6);

export function TwoFactorPanel() {
  const [factor, setFactor] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await mfa()?.listFactors(); setFactor((data?.totp || []).find((f: any) => f.status === 'verified') || null); } catch { setFactor(null); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    setBusy(true);
    try {
      const { data: list } = await mfa()?.listFactors();   // drop unfinished attempts so a new QR can be created
      for (const f of (list?.all || []).filter((x: any) => x.status !== 'verified')) await mfa()?.unenroll({ factorId: f.id });
      const { data, error } = await mfa()?.enroll({ factorType: 'totp', friendlyName: `ewvon ${new Date().toISOString().slice(0, 16)}` });
      if (error || !data) throw error || new Error('x');
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }); setCode('');
    } catch { toast.error('Não foi possível iniciar a verificação em duas etapas.'); }
    setBusy(false);
  };
  const confirm = async () => {
    if (!enroll || code.length !== 6) return;
    setBusy(true);
    try {
      const { error } = await mfa()?.challengeAndVerify({ factorId: enroll.id, code });
      if (error) throw error;
      toast.success('Verificação em duas etapas ativada.'); setEnroll(null); await load();
    } catch { toast.error('Código inválido. Confira o horário do celular e tente o código atual.'); }
    setBusy(false);
  };
  const disable = async () => {
    if (!factor) return;
    if (!(await appConfirm({ title: 'Desativar a verificação em duas etapas?', message: 'Sua conta volta a pedir só a senha para entrar.', confirmText: 'Desativar', danger: true }))) return;
    setBusy(true);
    const { error } = await mfa()?.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) { toast.error('Para desativar, saia e entre de novo usando o código do aplicativo, depois tente outra vez.'); return; }
    toast.success('Verificação em duas etapas desativada.'); await load();
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>;
  return (
    <div className="space-y-3 text-sm">
      {factor ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div className="flex-1"><b>Ativada</b><p className="text-xs text-muted-foreground">Ao entrar, o ewvon pede a senha e o código de 6 dígitos do seu aplicativo autenticador.</p></div>
          <Button variant="outline" size="sm" onClick={disable} disabled={busy}><ShieldOff className="mr-1.5 h-4 w-4" />Desativar</Button>
        </div>
      ) : enroll ? (
        <div className="space-y-3">
          <p>1. Abra um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou Authy) e leia o QR code:</p>
          <div className="flex justify-center rounded-xl bg-white p-3"><img src={enroll.qr} alt="QR code da verificação em duas etapas" className="h-44 w-44" /></div>
          <p className="text-xs text-muted-foreground">Sem câmera? Digite esta chave no aplicativo: <code className="select-all break-all rounded bg-muted px-1">{enroll.secret}</code></p>
          <p>2. Digite o código de 6 dígitos que aparece no aplicativo:</p>
          <div className="flex gap-2"><Input value={code} onChange={(e) => setCode(clean(e.target.value))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="max-w-[140px] text-center text-lg tracking-[0.3em]" aria-label="Código de 6 dígitos" />
            <Button onClick={confirm} disabled={busy || code.length !== 6}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Ativar</Button>
            <Button variant="ghost" onClick={() => setEnroll(null)} disabled={busy}>Cancelar</Button></div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground">Proteja sua conta: além da senha, o login pede um código que muda a cada 30 segundos no seu celular. Mesmo que alguém descubra sua senha, não consegue entrar.</p>
          <Button onClick={start} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Ativar verificação em duas etapas</Button>
        </div>
      )}
    </div>
  );
}

/** Full-screen code prompt after the password when the account has 2FA and the session is not verified yet. */
export function MfaGate() {
  const { user, signOut } = useAuth() as any;
  const [need, setNeed] = useState<string | null>(null);   // factor id
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const check = useCallback(async () => {
    if (!user || !mfa()) { setNeed(null); return; }
    try {
      const { data } = await mfa().getAuthenticatorAssuranceLevel();
      if (data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2') {
        const { data: f } = await mfa().listFactors();
        const v = (f?.totp || []).find((x: any) => x.status === 'verified');
        setNeed(v ? v.id : null);
      } else setNeed(null);
    } catch { setNeed(null); }
  }, [user]);
  useEffect(() => { void check(); }, [check]);
  useEffect(() => { const { data } = supabase.auth.onAuthStateChange(() => { void check(); }); return () => data.subscription.unsubscribe(); }, [check]);
  const verify = async () => {
    if (!need || code.length !== 6) return;
    setBusy(true);
    const { error } = await mfa().challengeAndVerify({ factorId: need, code });
    setBusy(false);
    if (error) { toast.error('Código inválido. Use o código atual do aplicativo.'); setCode(''); return; }
    setNeed(null); setCode('');
  };
  if (!need) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-xl font-semibold">Verificação em duas etapas</h1>
        <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu aplicativo autenticador para entrar.</p>
        <Input value={code} onChange={(e) => setCode(clean(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') void verify(); }} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000" className="mx-auto h-12 max-w-[200px] text-center text-2xl tracking-[0.35em]" aria-label="Código de 6 dígitos" />
        <Button className="w-full" onClick={verify} disabled={busy || code.length !== 6}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Entrar</Button>
        <button type="button" className="text-sm text-muted-foreground underline" onClick={() => void (signOut ? signOut() : supabase.auth.signOut())}>Sair e usar outra conta</button>
        <p className="text-xs text-muted-foreground">Perdeu o acesso ao aplicativo? Peça ao administrador da empresa ou escreva para o suporte.</p>
      </div>
    </div>
  );
}
