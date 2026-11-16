import { useState } from 'react';
import { passwordError as passwordRuleError } from '@/lib/passwordPolicy';
import { PasswordChecklist } from '@/components/common/PasswordChecklist';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Primeiro acesso no PC: só a troca de senha obrigatória. O passo a passo das abas é o DesktopTour. */
export function OnboardingScreen({ userName, onComplete }: { userName: string; onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const first = userName.split(' ')[0];
  const save = async () => {
    setError('');
    const rule = passwordRuleError(password);
    if (rule) { setError(rule); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setSaving(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      toast.success('Senha atualizada com sucesso!');
      onComplete();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a senha.'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#EDEFF2] p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Lock className="h-6 w-6" /></div>
        <h1 className="text-center text-xl font-semibold text-slate-900">Olá, {first}! Proteja sua conta</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">Antes de começar, defina uma nova senha pessoal. Depois eu te mostro, aba por aba, o que o seu perfil pode usar.</p>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5"><Label>Nova senha</Label>
            <Input autoComplete="new-password" type="password" maxLength={72} value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua nova senha" className="h-11" />
            <PasswordChecklist value={password} />
          </div>
          <div className="space-y-1.5"><Label>Confirmar senha</Label>
            <Input autoComplete="new-password" type="password" maxLength={72} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a nova senha" className="h-11" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="h-4 w-4 text-primary" />A senha será usada nos próximos acessos.</div>
          <Button size="lg" onClick={save} disabled={saving} className="w-full gap-2 rounded-xl">{saving ? 'Atualizando...' : 'Atualizar senha e começar'}<ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
