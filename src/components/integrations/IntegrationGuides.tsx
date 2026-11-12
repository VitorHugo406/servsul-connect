// Detailed, step-by-step setup guides for the Integrações tab (Slack, Microsoft Teams, WhatsApp).
// Each guide is a dropdown ("Passo a passo detalhado"); every step can be opened on its own.
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

const L = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">{children}</a>
);
const K = ({ children }: { children: ReactNode }) => <b className="font-semibold text-foreground">{children}</b>;
const Path = ({ items }: { items: string[] }) => (
  <span className="inline-flex flex-wrap items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-medium text-foreground">{items.map((x, i) => <span key={x}>{i ? '› ' : ''}{x}</span>)}</span>
);
const Tip = ({ children }: { children: ReactNode }) => <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px]">{children}</p>;

function Step({ n, title, children, open }: { n: number; title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-lg border border-border" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 text-[13px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] text-background">{n}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-3 pb-3 pl-[42px] text-[12.5px] leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}

export function GuideDropdown({ title = 'Passo a passo detalhado', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="group/g rounded-xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[13px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/g:rotate-180" />
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
}

export function SlackGuide() {
  return (
    <>
      <Tip>Você vai criar um "app" do Slack só para o ewvon e gerar um <K>link de webhook</K> (um endereço que começa com <K>https://hooks.slack.com/services/</K>). Tudo que o ewvon mandar para esse link aparece no canal que você escolher. Leva uns 5 minutos e não precisa de programação.</Tip>
      <Step n={1} title="Entre no painel de apps do Slack">
        <p>No computador, abra <L href="https://api.slack.com/apps">api.slack.com/apps</L> no navegador. Se pedir login, entre com a mesma conta que você usa no Slack da empresa.</p>
        <p>Você vai ver a página <K>Your Apps</K> (Seus apps). Se nunca criou um app, ela aparece vazia; é normal.</p>
      </Step>
      <Step n={2} title="Crie o app do ewvon">
        <p>Clique no botão verde <K>Create New App</K> (canto superior direito).</p>
        <p>Na janela que abre, escolha <K>From scratch</K> (do zero). Não use "From an app manifest".</p>
        <p>Preencha:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li><K>App Name</K>: <K>ewvon</K> (é o nome que vai aparecer nas mensagens do canal).</li>
          <li><K>Pick a workspace to develop your app in</K>: escolha o workspace da sua empresa.</li>
        </ul>
        <p>Clique em <K>Create App</K>. Você cai na página <Path items={['Basic Information']} /> do app.</p>
      </Step>
      <Step n={3} title="Ative os Incoming Webhooks">
        <p>No menu da esquerda, na seção <K>Features</K>, clique em <Path items={['Features', 'Incoming Webhooks']} />.</p>
        <p>No topo da página há a chave <K>Activate Incoming Webhooks</K>. Clique nela para deixar em <K>On</K> (fica verde).</p>
        <p>Assim que ativar, aparece mais abaixo a seção <K>Webhook URLs for Your Workspace</K>.</p>
      </Step>
      <Step n={4} title="Escolha o canal e gere o link">
        <p>Role a página até o final e clique em <K>Add New Webhook to Workspace</K> (em algumas contas aparece como <K>Add New Webhook</K>).</p>
        <p>Abre uma tela de permissão: "ewvon está solicitando permissão para acessar o workspace". No campo <K>Where should ewvon post?</K> (Onde o ewvon deve publicar?), escolha o canal, por exemplo <K>#avisos</K> ou <K>#geral</K>.</p>
        <p>Clique em <K>Allow</K> (Permitir).</p>
        <Tip>Para canal <K>privado</K>, você precisa ser membro dele para ele aparecer na lista. Se o botão "Allow" não aparecer e surgir "Request to install" (Solicitar instalação), o seu Slack exige aprovação de um administrador: envie a solicitação e peça para o admin do Slack aprovar em <Path items={['Configurações do workspace', 'Gerenciar apps']} />.</Tip>
      </Step>
      <Step n={5} title="Copie o link do webhook">
        <p>Você volta para a página <K>Incoming Webhooks</K>. Na tabela <K>Webhook URL</K> apareceu uma linha nova com o canal escolhido e um endereço parecido com:</p>
        <p className="break-all rounded-md bg-muted px-2 py-1 font-mono text-[11.5px] text-foreground">https://hooks.slack.com/services/T0000000/B0000000/XXXXXXXXXXXXXXXXXXXXXXXX</p>
        <p>Clique em <K>Copy</K> ao lado dele. Esse link é como uma senha: quem tiver o link consegue postar no canal, então não compartilhe.</p>
      </Step>
      <Step n={6} title="Cole aqui no ewvon e teste">
        <p>Volte para esta tela, cole o link no campo <K>Link do Incoming Webhook</K> logo abaixo.</p>
        <p>Em <K>Enviar quando houver</K>, deixe marcados os eventos que devem ir para o Slack (avisos, card atribuído, reuniões).</p>
        <p>Clique em <K>Conectar</K> e depois em <K>Enviar teste</K>. Em poucos segundos deve aparecer no canal a mensagem "Teste de integração do ewvon".</p>
      </Step>
      <Step n={7} title="(Opcional) Coloque a logo do ewvon nas mensagens">
        <p>Em <Path items={['Settings', 'Basic Information']} />, role até <K>Display Information</K>, envie a logo em <K>App icon</K> e clique em <K>Save Changes</K>. As próximas mensagens já saem com a logo.</p>
      </Step>
      <Step n={8} title="Problemas comuns">
        <ul className="list-disc space-y-1.5 pl-4">
          <li><K>"Use o link de Incoming Webhook do Slack"</K> ao salvar: o link colado não começa com <K>https://hooks.slack.com/services/</K>. Volte ao passo 5 e copie de novo pelo botão Copy.</li>
          <li><K>O teste falha com "HTTP 404" ou "no_service"</K>: o webhook foi apagado ou o app foi removido do Slack. Gere um novo link (passo 4) e salve aqui.</li>
          <li><K>"channel_not_found" ou "channel_is_archived"</K>: o canal foi apagado ou arquivado. Crie um webhook novo para outro canal.</li>
          <li><K>"action_prohibited"</K>: o administrador do Slack bloqueou webhooks. Peça para liberar o app "ewvon".</li>
          <li><K>Quer trocar de canal?</K> Cada link vale para um canal só: crie outro webhook (passo 4), copie e cole aqui no lugar do antigo.</li>
        </ul>
      </Step>
    </>
  );
}

export function TeamsGuide() {
  return (
    <>
      <Tip>No Teams, o ewvon publica por meio de um <K>fluxo do Workflows</K> (o antigo "Conector de Webhook de Entrada" foi descontinuado pela Microsoft). Você cria o fluxo no próprio canal e copia o link que ele gera. Leva uns 5 minutos.</Tip>
      <Step n={1} title="Abra o canal no Teams">
        <p>No Teams (aplicativo do computador ou <L href="https://teams.microsoft.com">teams.microsoft.com</L>), vá em <Path items={['Equipes', 'sua equipe', 'canal']} /> onde as mensagens do ewvon devem aparecer.</p>
      </Step>
      <Step n={2} title="Abra o Workflows do canal">
        <p>Passe o mouse sobre o nome do canal e clique nos três pontinhos <K>⋯ (Mais opções)</K> → <K>Workflows</K> (Fluxos de trabalho).</p>
        <Tip>Se a opção não aparecer, a sua empresa pode ter bloqueado o Power Automate/Workflows. O administrador do Microsoft 365 precisa liberar o app "Workflows" no Centro de administração do Teams.</Tip>
      </Step>
      <Step n={3} title="Escolha o modelo certo">
        <p>Na busca, digite <K>webhook</K> e escolha o modelo <K>Postar em um canal quando uma solicitação de webhook for recebida</K> (em inglês: <K>Post to a channel when a webhook request is received</K>).</p>
      </Step>
      <Step n={4} title="Conclua o assistente">
        <p>Dê um nome ao fluxo, por exemplo <K>ewvon</K>. Confira se a conexão com o Microsoft Teams aparece com um sinal de ✓ (é a sua conta) e clique em <K>Avançar</K>.</p>
        <p>Confira a <K>Equipe</K> e o <K>Canal</K> (já vêm preenchidos) e clique em <K>Adicionar fluxo de trabalho</K>.</p>
      </Step>
      <Step n={5} title="Copie o link">
        <p>Aparece "Fluxo de trabalho adicionado com êxito" com um link longo, que começa com algo como <K>https://prod-00.westus.logic.azure.com/…</K> ou <K>https://…powerplatform.com/…</K>. Clique no ícone de copiar e depois em <K>Concluído</K>.</p>
        <Tip>Perdeu o link? No Teams, abra o app <Path items={['Workflows', 'seu fluxo "ewvon"', 'Editar']} />, clique no primeiro passo "Quando uma solicitação de webhook do Teams for recebida" e copie a <K>URL HTTP POST</K>.</Tip>
      </Step>
      <Step n={6} title="Cole aqui no ewvon e teste">
        <p>Cole o link no campo <K>Link do fluxo (Workflows)</K> abaixo, escolha os eventos e clique em <K>Conectar</K> e depois em <K>Enviar teste</K>. O cartão "Teste de integração do ewvon" aparece no canal em alguns segundos (o Workflows às vezes leva até 1 minuto).</p>
      </Step>
      <Step n={7} title="Problemas comuns">
        <ul className="list-disc space-y-1.5 pl-4">
          <li><K>"Use o link do fluxo…"</K> ao salvar: o link colado não é do Workflows. Copie de novo no passo 5.</li>
          <li><K>Teste "ok", mas nada aparece no canal</K>: abra o fluxo no app Workflows e veja o <K>Histórico de execuções</K>; se houver erro de permissão, a conta que criou o fluxo precisa ser membro do canal.</li>
          <li><K>O fluxo parou depois de um tempo</K>: fluxos ficam ligados à conta de quem criou. Se a pessoa saiu da empresa, crie o fluxo de novo com outra conta e troque o link aqui.</li>
        </ul>
      </Step>
    </>
  );
}

export function WhatsAppGuide() {
  return (
    <>
      <Tip>O WhatsApp exige a <K>API oficial da Meta (WhatsApp Cloud API)</K>: uma conta empresarial verificada, um número só para a API e um <K>modelo de mensagem aprovado</K>. Cada conversa iniciada pela empresa é <K>cobrada pela Meta</K>. A configuração leva de 30 minutos a 1 dia (por causa da aprovação do modelo).</Tip>
      <Step n={1} title="Crie o app na Meta">
        <p>Abra <L href="https://developers.facebook.com/apps">developers.facebook.com/apps</L> → <K>Criar app</K>. Em caso de uso, escolha <K>Outro</K>; em tipo, <K>Empresa</K>. Dê o nome <K>ewvon</K>, informe seu e-mail e o <K>Portfólio empresarial</K> (Business Manager) da empresa → <K>Criar app</K>.</p>
      </Step>
      <Step n={2} title="Adicione o produto WhatsApp">
        <p>No painel do app, em <K>Adicionar produtos ao seu app</K>, encontre <K>WhatsApp</K> e clique em <K>Configurar</K>. Selecione o portfólio empresarial da empresa e continue.</p>
      </Step>
      <Step n={3} title="Cadastre o número e copie o ID dele">
        <p>Vá em <Path items={['WhatsApp', 'Configuração da API']} /> (API Setup). A Meta oferece um número de teste, que só envia para até 5 celulares cadastrados. Para uso real, clique em <K>Adicionar número de telefone</K>, informe um número que <K>não esteja</K> em uso no WhatsApp comum e confirme pelo código SMS.</p>
        <p>Com o número selecionado no campo <K>De</K>, copie o <K>ID do número de telefone</K> (Phone number ID). É um número longo como <K>123456789012345</K> — <K>não</K> é o telefone em si.</p>
      </Step>
      <Step n={4} title="Crie e aprove o modelo de mensagem">
        <p>Abra o <L href="https://business.facebook.com/wa/manage/message-templates/">Gerenciador do WhatsApp › Modelos de mensagem</L> → <K>Criar modelo</K>.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Categoria: <K>Utilidade</K>.</li>
          <li>Nome: <K>aviso_ewvon</K> (só letras minúsculas, números e _).</li>
          <li>Idioma: <K>Português (BR)</K>.</li>
          <li>Corpo: <K>Aviso do ewvon: {'{{1}}'}</K> — o <K>{'{{1}}'}</K> é onde o ewvon coloca o texto do aviso ou do card. Em "Exemplo", escreva qualquer frase.</li>
        </ul>
        <p>Clique em <K>Enviar</K>. A aprovação costuma sair em minutos, mas pode levar até 24 horas. O status precisa ficar <K>Ativo</K>.</p>
      </Step>
      <Step n={5} title="Gere o token permanente">
        <p>Abra <L href="https://business.facebook.com/settings/system-users">Configurações do negócio › Usuários do sistema</L> → <K>Adicionar</K>, dê um nome (ex.: ewvon) e função <K>Administrador</K>.</p>
        <p>Com o usuário criado, clique em <K>Atribuir ativos</K>: em <K>Apps</K>, marque o app ewvon com <K>controle total</K>; em <K>Contas do WhatsApp</K>, marque a conta com <K>controle total</K>.</p>
        <p>Clique em <K>Gerar novo token</K>, escolha o app ewvon, validade <K>Nunca</K>, e marque as permissões <K>whatsapp_business_messaging</K> e <K>whatsapp_business_management</K> → <K>Gerar token</K>. Copie o token na hora (ele só aparece uma vez).</p>
      </Step>
      <Step n={6} title="Cadastre a forma de pagamento">
        <p>No <L href="https://business.facebook.com/wa/manage/home/">Gerenciador do WhatsApp</L>, em <Path items={['Visão geral', 'Adicionar forma de pagamento']} />, cadastre um cartão. Sem isso a Meta não entrega mensagens iniciadas pela empresa.</p>
      </Step>
      <Step n={7} title="Preencha aqui no ewvon e teste">
        <p>Preencha abaixo: <K>Phone number ID</K> (passo 3), <K>Nome do modelo</K> (ex.: aviso_ewvon), <K>Idioma</K> (pt_BR) e o <K>Token</K> (passo 5). Clique em <K>Conectar</K> e depois em <K>Enviar teste</K>, informando o seu celular com DDD.</p>
        <Tip>Os funcionários só recebem se tiverem o <K>celular cadastrado no perfil</K> do ewvon (Gerenciamento › usuário › Telefone).</Tip>
      </Step>
      <Step n={8} title="Problemas comuns">
        <ul className="list-disc space-y-1.5 pl-4">
          <li><K>"(#132001) Template name does not exist"</K>: o nome ou o idioma do modelo não confere, ou ele ainda não foi aprovado.</li>
          <li><K>"(#131030) Recipient phone number not in allowed list"</K>: você está usando o número de teste; cadastre o destinatário em Configuração da API ou use um número real.</li>
          <li><K>"Invalid OAuth access token"</K>: o token expirou ou foi copiado incompleto. Gere de novo (passo 5).</li>
          <li><K>"(#131042) Business eligibility payment issue"</K>: falta forma de pagamento (passo 6).</li>
        </ul>
      </Step>
    </>
  );
}

export function HrGuide() {
  return (
    <div className="space-y-2">
      <Step n={1} title="Escolha o sistema e cole a chave" open>
        <p>Em <K>Buscar por API</K>, escolha o seu sistema (Convenia, Pontomais, Tangerino, Ahgora, Nexti…) e cole a <K>chave de acesso</K>. Você a gera no painel do próprio sistema, em algo como “Integrações” ou “API”. O texto abaixo da escolha diz onde.</p>
      </Step>
      <Step n={2} title="Conectar e carregar">
        <p>Clique em <K>Conectar e carregar</K>. O ewvon reconhece as colunas sozinho (nome, setor, cargo, banco de horas, faltas…) e mostra quantas pessoas foram reconhecidas. A atualização é automática, a cada 1 minuto.</p>
        <Tip>Para uma pessoa ser reconhecida, o cadastro dela no ewvon precisa ter o mesmo e-mail, CPF, matrícula ou nome do sistema de ponto.</Tip>
      </Step>
      <Step n={3} title="Sistema que não está na lista">
        <p>Use “Seu sistema” ou “Qualquer API” e informe o endereço da API em <K>Opções avançadas</K>. Se ele sabe enviar dados, use a aba <K>Receber por envio (push)</K>.</p>
      </Step>
    </div>
  );
}
