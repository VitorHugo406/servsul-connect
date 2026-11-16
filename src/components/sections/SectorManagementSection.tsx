// Gestão de setores — porta fiel do design "Setores - configurar / novo setor" (Tela_de_Avisos_6).
// CSS em src/styles/sectors.css (prefixo sg-, escopo .sg-pg). Lista à esquerda, configuração do setor à direita.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSectorManagement, type Sector } from '@/hooks/useSectorManagement';
import { limitErrorMessage } from '@/lib/planAccess';
import { appConfirm } from '@/lib/appDialog';
import { Sel } from '@/components/ui/Sel';
import { SECTOR_SVG, SECTOR_SVG_ORDER } from '@/components/sectors/sectorSvg';

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';
const SWATCHES: { c: string; n: string }[] = [
  { c: '#2563EB', n: 'Azul' }, { c: '#16A34A', n: 'Verde' }, { c: '#F59E0B', n: 'Laranja' }, { c: '#DC2626', n: 'Vermelho' }, { c: '#A78BFA', n: 'Roxo' },
  { c: '#EC4899', n: 'Rosa' }, { c: '#06B6D4', n: 'Ciano' }, { c: '#22C55E', n: 'Lima' }, { c: '#F97316', n: 'Laranja escuro' }, { c: '#6366F1', n: 'Índigo' },
];
const ROLE: Record<string, string> = { admin: 'administrador', gestor: 'gestor', gerente: 'gerente', supervisor: 'supervisor', diretoria: 'diretoria', colaborador: 'colaborador' };

interface Person { id: string; user_id: string; name: string; display_name: string | null; email: string; autonomy_level: string | null; sector_id: string | null }
const nameOf = (p: Person) => p.display_name || p.name;
const plural = (n: number) => `${n} ${n === 1 ? 'colaborador' : 'colaboradores'}`;

function Svg({ id, size }: { id: string; size: number }) {
  const ic = SECTOR_SVG[id] || SECTOR_SVG.building;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ic.svg }} />;
}

