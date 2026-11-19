const { chromium } = require('playwright');
const out = process.argv[2]; const U = 'http://127.0.0.1:5173/';
const seed = () => {
  const P = 'nuvexa:demo:data:';
  const now = Date.now(); const iso = (ms) => new Date(ms).toISOString();
  const s = { startedAt: now, expiresAt: now + 3 * 3600e3, userId: crypto.randomUUID(), profileId: crypto.randomUUID(), companyId: crypto.randomUUID() };
  localStorage.setItem('nuvexa:demo:session', JSON.stringify(s));
  localStorage.setItem('ewvor_onboarding_completed_' + s.userId, 'true');
  const G = '00000000-0000-0000-0000-000000000001', FIN = crypto.randomUUID(), TI = crypto.randomUUID();
  const ppl = [[s.profileId, s.userId, 'Vitor Hugo', 'admin', G, 'available', null],
    [crypto.randomUUID(), crypto.randomUUID(), 'Ana Souza', 'colaborador', FIN, 'available', (() => { const d = new Date(); return `1997-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()],
    [crypto.randomUUID(), crypto.randomUUID(), 'Carlos Lima', 'gerente', FIN, 'meeting', '1992-11-10'],
    [crypto.randomUUID(), crypto.randomUUID(), 'Marina Prado', 'colaborador', TI, 'lunch', '1999-11-21'],
    [crypto.randomUUID(), crypto.randomUUID(), 'Rafael Torres', 'supervisor', TI, 'away', '1995-12-02']];
  const w = (t, rows) => localStorage.setItem(P + t, JSON.stringify(rows));
  w('companies', [{ id: s.companyId, name: 'Empresa Teste', slug: 'teste', primary_color: '#000', secondary_color: '#fff', is_active: true, created_at: iso(now) }]);
  w('sectors', [{ id: G, name: 'Geral', color: '#3b82f6', company_id: s.companyId }, { id: FIN, name: 'Financeiro', color: '#10b981', company_id: s.companyId }, { id: TI, name: 'TI', color: '#8b5cf6', company_id: s.companyId }]);
  w('profiles', ppl.map(([id, uid, n, a, sec, st, b], i) => ({ id, user_id: uid, name: n, display_name: n, email: n.toLowerCase().replace(' ', '.') + '@ewwon.com', sector_id: sec, autonomy_level: a, birth_date: b, is_active: true, user_status: st, company_id: s.companyId, created_at: iso(now - (i + 1) * 90 * 864e5), description: i ? '' : 'Responsável pela operação.' })));
  w('user_roles', [{ id: crypto.randomUUID(), user_id: s.userId, role: 'admin' }]);
  w('user_permissions', [{ id: crypto.randomUUID(), user_id: s.userId, can_post_announcements: true, can_access_management: true, can_access_meeting_rooms: true }]);
  const [me, ana, carlos, marina] = ppl.map((p) => p[0]);
  w('messages', [
    { id: crypto.randomUUID(), content: 'Bom dia, pessoal! Hoje tem alinhamento às 14h.', author_id: carlos, sector_id: G, company_id: s.companyId, created_at: iso(now - 5 * 3600e3) },
    { id: crypto.randomUUID(), content: 'Confirmado por aqui 👍', author_id: marina, sector_id: G, company_id: s.companyId, created_at: iso(now - 4.8 * 3600e3) },
    { id: crypto.randomUUID(), content: 'Planilha enviada', author_id: me, sector_id: G, company_id: s.companyId, created_at: iso(now - 4 * 3600e3) },
    { id: crypto.randomUUID(), content: 'Reunião confirmada para amanhã', author_id: ana, sector_id: FIN, company_id: s.companyId, created_at: iso(now - 2 * 3600e3) }]);
  w('direct_messages', [
    { id: crypto.randomUUID(), sender_id: ana, receiver_id: me, content: 'Oi Vitor! Conseguiu ver o relatório?', is_read: false, company_id: s.companyId, created_at: iso(now - 30 * 60e3) },
    { id: crypto.randomUUID(), sender_id: ana, receiver_id: me, content: 'É para hoje 🙏', is_read: false, company_id: s.companyId, created_at: iso(now - 29 * 60e3) },
    { id: crypto.randomUUID(), sender_id: me, receiver_id: carlos, content: 'Fechamos o contrato novo!', is_read: true, company_id: s.companyId, created_at: iso(now - 26 * 3600e3) }]);
  w('announcements', [
    { id: crypto.randomUUID(), title: 'Recesso de fim de ano', content: 'O expediente encerra em 23/12 e volta em 02/01. Registre as pendências nos quadros antes da pausa.', author_id: me, is_pinned: true, priority: 'high', company_id: s.companyId, created_at: iso(now - 3600e3) },
    { id: crypto.randomUUID(), title: 'Nova política de home office', content: 'A partir do próximo mês, cada equipe poderá definir até 2 dias remotos por semana.', author_id: me, is_pinned: false, company_id: s.companyId, created_at: iso(now - 26 * 3600e3) },
    { id: crypto.randomUUID(), title: 'Manutenção programada', content: 'O sistema ficará indisponível no sábado entre 02:00 e 04:00.', author_id: me, is_pinned: false, company_id: s.companyId, created_at: iso(now - 50 * 3600e3) }]);
  const tasks = []; for (let i = 0; i < 9; i++) tasks.push({ id: crypto.randomUUID(), title: 'Tarefa ' + i, assigned_to: me, is_archived: false, company_id: s.companyId, due_date: iso(now + (i < 2 ? -864e5 : 864e5)), completed_at: i > 5 ? iso(now - (i - 6) * 864e5 - 3600e3) : null, status: i > 5 ? 'done' : 'todo', created_at: iso(now - 10 * 864e5) });
  w('tasks', tasks);
  const room = crypto.randomUUID();
  w('meeting_rooms', [{ id: room, name: 'Sala Executiva', company_id: s.companyId, capacity: 8, is_active: true, opens_at: '08:00', closes_at: '18:00' }]);
  const st = new Date(); st.setHours(st.getHours() + 2, 0, 0, 0);
  w('meeting_bookings', [{ id: crypto.randomUUID(), company_id: s.companyId, room_id: room, title: 'Alinhamento semanal', starts_at: iso(st.getTime()), ends_at: iso(st.getTime() + 3600e3), booked_by: me }]);
  w('support_tickets', [{ id: 1042, company_id: s.companyId, profile_id: ana, category: 'Erro no sistema', area: 'Chat', severity: 'Moderado', description: 'Mensagem não envia no setor TI desde hoje cedo.', status: 'Recebido', device: { platform: 'android', screen: '390x844', app: '1.0.0' }, created_at: iso(now - 21.5 * 3600e3) }, { id: 1043, company_id: s.companyId, profile_id: carlos, category: 'Lentidão', area: 'Início', severity: 'Leve', description: 'O painel demora para carregar.', status: 'Em análise', assignee_name: 'Rafael Torres', created_at: iso(now - 30 * 3600e3) }]);
  const B = crypto.randomUUID(), c1 = crypto.randomUUID(), c2 = crypto.randomUUID(), c3 = crypto.randomUUID();
  w('task_boards', [{ id: B, name: 'Operação', owner_id: me, company_id: s.companyId, created_at: iso(now) }]);
  w('task_board_columns', [{ id: c1, board_id: B, title: 'A fazer', color: '#64748b', position: 0, is_conclusion: false }, { id: c2, board_id: B, title: 'Em andamento', color: '#3b82f6', position: 1, is_conclusion: false }, { id: c3, board_id: B, title: 'Concluído', color: '#22c55e', position: 2, is_conclusion: true }]);
  const T = JSON.parse(localStorage.getItem(P + 'tasks') || '[]'); T.forEach((t, i) => { t.board_id = B; t.status = i > 5 ? c3 : c1; t.task_number = 100 + i; t.priority = 'medium'; }); w('tasks', T);
  const dms = JSON.parse(localStorage.getItem(P + 'direct_messages')); dms.push({ id: crypto.randomUUID(), sender_id: ana, receiver_id: me, content: 'Segue o link: https://docs.exemplo.com/relatorios/2026/novembro/fechamento-financeiro-consolidado-versao-final-revisada-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA e também uma frase bem longa para testar a quebra de linha dentro do balão de mensagem no celular.', is_read: false, company_id: s.companyId, created_at: iso(now - 20 * 60e3) }); w('direct_messages', dms);
  localStorage.setItem(P + 'seeded', '1');


  {
    const pr = JSON.parse(localStorage.getItem(P + 'profiles')); const me = pr[0].id, carlos = pr[2].id;
    const T = JSON.parse(localStorage.getItem(P + 'support_tickets')); T.push({ id: 2001, company_id: s.companyId, profile_id: me, category: 'Dúvida', area: 'Chat', severity: 'Leve', description: 'Como fixo uma conversa?', status: 'Em análise', assignee_name: 'Carlos Lima', assignee_profile_id: carlos, created_at: iso(now - 3600e3) }, { id: 2002, company_id: s.companyId, profile_id: me, category: 'Erro no sistema', area: 'Tarefas', severity: 'Moderado', description: 'Card não move de coluna', status: 'Fechado', assignee_name: 'Carlos Lima', assignee_profile_id: carlos, created_at: iso(now - 7200e3) }); w('support_tickets', T);
    const M = []; for (const [tid, n] of [[2001, 9], [2002, 3]]) for (let i = 0; i < n; i++) M.push({ id: crypto.randomUUID(), ticket_id: tid, body: i % 2 ? 'Resposta do suporte número ' + i : 'Mensagem do usuário ' + i, author_profile_id: i % 2 ? carlos : me, author_name: i % 2 ? 'Carlos Lima' : 'Vitor Hugo', from_staff: !!(i % 2), created_at: iso(now - 3000e3 + i * 60e3) });
    w('support_ticket_messages', M);
  }
};
