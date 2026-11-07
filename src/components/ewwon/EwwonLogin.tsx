// Mobile login (company lookup + e-mail/password) with the Ewwon home visual.
// Same rules as pages/SelectCompany + pages/Auth: the company is found with
// public_find_company / public_get_company_by_slug and the login is refused
// when the account belongs to another company.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyBrand, resetBrand } from '@/lib/branding';
import { useCompanyLogoUrl } from '@/lib/companyLogo';
import './ewwon.css';
import './ewwon-app.css';
import { I } from './icons';

interface Company { id: string; name: string; slug: string; logo_url: string | null; primary_color: string; secondary_color: string; is_system?: boolean }

const CACHE = 'ewvor:public-company:';
const LAST = 'ewvor:last-company';
const loginSchema = z.object({ email: z.string().email('E-mail inválido'), password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres') });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase as any).rpc(name, args);

function save(c: Company, q?: string) {
  try {
    if (q) localStorage.setItem(CACHE + q.toLowerCase(), JSON.stringify(c));
    localStorage.setItem(CACHE + c.slug.toLowerCase(), JSON.stringify(c));
    localStorage.setItem('ewvor:company:' + c.id, JSON.stringify(c));
    localStorage.setItem(LAST, JSON.stringify(c));
  } catch { /* storage unavailable */ }
}
function cached(q: string): Company | null {
  try { const c = JSON.parse(localStorage.getItem(CACHE + q.toLowerCase()) || 'null'); return c?.id ? c : null; } catch { return null; }
}

export default function EwwonLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slug = params.get('company');
  const { signIn, setVerifying } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [step, setStep] = useState<'company' | 'login'>(slug ? 'login' : 'company');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const logo = useCompanyLogoUrl(company?.logo_url);

  useEffect(() => {
    if (document.getElementById('ewwon-font')) return;
    const l = document.createElement('link');
    l.id = 'ewwon-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }, []);

  // ?company=slug → load that company directly
  useEffect(() => {
    if (!slug) return;
    const c = cached(slug);
    if (c) { setCompany(c); applyBrand(c); }
    let cancelled = false;
    void rpc('public_get_company_by_slug', { _slug: slug }).then(({ data, error }: { data: unknown; error: unknown }) => {
      if (cancelled) return;
      const row = (Array.isArray(data) ? data[0] : data) as Company | null;
      if (!error && row) { setCompany(row); applyBrand(row); save(row); setStep('login'); }
      else if (!c) { setStep('company'); setNotFound(true); }
    });
    return () => { cancelled = true; };
  }, [slug]);

  // company search (debounced)
  useEffect(() => {
    if (step !== 'company') return;
    const term = q.trim();
    if (!term) { setCompany(null); setNotFound(false); setSearching(false); return; }
    const c = cached(term);
    if (c) { setCompany(c); setNotFound(false); }
    let cancelled = false;
    setSearching(!c);
    const t = window.setTimeout(async () => {
      const { data, error } = await rpc('public_find_company', { _query: term });
      if (cancelled) return;
      const row = (Array.isArray(data) ? data[0] : data) as Company | null;
      if (!error && row) { setCompany(row); setNotFound(false); save(row, term); }
      else if (!c) { setCompany(null); setNotFound(true); }
      setSearching(false);
    }, 160);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [q, step]);

  const goLogin = () => {
    if (!company) return;
    save(company); applyBrand(company);
    setErr(null); setStep('login');
    navigate(`/auth?company=${encodeURIComponent(company.slug)}`, { replace: true });
  };
  const changeCompany = () => {
    resetBrand(); setCompany(null); setQ(''); setErr(null); setStep('company');
    navigate('/select-company', { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const v = loginSchema.safeParse({ email: email.trim(), password });
    if (!v.success) { setErr(v.error.errors[0].message); return; }
    setBusy(true);
    if (company) setVerifying(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setErr(error.message.includes('Invalid login credentials') ? 'E-mail ou senha incorretos para esta empresa'
          : /inativ/i.test(error.message) ? 'Sua conta está inativa. Fale com o administrador da empresa.' : error.message);
        return;
      }
      if (company) {
        const { data: u } = await supabase.auth.getUser();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prof } = await (supabase as any).from('profiles').select('company_id').eq('user_id', u.user?.id).maybeSingle();
        if (!prof || prof.company_id !== company.id) {
          await supabase.auth.signOut();
          setErr('Cadastro não encontrado para esta empresa');
          return;
        }
      }
      setVerifying(false);
      navigate('/');
    } catch (ex) {
      console.error(ex);
      setErr('Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
      setVerifying(false);
    }
  };

  const locked = step === 'login' && !!company;

  return (
    <div className="ew ewx-root ewx-login" data-theme="dark">
      <form className="ewx-lg" onSubmit={(e) => { if (!locked) { e.preventDefault(); goLogin(); return; } void submit(e); }}>
        <div className="ewx-lg-top">
          <img className="ewx-lg-mark" src="/ewwon/img/logo-mark.png" alt="" />
          <h1>{locked ? 'Entrar' : 'Bem-vindo'}</h1>
          <p>{locked ? `Use seu e-mail e senha da ${company?.name}.` : 'Comece encontrando a sua empresa.'}</p>
        </div>

        <div className="ewx-lg-fields">
          {locked && company ? (
            <div className="ewx-lg-co">
              <span className="ewx-login-logo" style={{ background: company.primary_color || 'var(--c2)' }}>{logo ? <img src={logo} alt="" /> : company.name.charAt(0)}</span>
              <span className="ewx-lg-co-n">{company.name}</span>
              <button type="button" onClick={changeCompany}>Trocar</button>
            </div>
          ) : (
            <>
              <label className="ewx-lg-f">
                <span>Empresa</span>
                <input autoFocus placeholder="Nome da empresa" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="organization" aria-label="Empresa" />
                {company ? <i className="ewx-lg-ok"><I n="check" /></i> : searching ? <i className="ewx-spin ewx-lg-sp" /> : null}
              </label>
              <div className="ewx-lg-hint">{company ? `${company.name} encontrada` : notFound && q.trim() ? 'Nenhuma empresa com esse nome' : ' '}</div>
            </>
          )}

          {locked ? (
            <>
              <label className="ewx-lg-f">
                <span>E-mail</span>
                <input type="email" inputMode="email" autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </label>
              <label className="ewx-lg-f">
                <span>Senha</span>
                <input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="ewx-lg-eye" onClick={() => setShow(!show)}>{show ? 'Ocultar' : 'Mostrar'}</button>
              </label>
            </>
          ) : null}
          {err ? <div className="ewx-lg-err">{err}</div> : null}
        </div>

        <div className="ewx-lg-bottom">
          <button className="ewx-lg-btn" type="submit" disabled={busy || !company}>{busy ? <i className="ewx-spin" /> : locked ? 'Entrar' : 'Continuar'}</button>
          {locked && company ? <button type="button" className="ewx-lg-link" onClick={() => navigate(`/auth?company=${encodeURIComponent(company.slug)}&full=1`)}>Primeiro acesso? <b>Criar conta</b></button>
            : <p className="ewx-lg-foot"><I n="lock" /> Conexão segura</p>}
        </div>
      </form>
    </div>
  );
}
