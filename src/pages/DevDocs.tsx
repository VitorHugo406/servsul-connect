// Public pages: /desenvolvedores (API of the mural key — cards-in function — plus webhooks, forms and iCal) and
// /seguranca (how data is protected). Only describe what really exists; update when the API changes.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/cards-in';
function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  useEffect(() => { document.title = `${title} | ewvon`; }, [title]);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border"><div className="mx-auto flex max-w-4xl items-center gap-4 px-5 py-4"><a href="/" className="text-lg font-bold">ewvon</a><nav className="ml-auto flex gap-4 text-sm text-muted-foreground"><Link to="/guia" className="hover:text-foreground">Guia</Link><Link to="/ajuda" className="hover:text-foreground">Ajuda</Link><Link to="/desenvolvedores" className="hover:text-foreground">Desenvolvedores</Link><Link to="/seguranca" className="hover:text-foreground">Segurança</Link></nav></div></header>
      <main className="mx-auto max-w-4xl px-5 py-10"><h1 className="text-3xl font-bold">{title}</h1><p className="mt-2 text-muted-foreground">{sub}</p><div className="dd mt-8 space-y-8">{children}</div></main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground"><Link to="/termos" className="underline">Termos</Link> · <Link to="/privacidade" className="underline">Privacidade</Link> · <Link to="/status" className="underline">Status</Link></footer>
    </div>
  );
}
const Code = ({ children }: { children: string }) => <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-[12.5px] leading-relaxed">{children}</pre>;
const H = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="mb-3 scroll-mt-6 text-xl font-semibold">{children}</h2>;

export function DevDocs() {
  return (
    <Shell title="API para desenvolvedores" sub="Conecte o ewvon ao sistema da sua empresa, a formulários, Zapier, Make ou n8n.">
      <section><H id="chave">1. Chave do mural</H>
        <p className="text-sm">No mural, abra <b>Compartilhar › Receber cards de fora</b> e clique em <b>Criar chave</b>. Por padrão a chave só cria cards. Para listar, ler e alterar cards, marque <b>API completa</b>. A chave vale apenas para aquele mural; pause ou gere uma nova quando quiser.</p>
        <p className="mt-2 text-sm">Envie a chave em um destes formatos: cabeçalho <code>X-Ewvon-Key: ewv_…</code>, cabeçalho <code>Authorization: Bearer ewv_…</code> ou parâmetro <code>?key=ewv_…</code> (útil em formulários HTML).</p>
        <Code>{`Endereço: ${API}`}</Code></section>
      <section><H id="criar">2. Criar um card — POST</H>
        <p className="mb-2 text-sm">Corpo em JSON ou formulário. Campos: <code>title</code> (obrigatório), <code>description</code>, <code>due_date</code> (<code>dd/mm/aaaa</code>, <code>dd/mm/aaaa hh:mm</code> ou ISO), <code>priority</code> (urgente, alta, média, baixa), <code>assignee_email</code> (colaborador da empresa), <code>labels</code> (nomes de etiquetas do mural) e <code>redirect</code> (para formulários HTML).</p>
        <Code>{`curl -X POST ${API} \\
  -H "X-Ewvon-Key: ewv_SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"title":"Novo pedido","due_date":"30/11/2026 18:00","priority":"alta"}'

→ 201 {"ok":true,"id":"…","number":42,"column":"A fazer","board":"Vendas","url":"https://ewvon.com/…"}`}</Code></section>
      <section><H id="listar">3. Listar cards — GET (API completa)</H>
        <p className="mb-2 text-sm">Filtros opcionais: <code>column</code> (id da coluna), <code>q</code> (busca no título), <code>open=1</code> (só em aberto), <code>limit</code> (até 200).</p>
        <Code>{`curl "${API}?open=1&limit=50" -H "X-Ewvon-Key: ewv_SUA_CHAVE"

→ {"ok":true,"board":{…},"columns":[{"id":"…","title":"A fazer","done":false},…],
   "cards":[{"id":"…","number":42,"title":"…","column":{"id":"…","title":"A fazer"},"priority":"high",
             "due_date":"…","done":false,"assignee":{"name":"…","email":"…"},"labels":["Cliente"],"url":"…"}]}`}</Code></section>
      <section><H id="ler">4. Ler um card — GET ?id= (API completa)</H>
        <p className="mb-2 text-sm">Inclui descrição em texto, campos personalizados, links e checklist.</p>
        <Code>{`curl "${API}?id=ID_DO_CARD" -H "X-Ewvon-Key: ewv_SUA_CHAVE"`}</Code></section>
      <section><H id="alterar">5. Alterar, mover ou concluir — PATCH ?id= (API completa)</H>
        <p className="mb-2 text-sm">Envie só o que quer mudar: <code>title</code>, <code>description</code>, <code>due_date</code>, <code>priority</code>, <code>assignee_email</code> (vazio remove), <code>column</code> (id ou nome da coluna) ou <code>done: true</code> (vai para a coluna de conclusão). As mesmas regras do mural valem: um card com dependências abertas não pode ser concluído, e cards de uma War Room ativa não podem ser alterados.</p>
        <Code>{`curl -X PATCH "${API}?id=ID_DO_CARD" \\
  -H "X-Ewvon-Key: ewv_SUA_CHAVE" -H "Content-Type: application/json" \\
  -d '{"column":"Em andamento","priority":"urgente"}'`}</Code></section>
      <section><H id="erros">6. Respostas de erro</H>
        <ul className="list-disc space-y-1 pl-5 text-sm"><li><b>401</b> chave inválida ou pausada · <b>403</b> a chave não tem "API completa" · <b>404</b> card não encontrado neste mural</li><li><b>400</b> dado inválido (mensagem explica) · <b>409</b> bloqueado por dependência ou War Room · <b>429</b> muitas requisições (máx. ~1 card por segundo por chave)</li></ul></section>
      <section><H id="webhooks">7. Receber eventos — Webhooks</H>
        <p className="text-sm">Em <b>Integrações › Webhooks</b>, cadastre um endereço https e escolha os eventos (cards, comentários, colaboradores, avisos, reuniões, War Room). Cada envio em JSON traz <code>{'{event, sent_at, company_id, data}'}</code> e o cabeçalho <code>X-Ewvon-Signature: sha256=…</code> (HMAC-SHA256 do corpo com a chave secreta do webhook). Também é possível enviar mensagens prontas para Discord, Google Chat, Telegram e Slack.</p></section>
      <section><H id="outros">8. Outras entradas e saídas</H>
        <ul className="list-disc space-y-1 pl-5 text-sm"><li><b>Formulário do mural</b> (sem código): Compartilhar › Formulário do mural gera um link público que cria cards.</li><li><b>Agenda (iCal)</b>: Calendário › Agenda no celular gera um link .ics pessoal com prazos e reuniões.</li><li><b>Link para convidados</b>: visão pública do mural, com comentários e aprovação opcionais.</li></ul></section>
    </Shell>
  );
}

