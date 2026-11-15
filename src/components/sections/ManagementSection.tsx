// Gerenciamento: lista de colaboradores à esquerda e ficha completa à direita (dados pessoais, contato, profissional,
// bancário, acesso e permissões). Dados sensíveis ficam criptografados (employee_records) e só o administrador grava.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { passwordError } from '@/lib/passwordPolicy';
import { PasswordChecklist } from '@/components/common/PasswordChecklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { limitErrorMessage } from '@/lib/planAccess';
import { getEmployeeRecord, saveEmployeeRecord, type EmployeeRecord } from '@/lib/employeeRecord';
import { UserRegistrationDialog } from '@/components/management/UserRegistrationDialog';

interface Profile { id: string; user_id: string; name: string; email: string; phone: string | null; address?: string | null; company: string | null; registration_number: string | null; profile_type: string; is_active: boolean; sector_id: string | null; birth_date: string | null; autonomy_level: string; last_seen_at?: string | null }
interface Sector { id: string; name: string; color: string }
interface Permission { user_id: string; can_post_announcements: boolean; can_delete_messages: boolean; can_access_management: boolean; can_access_password_change: boolean; can_create_war_room: boolean; can_access_orbs?: boolean; can_access_meeting_rooms?: boolean; can_access_dash?: boolean }
interface Role { user_id: string; role: string }
const ADMIN_EMAIL = 'adminservchat@servsul.com.br';
const LEVELS: [string, string][] = [['colaborador', 'Colaborador'], ['supervisor', 'Supervisor'], ['gerente', 'Gerente'], ['diretoria', 'Diretoria']];
const DAYS: [string, string][] = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex'], ['sab', 'Sáb'], ['dom', 'Dom']];
const BANKS = ['Banco do Brasil (001)', 'Bradesco (237)', 'Caixa Econômica Federal (104)', 'Itaú Unibanco (341)', 'Santander (033)', 'Nubank (260)', 'Inter (077)', 'C6 Bank (336)', 'Sicoob (756)', 'Sicredi (748)'];
const PERMS: { key: keyof Permission; label: string }[] = [
  { key: 'can_post_announcements', label: 'Postar avisos' }, { key: 'can_access_password_change', label: 'Alterar senhas' },
  { key: 'can_create_war_room', label: 'Criar War Room' }, { key: 'can_access_dash', label: 'Dash' },
  { key: 'can_access_meeting_rooms', label: 'Sala de Reunião' }, { key: 'can_delete_messages', label: 'Excluir mensagens' },
  { key: 'can_access_management', label: 'Gerenciamento' },
];

function Masked({ label, value, onChange, disabled, prefix }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; prefix?: string }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <label>{label}</label>
      <div className="dk-mk">
        <input type={show ? 'text' : 'password'} autoComplete="off" data-lpignore="true" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={prefix} />
        <button type="button" className="dk-mo" onClick={() => setShow((v) => !v)}>{show ? 'Ocultar' : 'Mostrar'}</button>
      </div>
    </>
  );
}

