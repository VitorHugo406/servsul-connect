import { useEffect, useMemo, useState } from 'react';
import { Users, UserPlus, Trash2, Search, CalendarDays, AlertTriangle, Bell, X, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeletons';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useSupervisorTeam } from '@/hooks/useSupervisorTeam';
import { useWorkloadAlerts } from '@/hooks/useWorkloadAlerts';
import { useTeams } from '@/hooks/useTeams';
import { usePeopleStats, type PersonStats } from '@/hooks/usePeopleStats';
import { useGlobalScores } from '@/hooks/useBoardScores';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { appConfirm } from '@/lib/appDialog';
import { Sel } from '@/components/ui/Sel';
import { ExportMenu } from '@/components/ui/ExportMenu';

/* Gestão de Pessoas — port of the owner's design "Gestão de pessoas" (Tela_de_Avisos_10): teams on the left, the selected
   team's data on the right (header, KPIs, Equipe / Alertas / Relatórios / Atividades / Score). Atividades keeps its
   day-by-day timeline. CSS: src/styles/people.css (prefix gp-). */

const sb = supabase as any;
type Tab = 'team' | 'alerts' | 'reports' | 'activities' | 'score';
const ALERT_TYPES: { key: string; t: string; d: string }[] = [
  { key: 'late_task', t: 'Tarefas atrasadas', d: 'Cards com prazo vencido.' },
  { key: 'deadline_risk', t: 'Prazos nos próximos 2 dias', d: 'Avisa antes do vencimento.' },
  { key: 'stuck_task', t: 'Cards parados', d: 'Sem nenhuma alteração há 3 dias ou mais.' },
  { key: 'overloaded', t: 'Sobrecarga', d: 'Pessoa com 5 ou mais cards em aberto.' },
];
const DAYS: [number, string][] = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
const SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const DONUT = ['#2F6FD1', '#6C5CE7', '#1B2340', '#0A8F7A', '#C77700', '#B3261E', '#5A6472', '#8E44AD'];
const ini = (n: string) => (n || '?').trim().charAt(0).toUpperCase();
const first = (n: string) => (n || '').split(' ')[0];
const fmtWhen = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso), now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diff = (day(now) - day(d)) / 864e5;
  if (diff === 0) return `hoje, ${hm}`;
  if (diff === 1) return `ontem, ${hm}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', ...(d.getFullYear() !== now.getFullYear() ? { year: '2-digit' } : {}) });
};

function Sw({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={'gp-sw' + (on ? ' gp-on' : '')} onClick={() => onChange(!on)}><i /></button>;
}
function Av({ name, url, size, dark }: { name: string; url?: string | null; size?: number; dark?: boolean }) {
  const st = size ? { width: size, height: size, ...(dark ? { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : {}) } : undefined;
  return <span className="gp-av" style={st}>{url ? <img src={url} alt="" /> : ini(name)}</span>;
}

export function PeopleManagementSection() {
  const { profile, user } = useAuth();
  const { teams, selectedTeam, selectedTeamId, setSelectedTeamId, createTeam, updateTeam, deleteTeam, refreshTeams } = useTeams();
  const { members, loading, addMember, removeMember } = useSupervisorTeam(selectedTeamId);
  const memberIds = useMemo(() => members.map((m) => m.member_profile_id), [members]);
  const [tab, setTab] = useState<Tab>('team');
  const [days, setDays] = useState(30);
  const [who, setWho] = useState('');
  const { stats, loading: statsLoading } = usePeopleStats(memberIds, days);
  const { scores, loading: scoresLoading } = useGlobalScores(memberIds);
  const { alerts, unreadCount, markAsRead, dismissAlert } = useWorkloadAlerts(memberIds);

  // left list: search, inline "Nova equipe", member counts per team
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const ids = teams.map((t) => t.id);
    if (!ids.length) { setCounts({}); return; }
    sb.from('supervisor_team_members').select('team_id').in('team_id', ids).then(({ data }: any) => {
      const c: Record<string, number> = {}; (data || []).forEach((r: any) => { c[r.team_id] = (c[r.team_id] || 0) + 1; }); setCounts(c);
    });
  }, [teams, members.length]);
  const shown = teams.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const doCreate = async () => {
    const n = newName.trim();
    if (n.length < 2) { toast({ title: 'Use pelo menos 2 caracteres no nome.' }); return; }
    if (teams.some((t) => t.name.trim().toLowerCase() === n.toLowerCase())) { toast({ title: 'Já existe uma equipe com esse nome.' }); return; }
    const t = await createTeam(n);
    if (t) { setSelectedTeamId(t.id); setCreating(false); setNewName(''); }
  };

  // header: rename / delete
  const [renaming, setRenaming] = useState(false);
  const [ren, setRen] = useState('');
  const saveRename = async () => { if (selectedTeam && ren.trim().length >= 2) await updateTeam(selectedTeam.id, { name: ren.trim() }); setRenaming(false); };
  useEffect(() => { setRenaming(false); setWho(''); }, [selectedTeamId]);

  // team alert settings (stored on the team; the scheduler sends them at the chosen hours/days)
  const T: any = selectedTeam || {};
  const alertsOn = T.alerts_enabled !== false;
  const saveTeam = async (patch: Record<string, unknown>) => {
    if (!selectedTeam) return;
    const { error } = await sb.from('teams').update(patch).eq('id', selectedTeam.id);
    if (error) { toast({ title: 'Não foi possível salvar.', variant: 'destructive' }); return; }
    await refreshTeams();
  };

  // add-member dialog
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [all, setAll] = useState<any[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const openAdd = async () => {
    if (!selectedTeamId) { toast({ title: 'Crie uma equipe primeiro', description: 'Use o botão "+ Nova equipe".' }); return; }
    setShowAdd(true); setAllLoading(true);
    const { data } = await sb.from('profiles').select('id, name, display_name, avatar_url, email, autonomy_level').eq('is_active', true).order('name');
    setAll(data || []); setAllLoading(false);
  };
  const candidates = all.filter((p) => !memberIds.includes(p.id) && p.id !== profile?.id && `${p.name || ''} ${p.display_name || ''} ${p.email || ''}`.toLowerCase().includes(search.toLowerCase()));

  // numbers
  const S = (id: string) => stats.find((s) => s.profileId === id);
  const tot = stats.reduce((a, s) => ({ tasks: a.tasks + s.tasks, done: a.done + s.completed, msgs: a.msgs + s.messages, inter: a.inter + s.messages + s.tasks + s.comments }), { tasks: 0, done: 0, msgs: 0, inter: 0 });
  const scoreOf = (id: string) => scores.find((s) => s.profileId === id)?.score;

  return (
    <div className="dk-pg gp-pg">
      {/* ---------- equipes ---------- */}
      <aside className="gp-panel gp-side">
        <div className="gp-sh">
          <input className="gp-srch" placeholder="Buscar equipe..." aria-label="Buscar equipe" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="gp-btn gp-pri" onClick={() => setCreating(true)}>+ Nova equipe</button>
        </div>
        <div className="gp-list">
          {creating && (
            <div className="gp-nw">
              <div className="gp-lab">Nova equipe</div>
              <input className="gp-in gp-fc" autoFocus placeholder="Nome da equipe" maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doCreate(); if (e.key === 'Escape') setCreating(false); }} />
              <div className="gp-nb">
                <button type="button" className="gp-btn gp-sm" onClick={() => { setCreating(false); setNewName(''); }}>Cancelar</button>
                <button type="button" className="gp-btn gp-sm gp-pri" onClick={() => void doCreate()}>Criar equipe</button>
              </div>
            </div>
          )}
          {shown.map((t: any) => (
            <button type="button" key={t.id} className={'gp-li' + (t.id === selectedTeamId ? ' gp-sel' : '')} onClick={() => setSelectedTeamId(t.id)}>
              <span className="gp-tl">{ini(t.name)}</span>
              <span className="gp-lt"><span className="gp-ti">{t.name}</span><span className="gp-su">{counts[t.id] || 0} colaborador{(counts[t.id] || 0) === 1 ? '' : 'es'} · Alertas {t.alerts_enabled === false ? 'inativos' : 'ativos'}</span></span>
            </button>
          ))}
          {!teams.length && !creating && <div className="gp-empty"><b>Nenhuma equipe ainda</b>Crie a primeira em “+ Nova equipe”.</div>}
        </div>
        <div className="gp-cnt">{teams.length} equipe{teams.length === 1 ? '' : 's'}</div>
      </aside>

      {/* ---------- dados da equipe ---------- */}
      <main className="gp-panel gp-main">
        {!selectedTeam ? (
          <div className="gp-empty" style={{ margin: 'auto' }}><b>Selecione ou crie uma equipe</b>As métricas da equipe aparecem aqui.</div>
        ) : (<>
          <div className="gp-dh">
            <span className="gp-big"><Users className="h-6 w-6" /></span>
            <h2>
              {renaming
                ? <input className="gp-in gp-ren" autoFocus value={ren} maxLength={60} onChange={(e) => setRen(e.target.value)} onBlur={() => void saveRename()} onKeyDown={(e) => { if (e.key === 'Enter') void saveRename(); if (e.key === 'Escape') setRenaming(false); }} />
                : selectedTeam.name}
              <span className={alertsOn ? 'gp-ok' : 'gp-off'}>Alertas {alertsOn ? 'ativos' : 'inativos'}</span>
            </h2>
            <button type="button" className="gp-lk" onClick={() => { setRen(selectedTeam.name); setRenaming(true); }}>Renomear</button>
            <button type="button" className="gp-lk gp-dg" onClick={async () => { if (await appConfirm({ title: `Excluir a equipe "${selectedTeam.name}"?`, message: 'Os membros serão desvinculados da equipe.', confirmText: 'Excluir equipe', danger: true })) await deleteTeam(selectedTeam.id); }}>Excluir</button>
            <div className="gp-acts"><button type="button" className="gp-btn gp-pri" onClick={() => void openAdd()}><UserPlus className="h-4 w-4" /> Adicionar colaborador</button></div>
          </div>
          <div className="gp-kp">
            <div className="gp-k"><span>Equipe</span><b>{members.length}</b></div>
            <div className="gp-k"><span>Total de tarefas</span><b>{tot.tasks}</b><small>{tot.done} concluídas</small></div>
            <div className="gp-k"><span>Taxa de conclusão</span><b>{tot.tasks ? Math.round((tot.done / tot.tasks) * 100) : 0}%</b></div>
            <div className="gp-k"><span>Mensagens enviadas</span><b>{tot.msgs}</b></div>
            <div className="gp-k"><span>Interações totais</span><b>{tot.inter}</b></div>
          </div>
          <nav className="gp-nav" aria-label="Seções">
            {([['team', 'Equipe'], ['alerts', 'Alertas'], ['reports', 'Relatórios'], ['activities', 'Atividades'], ['score', 'Score']] as [Tab, string][]).map(([k, l]) => (
              <button type="button" key={k} className={tab === k ? 'gp-on' : ''} onClick={() => setTab(k)}>{l}{k === 'alerts' && unreadCount > 0 ? ` (${unreadCount})` : ''}</button>
            ))}
          </nav>

          {tab === 'team' && (loading || statsLoading ? <div className="gp-act"><ListSkeleton rows={5} /></div> : !members.length ? (
            <div className="gp-empty"><b>Nenhum colaborador nesta equipe</b>Use “Adicionar colaborador” para acompanhar as métricas.</div>
          ) : (<>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 0 2px' }}>
              <ExportMenu className="gp-btn gp-sm" getData={() => ({ name: `equipe-${selectedTeam?.name || "equipe"}`, sheet: 'Equipe', headers: ['Colaborador', 'E-mail', 'Tarefas', 'Concluídas', 'Mensagens', 'Interações', 'Score'],
                rows: members.map((m) => { const s = S(m.member_profile_id); return [m.profile.display_name || m.profile.name, m.profile.email || '', s?.tasks ?? 0, s?.completed ?? 0, s?.messages ?? 0, s ? s.messages + s.tasks + s.comments : 0, scoreOf(m.member_profile_id) ?? '']; }) })} />
            </div>
            <table>
              <thead><tr><th>Colaborador</th><th>Tarefas</th><th>Concluídas</th><th>Mensagens</th><th>Interações</th><th>Score</th><th>Última atividade</th><th /></tr></thead>
              <tbody>
                {members.map((m) => {
                  const s = S(m.member_profile_id); const name = m.profile.display_name || m.profile.name;
                  const pct = s && s.tasks ? Math.round((s.completed / s.tasks) * 100) : 0;
                  return (
                    <tr key={m.id}>
                      <td><div className="gp-pe"><Av name={name} url={m.profile.avatar_url} /><div><div className="gp-ti">{name}</div><div className="gp-su">{m.profile.email}</div></div></div></td>
                      <td>{s?.tasks ?? 0}</td>
                      <td><div className="gp-mb">{s?.completed ?? 0}<i style={{ ['--p' as any]: pct + '%' }} /></div></td>
                      <td>{s?.messages ?? 0}</td>
                      <td>{s ? s.messages + s.tasks + s.comments : 0}</td>
                      <td><b>{scoreOf(m.member_profile_id) ?? '—'}</b></td>
                      <td>{fmtWhen(s?.lastActivity ?? null)}</td>
                      <td className="gp-r"><button type="button" className="gp-ic" title="Remover da equipe" aria-label={`Remover ${name} da equipe`} onClick={async () => { if (await appConfirm({ title: `Remover ${name} da equipe?`, confirmText: 'Remover', danger: true })) { const r = await removeMember(m.id); toast({ title: r?.error ? 'Não foi possível remover o colaborador.' : 'Colaborador removido da equipe.' }); } }}><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="gp-ft"><span>{members.length} colaborador{members.length === 1 ? '' : 'es'}</span><span>Interações = mensagens + tarefas + comentários em avisos</span></div>
          </>))}

          {tab === 'alerts' && <AlertsTab team={T} on={alertsOn} save={saveTeam} alerts={alerts} unread={unreadCount} markAsRead={markAsRead} dismiss={dismissAlert} nameOf={(id) => S(id)?.name || members.find((m) => m.member_profile_id === id)?.profile.name || ''} />}

          {tab === 'reports' && <ReportsTab team={selectedTeam.name} stats={stats} loading={statsLoading} days={days} setDays={setDays} who={who} setWho={setWho} />}

          {tab === 'activities' && <div className="gp-act"><ActivitiesTab memberIds={memberIds} members={members} /></div>}

          {tab === 'score' && <ScoreTab scores={scores} loading={scoresLoading} />}
        </>)}
      </main>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar colaborador</DialogTitle></DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <ScrollArea className="max-h-[400px]">
            {allLoading ? <ListSkeleton rows={4} /> : !candidates.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum colaborador encontrado.</p> : (
              <div className="space-y-1 pr-4">
                {candidates.map((p) => (
                  <button type="button" key={p.id} className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted" onClick={async () => { const r = await addMember(p.id); toast({ title: r?.error ? 'Não foi possível adicionar o colaborador.' : 'Colaborador adicionado à equipe.' }); }}>
                    <Avatar className="h-9 w-9"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback className="bg-primary text-xs text-primary-foreground">{ini(p.display_name || p.name)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.display_name || p.name}</p><p className="truncate text-xs text-muted-foreground">{p.email}</p></div>
                    <Badge variant="outline" className="text-xs">{p.autonomy_level}</Badge>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Alertas: team settings (design) + the alerts already generated ---------- */
function AlertsTab({ team, on, save, alerts, unread, markAsRead, dismiss, nameOf }: { team: any; on: boolean; save: (p: Record<string, unknown>) => Promise<void>; alerts: any[]; unread: number; markAsRead: (id: string) => void; dismiss: (id: string) => void; nameOf: (id: string) => string }) {
  const times: string[] = team.alert_times || ['09:00'];
  const daysOn: number[] = team.alert_days || [1, 2, 3, 4, 5];
  const types: string[] = team.alert_types || ALERT_TYPES.map((t) => t.key);
  const TAG: Record<string, [string, string]> = { late_task: ['Atraso', 'gp-t-c'], deadline_risk: ['Prazo', 'gp-t-a'], stuck_task: ['Parado', 'gp-t-d'], overloaded: ['Sobrecarga', 'gp-t-c'] };
  return (<>
    <div className="gp-sc">
      <div><h3>Alertas automáticos</h3><div className="gp-hp">Lembretes enviados à equipe nos horários definidos.</div></div>
      <div className="gp-pm"><span>Enviar alertas para esta equipe<span>Quando desligado, nenhum alerta é disparado.</span></span><Sw on={on} label="Enviar alertas para esta equipe" onChange={(v) => void save({ alerts_enabled: v })} /></div>
    </div>
    <div className="gp-sc">
      <div><h3>Horários de envio</h3><div className="gp-hp">Os alertas saem nestes horários (de Brasília), nos dias escolhidos.</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="gp-chs">
          {times.map((t) => (
            <span className="gp-ch" key={t}>{t}{times.length > 1 && <button type="button" aria-label={`Remover ${t}`} onClick={() => void save({ alert_times: times.filter((x) => x !== t) })}><X className="h-3 w-3" /></button>}</span>
          ))}
          {times.length < 6 && (
            <Sel className="gp-ad" value="" aria-label="Adicionar horário" onChange={(e) => { const v = e.target.value; if (v && !times.includes(v)) void save({ alert_times: [...times, v].sort() }); }}>
              <option value="">+ Adicionar horário</option>
              {SLOTS.filter((s) => !times.includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}
            </Sel>
          )}
        </div>
        <div className="gp-opts">
          {DAYS.map(([d, l]) => (
            <label className="gp-ck" key={d}><input type="checkbox" checked={daysOn.includes(d)} onChange={(e) => void save({ alert_days: e.target.checked ? [...daysOn, d] : daysOn.filter((x) => x !== d) })} />{l}</label>
          ))}
        </div>
      </div>
    </div>
    <div className="gp-sc">
      <div><h3>Tipos de alerta</h3><div className="gp-hp">O que o sistema avisa sobre a equipe.</div></div>
      <div>
        {ALERT_TYPES.map((a) => (
          <div className="gp-pm" key={a.key}><span>{a.t}<span>{a.d}</span></span><Sw on={types.includes(a.key)} label={a.t} onChange={(v) => void save({ alert_types: v ? [...types, a.key] : types.filter((x) => x !== a.key) })} /></div>
        ))}
      </div>
    </div>
    <div className="gp-sc">
      <div><h3>Canais</h3><div className="gp-hp">Onde o alerta aparece. Todos ficam também na lista abaixo.</div></div>
      <div>
        <div className="gp-pm"><span>Chat do ewvon<span>Você recebe um resumo em Comunicados quando houver alertas novos.</span></span><Sw on={team.alert_chat !== false} label="Chat do ewvon" onChange={(v) => void save({ alert_chat: v })} /></div>
      </div>
    </div>
    <div className="gp-sc" style={{ borderBottom: 0 }}>
      <div><h3>Alertas recebidos</h3><div className="gp-hp">{alerts.length} alerta(s) · {unread} não lido(s).</div>
        {alerts.length > 0 && <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {unread > 0 && <button type="button" className="gp-btn gp-sm" onClick={() => alerts.filter((a) => !a.is_read).forEach((a) => markAsRead(a.id))}><CheckCheck className="h-4 w-4" /> Ler tudo</button>}
          <button type="button" className="gp-btn gp-sm" style={{ color: '#B3261E' }} onClick={async () => { if (await appConfirm({ title: `Excluir todos os ${alerts.length} alertas?`, confirmText: 'Excluir tudo', danger: true })) alerts.forEach((a) => dismiss(a.id)); }}><Trash2 className="h-4 w-4" /> Excluir tudo</button>
        </div>}
      </div>
      <div>
        {!alerts.length ? <div className="gp-hp" style={{ padding: '10px 0' }}>Nenhum alerta por enquanto.</div> : alerts.map((a) => {
          const tg = TAG[a.alert_type] || ['Alerta', 'gp-t-d'];
          return (
            <div key={a.id} className={'gp-ev' + (a.is_read ? ' gp-read' : '')} style={{ padding: '12px 0', gridTemplateColumns: '36px 1fr auto auto' }}>
              <Av name={nameOf(a.profile_id)} />
              <div><b>{nameOf(a.profile_id) || 'Colaborador'}</b><div className="gp-su">{a.message} · {fmtWhen(a.created_at)}</div></div>
              <span className={'gp-tg ' + tg[1]}>{tg[0]}</span>
              <span className="gp-evx">
                {!a.is_read && <button type="button" className="gp-ic" title="Marcar como lido" onClick={() => markAsRead(a.id)}><Bell className="h-4 w-4" /></button>}
                <button type="button" className="gp-ic" title="Dispensar" onClick={() => dismiss(a.id)}><X className="h-4 w-4" /></button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </>);
}

/* ---------- Relatórios ---------- */
function ReportsTab({ team, stats, loading, days, setDays, who, setWho }: { team: string; stats: PersonStats[]; loading: boolean; days: number; setDays: (n: number) => void; who: string; setWho: (s: string) => void }) {
  const list = who ? stats.filter((s) => s.profileId === who) : stats;
  const byMsg = [...list].sort((a, b) => b.pMessages - a.pMessages);
  const max = Math.max(1, ...byMsg.map((s) => s.pMessages));
  const inter = list.map((s) => ({ s, v: s.messages + s.tasks + s.comments })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const interTot = inter.reduce((a, x) => a + x.v, 0);
  const C = 2 * Math.PI * 60;
  let off = 0;
  const sum = (k: keyof PersonStats) => list.reduce((a, s) => a + (s[k] as number), 0);
  const msgs = sum('pMessages'), prevMsgs = sum('pPrevMessages'), done = sum('pCompleted'), prevDone = sum('pPrevCompleted'), late = sum('overdue');
  const active = list.filter((s) => s.pMessages > 0 || s.pCompleted > 0).length;
  const pctChg = prevMsgs ? Math.round(((msgs - prevMsgs) / prevMsgs) * 100) : null;
  const Delta = ({ v, pct, goodUp = true }: { v: number | null; pct?: boolean; goodUp?: boolean }) => v === null || v === 0 ? null : <small style={{ color: (v > 0) === goodUp ? '#0A6B3D' : '#B3261E' }}>{v > 0 ? '▲' : '▼'} {Math.abs(v)}{pct ? '%' : ''}</small>;

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(`Relatório da equipe ${team}`, 40, 50);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Últimos ${days} dias · gerado em ${new Date().toLocaleString('pt-BR')}${who ? ' · ' + (list[0]?.name || '') : ''}`, 40, 68);
    autoTable(doc, { startY: 86, head: [['Resumo do período', 'Valor', `${days} dias anteriores`]], body: [
      ['Mensagens enviadas', String(msgs), String(prevMsgs)], ['Tarefas concluídas', String(done), String(prevDone)],
      ['Tarefas atrasadas (agora)', String(late), '—'], ['Colaboradores ativos', `${active} de ${list.length}`, '—'],
    ], styles: { fontSize: 9 }, headStyles: { fillColor: [27, 35, 64] } });
    autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 18, head: [['Colaborador', 'Mensagens', 'Concluídas', 'Em aberto', 'Taxa', 'Interações']], body: list.map((s) => {
      const tot = s.pCompleted + s.pOpen;
      return [s.name, String(s.pMessages), String(s.pCompleted), String(s.pOpen), tot ? Math.round((s.pCompleted / tot) * 100) + '%' : '—', interTot ? Math.round(((s.messages + s.tasks + s.comments) / interTot) * 100) + '%' : '—'];
    }), styles: { fontSize: 9 }, headStyles: { fillColor: [27, 35, 64] } });
    doc.save(`relatorio-${team.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.pdf`);
  };

  return (<>
    <div className="gp-fb">
      <Sel value={String(days)} aria-label="Período" onChange={(e) => setDays(Number(e.target.value))}>
        <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option>
      </Sel>
      <Sel value={who} aria-label="Colaborador" onChange={(e) => setWho(e.target.value)}>
        <option value="">Todos os colaboradores</option>
        {stats.map((s) => <option key={s.profileId} value={s.profileId}>{s.name}</option>)}
      </Sel>
      <span style={{ marginLeft: 'auto' }} />
      <button type="button" className="gp-btn gp-sm" disabled={loading || !list.length} onClick={() => void exportPdf()}>Exportar PDF</button>
    </div>
    {loading ? <div className="gp-act"><ListSkeleton rows={5} /></div> : !list.length ? <div className="gp-empty"><b>Sem dados</b>Adicione colaboradores para ver os relatórios.</div> : (<>
      <div className="gp-cg">
        <div className="gp-cb">
          <h4>Mensagens por colaborador</h4><div className="gp-hp">Total de mensagens enviadas no período (setores, grupos e conversas diretas).</div>
          {byMsg.map((s, i) => (
            <div className="gp-bar-row" key={s.profileId}><span title={s.name}>{first(s.name)}</span><i className={i === 0 && s.pMessages > 0 ? 'gp-top' : ''} style={{ width: `${Math.max(2, (s.pMessages / max) * 100)}%` }} /><b>{s.pMessages}</b></div>
          ))}
        </div>
        <div className="gp-cb">
          <h4>Distribuição de interações</h4><div className="gp-hp">Participação de cada pessoa no total de {interTot}.</div>
          {!interTot ? <div className="gp-hp" style={{ marginTop: 14 }}>Ainda sem interações.</div> : (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 14 }}>
              <svg width="170" height="170" viewBox="0 0 160 160" role="img" aria-label="Distribuição de interações">
                <g transform="rotate(-90 80 80)" fill="none" strokeWidth="28">
                  {inter.map((x, i) => { const len = (x.v / interTot) * C; const el = <circle key={x.s.profileId} cx="80" cy="80" r="60" stroke={DONUT[i % DONUT.length]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />; off += len; return el; })}
                </g>
              </svg>
              <div className="gp-lg" style={{ flex: 1 }}>
                {inter.map((x, i) => <div key={x.s.profileId}><i style={{ background: DONUT[i % DONUT.length] }} /><span>{first(x.s.name)}</span><b>{Math.round((x.v / interTot) * 100)}%</b></div>)}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="gp-cg" style={{ borderTop: '1px solid #E3E6EB' }}>
        <div className="gp-cb">
          <h4>Tarefas por colaborador</h4><div className="gp-hp">Concluídas no período e em aberto agora.</div>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th style={{ paddingLeft: 0 }}>Colaborador</th><th>Concluídas</th><th>Em aberto</th><th className="gp-r" style={{ paddingRight: 0 }}>Taxa</th></tr></thead>
            <tbody>
              {[...list].sort((a, b) => b.pCompleted - a.pCompleted).map((s) => { const t = s.pCompleted + s.pOpen; return (
                <tr key={s.profileId}><td style={{ paddingLeft: 0 }}>{s.name}</td><td>{s.pCompleted}</td><td>{s.pOpen}</td><td className="gp-r" style={{ paddingRight: 0 }}>{t ? Math.round((s.pCompleted / t) * 100) + '%' : '—'}</td></tr>
              ); })}
            </tbody>
          </table>
        </div>
        <div className="gp-cb">
          <h4>Resumo do período</h4><div className="gp-hp">Comparado aos {days} dias anteriores.</div>
          <div className="gp-pm" style={{ marginTop: 8 }}><span>Mensagens enviadas</span><b>{msgs} <Delta v={pctChg} pct /></b></div>
          <div className="gp-pm"><span>Tarefas concluídas</span><b>{done} <Delta v={done - prevDone} /></b></div>
          <div className="gp-pm"><span>Tarefas atrasadas agora</span><b>{late}</b></div>
          <div className="gp-pm"><span>Colaboradores ativos</span><b>{active} de {list.length}</b></div>
        </div>
      </div>
    </>)}
  </>);
}

