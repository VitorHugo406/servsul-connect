// Gerenciamento: lista de colaboradores à esquerda e ficha completa à direita (dados pessoais, contato, profissional,
// bancário, acesso e permissões). Dados sensíveis ficam criptografados (employee_records) e só o administrador grava.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { passwordError } from '@/lib/passwordPolicy';
import { PasswordChecklist } from '@/components/common/PasswordChecklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { planHasFeature } from '@/lib/planAccess';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { limitErrorMessage } from '@/lib/planAccess';
import { getEmployeeRecord, saveEmployeeRecord, type EmployeeRecord } from '@/lib/employeeRecord';
import { UserRegistrationDialog } from '@/components/management/UserRegistrationDialog';
import { Sel } from '@/components/ui/Sel';

interface Profile { avatar_url?: string | null; id: string; user_id: string; name: string; email: string; phone: string | null; address?: string | null; company: string | null; registration_number: string | null; profile_type: string; is_active: boolean; sector_id: string | null; birth_date: string | null; autonomy_level: string; last_seen_at?: string | null }
interface Sector { id: string; name: string; color: string }
interface Permission { user_id: string; can_post_announcements: boolean; can_delete_messages: boolean; can_access_management: boolean; can_access_password_change: boolean; can_create_war_room: boolean; can_access_orbs?: boolean; can_access_meeting_rooms?: boolean; can_access_dash?: boolean; can_manage_signatures?: boolean }
interface Role { user_id: string; role: string }
const ADMIN_EMAIL = 'adminservchat@servsul.com.br';
const LEVELS: [string, string][] = [['colaborador', 'Colaborador'], ['supervisor', 'Supervisor'], ['gerente', 'Gerente'], ['diretoria', 'Diretoria']];
const DAYS: [string, string][] = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex'], ['sab', 'Sáb'], ['dom', 'Dom']];
// `feature` = recurso do plano necessário; sem ele a empresa não tem acesso à aba, então o interruptor não aparece.
const PERMS: { key: keyof Permission; label: string; feature?: string }[] = [
  { key: 'can_post_announcements', label: 'Postar avisos', feature: 'announcements' }, { key: 'can_access_password_change', label: 'Alterar senhas' },
  { key: 'can_create_war_room', label: 'Criar War Room', feature: 'war_room' }, { key: 'can_access_dash', label: 'Dash', feature: 'dashboard_3d' },
  { key: 'can_access_meeting_rooms', label: 'Sala de Reunião', feature: 'meeting_rooms' }, { key: 'can_delete_messages', label: 'Excluir mensagens', feature: 'chat' },
  { key: 'can_manage_signatures', label: 'Criar visuais de assinatura' },
  { key: 'can_access_management', label: 'Gerenciamento' },
];

const digits = (v: string, max = 30) => v.replace(/\D/g, '').slice(0, max);
const mask = {
  cpf: (v: string) => { const d = digits(v, 11); return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2'); },
  rg: (v: string) => { const d = v.replace(/[^0-9xX]/g, '').toUpperCase().slice(0, 9); return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})([0-9X])$/, '.$1-$2'); },
  pis: (v: string) => { const d = digits(v, 11); return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{5})(\d)/, '$1.$2.$3').replace(/\.(\d{5})\.(\d{2})(\d)/, '.$1.$2-$3'); },
  cep: (v: string) => digits(v, 8).replace(/^(\d{5})(\d)/, '$1-$2'),
  phone: (v: string) => { const d = digits(v, 11); if (d.length <= 2) return d ? `(${d}` : ''; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; },
  money: (v: string) => { const d = digits(v, 12).replace(/^0+/, ''); if (!d) return ''; const c = d.padStart(3, '0'); return `${c.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${c.slice(-2)}`; },
  num: (v: string) => digits(v, 9),
  uf: (v: string) => v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2),
  upper: (v: string) => v.toUpperCase().slice(0, 12),
};
type MaskKey = keyof typeof mask;