export function SecurityPage() {
  const items: [string, string][] = [
    ['Dados no Brasil', 'O banco de dados e os arquivos ficam em servidores na região de São Paulo (sa-east-1), em um provedor de nuvem com criptografia dos dados armazenados.'],
    ['Conexão sempre criptografada', 'Todo acesso ao ewvon usa HTTPS (TLS). Nenhuma senha trafega ou é guardada em texto aberto.'],
    ['Separação entre empresas', 'Cada consulta ao banco passa por regras de segurança por linha (Row Level Security): uma empresa nunca enxerga dados de outra, mesmo que alguém tente acessar a API diretamente.'],
    ['Permissões por pessoa', 'Administradores, gestores e colaboradores veem apenas o que o papel permite. Murais, anotações e salas têm membros e permissões próprios.'],
    ['Dados sensíveis criptografados', 'Ficha do colaborador (documentos, salário, dados bancários) é guardada criptografada no banco, com a chave fora da tabela. Chaves de integrações (sistemas de RH, IA) são criptografadas (AES-256-GCM) e só abertas no servidor.'],
    ['Verificação em duas etapas', 'Cada pessoa pode ativar a verificação em duas etapas com um aplicativo autenticador (código de 6 dígitos).'],
    ['Áudios do chat', 'Mensagens de voz são criptografadas de ponta a ponta entre os aparelhos da conversa.'],
    ['Links públicos sob controle', 'Formulários, links de convidados, chaves de API e agendas usam códigos longos e aleatórios, podem ser pausados ou trocados a qualquer momento e têm limite de uso para evitar abuso.'],
    ['LGPD', 'Cada pessoa pode baixar seus dados e pedir correção ou exclusão em "Meus dados e privacidade". A empresa pode exportar todos os seus dados. Veja a Política de Privacidade e o Acordo de Tratamento de Dados (DPA).'],
    ['Transparência', 'A página de Status mostra em tempo real se o site, o login, o banco e os arquivos estão respondendo.'],
  ];
  return (
    <Shell title="Segurança e privacidade" sub="Como o ewvon protege os dados da sua empresa e da sua equipe.">
      <div className="grid gap-4 sm:grid-cols-2">{items.map(([t, d]) => <section key={t} className="rounded-xl border border-border p-5"><h2 className="mb-1.5 font-semibold">{t}</h2><p className="text-sm text-muted-foreground">{d}</p></section>)}</div>
      <p className="text-sm text-muted-foreground">Encontrou uma falha de segurança? Escreva para o contato informado nos <Link to="/termos" className="underline">Termos de Uso</Link>; respondemos o mais rápido possível. Documentos relacionados: <Link to="/privacidade" className="underline">Privacidade</Link>, <Link to="/dpa" className="underline">DPA</Link>, <Link to="/cookies" className="underline">Cookies</Link>.</p>
    </Shell>
  );
}
