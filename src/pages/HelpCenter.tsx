// Public pages: /ajuda (central de ajuda: searchable how-tos about features that really exist) and /status (live check of
// the services the app depends on). Same frame as the legal pages.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, Search, XCircle } from 'lucide-react';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import { LEGAL } from '@/lib/legal';

type Q = { q: string; a: string };
const HELP: { cat: string; items: Q[] }[] = [
  { cat: 'Primeiros passos', items: [
    { q: 'Como entro no sistema?', a: 'Acesse ewvon.com, clique em Entrar, escolha a sua empresa e use o e-mail e a senha recebidos do administrador. No primeiro acesso o sistema pede para você trocar a senha e mostra um tour pelas abas (você pode rever o tour pelo botão "?" no topo).' },
    { q: 'Esqueci a minha senha', a: 'Na tela de login, clique em "Esqueci minha senha" e siga o link enviado ao seu e-mail. Pessoas importadas de um sistema de RH também entram por esse caminho na primeira vez.' },
    { q: 'Posso usar no celular?', a: 'Sim. Pelo navegador do celular o ewvon abre a versão de celular automaticamente. No Android também há o aplicativo, que pode ser baixado no seu perfil.' },
    { q: 'Como mudo o tema (claro ou escuro)?', a: 'No computador, use o ícone de paleta no topo da tela e escolha um dos temas claros ou escuros. No celular, vá em Perfil › Aparência.' },
  ] },
  { cat: 'Chat', items: [
    { q: 'Como começo uma conversa com um colega?', a: 'No Chat, clique no ícone de "Nova conversa" (lápis) no topo da lista e digite o nome. A seção "Pessoas" mostra quem ainda não tem conversa com você; é só clicar.' },
    { q: 'Como crio um grupo?', a: 'No Chat do computador, clique no ícone de pessoas no topo da lista (Novo grupo), dê um nome, escolha os participantes e clique em Criar grupo. No celular, use o botão de novo grupo na aba Chat.' },
    { q: 'Como menciono alguém?', a: 'Digite @ na mensagem: aparece a lista das pessoas da conversa, que vai filtrando enquanto você digita. Quem é mencionado sempre recebe uma notificação "mencionou você", mesmo com a conversa silenciada.' },
    { q: 'Como mudo a cor do meu balão?', a: 'Abra a conversa e clique em Personalização (ícone de paleta). Em "Cor do meu balão" escolha a cor. Vale só para você e só naquela conversa, no computador e no celular.' },
    { q: 'Por quanto tempo os arquivos do chat ficam guardados?', a: 'Fotos, arquivos e áudios enviados no chat saem do servidor quando todos os destinatários recebem, ou em no máximo 7 dias. Depois disso ficam apenas nos aparelhos que já os tinham; se precisar de novo, peça a quem enviou para reenviar. Anexos de tarefas e avisos não seguem essa regra.' },
  ] },
  { cat: 'Tarefas e murais', items: [
    { q: 'Como crio um mural?', a: 'Em Tarefas, clique em "Novo mural", dê nome, descrição e escolha uma capa. As colunas padrão (A Fazer, Em Progresso, Em Revisão, Concluído) são criadas e podem ser renomeadas.' },
    { q: 'Como trago meus quadros do Trello, ClickUp ou Asana?', a: 'Em Tarefas, clique em "Importar". No Trello, exporte o quadro como JSON (Menu › Imprimir, exportar e compartilhar › Exportar como JSON). No ClickUp e no Asana, exporte em CSV. O ewvon cria um mural novo com colunas, cards, etiquetas, prazos, checklists e comentários.' },
    { q: 'Posso mostrar um mural para um cliente?', a: 'Sim. No mural, clique em Compartilhar e crie o "Link para convidados". Quem tiver o link vê as colunas e os cards (título, prazo, etiquetas e progresso) sem precisar de login. Descrições, comentários, anexos e pessoas não aparecem, e você pode desativar o link quando quiser.' },
    { q: 'Posso ver os cards em lista ou em calendário?', a: 'Sim. Dentro do mural, no topo, escolha Quadro, Lista ou Calendário. A Lista pode ser ordenada clicando nos títulos das colunas; o Calendário mostra os cards no dia do prazo.' },
    { q: 'Como anexo documentos a um card?', a: 'Abra o card e use a área de anexos para enviar arquivos e imagens. Os anexos de tarefas ficam guardados e não são apagados automaticamente.' },
    { q: 'O que é a coluna de conclusão?', a: 'É a coluna que marca o card como concluído. Ao mover um card para ela, o sistema registra a data e se foi entregue no prazo ou com atraso, o que alimenta os relatórios e o score da equipe.' },
  ] },
  { cat: 'Reuniões, avisos e War Room', items: [
    { q: 'Como reservo uma sala de reunião?', a: 'Em Salas de reunião, escolha a sala, o dia e o horário livre e convide os participantes. O status de quem está na reunião muda para "Em reunião" automaticamente durante o horário reservado.' },
    { q: 'Quem pode publicar avisos?', a: 'Administradores e as pessoas com a permissão "Postar avisos" (definida em Gerenciamento). Avisos podem ser fixados, agendados e ter data de término.' },
    { q: 'O que é a War Room?', a: 'É uma sala de crise para incidentes urgentes: as pessoas convocadas recebem um alerta até confirmarem com "Ciente", há uma linha do tempo de ações e o card de emergência fica travado no mural até a sala ser encerrada.' },
  ] },
  { cat: 'Administração e privacidade', items: [
    { q: 'Como cadastro colaboradores?', a: 'Em Gerenciamento, adicione a pessoa com nome, e-mail e setor. Se a empresa usa um sistema de RH conectado em Integrações, é possível importar os colaboradores ativos de uma vez.' },
    { q: 'Como exporto os meus dados?', a: 'No seu perfil, abra "Meus dados e privacidade" para baixar uma cópia dos seus dados ou fazer um pedido de correção ou exclusão, conforme a LGPD.' },
    { q: 'Como ligo o ewvon a outros sistemas (Zapier, Make)?', a: 'Em Integrações › Webhooks, cole o endereço https que o Zapier, Make ou o seu sistema forneceu e escolha os eventos: cards (criado, mudou de coluna, concluído, responsável, prazo, excluído, comentário), colaborador cadastrado/desativado/reativado, aviso publicado, reunião agendada/cancelada e War Room aberta/encerrada. Os eventos de um webhook já cadastrado podem ser trocados no botão "Eventos". Use "Enviar teste" para conferir. Cada envio é assinado com a chave secreta mostrada ali.' },
    { q: 'Como recebo avisos no Discord, Google Chat, Telegram ou Slack?', a: 'Em Integrações › Webhooks, escolha em "Enviar para" o aplicativo, cole o endereço de webhook do canal (as instruções aparecem na tela) e marque os eventos. O ewvon manda uma mensagem pronta, em português, a cada evento. Use "Enviar teste" para conferir.' },
    { q: 'Como crio cards a partir de um formulário ou de outro sistema?', a: 'No mural, abra Compartilhar › "Receber cards de fora" e crie a chave. Use o exemplo para sistemas (Zapier, Make, n8n) ou o formulário HTML pronto. Campos: título, descrição, prazo, prioridade, e-mail do responsável e etiquetas. A chave só cria cards; pause ou gere uma nova quando quiser.' },
    { q: 'Como vejo meus prazos no Google Agenda ou no iPhone?', a: 'Em Calendário, clique em "Agenda no celular" e assine o link pessoal no Google Agenda, Outlook ou iPhone. Seus cards com prazo e suas reuniões aparecem e se atualizam sozinhos. Não compartilhe o link; se precisar, gere um novo.' },
    { q: 'Como registro o tempo gasto em um card?', a: 'Abra o card e use "Tempo": Iniciar/Parar liga o cronômetro (só um por pessoa por vez) e o "+" registra um tempo manual (ex.: 1h30). O total e o tempo de cada pessoa aparecem no card.' },
    { q: 'Que automações posso criar no mural?', a: 'No ⚡ Automações do mural, crie regras SE → ENTÃO. Gatilhos instantâneos: card criado, card entrou numa coluna, card concluído, responsável definido. Gatilhos periódicos: prazo chegando, card parado, checklist completo, etiqueta urgente. Ações: notificar, definir responsável, adicionar etiqueta, definir prazo, mudar prioridade, mover de coluna e gerar alerta.' },
    { q: 'As chaves das integrações ficam seguras?', a: 'Sim. As chaves de API são guardadas criptografadas (AES-256) e só são abertas no servidor, no momento da sincronização. Nenhuma tela mostra a chave depois de salva.' },
  ] },
];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  useEffect(() => { document.title = `${title} | ewvon`; }, [title]);
  return (
    <div className="legal-page">
      <header className="legal-top"><Link to="/" className="legal-brand">ewvon</Link><nav><Link to="/ajuda">Ajuda</Link><Link to="/status">Status</Link><Link to="/termos">Termos</Link><Link to="/privacidade">Privacidade</Link></nav></header>
      <main>{children}</main>
      <footer className="legal-foot">© {new Date().getFullYear()} ewvon · Dúvidas, sugestões e suporte: {LEGAL.email}</footer>
    </div>
  );
}