export function ManagementSection() {
  const { isAdmin, canAccess, profile, refreshPermissions } = useAuth();
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: u, error: ue }, { data: s, error: se }, { data: p }, { data: r }] = await Promise.all([
        supabase.rpc('admin_list_profiles_full'), supabase.from('sectors').select('*').order('name'), supabase.from('user_permissions').select('*'), supabase.from('user_roles').select('*'),
      ]);
      if (ue) throw ue; if (se) throw se;
      setUsers((u as any[]) || []); setSectors(s || []);
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
    const map: Record<string, string> = { can_post_announcements: 'canPostAnnouncements', can_delete_messages: 'canDeleteMessages', can_access_management: 'canAccessManagement', can_access_password_change: 'canAccessPasswordChange', can_create_war_room: 'canCreateWarRoom', can_access_orbs: 'canAccessOrbs', can_access_meeting_rooms: 'canAccessMeetingRooms', can_access_dash: 'canAccessDash' };
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

  const goTo = (id: string) => { setSection(id); const el = scrollRef.current?.querySelector(`[data-sec="${id}"]`) as HTMLElement | null; if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop - 52, behavior: 'smooth' }); };
  const onScroll = () => {
    const c = scrollRef.current; if (!c) return;
    const secs = Array.from(c.querySelectorAll('[data-sec]')) as HTMLElement[];
    let cur = secs[0]?.dataset.sec || 'personal';
    secs.forEach((s) => { if (s.offsetTop - 80 <= c.scrollTop) cur = s.dataset.sec || cur; });
    if (c.scrollTop + c.clientHeight >= c.scrollHeight - 4 && secs.length) cur = secs[secs.length - 1].dataset.sec || cur;
    if (cur !== section) setSection(cur);
  };

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
  const text = (span: number, label: string, k: keyof EmployeeRecord, type = 'text') => field(span, label, <input type={type} value={r(k)} disabled={ro} maxLength={120} onChange={(e) => setR(k)(e.target.value)} />);
  const select = (span: number, label: string, k: keyof EmployeeRecord, opts: string[]) => field(span, label, <select value={r(k)} disabled={ro} onChange={(e) => setR(k)(e.target.value)}><option value="">Selecione</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>);
  const masked = (span: number, label: string, k: keyof EmployeeRecord) => <div className="dk-f" style={{ gridColumn: `span ${span}` }}><Masked label={label} value={r(k)} disabled={ro} onChange={setR(k)} /></div>;

  return (
    <div className="dk-pg dk-mg">
      <aside className="dk-ml">
        <div className="sh">
          <div className="srow"><input className="dk-srch" placeholder="Buscar usuário..." value={search} onChange={(e) => setSearch(e.target.value)} /><button className="dk-b2 pri" onClick={() => setCreateOpen(true)}>+ Novo</button></div>
          <div className="dk-tb" role="group" aria-label="Situação">{([['all', 'Todos'], ['on', 'Ativos'], ['off', 'Inativos']] as const).map(([k, l]) => <button key={k} aria-pressed={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}<span>{counts[k]}</span></button>)}</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? <div className="dk-cnt">Carregando...</div> : filtered.map((u) => (
            <button key={u.user_id} className={`dk-li${u.user_id === selId ? ' sel' : ''}`} onClick={() => selectUser(u)}>
              <span className="dk-mav">{(u.name || '?')[0].toUpperCase()}</span>
              <span className="dk-lt"><span className="ti">{u.name}</span><span className="su">{u.email} • {sectorName(u)}</span><span className="dk-bd"><em>{roleOf(u)}</em><span className={u.is_active ? 'dk-s1' : 'dk-s0'} style={{ color: u.is_active ? '#0A6B3D' : undefined }}>{u.is_active ? 'Ativo' : 'Inativo'}</span></span></span>
            </button>
          ))}
        </div>
        <div className="dk-cnt">{filtered.length} usuários encontrados</div>
      </aside>

      <main className="dk-mm">
        {!sel ? <div className="dk-empty">Selecione um colaborador na lista.</div> : (
          <div ref={scrollRef} onScroll={onScroll} style={{ overflowY: 'auto', flex: 1, position: 'relative' }}>
            <div className="dk-dh">
              <div className="dk-bav">{(sel.name || '?')[0].toUpperCase()}</div>
              <div>
                <h2>{sel.name}</h2>
                <div className="su" style={{ color: '#4A5563' }}>{sel.email} • {roleOf(sel) === 'admin' ? 'Admin' : sectorName(sel)}</div>
                <div className="dk-bd"><em>{roleOf(sel)}</em><span className={sel.is_active ? 'dk-s1' : 'dk-s0'} style={{ color: sel.is_active ? '#0A6B3D' : undefined }}>{sel.is_active ? 'Ativo' : 'Inativo'}</span></div>
              </div>
              <div className="dk-acts">
                {canChangePasswords && <button className="dk-lk" onClick={() => setPasswordUser(sel)}>Senha</button>}
                <button className="dk-lk" onClick={() => updateStatus(sel)}>{sel.is_active ? 'Desativar' : 'Ativar'}</button>
                {sel.email !== ADMIN_EMAIL && <button className="dk-lk dg" onClick={() => setDeleteUser(sel)}>Excluir</button>}
                <button className="dk-b2 pri" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
            <nav className="dk-nav">{[['personal', 'Dados pessoais'], ['contact', 'Contato'], ['work', 'Profissional'], ['bank', 'Bancário'], ['access', 'Acesso'], ['perms', 'Permissões']].map(([id, l]) => <button key={id} className={section === id ? 'on' : ''} onClick={() => goTo(id)}>{l}</button>)}</nav>

            <section className="dk-sec" data-sec="personal"><div><h3>Dados pessoais</h3><div className="hp">Identificação e documentos do colaborador.</div></div>
              <div className="dk-gr6">
                {field(4, 'Nome completo', <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />)}
                {text(2, 'Nome social', 'social_name')}
                {field(2, 'Data de nascimento', <input type="date" value={f.birth} onChange={(e) => setF({ ...f, birth: e.target.value })} />)}
                {select(2, 'Estado civil', 'marital_status', ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'])}
                {select(2, 'Escolaridade', 'education', ['Fundamental completo', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação'])}
                {masked(2, 'CPF', 'cpf')}{masked(2, 'RG', 'rg')}{text(2, 'Órgão emissor', 'rg_issuer')}
                {masked(3, 'PIS/NIS', 'pis')}
                <div className="dk-f" style={{ gridColumn: 'span 3' }}><span className="lab">Sexo</span><div className="dk-opts">{[['M', 'Masculino'], ['F', 'Feminino'], ['O', 'Outro']].map(([v, l]) => <label key={v}><input type="radio" name="sex" disabled={ro} checked={r('sex') === v} onChange={() => setR('sex')(v)} />{l}</label>)}</div></div>
              </div></section>

            <section className="dk-sec" data-sec="contact"><div><h3>Contato e endereço</h3><div className="hp">Como falar com o colaborador e com um contato de emergência.</div></div>
              <div className="dk-gr6">
                {field(2, 'Celular', <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />)}{text(2, 'Telefone fixo', 'phone_alt')}{text(2, 'E-mail pessoal', 'personal_email', 'email')}
                {text(2, 'Contato de emergência', 'emergency_name')}{text(2, 'Parentesco', 'emergency_relation')}{text(2, 'Telefone do contato', 'emergency_phone')}
                {text(2, 'CEP', 'zip')}{text(3, 'Logradouro', 'street')}{text(1, 'Número', 'number')}
                {text(2, 'Complemento', 'complement')}{text(2, 'Bairro', 'district')}{text(1, 'Cidade', 'city')}{text(1, 'UF', 'state')}
              </div></section>

            <section className="dk-sec" data-sec="work"><div><h3>Dados profissionais</h3><div className="hp">Cargo, contrato, remuneração e jornada.</div></div>
              <div className="dk-gr6">
                {text(1, 'Matrícula', 'registration')}{text(3, 'Cargo', 'job_title')}
                {field(2, 'Setor', <select value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })}><option value="">Sem setor</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>)}
                {text(2, 'Unidade', 'unit')}{text(2, 'Gestor direto', 'manager_name')}{text(2, 'Data de admissão', 'admission_date', 'date')}
                {select(2, 'Tipo de contrato', 'contract_type', ['CLT', 'PJ', 'Estágio', 'Temporário', 'Aprendiz'])}{masked(2, 'Salário', 'salary')}{text(1, 'Entrada', 'work_start', 'time')}{text(1, 'Saída', 'work_end', 'time')}
                {text(1, 'Intervalo', 'break_time', 'time')}{text(2, 'Jornada semanal', 'weekly_hours')}
                <div className="dk-f" style={{ gridColumn: 'span 3' }}><span className="lab">Dias de trabalho</span><div className="dk-opts">{DAYS.map(([v, l]) => <label key={v}><input type="checkbox" disabled={ro} checked={days.has(v)} onChange={() => toggleDay(v)} />{l}</label>)}</div></div>
              </div></section>

            <section className="dk-sec" data-sec="bank"><div><h3>Dados bancários</h3><div className="hp">Conta para pagamento de salário.</div></div>
              <div className="dk-gr6">
                {field(3, 'Banco', <select value={r('bank')} disabled={ro} onChange={(e) => setR('bank')(e.target.value)}><option value="">Selecione</option>{BANKS.map((b) => <option key={b} value={b}>{b}</option>)}</select>)}
                {text(1, 'Agência', 'agency')}{masked(2, 'Conta', 'account')}
                {select(2, 'Tipo de conta', 'account_type', ['Corrente', 'Poupança', 'Salário'])}{select(2, 'Tipo de chave PIX', 'pix_type', ['CPF', 'CNPJ', 'E-mail', 'Celular', 'Aleatória'])}{masked(2, 'Chave PIX', 'pix_key')}
              </div></section>

            <section className="dk-sec" data-sec="access"><div><h3>Acesso</h3><div className="hp">Login e situação da conta no sistema.</div></div>
              <div className="dk-gr6">
                {field(3, 'E-mail de login', <input value={sel.email} disabled readOnly />)}
                {field(2, 'Perfil', <select value={selAdmin ? 'admin' : f.level} disabled={!isAdmin || selAdmin} onChange={(e) => setF({ ...f, level: e.target.value })}>{selAdmin ? <option value="admin">Administrador</option> : null}{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
                {field(1, 'Situação', <select value={f.active ? '1' : '0'} onChange={(e) => setF({ ...f, active: e.target.value === '1' })}><option value="1">Ativo</option><option value="0">Inativo</option></select>)}
                <div className="dk-pwr">{canChangePasswords && <button className="dk-b2" onClick={() => setPasswordUser(sel)}>Definir nova senha</button>}{lastSeen ? <span>Último acesso: {lastSeen}</span> : <span>Sem acesso registrado</span>}</div>
              </div></section>

            <section className="dk-sec" data-sec="perms" style={{ borderBottom: 0 }}><div><h3>Permissões</h3><div className="hp">Configure os acessos individualmente, sem exigir que o colaborador seja administrador.</div></div>
              <div className="dk-pg2">
                {PERMS.map(({ key, label }) => {
                  const on = selAdmin || !!p[key];
                  return <div key={key} className="dk-pm"><span>{label}</span><button type="button" className={`dk-sw${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={selAdmin} onClick={() => updatePermission(sel.user_id, key, !on)}><i /></button></div>;
                })}
              </div></section>
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