/* ---------- Score ---------- */
function ScoreTab({ scores, loading }: { scores: any[]; loading: boolean }) {
  if (loading) return <div className="gp-act"><ListSkeleton rows={5} /></div>;
  if (!scores.length) return <div className="gp-empty"><b>Sem dados de score</b>Adicione membros com tarefas para ver o pódio.</div>;
  const [a, b, c] = scores;
  const Pod = ({ s, pos, h, bg, big }: { s: any; pos: number; h: number; bg: string; big?: boolean }) => (
    <div className="gp-pc">
      <Av name={s.displayName || s.name} url={s.avatarUrl} size={big ? 60 : 52} dark={big} />
      <div className="gp-nm">{s.displayName || s.name}</div><div className="gp-pt">{s.score} pontos</div>
      <div className="gp-st" style={{ height: h, background: bg }}>{pos}</div>
    </div>
  );
  return (<>
    <div style={{ padding: '28px 28px 6px' }}><div className="gp-lab">Pódio · Score global</div></div>
    <div className="gp-pod">
      {b && <Pod s={b} pos={2} h={110} bg="#6B7482" />}
      {a && <Pod s={a} pos={1} h={150} bg="hsl(var(--primary))" big />}
      {c && <Pod s={c} pos={3} h={84} bg="#8A94A3" />}
    </div>
    <table style={{ borderTop: '1px solid #D3D8E0' }}>
      <thead><tr><th>Posição</th><th>Colaborador</th><th>Tarefas</th><th>Concluídas no prazo</th><th>Com atraso</th><th className="gp-r">Score</th></tr></thead>
      <tbody>
        {scores.map((s, i) => (
          <tr key={s.profileId}>
            <td><b>{i + 1}º</b></td>
            <td><div className="gp-pe"><Av name={s.displayName || s.name} url={s.avatarUrl} /><div className="gp-ti">{s.displayName || s.name}</div></div></td>
            <td>{s.totalTasks}</td><td>{s.onTimeTasks}</td><td>{s.lateTasks}</td>
            <td className="gp-r"><b>{s.score}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="gp-ft"><span>Score (0 a 1000) = tarefas concluídas no prazo valem 100%, com atraso 60%, não concluídas 0</span><span>Atualizado {fmtWhen(new Date().toISOString())}</span></div>
  </>);
}

/* ---------- Atividades: unchanged day-by-day timeline (owner asked to keep it) ---------- */
// Activities Tab Component
function ActivitiesTab({ memberIds, members }: { memberIds: string[]; members: any[] }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, assigned_to, created_at, updated_at, completed_at')
          .in('assigned_to', memberIds)
          .order('updated_at', { ascending: false });
        // Filter out completed tasks
        setTasks((data || []).filter((t: any) => !t.completed_at));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [memberIds]);

  if (loading) {
    return <ListSkeleton rows={5} />;
  }

  if (memberIds.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold">Nenhum colaborador adicionado</h4>
          <p className="text-muted-foreground mt-1">Adicione membros para ver atividades.</p>
        </CardContent>
      </Card>
    );
  }

  const getMemberName = (profileId: string) => {
    const m = members.find(mem => mem.member_profile_id === profileId);
    return m?.profile?.display_name || m?.profile?.name || 'Desconhecido';
  };

  const getMemberAvatar = (profileId: string) => {
    const m = members.find(mem => mem.member_profile_id === profileId);
    return m?.profile?.avatar_url || '';
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-destructive/10 text-destructive',
    medium: 'bg-yellow-500/10 text-yellow-600',
    low: 'bg-green-500/10 text-green-600',
  };

  const statusLabels: Record<string, string> = {
    todo: 'A Fazer',
    in_progress: 'Em Andamento',
    done: 'Concluida',
  };

  // Group tasks by member then by due_date (or created_at as fallback)
  const tasksByMember: Record<string, Record<string, any[]>> = {};
  
  for (const task of tasks) {
    const memberId = task.assigned_to;
    if (!memberId) continue;
    if (!tasksByMember[memberId]) tasksByMember[memberId] = {};
    
    const taskDate = task.due_date || task.created_at;
    const dateKey = new Date(taskDate).toLocaleDateString('pt-BR');
    if (!tasksByMember[memberId][dateKey]) tasksByMember[memberId][dateKey] = [];
    tasksByMember[memberId][dateKey].push(task);
  }

  // Sort date groups ascending (oldest to newest)
  const sortedTasksByMember: Record<string, [string, any[]][]> = {};
  for (const [memberId, dateGroups] of Object.entries(tasksByMember)) {
    sortedTasksByMember[memberId] = Object.entries(dateGroups).sort((a, b) => {
      const parseDate = (dateStr: string) => {
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day).getTime();
      };
      return parseDate(a[0]) - parseDate(b[0]);
    });
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(sortedTasksByMember).map(([memberId, sortedDateGroups]) => (
          <Card key={memberId} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getMemberAvatar(memberId)} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getMemberName(memberId).split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{getMemberName(memberId)}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {sortedDateGroups.reduce((sum, [, tasks]) => sum + tasks.length, 0)} atividades
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {sortedDateGroups.map(([date, dayTasks]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{date}</span>
                  </div>
                  <div className="space-y-2 pl-5 border-l-2 border-border">
                    {dayTasks.map((task: any) => (
                      <div key={task.id} className="p-2 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {statusLabels[task.status] || task.status}
                          </Badge>
                          <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[task.priority] || ''}`}>
                            {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baixa'}
                          </Badge>
                          {task.due_date && (
                            <span className="text-[10px] text-muted-foreground">
                              Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {Object.keys(sortedTasksByMember).length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma atividade encontrada para os colaboradores da equipe.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