export function HelpCenter() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => { const f = fold(q.trim()); return HELP.map((c) => ({ ...c, items: f ? c.items.filter((i) => fold(i.q + ' ' + i.a).includes(f)) : c.items })).filter((c) => c.items.length); }, [q]);
  return (
    <Frame title="Central de ajuda">
      <article className="legal-doc">
        <h1>Central de ajuda</h1>
        <p className="legal-meta">Respostas rápidas sobre o uso do ewvon. Não encontrou? Escreva para {LEGAL.email}.</p>
        <div style={{ position: 'relative', margin: '18px 0 8px' }}>
          <Search style={{ position: 'absolute', left: 12, top: 12, width: 16, height: 16, opacity: .55 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: senha, grupo, Trello, calendário…" aria-label="Buscar na ajuda"
            style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'inherit', padding: '0 12px 0 36px', fontSize: 14 }} />
        </div>
        {list.length === 0 ? <p>Nada encontrado para “{q}”. Tente outra palavra ou escreva para {LEGAL.email}.</p> : list.map((c) => (
          <section key={c.cat}>
            <h2>{c.cat}</h2>
            {c.items.map((i) => { const k = c.cat + i.q; const on = open === k || !!q.trim(); return (
              <div key={k} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <button type="button" onClick={() => setOpen(open === k ? null : k)} aria-expanded={on} style={{ width: '100%', textAlign: 'left', padding: '12px 0', fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 12, background: 'none', color: 'inherit' }}>{i.q}<span aria-hidden="true">{on ? '−' : '+'}</span></button>
                {on ? <p style={{ marginTop: 0 }}>{i.a}</p> : null}
              </div>); })}
          </section>
        ))}
      </article>
    </Frame>
  );
}