/** Sublinhado reto que desliza até a aba ativa. */
function useIndicator(active: string, deps: unknown[] = []) {
  const ref = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-tab="${active}"]`) as HTMLElement | null;
    if (el) setPos({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, style: { transform: `translateX(${pos.x}px)`, width: pos.w } as React.CSSProperties };
}

function Masked({ label, value, onChange, disabled, prefix, numeric }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; prefix?: string; numeric?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <label>{label}</label>
      <div className="dk-mk">
        <input type={show ? 'text' : 'password'} inputMode={numeric ? 'numeric' : undefined} autoComplete="off" data-lpignore="true" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={prefix} />
        <button type="button" className="dk-mo" onClick={() => setShow((v) => !v)}>{show ? 'Ocultar' : 'Mostrar'}</button>
      </div>
    </>
  );
}

export function ManagementSection() {
  const { isAdmin, canAccess, profile, refreshPermissions } = useAuth();
  const { plan: companyPlan } = useCompanyPlan();
  const hasManagementAccess = isAdmin || ['diretoria', 'gerente', 'supervisor', 'gestor'].includes(profile?.autonomy_level || '') || canAccess('can_access_management');
  const canChangePasswords = hasManagementAccess || canAccess('can_access_password_change');
  const [users, setUsers] = useState<Profile[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'on' | 'off'>('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<Profile | null>(null);
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [rec, setRec] = useState<EmployeeRecord>({});
  const [f, setF] = useState({ name: '', phone: '', birth: '', sector: '', level: 'colaborador', active: true });
  const [section, setSection] = useState('personal');
  const scrollRef = useRef<HTMLDivElement>(null);
  const navInd = useIndicator(section, [selId, loading]);
  const tabInd = useIndicator(filter, [users.length]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: u, error: ue }, { data: s, error: se }, { data: p }, { data: r }] = await Promise.all([
        supabase.rpc('admin_list_profiles_full'), supabase.from('sectors').select('*').order('name'), supabase.from('user_permissions').select('*'), supabase.from('user_roles').select('*'),
      ]);
      if (ue) throw ue; if (se) throw se;
      let list = ((u as any[]) || []) as Profile[];
      if (list.length && !list.some((x) => 'avatar_url' in x)) {
        const { data: av } = await supabase.from('profiles').select('user_id, avatar_url');
        const am = new Map((av || []).map((x: any) => [x.user_id, x.avatar_url]));
        list = list.map((x) => ({ ...x, avatar_url: (am.get(x.user_id) as string | null) ?? null }));
      }
      setUsers(list); setSectors(s || []);
      const pm: Record<string, Permission> = {}; (p || []).forEach((x: any) => { pm[x.user_id] = x; }); setPermissions(pm);
      const rm: Record<string, Role> = {}; (r || []).forEach((x: any) => { rm[x.user_id] = x; }); setRoles(rm);
    } catch (e) { console.error(e); toast.error('Erro ao carregar usuários e configurações.'); } finally { setLoading(false); }
  };
  useEffect(() => { if (hasManagementAccess) fetchData(); else setLoading(false); }, [hasManagementAccess]);

  const matches = (u: Profile) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
  const counts = { all: users.length, on: users.filter((u) => u.is_active).length, off: users.filter((u) => !u.is_active).length };
  const filtered = useMemo(() => users.filter((u) => matches(u) && (filter === 'all' || (filter === 'on' ? u.is_active : !u.is_active))), [users, search, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = users.find((u) => u.user_id === selId) || null;

  // abre o primeiro colaborador sozinho
  useEffect(() => { if (!selId && filtered.length) selectUser(filtered[0]); }, [filtered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectUser = (u: Profile) => {
    setSelId(u.user_id);
    setF({ name: u.name || '', phone: u.phone || '', birth: u.birth_date || '', sector: u.sector_id || '', level: u.autonomy_level || 'colaborador', active: u.is_active });
    setRec({}); void getEmployeeRecord(u.id).then(setRec);
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const r = (k: keyof EmployeeRecord) => (rec[k] as string) || '';
  const setR = (k: keyof EmployeeRecord) => (v: string) => setRec((prev) => ({ ...prev, [k]: v }));

  const updatePermission = async (userId: string, key: keyof Permission, value: boolean) => {
    const map: Record<string, string> = { can_post_announcements: 'canPostAnnouncements', can_delete_messages: 'canDeleteMessages', can_access_management: 'canAccessManagement', can_access_password_change: 'canAccessPasswordChange', can_create_war_room: 'canCreateWarRoom', can_access_orbs: 'canAccessOrbs', can_access_meeting_rooms: 'canAccessMeetingRooms', can_access_dash: 'canAccessDash', can_manage_signatures: 'canManageSignatures' };
    try {
      const response = await supabase.functions.invoke('update-user-permissions', { body: { userId, permissions: { [map[key]]: value } } });
      if (response.error || response.data?.error) throw new Error(response.data?.error || response.error?.message);
      setPermissions((prev) => ({ ...prev, [userId]: { ...prev[userId], user_id: userId, [key]: value } as Permission }));
      if (userId === profile?.user_id) await refreshPermissions();
      toast.success('Permissão salva.');
    } catch (e) { console.error(e); toast.error(e instanceof Error ? e.message : 'Erro ao atualizar permissão'); }
  };
  const updateStatus = async (u: Profile) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_active: !u.is_active }).eq('user_id', u.user_id);
      if (error) throw error;
      setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, is_active: !u.is_active } : x)));
      if (u.user_id === selId) setF((p) => ({ ...p, active: !u.is_active }));
      toast.success(`Usuário ${!u.is_active ? 'ativado' : 'desativado'}.`);
    } catch (e) { toast.error(limitErrorMessage(e) || 'Erro ao atualizar status.'); }
  };
  const save = async () => {
    if (!sel) return;
    setSaving(true);
    try {
      const patch: Record<string, any> = { name: f.name, phone: f.phone || null, birth_date: f.birth || null, sector_id: f.sector || null, registration_number: r('registration') || null, is_active: f.active };
      // A new full name must win over an old "nome de exibição" (the app and chat show display_name first).
      if ((f.name || '').trim() !== (sel.name || '').trim()) patch.display_name = null;
      if (isAdmin && f.level !== sel.autonomy_level && roles[sel.user_id]?.role !== 'admin') patch.autonomy_level = f.level;
      const { error } = await supabase.from('profiles').update(patch as never).eq('user_id', sel.user_id);
      if (error) throw error;
      if (isAdmin) { try { await saveEmployeeRecord(sel.id, rec); } catch (err) { toast.error((err as Error).message); } }
      toast.success('Usuário atualizado.'); await fetchData();
    } catch (e) { toast.error(limitErrorMessage(e) || 'Erro ao atualizar usuário.'); } finally { setSaving(false); }
  };
  const changePassword = async () => {
    if (!passwordUser) return;
    { const pe = passwordError(newPassword); if (pe) { toast.error(pe); return; } }
    setSaving(true);
    try {
      const response = await supabase.functions.invoke('manage-user', { body: { type: 'change-password', userId: passwordUser.user_id, newPassword } });
      if (response.error || response.data?.error) throw new Error(response.data?.error || response.error?.message);
      toast.success(`Senha de ${passwordUser.name} alterada.`); setPasswordUser(null); setNewPassword('');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao alterar senha.'); } finally { setSaving(false); }
  };
  const deleteUserPermanently = async () => {
    if (!deleteUser) return;
    if (deleteUser.email === ADMIN_EMAIL) { toast.error('O administrador principal não pode ser excluído.'); return; }
    setSaving(true);
    try {
      const response = await supabase.functions.invoke('manage-user', { body: { type: 'delete-single-user', userId: deleteUser.user_id } });
      if (response.error || response.data?.error) throw new Error(response.data?.error || response.error?.message);
      toast.success('Usuário excluído com sucesso.'); setDeleteUser(null); if (deleteUser.user_id === selId) setSelId(null); fetchData();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro ao excluir usuário.'); } finally { setSaving(false); }
  };

  const goTo = (id: string) => { setSection(id); scrollRef.current?.scrollTo({ top: 0 }); };

  if (!hasManagementAccess) return <div className="dk-pg"><div className="dk-empty"><Shield className="mx-auto mb-3 h-10 w-10" style={{ color: '#6B7482' }} /><b>Acesso restrito</b><div className="dk-sub" style={{ marginTop: 6 }}>Você não tem permissão para acessar o gerenciamento.</div></div></div>;

  const roleOf = (u: Profile) => roles[u.user_id]?.role === 'admin' ? 'admin' : (u.autonomy_level || 'colaborador');
  const sectorName = (u: Profile) => sectors.find((s) => s.id === u.sector_id)?.name || 'Sem setor';
  const days = new Set((rec.work_days || '').split(',').filter(Boolean));
  const toggleDay = (d: string) => { const n = new Set(days); n.has(d) ? n.delete(d) : n.add(d); setR('work_days')(Array.from(n).join(',')); };
  const ro = !isAdmin;
  const lastSeen = sel?.last_seen_at ? new Date(sel.last_seen_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  const selAdmin = sel ? roles[sel.user_id]?.role === 'admin' : false;
  const p = (sel && permissions[sel.user_id]) || ({} as Permission);

  const field = (span: number, label: string, node: React.ReactNode) => <div className="dk-f" style={{ gridColumn: `span ${span}` }}>{label ? <label>{label}</label> : null}{node}</div>;
  const text = (span: number, label: string, k: keyof EmployeeRecord, type = 'text', m?: MaskKey) => field(span, label, <input type={type} inputMode={m && m !== 'upper' && m !== 'uf' ? 'numeric' : undefined} value={r(k)} disabled={ro} maxLength={120} onChange={(e) => setR(k)(m ? mask[m](e.target.value) : e.target.value)} />);
  const select = (span: number, label: string, k: keyof EmployeeRecord, opts: string[]) => field(span, label, <Sel value={r(k)} disabled={ro} onChange={(e) => setR(k)(e.target.value)}><option value="">Selecione</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</Sel>);
  const masked = (span: number, label: string, k: keyof EmployeeRecord, m?: MaskKey) => <div className="dk-f" style={{ gridColumn: `span ${span}` }}><Masked label={label} value={r(k)} disabled={ro} onChange={(v) => setR(k)(m ? mask[m](v) : v)} numeric={!!m} /></div>;

  return (
    <div className="dk-pg dk-mg">
      <aside className="dk-ml">
        <div className="sh">
          <div className="srow"><input className="dk-srch" placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} /><button className="dk-b2 pri" onClick={() => setCreateOpen(true)}>+ Novo</button>
            <ExportMenu className="dk-b2" label="" getData={() => ({ name: 'colaboradores', sheet: 'Colaboradores', headers: ['Nome', 'E-mail', 'Telefone', 'Setor', 'Nível', 'Situação'],
              rows: filtered.map((u) => [u.name, u.email, u.phone || '', sectorName(u), roleOf(u) === 'admin' ? 'Administrador' : (u.autonomy_level || 'colaborador'), u.is_active ? 'Ativo' : 'Inativo']) })} /></div>
          <div className="dk-tb" role="group" aria-label="Situação" ref={tabInd.ref as React.RefObject<HTMLDivElement>}>{([['all', 'Todos'], ['on', 'Ativos'], ['off', 'Inativos']] as const).map(([k, l]) => <button key={k} data-tab={k} aria-pressed={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}<span>{counts[k]}</span></button>)}<i className="dk-ind" style={tabInd.style} /></div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? <div className="dk-cnt">Carregando...</div> : filtered.map((u) => (
            <button key={u.user_id} className={`dk-li${u.user_id === selId ? ' sel' : ''}`} onClick={() => selectUser(u)}>
              <span className="dk-mav">{u.avatar_url ? <img src={u.avatar_url} alt="" /> : (u.name || '?')[0].toUpperCase()}</span>
              <span className="dk-lt"><span className="ti">{u.name}</span><span className="su">{u.email} • {sectorName(u)}</span><span className="dk-bd"><em>{roleOf(u)}</em><span className={u.is_active ? 'dk-s1' : 'dk-s0'} style={{ color: u.is_active ? '#0A6B3D' : undefined }}>{u.is_active ? 'Ativo' : 'Inativo'}</span></span></span>
            </button>
          ))}
        </div>
        <div className="dk-cnt">{filtered.length} usuários encontrados</div>
      </aside>

      <main className="dk-mm">
        {!sel ? <div className="dk-empty">Selecione um colaborador na lista.</div> : (
          <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div className="dk-dh">
              <div className="dk-bav">{sel.avatar_url ? <img src={sel.avatar_url} alt="" /> : (sel.name || '?')[0].toUpperCase()}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0 }}>{sel.name}</h2>
                  <div className="dk-bd" style={{ marginTop: 0 }}><em>{roleOf(sel)}</em><span className={sel.is_active ? 'dk-s1' : 'dk-s0'} style={{ color: sel.is_active ? '#0A6B3D' : undefined }}>{sel.is_active ? 'Ativo' : 'Inativo'}</span></div>
                </div>
                <div className="su" style={{ color: '#4A5563', marginTop: 2 }}>{sel.email} • {roleOf(sel) === 'admin' ? 'Admin' : sectorName(sel)}</div>
              </div>
              <div className="dk-acts">
                {canChangePasswords && <button className="dk-lk" onClick={() => setPasswordUser(sel)}>Senha</button>}
                <button className="dk-lk" onClick={() => updateStatus(sel)}>{sel.is_active ? 'Desativar' : 'Ativar'}</button>
                {sel.email !== ADMIN_EMAIL && <button className="dk-lk dg" onClick={() => setDeleteUser(sel)}>Excluir</button>}
                <button className="dk-b2 pri" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
            <nav className="dk-nav" ref={navInd.ref as React.RefObject<HTMLElement & HTMLDivElement>}>{[['personal', 'Dados pessoais'], ['contact', 'Contato'], ['work', 'Profissional'], ['access', 'Acesso'], ['perms', 'Permissões']].map(([id, l]) => <button key={id} data-tab={id} className={section === id ? 'on' : ''} onClick={() => goTo(id)}>{l}</button>)}<span className="dk-ind" style={navInd.style} /></nav>

            {section === 'personal' && <section key="personal" className="dk-sec dk-fade" data-sec="personal"><div><h3>Dados pessoais</h3><div className="hp">Identificação e documentos do colaborador.</div></div>
              <div className="dk-gr6">
                {field(4, 'Nome completo', <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />)}
                {text(2, 'Nome social', 'social_name')}
                {field(2, 'Data de nascimento', <input type="date" value={f.birth} onChange={(e) => setF({ ...f, birth: e.target.value })} />)}
                {select(2, 'Estado civil', 'marital_status', ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'])}
                {select(2, 'Escolaridade', 'education', ['Fundamental completo', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação'])}
                {masked(2, 'CPF', 'cpf', 'cpf')}{masked(2, 'RG', 'rg', 'rg')}{text(2, 'Órgão emissor', 'rg_issuer', 'text', 'upper')}
                {masked(3, 'PIS/NIS', 'pis', 'pis')}
                <div className="dk-f" style={{ gridColumn: 'span 3' }}><span className="lab">Sexo</span><div className="dk-opts">{[['M', 'Masculino'], ['F', 'Feminino'], ['O', 'Outro']].map(([v, l]) => <label key={v}><input type="radio" name="sex" disabled={ro} checked={r('sex') === v} onChange={() => setR('sex')(v)} />{l}</label>)}</div></div>
              </div></section>}

            {section === 'contact' && <section key="contact" className="dk-sec dk-fade" data-sec="contact"><div><h3>Contato e endereço</h3><div className="hp">Como falar com o colaborador e com um contato de emergência.</div></div>
              <div className="dk-gr6">
                {field(2, 'Celular', <input inputMode="numeric" placeholder="(11) 90000-0000" value={f.phone} onChange={(e) => setF({ ...f, phone: mask.phone(e.target.value) })} />)}{text(2, 'Telefone fixo', 'phone_alt', 'text', 'phone')}{text(2, 'E-mail pessoal', 'personal_email', 'email')}
                {text(2, 'Contato de emergência', 'emergency_name')}{text(2, 'Parentesco', 'emergency_relation')}{text(2, 'Telefone do contato', 'emergency_phone', 'text', 'phone')}
                {text(2, 'CEP', 'zip', 'text', 'cep')}{text(3, 'Logradouro', 'street')}{text(1, 'Número', 'number', 'text', 'num')}
                {text(2, 'Complemento', 'complement')}{text(2, 'Bairro', 'district')}{text(1, 'Cidade', 'city')}{text(1, 'UF', 'state', 'text', 'uf')}
              </div></section>}

            {section === 'work' && <section key="work" className="dk-sec dk-fade" data-sec="work"><div><h3>Dados profissionais</h3><div className="hp">Cargo, contrato, remuneração e jornada.</div></div>
              <div className="dk-gr6">
                {text(1, 'Matrícula', 'registration', 'text', 'num')}{text(3, 'Cargo', 'job_title')}
                {field(2, 'Setor', <Sel value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })}><option value="">Sem setor</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Sel>)}
                {text(2, 'Unidade', 'unit')}{text(2, 'Gestor direto', 'manager_name')}{text(2, 'Data de admissão', 'admission_date', 'date')}
                {select(2, 'Tipo de contrato', 'contract_type', ['CLT', 'PJ', 'Estágio', 'Temporário', 'Aprendiz'])}{masked(2, 'Salário (R$)', 'salary', 'money')}{text(1, 'Entrada', 'work_start', 'time')}{text(1, 'Saída', 'work_end', 'time')}
                {text(1, 'Intervalo', 'break_time', 'time')}{text(2, 'Jornada semanal (horas)', 'weekly_hours', 'text', 'num')}
                <div className="dk-f" style={{ gridColumn: 'span 3' }}><span className="lab">Dias de trabalho</span><div className="dk-opts">{DAYS.map(([v, l]) => <label key={v}><input type="checkbox" disabled={ro} checked={days.has(v)} onChange={() => toggleDay(v)} />{l}</label>)}</div></div>
              </div></section>}


            {section === 'access' && <section key="access" className="dk-sec dk-fade" data-sec="access"><div><h3>Acesso</h3><div className="hp">Login e situação da conta no sistema.</div></div>
              <div className="dk-gr6">
                {field(3, 'E-mail de login', <input value={sel.email} disabled readOnly />)}
                {field(2, 'Perfil', <Sel value={selAdmin ? 'admin' : f.level} disabled={!isAdmin || selAdmin} onChange={(e) => setF({ ...f, level: e.target.value })}>{selAdmin ? <option value="admin">Administrador</option> : null}{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Sel>)}
                {field(1, 'Situação', <Sel value={f.active ? '1' : '0'} onChange={(e) => setF({ ...f, active: e.target.value === '1' })}><option value="1">Ativo</option><option value="0">Inativo</option></Sel>)}
                <div className="dk-pwr">{canChangePasswords && <button className="dk-b2" onClick={() => setPasswordUser(sel)}>Definir nova senha</button>}{lastSeen ? <span>Último acesso: {lastSeen}</span> : <span>Sem acesso registrado</span>}</div>
              </div></section>}

            {section === 'perms' && <section key="perms" className="dk-sec dk-fade" data-sec="perms" style={{ borderBottom: 0 }}><div><h3>Permissões</h3><div className="hp">Configure os acessos individualmente, sem exigir que o colaborador seja administrador.</div></div>
              <div className="dk-pg2">
                {PERMS.filter(({ feature }) => !feature || planHasFeature(companyPlan, feature)).map(({ key, label }) => {
                  const on = selAdmin || !!p[key];
                  return <div key={key} className="dk-pm"><span>{label}</span><button type="button" className={`dk-sw${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={selAdmin} onClick={() => updatePermission(sel.user_id, key, !on)}><i /></button></div>;
                })}
              </div></section>}
            <div className="dk-ftb"><button className="dk-b2" onClick={() => selectUser(sel)}>Cancelar</button><button className="dk-b2 pri" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
          </div>
        )}
      </main>

      <UserRegistrationDialog open={createOpen} onOpenChange={setCreateOpen} sectors={sectors} onSuccess={() => { setCreateOpen(false); fetchData(); }} />
      <Dialog open={!!passwordUser} onOpenChange={(o) => { if (!o) { setPasswordUser(null); setNewPassword(''); setShowPw(false); } }}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Alterar senha</DialogTitle><DialogDescription>Defina uma nova senha para {passwordUser?.name}. A senha existente não é exibida.</DialogDescription></DialogHeader>
          <div className="space-y-4"><div className="space-y-2"><Label>Nova senha</Label>
            <div className="relative"><Input type={showPw ? 'text' : 'password'} autoComplete="new-password" maxLength={72} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Ex.: Equipe@2026" className="pr-10" /><button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
            <PasswordChecklist value={newPassword} /></div>
            <Button className="w-full" onClick={changePassword} disabled={saving}>{saving ? 'Salvando...' : 'Alterar senha'}</Button></div></DialogContent></Dialog>
      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Excluir usuário</DialogTitle><DialogDescription>Excluir permanentemente <strong>{deleteUser?.name}</strong> remove o acesso e os dados vinculados ao usuário. Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button><Button variant="destructive" onClick={deleteUserPermanently} disabled={saving}>{saving ? 'Excluindo...' : 'Excluir definitivamente'}</Button></div></DialogContent></Dialog>
    </div>
  );
}
