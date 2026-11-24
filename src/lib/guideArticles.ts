// Content of the public guide center (/guia, /guia/<slug>). Each article: category, title, summary, numbered steps
// (text + optional screenshot in public/guia/<img>.jpg, captured from test mode with fictional data), tips and related
// articles. Only describe features that exist; update together with the feature. Screenshots: scratchpad script
// "guide-shots" (Playwright, test mode) — recapture when a screen changes.
export type GuideStep = { t: string; d: string; img?: string };
/** hidden: written but not published yet (the feature waits for a database change) — flip to false when it is live. */
export type GuideArticle = { slug: string; cat: string; title: string; sum: string; steps: GuideStep[]; tips?: string[]; rel?: string[]; who?: string; hidden?: boolean };

/** Topics in the order they appear on /guia (like a help center: one topic → many how-to articles). */
export const GUIDE_CATS = ['Primeiros passos', 'Chat e comunicação', 'Murais e cards', 'Visualizações', 'Organização avançada', 'Receber e compartilhar',
  'Agenda e reuniões', 'Avisos e celebrações', 'War Room', 'Pessoas e equipes', 'Avaliações', 'Anotações', 'Dash 3D', 'Integrações', 'Administração', 'Conta e segurança'];
/** One line per topic, shown on the topic cards of /guia. */
export const GUIDE_CAT_DESC: Record<string, string> = {
  'Primeiros passos': 'Entrar, conhecer as telas, buscar qualquer coisa e criar o primeiro mural.',
  'Chat e comunicação': 'Conversas por setor, diretas e em grupo, áudios, figurinhas, chamadas e assistente.',
  'Murais e cards': 'Cards, checklists, etiquetas, anexos, templates, repetição e ações em massa.',
  'Visualizações': 'Quadro, Lista, Calendário, Linha do tempo, Carga, Relatórios e visão geral.',
  'Organização avançada': 'Campos personalizados, dependências, cronômetro, automações, modo operação e score.',
  'Receber e compartilhar': 'Formulário público, link para clientes, importação e convite de membros.',
  'Agenda e reuniões': 'Calendário, salas de reunião, relatório do dia e agenda no celular.',
  'Avisos e celebrações': 'Avisos oficiais, aniversariantes e eventos do mês.',
  'War Room': 'Sala de crise: convocação com alerta, linha do tempo e card de emergência.',
  'Pessoas e equipes': 'Equipes, indicadores, alertas, score, setores e o seu painel.',
  'Avaliações': 'Experiência de 45 e 90 dias, desempenho e desenvolvimento, com PDF validável.',
  'Anotações': 'Notas pessoais e compartilhadas, editadas por várias pessoas ao mesmo tempo.',
  'Dash 3D': 'O escritório em 3D com a equipe, indicadores de RH e passeio em primeira pessoa.',
  'Integrações': 'Sistemas de RH, Slack, Teams, WhatsApp, Google, webhooks, API e assistente com IA.',
  'Administração': 'Colaboradores, permissões, setores, pagamentos e personalização da empresa.',
  'Conta e segurança': 'Perfil, aparência, notificações, verificação em duas etapas e privacidade.',
};