export function SectorManagementSection() {
  const { isAdmin } = useAuth();
  const { sectors, loading, createSector, updateSector, deleteSector, refetch } = useSectorManagement();
  const [people, setPeople] = useState<Person[]>([]);
  const [extra, setExtra] = useState<{ user_id: string; sector_id: string }[]>([]);
  const [sel, setSel] = useState<string | 'new' | null>(null);     // sector id, 'new' (unsaved) or nothing yet
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [manager, setManager] = useState('');
  const [color, setColor] = useState('#2563EB');
  const [icon, setIcon] = useState('building');
  const [pending, setPending] = useState<string[]>([]);              // people chosen while the sector is still unsaved (profile ids)
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadPeople = useCallback(async () => {
    const [p, a] = await Promise.all([
      supabase.from('profiles').select('id, user_id, name, display_name, email, autonomy_level, sector_id, profile_type').eq('is_active', true).not('profile_type', 'in', '(bot,system)').order('name'),
      supabase.from('user_additional_sectors').select('user_id, sector_id'),
    ]);
    setPeople(((p.data || []) as unknown as Person[]));
    setExtra((a.data || []) as { user_id: string; sector_id: string }[]);
  }, []);
  useEffect(() => { if (isAdmin) void loadPeople(); }, [isAdmin, loadPeople]);

  const general = useMemo(() => sectors.find(s => s.is_general || s.id === GERAL_SECTOR_ID) || null, [sectors]);
  const isGeneral = (s: Sector | undefined | null) => !!s && (s.id === GERAL_SECTOR_ID || !!s.is_general);
  const membersOf = useCallback((sid: string): Person[] => {
    if (general && sid === general.id) return people;
    const extraIds = new Set(extra.filter(e => e.sector_id === sid).map(e => e.user_id));
    return people.filter(p => p.sector_id === sid || extraIds.has(p.user_id));
  }, [people, extra, general]);

  // First load: open the first sector.
  useEffect(() => { if (!loading && sel === null && sectors.length) setSel(sectors[0].id); }, [loading, sectors, sel]);

  const current = sel && sel !== 'new' ? sectors.find(s => s.id === sel) || null : null;
  const fill = useCallback((s: Sector | null) => {
    setName(s?.name || ''); setDesc(s?.description || ''); setManager(s?.manager_id || ''); setColor(s?.color || '#2563EB'); setIcon(s?.icon || 'building');
    setPending([]); setPicking(false);
  }, []);
  useEffect(() => { if (sel === 'new') fill(null); else fill(current); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sel, current?.id]);

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Shield className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="font-display text-xl font-semibold text-foreground">Acesso Restrito</h3>
        <p className="mt-2 text-muted-foreground">Apenas administradores podem gerenciar setores.</p>
      </div>
    );
  }

  const creating = sel === 'new';
  const locked = !creating && isGeneral(current);
  const list = sectors.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const members: Person[] = creating ? people.filter(p => pending.includes(p.id)) : current ? membersOf(current.id) : [];
  const candidates = people.filter(p => !members.some(m => m.id === p.id));
  const swatches = SWATCHES.some(s => s.c.toLowerCase() === color.toLowerCase()) ? SWATCHES : [{ c: color, n: 'Atual' }, ...SWATCHES];
  const dirty = creating || (!!current && (name !== current.name || desc !== (current.description || '') || manager !== (current.manager_id || '') || color !== current.color || icon !== (current.icon || 'building')));

  const addMember = async (p: Person) => {
    setPicking(false);
    if (creating) { setPending(v => [...v, p.id]); return; }
    if (!current) return;
    const { error } = await supabase.from('user_additional_sectors').insert({ user_id: p.user_id, sector_id: current.id });
    if (error) { toast.error('Não foi possível adicionar o colaborador'); return; }
    toast.success(`${nameOf(p)} adicionado ao setor`); void loadPeople();
  };
  const removeMember = async (p: Person) => {
    if (creating) { setPending(v => v.filter(id => id !== p.id)); return; }
    if (!current) return;
    if (p.sector_id === current.id) {
      if (!general) { toast.error('Não há setor padrão para mover o colaborador'); return; }
      const { error } = await supabase.from('profiles').update({ sector_id: general.id }).eq('id', p.id);
      if (error) { toast.error('Não foi possível remover o colaborador'); return; }
    } else {
      const { error } = await supabase.from('user_additional_sectors').delete().eq('user_id', p.user_id).eq('sector_id', current.id);
      if (error) { toast.error('Não foi possível remover o colaborador'); return; }
    }
    toast.success(`${nameOf(p)} removido do setor`); void loadPeople();
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Digite o nome do setor'); return; }
    setBusy(true);
    const fields = { name: name.trim(), description: desc.trim() || null, manager_id: manager || null, color, icon };
    if (creating) {
      const { data, error } = await createSector(fields.name, color, { icon, description: fields.description, manager_id: fields.manager_id });
      if (error || !data) { setBusy(false); toast.error(limitErrorMessage(error) || 'Erro ao criar setor'); return; }
      const rows = people.filter(p => pending.includes(p.id)).map(p => ({ user_id: p.user_id, sector_id: (data as Sector).id }));
      if (rows.length) await supabase.from('user_additional_sectors').insert(rows);
      setBusy(false); toast.success('Setor criado com sucesso!'); await loadPeople(); setSel((data as Sector).id);
    } else if (current) {
      const { error } = await updateSector(current.id, fields);
      setBusy(false);
      if (error) { toast.error('Erro ao atualizar setor'); return; }
      toast.success('Setor atualizado!');
    }
  };
  const remove = async () => {
    if (!current) return;
    const ok = await appConfirm({ title: 'Excluir setor', message: `Tem certeza que deseja excluir o setor "${current.name}"? Esta ação não pode ser desfeita. Certifique-se de que não há colaboradores vinculados a este setor.`, confirmText: 'Excluir', danger: true });
    if (!ok) return;
    setBusy(true);
    const { error } = await deleteSector(current.id);
    setBusy(false);
    if (error) { toast.error('Erro ao excluir setor. Verifique se não há colaboradores vinculados.'); return; }
    toast.success('Setor excluído!'); setSel(null); void refetch();
  };

  const headTitle = creating ? 'Novo setor' : current?.name || 'Setor';
  const headSub = creating ? 'Adicione um novo departamento ao sistema' : `${plural(members.length)} · ${locked ? 'Padrão' : 'Ativo'}`;

  return (
    <div className="dk-pg sg-pg">
      <aside className="sg-panel" aria-label="Setores">
        <div className="sg-sh">
          <div className="sg-srow">
            <input className="sg-srch" type="text" placeholder="Buscar setor..." aria-label="Buscar setor" value={q} onChange={e => setQ(e.target.value)} />
            <button className="sg-btn sg-pri" onClick={() => setSel('new')}>+ Novo setor</button>
          </div>
        </div>
        {loading ? <div style={{ padding: 24, textAlign: 'center' }}><Loader2 className="h-5 w-5 animate-spin" style={{ display: 'inline' }} /></div> : (
          <div className="sg-list">
            {creating && (
              <button className="sg-li sg-sel"><span className="sg-tl" style={{ background: color }}><Svg id={icon} size={18} /></span><span className="sg-lt"><span className="sg-ti">{name.trim() || 'Novo setor'}</span><span className="sg-su">Ainda não salvo</span></span></button>
            )}
            {list.map(s => (
              <button key={s.id} className={`sg-li${sel === s.id ? ' sg-sel' : ''}`} onClick={() => setSel(s.id)}>
                <span className="sg-tl" style={{ background: s.color }}><Svg id={s.icon || 'building'} size={18} /></span>
                <span className="sg-lt"><span className="sg-ti">{s.name}</span><span className="sg-su">{plural(membersOf(s.id).length)}</span></span>
              </button>
            ))}
          </div>
        )}
        <div className="sg-cnt">{sectors.length} {sectors.length === 1 ? 'setor' : 'setores'}</div>
      </aside>

      <main className="sg-panel" aria-label="Configuração do setor">
        <div className="sg-dh">
          <div className="sg-bt" style={{ background: color }}><Svg id={icon} size={26} /></div>
          <div><h2>{headTitle}</h2><div className="sg-su">{headSub}</div></div>
        </div>

        <div className="sg-body">
        <section className="sg-sc"><div><h3>Identificação</h3><div className="sg-hp">Nome e informações do departamento.</div></div>
          <div>
            <div className="sg-fl"><label htmlFor="sg-n1">Nome do setor</label><input id="sg-n1" className="sg-in" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Recursos Humanos" disabled={locked} maxLength={80} autoFocus={creating} /></div>
            <div className="sg-fl"><label htmlFor="sg-n2">Descrição</label><textarea id="sg-n2" className="sg-in" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Para que serve este setor (opcional)" disabled={locked} maxLength={400} /></div>
            <div className="sg-fl"><label htmlFor="sg-n3">Gestor responsável</label>
              <Sel id="sg-n3" className="sg-in sg-sbtn" value={manager} onChange={e => setManager(e.target.value)} disabled={locked}>
                <option value="">Selecione</option>
                {people.map(p => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}
              </Sel>
            </div>
          </div>
        </section>

        <section className="sg-sc"><div><h3>Cor do setor</h3><div className="sg-hp">Usada nas etiquetas e cartões do setor em todo o sistema.</div></div>
          <div className="sg-sws">
            {swatches.map(s => {
              const on = s.c.toLowerCase() === color.toLowerCase();
              return (
                <button key={s.c} type="button" className={`sg-sw${on ? ' sg-on' : ''}`} style={{ background: s.c }} aria-label={s.n} aria-pressed={on} disabled={locked} onClick={() => setColor(s.c)}>
                  {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="sg-sc"><div><h3>Ícone do setor</h3><div className="sg-hp">Escolha o que melhor representa o departamento.</div></div>
          <div className="sg-ig">
            {SECTOR_SVG_ORDER.map(id => (
              <button key={id} type="button" className={`sg-ib${icon === id ? ' sg-on' : ''}`} aria-pressed={icon === id} disabled={locked} onClick={() => setIcon(id)}>
                <Svg id={id} size={22} /><span>{SECTOR_SVG[id].label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="sg-sc"><div><h3>Colaboradores</h3><div className="sg-hp">Quem pertence a este setor.</div></div>
          <div>
            {locked ? <div className="sg-emp">Todos os funcionários da empresa fazem parte deste setor. Ele não conta no limite de setores do plano.</div> : (
              <>
                {members.length === 0 && <div className="sg-emp">{creating ? 'Nenhum colaborador ainda. Adicione colaboradores depois de criar o setor.' : 'Nenhum colaborador neste setor ainda.'}</div>}
                {members.map(p => (
                  <div className="sg-mb" key={p.id}>
                    <span className="sg-av">{nameOf(p).charAt(0).toUpperCase()}</span>
                    <div><b>{nameOf(p)}</b><span>{p.email} · {ROLE[p.autonomy_level || ''] || 'colaborador'}</span></div>
                    <button className="sg-lk sg-rm" onClick={() => void removeMember(p)}>Remover</button>
                  </div>
                ))}
                <button className="sg-btn sg-add" onClick={() => setPicking(v => !v)}>+ Adicionar colaborador</button>
                {picking && (
                  <div className="sg-pick">
                    {candidates.length === 0 ? <div className="sg-emp" style={{ padding: '10px 12px' }}>Todos os colaboradores já estão neste setor.</div> : candidates.map(p => (
                      <button key={p.id} type="button" onClick={() => void addMember(p)}>
                        <span className="sg-av">{nameOf(p).charAt(0).toUpperCase()}</span>
                        <span style={{ display: 'flex', flexDirection: 'column' }}><b style={{ fontWeight: 600 }}>{nameOf(p)}</b><span style={{ color: '#4A5563', fontSize: 12.5 }}>{p.email}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        </div>

        {!locked && (
          <div className="sg-ft">
            {!creating && <button className="sg-lk sg-dg" onClick={() => void remove()} disabled={busy}>Excluir setor</button>}
            <button className="sg-btn" onClick={() => { if (creating) setSel(sectors[0]?.id ?? null); else fill(current); }} disabled={busy}>Cancelar</button>
            <button className="sg-btn sg-pri" onClick={() => void save()} disabled={busy || !dirty}>{busy ? 'Salvando...' : creating ? 'Criar setor' : 'Salvar alterações'}</button>
          </div>
        )}
      </main>
    </div>
  );
}