type St = 'checking' | 'ok' | 'slow' | 'down';
const CHECKS: { id: string; name: string; desc: string; url: string; init?: RequestInit }[] = [
  { id: 'site', name: 'Site e aplicativo', desc: 'ewvon.com e a versão para celular', url: '/manifest.json' },
  { id: 'auth', name: 'Login', desc: 'Entrar, sair e recuperar senha', url: `${SUPABASE_URL}/auth/v1/health`, init: { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } } },
  { id: 'db', name: 'Banco de dados', desc: 'Chat, tarefas, avisos e demais dados', url: `${SUPABASE_URL}/rest/v1/`, init: { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } } },
  { id: 'storage', name: 'Arquivos', desc: 'Fotos, anexos e documentos', url: `${SUPABASE_URL}/storage/v1/version`, init: { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } } },
  { id: 'fn', name: 'Automações e integrações', desc: 'Notificações, relatórios e integrações', url: `${SUPABASE_URL}/functions/v1/hr-sync/presets`, init: { method: 'OPTIONS' } },
];

export function StatusPage() {
  const [res, setRes] = useState<Record<string, { st: St; ms: number }>>({});
  const [at, setAt] = useState<Date | null>(null);
  const run = async () => {
    setRes(Object.fromEntries(CHECKS.map((c) => [c.id, { st: 'checking' as St, ms: 0 }])));
    await Promise.all(CHECKS.map(async (c) => {
      const t0 = performance.now(); let st: St = 'down';
      try { const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 10000); const r = await fetch(c.url, { ...c.init, cache: 'no-store', signal: ac.signal }); clearTimeout(to); st = r.status < 500 ? 'ok' : 'down'; } catch { st = 'down'; }
      const ms = Math.round(performance.now() - t0); if (st === 'ok' && ms > 3000) st = 'slow';
      setRes((p) => ({ ...p, [c.id]: { st, ms } }));
    }));
    setAt(new Date());
  };
  useEffect(() => { void run(); const t = setInterval(() => void run(), 60000); return () => clearInterval(t); }, []);
  const vals = Object.values(res); const allOk = vals.length === CHECKS.length && vals.every((v) => v.st === 'ok');
  const anyDown = vals.some((v) => v.st === 'down');
  const ICON = { checking: <Loader2 className="h-5 w-5 animate-spin" style={{ opacity: .6 }} />, ok: <CheckCircle2 className="h-5 w-5" style={{ color: '#16a34a' }} />, slow: <AlertTriangle className="h-5 w-5" style={{ color: '#d97706' }} />, down: <XCircle className="h-5 w-5" style={{ color: '#dc2626' }} /> };
  const LABEL = { checking: 'Verificando…', ok: 'Funcionando', slow: 'Lento', down: 'Fora do ar' };
  return (
    <Frame title="Status">
      <article className="legal-doc">
        <h1>Status do ewvon</h1>
        <p className="legal-meta">Verificação feita agora, a partir do seu navegador, e repetida a cada minuto.{at ? ` Última: ${at.toLocaleTimeString('pt-BR')}.` : ''}</p>
        <div style={{ margin: '18px 0', padding: '14px 16px', borderRadius: 14, fontWeight: 600, background: anyDown ? '#fee2e2' : allOk ? '#dcfce7' : 'hsl(var(--muted))', color: anyDown ? '#991b1b' : allOk ? '#166534' : 'inherit' }}>
          {anyDown ? 'Há instabilidade em algum serviço. Se o problema continuar, escreva para ' + LEGAL.email + '.' : allOk ? 'Todos os serviços estão funcionando.' : 'Verificando os serviços…'}
        </div>
        {CHECKS.map((c) => { const r = res[c.id] || { st: 'checking' as St, ms: 0 }; return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid hsl(var(--border))' }}>
            {ICON[r.st]}
            <div style={{ flex: 1 }}><b>{c.name}</b><div style={{ fontSize: 13, opacity: .7 }}>{c.desc}</div></div>
            <span style={{ fontSize: 13 }}>{LABEL[r.st]}{r.st === 'ok' || r.st === 'slow' ? ` · ${r.ms} ms` : ''}</span>
          </div>); })}
        <p style={{ marginTop: 16, fontSize: 13, opacity: .75 }}>Se aqui estiver tudo verde e o sistema não abrir para você, o problema pode estar na sua internet ou na rede da empresa.</p>
        <button type="button" onClick={() => void run()} style={{ marginTop: 6, height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'inherit', fontWeight: 600 }}>Verificar de novo</button>
      </article>
    </Frame>
  );
}