export const GUIDE: GuideArticle[] = [
  { slug: 'criar-mural', cat: 'Primeiros passos', title: 'Criar um mural', sum: 'O mural é onde a equipe organiza o trabalho em colunas e cards. Crie do zero ou a partir de um modelo pronto.',
    steps: [
      { t: 'Abra Tarefas', d: 'No menu, clique no ícone de Tarefas. Você verá todos os murais que pode acessar, com capa, progresso e situação (em dia, atrasado ou concluído).', img: 'murais' },
      { t: 'Clique em "Novo mural"', d: 'Dê um nome, uma descrição opcional e escolha uma capa. O mural é criado com as colunas padrão, que você pode renomear depois.' },
      { t: 'Ou comece por um modelo', d: 'Clique em "Modelos" para ver 67 modelos prontos por área (RH, departamento pessoal, segurança do trabalho, TI e proteção de dados, resolução de problemas, vendas e atendimento, marketing, operações, financeiro e compras, projetos e tecnologia, gestão e administração). Escolha um, ajuste o nome e clique em "Usar modelo".', img: 'modelos' },
    ], tips: ['Arraste os murais na lista (ordem "Minha ordem") para deixar os mais usados primeiro.', 'Já usa outra ferramenta? Veja "Importar do Trello, Asana ou ClickUp".'], rel: ['modelos', 'importar', 'cards'] },
  { slug: 'modelos', cat: 'Primeiros passos', title: 'Modelos de mural prontos', sum: 'Comece com colunas, etiquetas, campos personalizados, automações, dependências, formulário e cards de exemplo já montados para a sua área.',
    steps: [
      { t: 'Abra a galeria', d: 'Em Tarefas, clique em "Modelos". À esquerda ficam as áreas (Recursos Humanos, Vendas e atendimento, Marketing, Operações, Financeiro e compras, Projetos e tecnologia, Gestão e administração) e uma busca; no centro, os modelos; à direita, a prévia das colunas e tudo o que o modelo traz.', img: 'modelos' },
      { t: 'Escolha e dê um nome', d: 'Clique no modelo, ajuste o nome do mural no rodapé e clique em "Usar modelo". Os prazos e datas de início dos exemplos são calculados a partir de hoje.' },
      { t: 'O que já vem pronto', d: 'Conforme o modelo: campos personalizados (ex.: Valor, Origem e Probabilidade no funil de vendas) já preenchidos nos exemplos, automações (ex.: card novo ganha prazo, ao entrar em uma coluna vira prioridade Alta), dependências entre etapas (veja na Linha do tempo) e um formulário público (Trabalhe conosco, Abrir chamado, Pedido de compra, Pedido de manutenção...). O formulário começa pausado: revise e ative em Compartilhar › Formulário.' },
      { t: 'Modelo do processo', d: 'Todo modelo traz os seus cards numa coluna "Modelo do processo". Para começar (ex.: um onboarding), use "Duplicar todos os cards" no menu dessa coluna: preencha as informações (colaborador, data de admissão…) e cada card é criado já na sua coluna — a avaliação de experiência na coluna de experiência, a conversa de 30 dias na de 30 dias — com o prazo calculado. Modelos sem data de referência contam os prazos a partir da data que você informar.' },
      { t: 'Edite à vontade', d: 'O mural é seu: apague os cards de exemplo, renomeie colunas, ajuste campos (Configurar › Campos personalizados) e automações (Organizar › Automações), no topo do mural. Nada muda nos outros murais.', img: 'quadro' },
    ], rel: ['criar-mural', 'cards'] },
  { slug: 'cards', cat: 'Murais e cards', title: 'Criar, mover e concluir cards', sum: 'Cada tarefa é um card. Ele guarda responsável, prazo, prioridade, etiquetas, checklist, comentários e anexos.',
    steps: [
      { t: 'Crie um card', d: 'Em qualquer coluna, clique em "Adicionar um cartão", escreva o título e pressione Enter.', img: 'quadro' },
      { t: 'Abra o card para detalhar', d: 'Clique no card para definir datas, membros, etiquetas, checklist, descrição e comentários. Tudo fica registrado no histórico de atividade.', img: 'card' },
      { t: 'Mova arrastando', d: 'Arraste o card para outra coluna. As automações da coluna (responsável, capa, subtarefas) são aplicadas na hora.' },
      { t: 'Conclua', d: 'Passe o mouse no card e clique no círculo, ou mova para a coluna de conclusão. O ewvon registra se foi concluído no prazo ou com atraso.' },
    ], rel: ['lista', 'cronometro'] },
  { slug: 'lista', cat: 'Visualizações', title: 'Ver o mural em Lista', sum: 'Uma tabela com status, responsável, prazo, prioridade, etiquetas e campos personalizados, editável direto na linha.',
    steps: [
      { t: 'Troque a visualização', d: 'Na barra de baixo do mural, clique em "Quadro" e escolha "Lista".', img: 'menu-visao' },
      { t: 'Edite na linha', d: 'Clique em Status para mover o card, em Responsável para trocar a pessoa, em Prazo para escolher a data e em Prioridade para mudar. O círculo à esquerda conclui.', img: 'lista' },
      { t: 'Ordene', d: 'Clique no título de uma coluna da tabela para ordenar; clique de novo para inverter.' },
    ], rel: ['calendario', 'linha-do-tempo', 'campos'] },
  { slug: 'calendario', cat: 'Visualizações', title: 'Ver o mural em Calendário', sum: 'Os cards aparecem no dia do prazo. Arraste um card para outro dia para mudar a data.',
    steps: [
      { t: 'Abra o Calendário', d: 'Na barra de baixo, em "Quadro", escolha "Calendário".', img: 'calendario' },
      { t: 'Mude prazos arrastando', d: 'Arraste o card para outro dia. O horário do prazo é mantido.' },
      { t: 'Navegue', d: 'Use "Hoje" e as setas para trocar de mês. Cards atrasados aparecem em vermelho.' },
    ], rel: ['linha-do-tempo', 'agenda'] },
  { slug: 'linha-do-tempo', cat: 'Visualizações', title: 'Linha do tempo (cronograma)', sum: 'Veja os cards como barras de início a prazo, com as dependências entre eles. Ideal para projetos.',
    steps: [
      { t: 'Abra a Linha do tempo', d: 'Na barra de baixo, em "Quadro", escolha "Linha do tempo". Os cards aparecem agrupados por coluna.', img: 'linha-do-tempo' },
      { t: 'Ajuste as datas com o mouse', d: 'Arraste a barra para mudar início e prazo juntos; puxe a ponta esquerda (início) ou a direita (prazo) para alongar ou encurtar. Um card sem datas ganha uma barra de um dia ao clicar na linha dele.' },
      { t: 'Veja as dependências', d: 'As setas ligam um card ao que depende dele. Se a seta fica vermelha, o card começa antes do outro terminar.' },
      { t: 'Mude a escala', d: 'Use "Dias" ou "Semanas" e as setas para navegar no tempo.' },
    ], rel: ['dependencias', 'carga'] },
  { slug: 'carga', cat: 'Visualizações', title: 'Carga de trabalho da equipe', sum: 'Quantos cards cada pessoa tem por semana, para redistribuir antes que alguém fique sobrecarregado.',
    steps: [
      { t: 'Abra "Carga de trabalho"', d: 'Na barra de baixo, em "Quadro", escolha "Carga de trabalho".', img: 'carga' },
      { t: 'Leia as cores', d: 'Verde: 1–2 cards; amarelo: 3–4; vermelho: 5 ou mais (ou atrasados). A coluna "Horas" soma o cronômetro da semana.' },
      { t: 'Veja os cards', d: 'Clique num número para listar os cards daquela pessoa e semana e abrir qualquer um.' },
    ], rel: ['relatorios', 'cronometro'] },
  { slug: 'relatorios', cat: 'Visualizações', title: 'Relatórios do mural', sum: 'Indicadores, gráficos e PDF do mural: concluídos no prazo, tempo médio, evolução semanal e situação por pessoa.',
    steps: [
      { t: 'Abra "Relatórios"', d: 'Na barra de baixo, em "Quadro", escolha "Relatórios".', img: 'relatorios' },
      { t: 'Use o filtro', d: 'Os números consideram o filtro do mural: filtre por pessoa, etiqueta ou prazo para analisar só uma parte.' },
      { t: 'Baixe o PDF', d: 'Clique em "Baixar PDF" para gerar o relatório com os mesmos números.' },
    ], rel: ['carga'] },
  { slug: 'campos', cat: 'Organização avançada', title: 'Campos personalizados', sum: 'Crie campos próprios do mural, como Valor (R$), Cliente, Tipo de pedido ou Aprovado, e preencha em cada card.',
    steps: [
      { t: 'Abra os campos do mural', d: 'No topo do mural, abra o menu Configurar e escolha "Campos personalizados". Só o dono ou administrador do mural cria campos.', img: 'campos' },
      { t: 'Crie o campo', d: 'Clique em "Novo campo", dê o nome e escolha o tipo: Texto, Número, Valor (R$), Data, Lista de opções ou Sim/Não. Marque se o valor aparece no card do quadro.' },
      { t: 'Preencha no card', d: 'Abra um card: os campos aparecem na seção "Campos". O valor também aparece como coluna na visualização Lista.', img: 'card-campos' },
    ], rel: ['lista', 'dependencias'] },
  { slug: 'dependencias', cat: 'Organização avançada', title: 'Dependências entre cards', sum: 'Diga que um card só pode ser concluído depois de outro. O ewvon mostra "Bloqueado" e impede a conclusão antes da hora.',
    steps: [
      { t: 'Abra o card que espera', d: 'Na seção "Dependências", clique em "Adicionar" ao lado de "Bloqueado por".', img: 'card-campos' },
      { t: 'Escolha o card', d: 'Busque pelo número ou título do card do mesmo mural. O ewvon não deixa criar ciclos (A depende de B que depende de A).' },
      { t: 'Acompanhe', d: 'O card mostra "Bloqueado" no quadro até o outro ser concluído. Na Linha do tempo, a dependência aparece como seta.' },
    ], rel: ['linha-do-tempo', 'campos'] },
  { slug: 'cronometro', cat: 'Organização avançada', title: 'Cronômetro e horas nos cards', sum: 'Registre o tempo gasto em cada card com um clique ou lance horas manualmente.',
    steps: [
      { t: 'Inicie', d: 'Abra o card e, na seção "Tempo", clique em "Iniciar". Só um cronômetro roda por pessoa: iniciar em outro card para o anterior.', img: 'card' },
      { t: 'Pare ou lance manualmente', d: 'Clique em "Parar" quando terminar. Pelo "+", registre um tempo manual, como "1h30" ou "45min", com uma observação.' },
      { t: 'Acompanhe', d: 'O card mostra o total e o tempo de cada pessoa. A Carga de trabalho e os Relatórios somam as horas.' },
    ], rel: ['carga', 'relatorios'] },
  { slug: 'automacoes', cat: 'Organização avançada', title: 'Automações (SE → ENTÃO)', sum: 'Faça o mural trabalhar sozinho: ao entrar numa coluna, definir responsável, prazo, etiqueta ou avisar alguém.',
    steps: [
      { t: 'Abra as automações', d: 'No topo do mural, abra o menu Organizar, escolha "Automações" e clique em "Nova regra SE → ENTÃO".', img: 'automacoes' },
      { t: 'Escolha o gatilho (SE)', d: 'Instantâneos (⚡): card criado, entrou numa coluna, concluído, responsável definido, etiqueta adicionada (escolha qual etiqueta). Periódicos (⏱): prazo chegando, card parado, checklist completo, etiqueta urgente.' },
      { t: 'Escolha a ação (ENTÃO)', d: 'Notificar, definir responsável, adicionar co-responsável, alterar a capa, adicionar etiqueta, definir prazo (hoje + N dias), mudar prioridade, mover de coluna ou gerar alerta. Clique em "Criar regra".' },
    ], tips: ['Exemplo: SE o card entrar em "Revisão", ENTÃO o responsável vira a pessoa que revisa e ela recebe um aviso.', 'Exemplo: SE a etiqueta "TI" for adicionada, ENTÃO o responsável vira a pessoa de TI e a capa fica azul. Crie uma regra para cada ação que quiser.'], rel: ['formulario', 'webhooks'] },
  { slug: 'formulario', cat: 'Receber e compartilhar', title: 'Formulário do mural', sum: 'Um link público com formulário: cada resposta vira um card no mural, sem login e sem site.',
    steps: [
      { t: 'Abra o compartilhamento', d: 'No topo do mural, clique em "Compartilhar quadro" e, em "Formulário do mural", clique em "Criar formulário".', img: 'compartilhar' },
      { t: 'Monte as perguntas', d: 'Clique em "Editar formulário": título, apresentação, perguntas (texto, e-mail, telefone, data, escolha…), coluna de entrada, prioridade, prazo em dias e mensagem final. A primeira pergunta vira o título do card.', img: 'form-editor' },
      { t: 'Divulgue o link', d: 'Copie o link e envie por e-mail, WhatsApp ou coloque no site. Quem preencher não precisa de conta.', img: 'form-publico' },
    ], tips: ['Pause o formulário ou gere um novo link a qualquer momento.', 'Combine com automações: SE card criado ENTÃO definir responsável.'], rel: ['convidados', 'api'] },
  { slug: 'convidados', cat: 'Receber e compartilhar', title: 'Link para convidados (clientes e fornecedores)', sum: 'Mostre o andamento do mural para pessoas de fora, sem login. Opcionalmente, deixe comentar e aprovar.',
    steps: [
      { t: 'Crie o link', d: 'Em "Compartilhar quadro", na seção "Link para convidados", clique em "Criar link para convidados" e copie.', img: 'compartilhar' },
      { t: 'Libere comentários (opcional)', d: 'Marque "Permitir que convidados comentem e aprovem cards". O convidado clica num card e escolhe Comentar, Aprovar ou Pedir ajustes.', img: 'convidado' },
      { t: 'A equipe acompanha', d: 'Cada comentário de convidado também aparece dentro do card, nos comentários. Desative ou gere um novo link quando quiser.' },
    ], tips: ['Descrições, comentários internos, anexos e nomes da equipe nunca aparecem para convidados.'], rel: ['formulario'] },
  { slug: 'importar', cat: 'Receber e compartilhar', title: 'Importar do Trello, Asana, ClickUp, monday.com ou Notion', sum: 'Traga seus quadros com colunas, cards, etiquetas, checklists, comentários e responsáveis.',
    steps: [
      { t: 'Exporte da outra ferramenta', d: 'Trello: Menu do quadro › Imprimir, exportar e compartilhar › Exportar como JSON. Asana e ClickUp: CSV. monday.com: "Exportar quadro para o Excel" (os grupos viram etiquetas). Notion: exporte o banco de dados em "Markdown e CSV". Planilhas em Excel (.xlsx) ou CSV também funcionam.' },
      { t: 'Importe no ewvon', d: 'Em Tarefas, clique em "Importar", escolha o arquivo e confira o resumo (colunas, cards, etiquetas).', img: 'importar' },
      { t: 'Confirme', d: 'Clique em importar. Um mural novo é criado; responsáveis são ligados pelo e-mail ou nome dos colaboradores da empresa.' },
    ], rel: ['criar-mural'] },
  { slug: 'agenda', cat: 'Agenda e reuniões', title: 'Prazos no Google Agenda, Outlook e iPhone', sum: 'Assine um link pessoal e veja seus prazos e reuniões na agenda do celular, com atualização automática.',
    steps: [
      { t: 'Gere o link', d: 'Em Calendário, clique em "Agenda no celular".', img: 'agenda' },
      { t: 'Adicione à sua agenda', d: 'Clique em Google Agenda, iPhone/Mac ou Outlook, ou copie o link e cole em "Adicionar calendário pela URL".' },
      { t: 'Pronto', d: 'Cards com prazo e reuniões aparecem e se atualizam sozinhos (o Google pode levar algumas horas). Se o link vazar, gere um novo.' },
    ], rel: ['cards'] },
  { slug: 'webhooks', cat: 'Integrações', title: 'Webhooks e avisos no Discord, Google Chat, Telegram e Slack', sum: 'Avise outros sistemas e canais quando algo acontecer: card criado ou concluído, colaborador cadastrado, aviso publicado…',
    steps: [
      { t: 'Abra Integrações › Webhooks', d: 'Disponível para administradores da empresa.', img: 'webhooks' },
      { t: 'Escolha o destino', d: 'Em "Enviar para", escolha JSON (Zapier, Make, n8n, sistema próprio), Discord, Google Chat, Telegram ou Slack. A tela mostra onde pegar o endereço no app escolhido.' },
      { t: 'Marque os eventos e teste', d: 'Cards, colaboradores, avisos, reuniões e War Room. Clique em "Adicionar" e depois em "Enviar teste".' },
    ], rel: ['api', 'automacoes'] },
  { slug: 'api', cat: 'Integrações', title: 'API e chave do mural', sum: 'Crie, liste, leia e altere cards a partir de outros sistemas com uma chave por mural.',
    steps: [
      { t: 'Crie a chave', d: 'Em "Compartilhar quadro", seção "Receber cards de fora", clique em "Criar chave". Escolha a coluna de entrada.', img: 'compartilhar' },
      { t: 'Escolha o alcance', d: 'Por padrão a chave só cria cards. Marque "API completa" para também listar, ler e alterar cards do mural.' },
      { t: 'Integre', d: 'Use o exemplo pronto ou veja todos os detalhes na documentação para desenvolvedores (ewvon.com/desenvolvedores).' },
    ], rel: ['webhooks', 'formulario'] },
  { slug: 'duas-etapas', cat: 'Conta e segurança', title: 'Verificação em duas etapas', sum: 'Proteja sua conta com um código do aplicativo autenticador além da senha.',
    steps: [
      { t: 'Abra seu perfil', d: 'Clique na sua foto no topo e abra "Verificação em duas etapas".' },
      { t: 'Escaneie o QR Code', d: 'Use Google Authenticator, Microsoft Authenticator ou outro app compatível e digite o código de 6 dígitos.' },
      { t: 'Pronto', d: 'A partir de agora o ewvon pede o código ao entrar. Perdeu o celular? Peça ao administrador para remover a verificação.' },
    ], rel: ['seguranca'] },
  { slug: 'seguranca', cat: 'Conta e segurança', title: 'Como o ewvon protege seus dados', sum: 'Dados no Brasil, conexão criptografada, separação total entre empresas e dados sensíveis criptografados.',
    steps: [
      { t: 'Leia a página de segurança', d: 'Em ewvon.com/seguranca estão as medidas: servidores em São Paulo, HTTPS, regras por linha no banco, permissões por pessoa, criptografia de dados sensíveis e LGPD.' },
      { t: 'Seus dados, suas regras', d: 'Em "Meus dados e privacidade" cada pessoa baixa seus dados ou pede correção/exclusão.' },
    ], rel: ['duas-etapas'] },
  // ───────── Primeiros passos
  { slug: 'entrar', cat: 'Primeiros passos', title: 'Entrar no ewvon pela primeira vez', sum: 'Acesse com o e-mail e a senha que o administrador da sua empresa cadastrou, troque a senha e conheça as telas com o tour.',
    steps: [
      { t: 'Abra o ewvon', d: 'Acesse ewvon.com e clique em Entrar. Escolha a sua empresa e informe o e-mail e a senha recebidos.' },
      { t: 'Crie a sua senha', d: 'No primeiro acesso o sistema pede uma senha nova, só sua. Depois disso a senha inicial deixa de valer.' },
      { t: 'Faça o tour', d: 'Um passo a passo destaca cada aba que você pode usar. Para rever depois, clique no "?" no topo da tela.' },
    ], tips: ['Esqueceu a senha? Use "Esqueci minha senha" na tela de login.'], rel: ['navegar', 'busca-geral', 'celular'] },
  { slug: 'navegar', cat: 'Primeiros passos', title: 'Conhecer as telas e navegar', sum: 'O menu lateral leva às áreas do sistema; o topo tem busca, notificações, aparência, ajuda e o seu perfil.',
    steps: [
      { t: 'Menu lateral', d: 'Início, Chat, Avisos, Aniversariantes, Tarefas, Calendário, Salas de reunião, War Room, Pessoas e as telas de administração. Cada pessoa vê só o que o plano da empresa e as permissões liberam.' },
      { t: 'Barra do topo', d: 'Lupa (busca geral), "?" (tour), paleta (aparência), assistente, sino (notificações) e a sua foto (perfil, privacidade e sair).' },
      { t: 'Modo foco', d: 'Ctrl+Shift+F esconde menus e deixa só a tela atual; Ctrl+Shift+E troca de aba sem sair do foco. Repita o atalho para voltar.' },
    ], rel: ['busca-geral', 'aparencia', 'notificacoes'] },
  { slug: 'busca-geral', cat: 'Primeiros passos', title: 'Busca geral (Ctrl+K)', sum: 'Encontre qualquer card, mural, pessoa ou tela de onde você estiver, só pelo teclado.',
    steps: [
      { t: 'Abra a busca', d: 'Pressione Ctrl+K (⌘K no Mac) ou clique na lupa no topo.' },
      { t: 'Digite', d: 'Nome ou número do card (ex.: #42), nome do mural, de um colega ou de uma tela. Os resultados aparecem separados em Cards, Murais, Pessoas e Telas.' },
      { t: 'Abra com Enter', d: 'Use as setas e Enter. Um card abre já dentro do mural dele; uma pessoa abre a conversa com ela no chat.' },
    ], rel: ['navegar', 'atalhos'] },
  { slug: 'celular', cat: 'Primeiros passos', title: 'Usar no celular e no aplicativo Android', sum: 'Pelo navegador do celular o ewvon abre a versão de celular. No Android há também o aplicativo com notificações.',
    steps: [
      { t: 'No navegador', d: 'Abra ewvon.com no celular e entre normalmente: chat, tarefas, avisos, agenda e perfil se ajustam à tela.' },
      { t: 'Aplicativo Android', d: 'No celular, abra o seu Perfil e use "Baixar aplicativo". O app avisa quando há uma versão nova para instalar.' },
      { t: 'Permita as notificações', d: 'No primeiro acesso o app pede permissão de notificações. Assim mensagens, menções e alertas de War Room chegam mesmo com o app fechado.' },
    ], rel: ['notificacoes', 'war-room'] },

  // ───────── Chat e comunicação
  { slug: 'chat-conversas', cat: 'Chat e comunicação', title: 'Conversas por setor, diretas e em grupo', sum: 'Cada setor tem o seu canal; além disso há conversas diretas com colegas e grupos criados por você.',
    steps: [
      { t: 'Abra o Chat', d: 'À esquerda ficam as conversas, com filtros para diretas, grupos, setores e favoritas. Conversas não lidas ficam destacadas.' },
      { t: 'Nova conversa', d: 'Clique no ícone de nova conversa e digite o nome. A seção "Pessoas" lista quem ainda não conversou com você; é só clicar.' },
      { t: 'Novo grupo', d: 'Clique no ícone de pessoas no topo da lista, dê nome e descrição, marque os participantes e crie. Quem cria é o administrador do grupo.' },
      { t: 'Informações da conversa', d: 'No computador, o painel lateral mostra os dados da pessoa ou do grupo e pode ser recolhido.' },
    ], tips: ['Você pode conversar consigo mesmo para guardar lembretes e arquivos.'], rel: ['chat-mencoes', 'chat-midia', 'chat-personalizar'] },
  { slug: 'chat-mencoes', cat: 'Chat e comunicação', title: 'Menções, reações e formatação', sum: 'Chame a atenção de alguém com @, reaja às mensagens e destaque palavras.',
    steps: [
      { t: 'Mencione', d: 'Digite @ e escolha a pessoa na lista, que filtra enquanto você digita. Quem é mencionado sempre recebe o aviso, mesmo com a conversa silenciada.' },
      { t: 'Reaja e responda', d: 'Use as reações rápidas em uma mensagem ou responda citando a mensagem original.' },
      { t: 'Formate', d: 'Escreva *negrito*, _itálico_ ou ~riscado~. Links viram atalhos clicáveis com pré-visualização.' },
    ], rel: ['chat-conversas', 'notificacoes'] },
  { slug: 'chat-midia', cat: 'Chat e comunicação', title: 'Áudios, arquivos, fotos e figurinhas', sum: 'Envie áudios protegidos, documentos com pré-visualização, fotos e figurinhas, inclusive animadas.',
    steps: [
      { t: 'Áudio', d: 'Segure o botão do microfone para gravar; no celular, deslize para travar e gravar sem segurar. Os áudios são criptografados de ponta a ponta.' },
      { t: 'Arquivos e fotos', d: 'Use o clipe para enviar. PDFs têm pré-visualização dentro da conversa.' },
      { t: 'Figurinhas', d: 'Abra o painel de figurinhas ao lado do "+", use os pacotes, salve figurinhas recebidas e crie as suas (até 5 segundos se animadas). Pacotes podem ser exportados e compartilhados.' },
    ], tips: ['Fotos, arquivos e áudios do chat saem do servidor quando todos recebem, ou em no máximo 7 dias. Anexos de tarefas e avisos não seguem essa regra.'], rel: ['chat-conversas'] },
  { slug: 'chamadas', cat: 'Chat e comunicação', title: 'Chamadas de voz e vídeo', sum: 'Ligue para um colega ou grupo direto da conversa, no computador ou no celular.',
    steps: [
      { t: 'Inicie a chamada', d: 'Na conversa, clique no ícone de chamada. A outra pessoa recebe o toque no computador ou no celular.' },
      { t: 'Durante a chamada', d: 'Ligue ou desligue câmera e microfone e encerre quando terminar.' },
      { t: 'Histórico', d: 'Chamadas perdidas, encerradas e a duração aparecem na conversa, como em aplicativos de mensagem.' },
    ], rel: ['chat-conversas'] },
  { slug: 'chat-personalizar', cat: 'Chat e comunicação', title: 'Personalizar conversas e marcar como não lida', sum: 'Cor do seu balão por conversa, conversas favoritas, silenciar e lembrar depois.',
    steps: [
      { t: 'Cor do balão', d: 'Na conversa, abra Personalização e escolha "Cor do meu balão". Vale só para você e só naquela conversa.' },
      { t: 'Favoritar e silenciar', d: 'Pelo menu da conversa, fixe as mais importantes e silencie as que não precisam avisar (menções continuam chegando).' },
      { t: 'Marcar como não lida', d: 'Marque uma conversa como não lida para lembrar de responder depois. Isso não muda o "visto" para quem enviou.' },
    ], rel: ['chat-conversas'] },
  { slug: 'assistente-ia', cat: 'Chat e comunicação', title: 'EwvonAI, o assistente no chat', sum: 'Escreva @ewvonai em uma conversa para pedir ajuda ao assistente com inteligência artificial.',
    steps: [
      { t: 'Chame o assistente', d: 'Em qualquer conversa, digite @ewvonai seguido da pergunta.' },
      { t: 'Receba a resposta', d: 'O EwvonAI responde na própria conversa. Ele aparece com o seu próprio ícone.' },
      { t: 'Se ele avisar que falta configuração', d: 'O assistente usa uma chave de IA cadastrada pela empresa. Sem ela, ele responde pedindo para o administrador cadastrar a chave em Integrações.' },
    ], rel: ['integracoes-ia'] },

  // ───────── Murais e cards (extras)
  { slug: 'detalhes-card', cat: 'Murais e cards', title: 'Etiquetas, checklist, anexos, capa e decisões', sum: 'Tudo o que um card pode guardar, organizado em botões no topo do card.',
    steps: [
      { t: 'Etiquetas e prioridade', d: 'Use "Etiquetas" para classificar e "Prioridade" para marcar Baixa, Média, Alta ou Urgente.' },
      { t: 'Datas e membros', d: 'Em "Datas", defina início, prazo e lembrete. Em "Membros", escolha o responsável e outras pessoas.' },
      { t: 'Checklist', d: 'Crie listas de itens; o progresso aparece no card do quadro.' },
      { t: 'Capa, anexos e decisões', d: 'Coloque uma capa, anexe arquivos e registre decisões (o que foi decidido, por quem e quando).' },
      { t: 'Mais', d: 'Em "Mais" ficam cronômetro, links externos (Drive, OneDrive, Figma…), dependências e aprovação.' },
    ], rel: ['cards', 'templates-card'] },
  { slug: 'templates-card', cat: 'Murais e cards', title: 'Templates de card', sum: 'Transforme um card em modelo e crie cards iguais com um clique.',
    steps: [
      { t: 'Torne um card template', d: 'Abra o card e clique em "Tornar Template". Ele passa a servir de modelo e não entra nos números do mural.' },
      { t: 'Crie a partir do template', d: 'Na coluna, use o botão de templates ao lado de "Adicionar um cartão" e escolha o modelo. O card nasce com descrição, checklist e etiquetas.' },
      { t: 'Defina o prazo de cada etapa', d: 'Dentro de um card-template, em "No processo", escolha a coluna onde o card será criado e diga quando ele vence: dias antes ou depois do prazo final do processo, ou no próprio prazo final. O mesmo vale para a data de início.' },
      { t: 'Duplique o processo inteiro', d: 'Em uma coluna de template, abra o menu da coluna (⋮) e clique em "Duplicar todos os cards". Preencha as informações do mural (ex.: Colaborador, Último dia, Tipo), escolha a data de referência e responda quantos dias antes dela tudo precisa estar concluído. A prévia mostra a coluna e o prazo de cada card; ao confirmar, todos os cards são criados de uma vez, cada um na sua coluna, já preenchidos, com checklists, etiquetas, responsáveis e dependências.' },
    ], rel: ['repetir-card', 'modelos'] },
  { slug: 'repetir-card', cat: 'Murais e cards', title: 'Cards que se repetem', sum: 'Programe um card para ser criado de novo todo dia, semana ou mês, na coluna que você escolher.',
    steps: [
      { t: 'Abra a duplicação automática', d: 'No menu do card (ou do template), escolha "Auto-duplicar".' },
      { t: 'Escolha a frequência', d: 'Diária, semanal (escolhendo os dias) ou mensal (escolhendo o dia do mês) e a coluna de destino.' },
      { t: 'Ative', d: 'O ewvon cria a cópia no horário programado. Desative quando não precisar mais.' },
    ], rel: ['templates-card'] },
  { slug: 'card-emergente', cat: 'Murais e cards', title: 'Modo Emergente em um card', sum: 'Destaque um card urgente para que ele chame a atenção de todos no mural.',
    steps: [
      { t: 'Ative', d: 'No menu do card, escolha "Ativar Modo Emergente". O card ganha destaque no quadro.' },
      { t: 'Desative', d: 'Quando a urgência passar, use "Desativar Emergente" no mesmo menu. Para incidentes maiores, use a War Room.' },
    ], rel: ['war-room'] },
  { slug: 'arquivar', cat: 'Murais e cards', title: 'Arquivar cards e colunas', sum: 'Tire do caminho o que já foi resolvido sem perder nada.',
    steps: [
      { t: 'Arquive', d: 'No menu do card, use "Arquivar". No menu da coluna, "Arquivar todos os cards".' },
      { t: 'Recupere', d: 'No topo do mural, abra Configurar › Arquivados e lixeira para restaurar um card ou todos de uma vez.' },
    ], rel: ['lixeira'] },
  { slug: 'lixeira', cat: 'Murais e cards', title: 'Lixeira: recuperar cards excluídos', sum: 'Card excluído fica 30 dias na lixeira do mural e volta com checklists, comentários, etiquetas e campos.',
    steps: [
      { t: 'Abra a lixeira', d: 'No topo do mural, abra Configurar › Arquivados e lixeira e escolha a aba "Lixeira".' },
      { t: 'Restaure', d: 'Clique em restaurar: o card volta com o mesmo número e tudo o que tinha.' },
      { t: 'Excluir de vez', d: 'O dono ou administrador do mural (ou quem excluiu) pode apagar definitivamente. Depois de 30 dias isso acontece sozinho.' },
    ], rel: ['arquivar'] },
  { slug: 'acoes-em-massa', cat: 'Murais e cards', title: 'Alterar vários cards de uma vez', sum: 'Na Lista, selecione vários cards e mude coluna, responsável, prazo ou prioridade, ou exclua.',
    steps: [
      { t: 'Abra a Lista', d: 'Na barra de baixo do mural, escolha "Lista".' },
      { t: 'Selecione', d: 'Marque a caixa à esquerda de cada card, ou a do cabeçalho para todos os que estão no filtro.' },
      { t: 'Aplique', d: 'Use Mover para, Responsável, Prazo, Prioridade ou Excluir. Cards controlados por uma War Room ficam de fora.' },
    ], rel: ['lista'] },
  { slug: 'atalhos', cat: 'Murais e cards', title: 'Atalhos de teclado', sum: 'Trabalhe mais rápido no mural sem tirar a mão do teclado.',
    steps: [
      { t: 'No mural', d: 'N cria um card na primeira coluna; F ou / vai para a pesquisa; 1 a 6 trocam a visão (Quadro, Lista, Calendário, Linha do tempo, Carga, Relatórios); ? mostra a lista de atalhos.' },
      { t: 'Em qualquer tela', d: 'Ctrl+K abre a busca geral; Ctrl+Shift+F liga o modo foco; Ctrl+Shift+E troca de aba no modo foco.' },
    ], rel: ['busca-geral'] },
  { slug: 'aprovacao', cat: 'Organização avançada', title: 'Pedir aprovação em um card', sum: 'Peça o "ok" de alguém antes de seguir; ao aprovar ou recusar, o card pode mudar de coluna sozinho.',
    steps: [
      { t: 'Peça a aprovação', d: 'Abra o card, clique em "Mais" › "Aprovação", escolha quem aprova, escreva uma mensagem e, se quiser, as colunas para onde o card vai ao aprovar ou recusar.' },
      { t: 'Quem aprova é avisado', d: 'A pessoa recebe a notificação e vê os botões Aprovar e Recusar dentro do card. O quadro mostra o selo "Aprovação" enquanto espera.' },
      { t: 'Decisão registrada', d: 'Quem pediu é avisado do resultado e o histórico fica no card.' },
    ], rel: ['automacoes'] },

  // ───────── Visualizações (extras)
  { slug: 'visao-geral', cat: 'Visualizações', title: 'Visão geral de todos os murais', sum: 'O andamento de todos os murais lado a lado e os atrasados de todos eles em uma lista.',
    steps: [
      { t: 'Abra a visão geral', d: 'Na lista de murais, clique em "Visão geral".' },
      { t: 'Compare', d: 'Cada linha mostra progresso, em aberto, atrasados, vencem em 7 dias, concluídos em 30 dias e a situação. Clique no título de uma coluna para ordenar.' },
      { t: 'Ataque os atrasados', d: 'Embaixo ficam os cards atrasados de todos os murais, do mais antigo para o mais novo. Clique para abrir.' },
    ], rel: ['relatorios'] },
  { slug: 'planejador', cat: 'Visualizações', title: 'Planejador do dia', sum: 'Um painel ao lado do mural com os cards do dia, para organizar a sua jornada.',
    steps: [
      { t: 'Abra o planejador', d: 'Na barra de baixo do mural, clique em "Planejador".' },
      { t: 'Acompanhe o dia', d: 'Os cards com prazo para hoje aparecem no painel; abra qualquer um com um clique.' },
    ], rel: ['cards'] },

  // ───────── Organização avançada (extras)
  { slug: 'modo-operacao', cat: 'Organização avançada', title: 'Modo Operação', sum: 'Reorganiza o mural de uma vez: ordena as colunas e sobe a prioridade de quem está com prazo vencido ou perto de vencer.',
    steps: [
      { t: 'Abra o Modo Operação', d: 'No topo do mural, abra o menu Organizar e escolha "Modo Operação".' },
      { t: 'Escolha os critérios', d: 'Prioridade, prazo e urgência. O painel mostra antes quantos cards vão mudar de lugar e quais vão subir de prioridade.' },
      { t: 'Aplique', d: 'Confirme para reorganizar. Bom para começar o dia ou a semana com o quadro em ordem.' },
    ], rel: ['score'] },
  { slug: 'score', cat: 'Organização avançada', title: 'Score da equipe no mural', sum: 'Pontuação mensal de cada pessoa pelos cards entregues no prazo e com atraso.',
    steps: [
      { t: 'Abra o Score', d: 'No topo do mural, abra o menu Acompanhar e escolha "Score".' },
      { t: 'Leia a pontuação', d: 'Cada membro aparece com os cards concluídos no mês, no prazo e com atraso, e a evolução mês a mês.' },
    ], rel: ['relatorios', 'equipes'] },
  { slug: 'notificacoes', cat: 'Conta e segurança', title: 'Notificações, lembretes e resumo do dia', sum: 'O sino reúne mensagens, avisos e avisos de cards; no PC, um resumo do dia mostra o que vence hoje.',
    steps: [
      { t: 'Sino do topo', d: 'Mostra mensagens não lidas, avisos novos e avisos dos seus cards. Clique para abrir.' },
      { t: 'Resumo do dia', d: 'No computador, uma vez por dia, aparece "Seu dia": cards atrasados, que vencem hoje, aprovações para você e a agenda. Desligue em "Não mostrar automaticamente".' },
      { t: 'No celular', d: 'O app avisa mensagens, menções, War Room e lembretes de reunião, mesmo fechado.' },
    ], rel: ['lembretes', 'celular'] },
  { slug: 'lembretes', cat: 'Organização avançada', title: 'Lembretes de prazo', sum: 'O responsável é avisado antes do vencimento (pelo lembrete do card) e quando o card atrasa.',
    steps: [
      { t: 'Defina o lembrete', d: 'No card, em "Datas", escolha o lembrete (ex.: 1 hora ou 1 dia antes).' },
      { t: 'Receba o aviso', d: 'O responsável e os demais membros do card recebem "Prazo chegando" e, se passar do prazo, "Card atrasado". Clique no aviso para abrir o card.' },
    ], rel: ['notificacoes'] },

  // ───────── Receber e compartilhar (extras)
  { slug: 'membros-mural', cat: 'Receber e compartilhar', title: 'Membros e convite para o mural', sum: 'Escolha quem participa do mural e convide colegas por link.',
    steps: [
      { t: 'Abra os membros', d: 'No topo do mural, clique no ícone de pessoas para ver e gerenciar os membros.' },
      { t: 'Convide por link', d: 'Em "Compartilhar quadro", copie o convite. O colega da empresa que abrir o link entra no mural.' },
    ], rel: ['convidados'] },

  // ───────── Agenda e reuniões
  { slug: 'calendario-eventos', cat: 'Agenda e reuniões', title: 'Calendário: eventos e reuniões', sum: 'Marque compromissos e reuniões com participantes, lembrete e local (chamada do ewvon, Teams/Meet/Zoom, sala reservada ou presencial), e veja junto os prazos dos seus cards.',
    steps: [
      { t: 'Abra o Calendário', d: 'Escolha a visão de Mês, Semana ou Dia no topo.' },
      { t: 'Crie um evento', d: 'Clique em um dia ou horário, preencha título, horário, participantes, cor e lembrete.' },
      { t: 'Marque uma reunião', d: 'Em "Onde vai ser", escolha chamada de vídeo pelo ewvon (todos entram pelo botão "Entrar na chamada"), link externo do Teams, Meet ou Zoom, uma sala de reunião (salas ocupadas no horário aparecem como "Ocupada" e a sala é reservada junto) ou um local presencial.' },
      { t: 'Veja seus prazos', d: 'Os cards com prazo aparecem junto com os eventos.' },
    ], rel: ['relatorio-dia', 'agenda', 'salas-reuniao'] },
  { slug: 'relatorio-dia', cat: 'Agenda e reuniões', title: 'Relatório do dia (PDF)', sum: 'Um relatório em A4 com os compromissos e cards do dia, pronto para imprimir.',
    steps: [
      { t: 'Escolha o dia', d: 'No Calendário, abra o dia desejado.' },
      { t: 'Gere o relatório', d: 'Clique no botão de relatório do dia. A página abre pronta para imprimir ou salvar em PDF.' },
    ], rel: ['calendario-eventos'] },
  { slug: 'salas-reuniao', cat: 'Agenda e reuniões', title: 'Salas de reunião', sum: 'Reserve salas por horário, convide participantes e veja quem está em reunião.',
    steps: [
      { t: 'Escolha a sala', d: 'Em Salas de reunião, veja as salas, a capacidade e a agenda de cada uma.' },
      { t: 'Reserve', d: 'Escolha um horário livre, dê um título e convide os participantes.' },
      { t: 'Status automático', d: 'Durante a reserva, o status dos participantes muda para "Em reunião" sozinho e volta ao terminar (sem sobrescrever um status escolhido à mão).' },
    ], rel: ['calendario-eventos'] },

  // ───────── Avisos e celebrações
  { slug: 'avisos', cat: 'Avisos e celebrações', title: 'Avisos gerais', sum: 'Comunicados oficiais com fixação, agendamento, data de término, fotos, vídeos, enquete e contagem de leitura.',
    steps: [
      { t: 'Publique', d: 'Em Avisos, clique em "Novo aviso". Administradores e quem tem a permissão "Postar avisos" podem publicar.' },
      { t: 'Organize', d: 'Fixe no topo, agende para começar depois e defina quando deixa de valer. Os avisos ficam separados em Ativos, Agendados e Expirados.' },
      { t: 'Fotos, vídeos e enquete', d: 'No computador ou no celular, anexe até 6 fotos ou vídeos e, se quiser, uma enquete. Quem abre o aviso vê a galeria (as fotos ampliam com um clique) e vota na hora. As fotos e vídeos são apagados automaticamente quando o aviso expira ou é excluído.' },
      { t: 'Acompanhe', d: 'Veja quantas pessoas leram, reative um aviso expirado e exporte a lista em CSV.' },
    ], rel: ['aniversariantes', 'comunicados'] },
  { slug: 'aniversariantes', cat: 'Avisos e celebrações', title: 'Aniversariantes', sum: 'Lista e calendário dos aniversários, com relatório em PDF para a gestão.',
    steps: [
      { t: 'Veja os próximos', d: 'Em Aniversariantes, a lista mostra os próximos aniversários com nome e setor, e o calendário do mês.' },
      { t: 'Relatório (gestão)', d: 'Quem gerencia gera o PDF do mês com a marca da empresa e um QR Code com link curto.' },
      { t: 'No dia', d: 'O aniversariante recebe uma comemoração ao entrar e, no app Android, uma saudação e um ícone especial.' },
    ], rel: ['avisos'] },
  { slug: 'comunicados', cat: 'Avisos e celebrações', title: 'Comunicados automáticos e eventos do mês', sum: 'O remetente "Comunicados" entrega mensagens automáticas: feedback mensal, alertas de equipe e avisos de experiência.',
    steps: [
      { t: 'Onde aparecem', d: 'No Chat, na conversa "Comunicados". Ali chegam o relatório mensal em PDF de cada pessoa, os resumos de alertas da equipe e os avisos de fim de experiência.' },
      { t: 'Eventos do mês', d: 'Em datas especiais, a tela ganha efeitos sazonais. O histórico de campanhas fica em "Eventos Mensais".' },
    ], rel: ['avisos', 'alertas-equipe'] },

  // ───────── War Room
  { slug: 'war-room', cat: 'War Room', title: 'Abrir uma War Room (sala de crise)', sum: 'Para incidentes urgentes: convoque as pessoas com alerta até confirmarem e coordene tudo em uma sala só.',
    steps: [
      { t: 'Crie a sala', d: 'Em War Room, clique em nova sala: título, descrição, meta (prazo) e quem será convocado. Requer a permissão "Criar War Room".' },
      { t: 'Convocação com alerta', d: 'Cada convocado recebe um alerta como uma ligação no celular (e um aviso no computador) até tocar em "Ciente".' },
      { t: 'Ligue a um card', d: 'Escolha mural e coluna para criar o card de emergência. Enquanto a sala está ativa, o card fica travado e o checklist espelha a linha do tempo.' },
    ], rel: ['war-room-timeline'] },
  { slug: 'war-room-timeline', cat: 'War Room', title: 'Linha do tempo, chat e encerramento', sum: 'Ações com responsável e duração, conversa da sala e encerramento que conclui o card.',
    steps: [
      { t: 'Linha do tempo', d: 'Adicione ações com título, responsável e duração. Marcar uma ação conclui o item do card, e vice-versa. A primeira pendente aparece como "Em andamento".' },
      { t: 'Converse', d: 'O chat da sala reúne a comunicação do incidente. Descrição e convocados ficam em "Informações".' },
      { t: 'Encerre', d: 'Ao encerrar, o card de emergência vai para a coluna de conclusão, com a data e se foi no prazo.' },
    ], rel: ['war-room'] },

  // ───────── Pessoas e equipes
  { slug: 'equipes', cat: 'Pessoas e equipes', title: 'Gestão de Pessoas: equipes e indicadores', sum: 'Monte equipes e acompanhe tarefas, mensagens, interações e score de cada pessoa.',
    steps: [
      { t: 'Crie a equipe', d: 'Em Gestão de Pessoas, use "Nova equipe" e adicione colaboradores.' },
      { t: 'Acompanhe', d: 'A aba Equipe mostra, por pessoa: tarefas, concluídas, mensagens, interações, score e última atividade. Atividades mostra a linha do tempo dia a dia.' },
      { t: 'Relatórios e Score', d: 'Relatórios compara períodos (7, 30 ou 90 dias) e exporta PDF; Score mostra o pódio da equipe.' },
    ], rel: ['alertas-equipe', 'meu-painel'] },
  { slug: 'alertas-equipe', cat: 'Pessoas e equipes', title: 'Alertas da equipe', sum: 'Avisos automáticos de cards atrasados, prazos em risco, cards parados e sobrecarga.',
    steps: [
      { t: 'Ligue os alertas', d: 'Na equipe, abra Alertas e escolha os tipos, os dias da semana e os horários.' },
      { t: 'Receba o resumo', d: 'Marque o envio pelo chat para o supervisor receber um resumo em "Comunicados".' },
    ], rel: ['equipes'] },
  { slug: 'meu-painel', cat: 'Pessoas e equipes', title: 'Meu Painel', sum: 'As suas métricas pessoais de trabalho em uma tela.',
    steps: [
      { t: 'Abra o painel', d: 'No topo, abra "Meu Painel" para ver seus números de tarefas e atividade.' },
      { t: 'Relatório mensal', d: 'Todo mês você recebe em "Comunicados" um PDF com seus indicadores, evolução semanal e recomendações.' },
    ], rel: ['equipes'] },

  // ───────── Avaliações
  { slug: 'avaliacoes', cat: 'Avaliações', title: 'Avaliações de experiência e de desempenho', sum: 'Experiência de 45 e 90 dias, desempenho e desenvolvimento, feitas pelo supervisor da equipe.',
    steps: [
      { t: 'Quem avalia', d: 'O supervisor de uma equipe avalia as pessoas da equipe. Em Avaliações, a aba Equipe lista quem pode ser avaliado e o progresso da experiência.' },
      { t: 'Experiência', d: 'Há uma avaliação de 45 dias e uma de 90 dias por pessoa; a de 90 dias mostra a evolução em cada critério. Dez dias antes do fim de cada período os gestores são avisados.' },
      { t: 'Desempenho e desenvolvimento', d: 'Escolha os critérios de desenvolvimento que entram em cada avaliação.' },
      { t: 'PDF validável', d: 'Cada avaliação gera um PDF com a marca da empresa, número, chave e QR Code para conferir a autenticidade, sem expor dados pessoais.' },
    ], rel: ['criterios-avaliacao'] },
  { slug: 'criterios-avaliacao', cat: 'Avaliações', title: 'Critérios de avaliação', sum: 'Ajuste os critérios do formulário de experiência e de desenvolvimento.',
    steps: [
      { t: 'Abra Critérios', d: 'Em Avaliações, aba Critérios. O modelo de experiência é cadastrado pelo administrador da empresa.' },
      { t: 'Desenvolvimento', d: 'Supervisores podem editar os critérios de desenvolvimento e agrupá-los.' },
    ], rel: ['avaliacoes'] },

  // ───────── Anotações
  { slug: 'anotacoes', cat: 'Anotações', title: 'Anotações pessoais e compartilhadas', sum: 'Notas com cores, imagens e compartilhamento; várias pessoas podem editar ao mesmo tempo sem perder nada.',
    steps: [
      { t: 'Crie a nota', d: 'Em Anotações, crie uma nota, escolha cor, textura ou imagem e fixe as importantes.' },
      { t: 'Compartilhe', d: 'Dê acesso de edição ou só de visualização a colegas. Quem só visualiza vê "Somente visualização".' },
      { t: 'Edição ao mesmo tempo', d: 'Se duas pessoas editarem juntas, o ewvon junta as alterações em vez de sobrescrever.' },
      { t: 'Janela flutuante', d: 'Abra a nota em uma janela flutuante para consultar enquanto usa outras telas.' },
    ], rel: [] },

  // ───────── Dash 3D
  { slug: 'dash-3d', cat: 'Dash 3D', title: 'Dash 3D: o escritório da equipe em 3D', sum: 'Veja onde cada pessoa está, o status de cada uma e os indicadores no telão, andar por andar.',
    steps: [
      { t: 'Abra o Dash', d: 'No topo, troque de "Sistema" para "Dash". Requer a permissão Dash e o módulo no plano.' },
      { t: 'Navegue', d: 'Gire e aproxime com o mouse ou o dedo; troque de andar pelo seletor. As pessoas aparecem nas mesas, em reunião ou no almoço conforme o status.' },
      { t: 'Telão e informações', d: 'O telão mostra indicadores escolhidos em "Informações" (como turnover e absenteísmo, quando o sistema de RH fornece os dados). O "?" explica cada fórmula.' },
      { t: 'Configure', d: 'Em "Configurar escritório" ajuste tamanho, andares, aparência e logotipo; gere relatórios em PDF.' },
    ], rel: ['dash-passeio', 'integracoes-rh'] },
  { slug: 'dash-passeio', cat: 'Dash 3D', title: 'Passeio em primeira pessoa', sum: 'Caminhe pelo escritório, pegue o elevador e encontre qualquer colega.',
    steps: [
      { t: 'Comece o passeio', d: 'Clique em "Passear". No computador ande com WASD ou as setas (Shift corre); no celular use o joystick.' },
      { t: 'Elevador', d: 'Entre no elevador e escolha o andar pelos botões ou digitando o número.' },
      { t: 'Encontre alguém', d: 'Em "Pessoas", busque o colega: o passeio leva até ele. Mire em alguém para ver nome, cargo, setor e status.' },
    ], rel: ['dash-3d'] },

  // ───────── Integrações (extras)
  { slug: 'integracoes-rh', cat: 'Integrações', title: 'Conectar o sistema de RH', sum: 'Sincronize colaboradores do seu sistema de RH e importe as pessoas como usuários.',
    steps: [
      { t: 'Adicione o sistema', d: 'Em Integrações › RH e Pessoas, clique em "Adicionar sistema", escolha o seu e informe a chave de acesso. As chaves ficam criptografadas.' },
      { t: 'Sincronize', d: 'O cartão mostra quantos ativos e desligados foram lidos. Esses dados alimentam os indicadores do Dash.' },
      { t: 'Importe como usuários', d: 'Use "Importar como usuários" para criar logins para as pessoas ativas com e-mail, respeitando as vagas do plano. Elas entram por "Esqueci minha senha".' },
    ], rel: ['dash-3d', 'colaboradores'] },
  { slug: 'integracoes-mensagens', cat: 'Integrações', title: 'Slack, Microsoft Teams e WhatsApp', sum: 'Leve avisos, tarefas atribuídas e reuniões para os canais que a equipe já usa.',
    steps: [
      { t: 'Abra Integrações', d: 'Escolha Slack (link de Incoming Webhook), Microsoft Teams ou WhatsApp Business (token de acesso) e siga o passo a passo detalhado da tela.' },
      { t: 'Teste e use', d: 'Envie um teste. Depois disso, avisos, avisos importantes, tarefas atribuídas e reuniões são enviados automaticamente.' },
    ], rel: ['webhooks'] },
  { slug: 'integracoes-ia', cat: 'Integrações', title: 'Chave de IA para o EwvonAI', sum: 'O administrador cadastra a chave da IA da empresa para o assistente responder no chat.',
    steps: [
      { t: 'Cadastre a chave', d: 'Em Integrações, abra o cartão da IA e cole a chave da empresa. Ela fica criptografada.' },
      { t: 'Use no chat', d: 'Depois disso, qualquer pessoa chama o assistente com @ewvonai.' },
    ], rel: ['assistente-ia', 'integracoes-ia'] },

  // ───────── Administração
  { slug: 'colaboradores', cat: 'Administração', title: 'Cadastrar e gerenciar colaboradores', sum: 'Ficha completa de cada pessoa, com dados sensíveis criptografados.',
    steps: [
      { t: 'Abra Gerenciamento', d: 'À esquerda a lista de colaboradores; à direita a ficha: dados pessoais, contato, profissional, bancário, acesso e permissões.' },
      { t: 'Cadastre', d: 'Adicione nome, e-mail e setor. Os dados de admissão, documentos e salário ficam criptografados e preenchem as avaliações sozinhos.' },
      { t: 'Ative ou desative', d: 'Desative quem saiu da empresa sem apagar o histórico.' },
    ], tips: ['Gestores que não são administradores veem a ficha sem os dados financeiros e sem poder editar.'], rel: ['permissoes', 'setores', 'integracoes-rh'] },
  { slug: 'permissoes', cat: 'Administração', title: 'Permissões por pessoa', sum: 'Libere funções específicas sem dar acesso de administrador.',
    steps: [
      { t: 'Abra a ficha', d: 'Em Gerenciamento, escolha a pessoa e vá em Permissões.' },
      { t: 'Ligue o que precisa', d: 'Postar avisos, Criar War Room, Dash, Sala de reunião, Excluir mensagens, Alterar senhas e Gerenciamento. Só aparecem as que o plano da empresa inclui.' },
    ], rel: ['colaboradores'] },
  { slug: 'setores', cat: 'Administração', title: 'Setores da empresa', sum: 'Organize as pessoas em setores, cada um com cor, ícone, gestor e canal de chat.',
    steps: [
      { t: 'Crie o setor', d: 'Em Gestão de Setores, clique em novo setor: nome, descrição, cor, ícone e gestor.' },
      { t: 'Adicione pessoas', d: 'Inclua colaboradores; a mudança vale na hora. O setor Geral inclui todos automaticamente.' },
    ], rel: ['chat-conversas', 'colaboradores'] },
  { slug: 'pagamentos', cat: 'Administração', title: 'Plano, pagamentos e recibos', sum: 'Veja o plano, o uso, compre extras e baixe os recibos.',
    steps: [
      { t: 'Abra Pagamentos', d: 'Mostra o plano, a validade, o valor, o que está incluído e o uso (pessoas e armazenamento).' },
      { t: 'Extras e plano', d: 'Compre extras ou mude de plano; a diferença é calculada de forma proporcional.' },
      { t: 'Recibos', d: 'No histórico, baixe o recibo em PDF de cada pagamento ou exporte a lista.' },
    ], rel: [] },
  { slug: 'personalizacao', cat: 'Administração', title: 'Marca da empresa e atalhos do sistema', sum: 'Logotipo, cores e links rápidos no topo para toda a empresa.',
    steps: [
      { t: 'Marca', d: 'O logotipo e a cor da empresa aparecem no topo, nos botões, na aba do navegador e nos PDFs.' },
      { t: 'Atalhos do sistema', d: 'Em "Atalhos do Sistema", cadastre links que aparecem no topo para todos (por exemplo, sistemas internos).' },
    ], rel: ['aparencia'] },

  // ───────── Conta e segurança (extras)
  { slug: 'perfil', cat: 'Conta e segurança', title: 'Seu perfil e status', sum: 'Foto, capa, descrição, expediente e status (disponível, em reunião, almoço, ausente) com horário para terminar.',
    steps: [
      { t: 'Abra o perfil', d: 'Clique na sua foto no topo. Troque foto e capa, escreva uma descrição e informe o seu expediente.' },
      { t: 'Defina o status', d: 'Escolha o status e, se quiser, até quando ele vale. Os colegas veem no chat, no cartão de perfil e no Dash.' },
    ], rel: ['aparencia', 'privacidade'] },
  { slug: 'aparencia', cat: 'Conta e segurança', title: 'Aparência: temas claros e escuros', sum: 'Escolha o tema que preferir no computador e no celular.',
    steps: [
      { t: 'No computador', d: 'Clique na paleta no topo e escolha um tema claro ou escuro.' },
      { t: 'No celular', d: 'Vá em Perfil › Aparência.' },
    ], rel: ['perfil'] },
  { slug: 'privacidade', cat: 'Conta e segurança', title: 'Meus dados e privacidade (LGPD)', sum: 'Baixe uma cópia dos seus dados ou peça correção ou exclusão.',
    steps: [
      { t: 'Abra "Meus dados e privacidade"', d: 'No perfil (computador) ou em Perfil (celular).' },
      { t: 'Escolha', d: 'Exporte os seus dados ou registre um pedido de correção ou exclusão. Termos, privacidade e cookies ficam em ewvon.com/termos, /privacidade e /cookies.' },
    ], rel: ['seguranca', 'duas-etapas'] },

  // ── pacote 4 (os marcados com hidden dependem da migração 20261121010000 e entram no site quando ela for aplicada)
  { slug: 'criar-card-mensagem', cat: 'Chat e comunicação', title: 'Criar um card a partir de uma mensagem', sum: 'Transforme um pedido feito no chat em card, com o texto e os anexos, sem copiar e colar.',
    steps: [
      { t: 'Abra o menu da mensagem', d: 'Passe o mouse sobre a mensagem e clique nos três pontinhos (⋯) ao lado dela.' },
      { t: 'Escolha "Criar card"', d: 'Escolha o mural e a coluna. O título e a descrição já vêm preenchidos com a mensagem; ajuste prioridade e prazo se quiser.' },
      { t: 'Anexos e aviso', d: 'Os arquivos da mensagem são copiados para o card (a primeira imagem pode virar capa), e a conversa recebe um aviso com o card criado.' },
    ], rel: ['chat-conversas', 'detalhes-card'] },
  { slug: 'buscar-na-conversa', cat: 'Chat e comunicação', title: 'Buscar dentro de uma conversa', sum: 'Encontre uma mensagem antiga em uma conversa direta ou em grupo.',
    steps: [
      { t: 'Abra a busca', d: 'No topo da conversa, clique na lupa e digite pelo menos duas letras.' },
      { t: 'Vá até a mensagem', d: 'A busca procura no histórico inteiro. Clique no resultado para ir até a mensagem; se ela for antiga, role a conversa para cima para carregá-la.' },
    ], rel: ['busca-geral'] },
  { slug: 'resumo-conversa-ia', cat: 'Chat e comunicação', title: 'Resumo da conversa com IA', sum: 'O EwvonAI resume as últimas 24 horas, 3 ou 7 dias da conversa: assuntos, decisões e pendências com responsáveis.',
    who: 'Disponível quando a empresa cadastrou a chave da Claude em Integrações › EwvonAI.',
    steps: [
      { t: 'Abra o resumo', d: 'No topo da conversa (setor, direta ou grupo), clique no ícone de brilho.' },
      { t: 'Escolha o período', d: 'Últimas 24 h, 3 dias ou 7 dias, e clique em Resumir. O texto pode ser copiado.' },
      { t: 'Limite diário', d: 'Cada resumo conta no limite diário de pedidos de IA definido pelo administrador. A IA só lê conversas de que você participa.' },
    ], rel: ['assistente-ia', 'integracoes-ia'] },
  { slug: 'ia-no-mural', cat: 'Organização avançada', title: 'IA no mural: resumo e cards a partir de um texto', sum: 'Peça um resumo da situação do mural ou cole uma ata e receba os cards prontos para revisar.',
    who: 'Disponível quando a empresa cadastrou a chave da Claude em Integrações › EwvonAI.',
    steps: [
      { t: 'Resumo do mural', d: 'No topo do mural, abra Acompanhar › Resumo com IA: situação geral, cards em atenção, próximos prazos e sugestões.' },
      { t: 'Cards a partir de um texto', d: 'Abra Organizar › Criar cards de um texto, cole a ata, o e-mail ou a lista e clique em Sugerir cards.' },
      { t: 'Revise e crie', d: 'Ajuste título, coluna, prioridade, prazo e responsável de cada sugestão, desmarque o que não quiser e crie. Nada é criado sem a sua revisão.' },
    ], rel: ['automacoes', 'relatorios'] },
  { slug: 'exportar-excel', cat: 'Primeiros passos', title: 'Exportar para Excel ou CSV', sum: 'Leve as tabelas do sistema para uma planilha: cards da Lista, minhas tarefas, visão geral, relatórios, avaliações, pessoas e aniversariantes.',
    steps: [
      { t: 'Clique em Exportar', d: 'Nas telas com tabela, use o botão Exportar.' },
      { t: 'Escolha o formato', d: 'Excel (.xlsx) abre direto no Excel ou no Google Planilhas; CSV serve para outros sistemas. O arquivo leva o que está filtrado na tela.' },
    ], rel: ['lista', 'relatorios'] },
  { slug: 'organograma', cat: 'Pessoas e equipes', title: 'Organograma da empresa', sum: 'Veja os setores, quem é o gestor de cada um, as pessoas e as equipes supervisionadas.',
    steps: [
      { t: 'Abra o RH', d: 'No menu, abra RH e escolha Organograma.' },
      { t: 'Busque', d: 'Procure por nome de pessoa ou de setor. O gestor de cada setor é definido em Gestão de Setores.' },
    ], rel: ['setores', 'equipes'] },
  { slug: 'fixar-mensagens', cat: 'Chat e comunicação', title: 'Fixar mensagens no topo da conversa', sum: 'Deixe à vista o que todos precisam lembrar: regras, links, combinados.',
    steps: [
      { t: 'Fixe', d: 'No menu ⋯ da mensagem, escolha "Fixar no topo". Cada conversa guarda até 20 mensagens fixadas.' },
      { t: 'Navegue', d: 'A barra no topo mostra a última fixada; use as setas para ver as outras e clique para ir até a mensagem.' },
    ], rel: ['buscar-na-conversa'] },
  { slug: 'enquetes', cat: 'Chat e comunicação', title: 'Enquetes no chat e nos avisos', sum: 'Pergunte e veja o resultado na hora, com voto único ou múltiplo, aberto ou anônimo.',
    steps: [
      { t: 'Crie no chat', d: 'Na caixa de mensagem, clique em + › Criar enquete, escreva a pergunta e as opções (até 10).' },
      { t: 'Escolha as regras', d: 'Permita várias respostas, deixe os votos anônimos (só os totais aparecem) e defina quando encerra.' },
      { t: 'Nos avisos', d: 'Ao criar um aviso, ligue "Incluir enquete no aviso". Quem vê o aviso vota pelo computador ou pelo celular.' },
    ], rel: ['avisos'] },
  { slug: 'agendar-mensagem', cat: 'Chat e comunicação', title: 'Agendar mensagem', sum: 'Escreva agora e deixe a mensagem sair no dia e hora certos.',
    steps: [
      { t: 'Agende', d: 'Na caixa de mensagem, clique em + › Agendar mensagem, escreva e escolha o dia e a hora.' },
      { t: 'Acompanhe', d: 'Acima da caixa aparece quantas mensagens estão agendadas. Clique para ver, ou cancelar antes do envio.' },
    ], rel: ['fixar-mensagens'] },
  { slug: 'leitura-obrigatoria', cat: 'Avisos e celebrações', title: 'Leitura obrigatória e avisos para setores', sum: 'Peça "Li e concordo" em avisos importantes, veja quem ainda não confirmou e escolha quais setores recebem o aviso.',
    steps: [
      { t: 'Escolha o público', d: 'No formulário do aviso, em "Quem vê este aviso", deixe Todos os usuários ou marque os setores. Notificação e e-mail chegam só a eles.' },
      { t: 'Peça confirmação', d: 'Ligue "Exigir confirmação de leitura". Cada pessoa confirma com "Li e concordo", no computador ou no celular.' },
      { t: 'Acompanhe', d: 'No menu do aviso, abra "Confirmações de leitura" para ver quem confirmou e quem falta, e exportar a lista.' },
    ], rel: ['avisos', 'enquetes'] },
  { slug: 'link-agendamento', cat: 'Agenda e reuniões', title: 'Link público de agendamento', sum: 'Envie um link para clientes e parceiros escolherem um horário livre na sua agenda.',
    steps: [
      { t: 'Configure', d: 'No Calendário, clique em "Link de agendamento": dias da semana, horário, duração, intervalo, antecedência mínima e link da reunião on-line.' },
      { t: 'Compartilhe', d: 'Copie o link e envie. Só aparecem horários em que você não tem compromisso nem reserva de sala.' },
      { t: 'Receba', d: 'Cada agendamento entra no seu calendário e você recebe um aviso no sino. Pause o link quando quiser ou gere um novo.' },
    ], rel: ['agenda', 'salas-reuniao'] },
  { slug: 'pauta-ata', cat: 'Agenda e reuniões', title: 'Pauta e ata da reunião', sum: 'Prepare a pauta, registre a ata e transforme as ações combinadas em cards.',
    steps: [
      { t: 'Abra a pauta', d: 'No evento do Calendário ou na reserva da sala, clique em "Pauta e ata". Todos os participantes veem e editam.' },
      { t: 'Registre', d: 'Escreva a pauta antes e a ata durante ou depois da reunião. Adicione as ações com responsável e prazo.' },
      { t: 'Vire cards', d: 'Escolha o mural e a coluna e clique em "Criar cards": cada ação vira um card com responsável e prazo.' },
    ], rel: ['salas-reuniao', 'link-agendamento'] },
  { slug: 'checkin-sala', cat: 'Agenda e reuniões', title: 'Check-in na sala por QR Code', sum: 'Cole o QR Code na porta da sala e as pessoas confirmam presença na reunião pelo celular.',
    steps: [
      { t: 'Imprima o QR', d: 'Em Salas de reunião, abra a sala e clique em "QR de check-in" (administradores). Imprima e cole na porta.' },
      { t: 'Faça o check-in', d: 'Quem chega lê o código com o celular, entra com a conta da empresa e toca em "Fazer check-in". Abre 15 minutos antes do início.' },
    ], rel: ['salas-reuniao'] },
  { slug: 'ausencias', cat: 'Pessoas e equipes', title: 'Férias e ausências', sum: 'Peça férias, folga, atestado ou home office; o gestor aprova e todos veem o calendário da equipe.',
    steps: [
      { t: 'Peça', d: 'Em RH › Ausências, clique em "Solicitar ausência", escolha o tipo e o período.' },
      { t: 'Aprovação', d: 'O gestor da equipe ou do setor recebe um aviso e aprova ou recusa (com motivo). Você é avisado da resposta.' },
      { t: 'Calendário da equipe', d: 'As ausências aprovadas aparecem no calendário do mês. Colegas veem "Ausente"; gestores veem o tipo.' },
      { t: 'Cancele ou exclua', d: 'Você cancela um pedido pendente ou uma ausência aprovada que ainda não começou, e exclui pela lixeira os pedidos que não valem mais. Gestores e admins também podem excluir pedidos da equipe.' },
    ], rel: ['equipes', 'organograma'] },
  { slug: 'pesquisas-clima', cat: 'Pessoas e equipes', title: 'Pesquisas de clima e eNPS anônimas', sum: 'Meça o clima e a satisfação da equipe com respostas anônimas.',
    steps: [
      { t: 'Crie', d: 'Em RH › Pesquisas, gestores escolhem um modelo (eNPS ou Clima) ou começam em branco, escolhem os setores e a data de encerramento.' },
      { t: 'Abra', d: 'Ao abrir a pesquisa, o público recebe um aviso. As respostas não ficam ligadas à pessoa.' },
      { t: 'Resultados', d: 'Aparecem a partir de 3 respostas: eNPS, médias, distribuição e comentários. A divisão por setor só aparece com 5 respostas ou mais no setor.' },
    ], rel: ['ausencias'] },
  { slug: 'reunioes-1-1', cat: 'Pessoas e equipes', title: 'Reuniões 1:1', sum: 'Encontros recorrentes entre gestor e pessoa, com pauta conjunta, combinados e anotações privadas.',
    steps: [
      { t: 'Marque', d: 'Em RH › 1:1, o gestor clica em "Marcar 1:1", escolhe a pessoa, o horário, a duração e onde vai ser: chamada de vídeo pelo próprio ewvon, link externo (Teams, Meet, Zoom), sala de reunião (fica reservada no mesmo horário) ou presencial. A reunião vai para o calendário dos dois e a pessoa recebe um aviso.' },
      { t: 'Prepare a pauta', d: 'Os dois adicionam assuntos antes do encontro. Durante, registrem as anotações e os combinados com responsável.' },
      { t: 'Anotações privadas', d: 'Cada um tem um espaço que só ele vê. O histórico fica guardado por pessoa.' },
      { t: 'Entre, repita ou exclua', d: 'Na hora, "Entrar na chamada" ou "Entrar na reunião" aparece na lista. "Marcar próxima" agenda a seguinte com a mesma pessoa e o mesmo local, duas semanas depois. O gestor (ou um admin) exclui pela lixeira; a reunião do calendário e a reserva da sala saem junto.' },
    ], rel: ['metas', 'avaliacoes'] },
  { slug: 'reconhecimento', cat: 'Pessoas e equipes', title: 'Elogios e feedback', sum: 'Mural de elogios com os valores da empresa e feedback privado entre colegas.',
    steps: [
      { t: 'Elogie', d: 'Em RH › Reconhecimento, clique em "Elogiar alguém", escolha a pessoa e o valor. O elogio público vai para o mural e os colegas podem aplaudir.' },
      { t: 'Dê feedback', d: '"Dar feedback" é sempre privado: só vocês dois e os gestores da pessoa veem.' },
    ], rel: ['reunioes-1-1'] },
  { slug: 'metas', cat: 'Pessoas e equipes', title: 'Metas individuais', sum: 'Metas com prazo e progresso, definidas pela pessoa ou pelo gestor e consideradas na avaliação.',
    steps: [
      { t: 'Crie', d: 'Em RH › Metas, clique em "Nova meta": percentual, número (com alvo e unidade) ou feito/não feito, e o prazo. Gestores definem metas para a equipe.' },
      { t: 'Atualize', d: 'Informe o valor atual sempre que avançar. Cada atualização fica registrada.' },
      { t: 'Na avaliação', d: 'Ao avaliar alguém, marque as metas que entram na avaliação: o progresso daquele momento fica guardado com ela.' },
    ], rel: ['avaliacoes', 'reunioes-1-1'] },
  { slug: 'onboarding-automatico', cat: 'Pessoas e equipes', title: 'Onboarding automático', sum: 'Cada pessoa cadastrada ganha um mural de integração com as tarefas dos primeiros dias.', who: 'Administradores da empresa.',
    steps: [
      { t: 'Ligue', d: 'Em RH, ligue "Onboarding automático" (canto superior direito).' },
      { t: 'Cadastre', d: 'Ao cadastrar uma pessoa no Gerenciamento, o mural "Onboarding — Nome" é criado a partir do modelo de onboarding, com os cards atribuídos a ela.' },
    ], rel: ['modelos', 'colaboradores'] },
  { slug: 'base-de-conhecimento', cat: 'Anotações', title: 'Base de conhecimento', sum: 'Procedimentos, políticas e respostas para dúvidas frequentes, organizados por setor e com busca.',
    steps: [
      { t: 'Crie páginas', d: 'Em Base de conhecimento, clique em "Nova página" em Toda a empresa ou no seu setor. Páginas podem ter subpáginas.' },
      { t: 'Escreva', d: 'O texto salva sozinho. Cada edição importante vira uma versão no Histórico, que pode ser restaurada.' },
      { t: 'Controle o acesso', d: 'Em "Quem vê e quem edita", escolha se a página é da empresa toda ou só do setor e quem pode editar.' },
      { t: 'Busque', d: 'A busca procura no título e no texto de todas as páginas que você pode ver.' },
    ], rel: ['anotacoes'] },
  { slug: 'assinatura-de-email', cat: 'Chat e comunicação', title: 'Assinatura de e-mail padronizada', sum: 'A empresa cria os visuais da assinatura e cada pessoa copia a sua, já preenchida, para o Gmail ou o Outlook.',
    steps: [
      { t: 'Crie os visuais da empresa', d: 'Em Visuais de assinatura (no menu de quem tem acesso), clique em "Novo visual" e escolha um dos 31 estilos, separados por categoria: Corporativo, Moderno, Criativo, Minimalista (inclui o clássico em texto), Com chamada (botão com link) e Escuro. Ajuste cores principal, secundária, de fundo e do texto, o formato da foto e o da logo (redonda, quadrada arredondada, quadrada, hexágono, octógono, losango, folha ou a logo original), o que aparece (cargo, setor, telefones, e-mail, site, endereço, redes sociais, aviso legal) e, se quiser, uma marca d\'água (logo, imagem ou texto) no centro, à esquerda, à direita ou repetida em toda a assinatura, com transparência e tamanho.' },
      { t: 'Defina quem pode criar visuais', d: 'Administradores sempre podem. Para liberar outra pessoa, ligue "Criar visuais de assinatura" nas permissões dela em Gerenciamento.' },
      { t: 'Escolha o visual padrão', d: 'Marque "Visual padrão da empresa": ele é usado por quem ainda não escolheu outro.' },
      { t: 'Monte a sua assinatura', d: 'Abra Meu Perfil (sua foto no canto superior). Lá embaixo, em Assinatura de e-mail, aparece a prévia; em "Ajustar meus dados e o visual" confira nome, cargo, setor e telefones e salve.' },
      { t: 'Cole no seu e-mail', d: 'Clique em "Copiar assinatura" e cole nas configurações de assinatura do Gmail, do Outlook ou do Apple Mail. A tela mostra o caminho de cada um.' },
    ], tips: ['Os estilos com formas e marca d\'água viram uma imagem gerada pelo ewvon, para aparecerem iguais em qualquer programa de e-mail; telefones, e-mail, site, endereço, redes sociais, logo e botão de chamada continuam clicáveis, cada um com o próprio link. Nenhuma informação é cortada: textos longos ficam menores e um contato comprido ocupa a linha inteira.', 'Copie pelo computador: os aplicativos de e-mail do celular costumam aceitar só assinatura em texto simples.', 'Use logo em PNG, JPG ou GIF; alguns programas de e-mail não mostram outros formatos.'], who: 'Todos usam a própria assinatura; criar visuais é para administradores ou quem tem a permissão.' },
];

/** Published articles (hidden ones stay out of the site, the sitemap and the search). */
export const PUBLISHED = GUIDE.filter((a) => !a.hidden);
