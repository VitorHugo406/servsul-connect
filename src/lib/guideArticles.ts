// Content of the public guide center (/guia, /guia/<slug>). Each article: category, title, summary, numbered steps
// (text + optional screenshot in public/guia/<img>.jpg, captured from test mode with fictional data), tips and related
// articles. Only describe features that exist; update together with the feature. Screenshots: scratchpad script
// "guide-shots" (Playwright, test mode) — recapture when a screen changes.
export type GuideStep = { t: string; d: string; img?: string };
export type GuideArticle = { slug: string; cat: string; title: string; sum: string; steps: GuideStep[]; tips?: string[]; rel?: string[]; who?: string };

export const GUIDE_CATS = ['Primeiros passos', 'Murais e cards', 'Visualizações', 'Organização avançada', 'Receber e compartilhar', 'Integrações', 'Conta e segurança'];

export const GUIDE: GuideArticle[] = [
  { slug: 'criar-mural', cat: 'Primeiros passos', title: 'Criar um mural', sum: 'O mural é onde a equipe organiza o trabalho em colunas e cards. Crie do zero ou a partir de um modelo pronto.',
    steps: [
      { t: 'Abra Tarefas', d: 'No menu, clique no ícone de Tarefas. Você verá todos os murais que pode acessar, com capa, progresso e situação (em dia, atrasado ou concluído).', img: 'murais' },
      { t: 'Clique em "Novo mural"', d: 'Dê um nome, uma descrição opcional e escolha uma capa. O mural é criado com as colunas padrão, que você pode renomear depois.' },
      { t: 'Ou comece por um modelo', d: 'Clique em "Modelos" para ver 16 modelos prontos por área (RH, vendas e atendimento, marketing, operações, financeiro e projetos). Escolha um, ajuste o nome e clique em "Usar modelo".', img: 'modelos' },
    ], tips: ['Arraste os murais na lista (ordem "Minha ordem") para deixar os mais usados primeiro.', 'Já usa outra ferramenta? Veja "Importar do Trello, Asana ou ClickUp".'], rel: ['modelos', 'importar', 'cards'] },
  { slug: 'modelos', cat: 'Primeiros passos', title: 'Modelos de mural prontos', sum: 'Comece com colunas, etiquetas, campos personalizados, automações, dependências, formulário e cards de exemplo já montados para a sua área.',
    steps: [
      { t: 'Abra a galeria', d: 'Em Tarefas, clique em "Modelos". À esquerda ficam as áreas (Recursos Humanos, Vendas e atendimento, Marketing, Operações, Financeiro e compras, Projetos e tecnologia) e uma busca; no centro, os modelos; à direita, a prévia das colunas e tudo o que o modelo traz.', img: 'modelos' },
      { t: 'Escolha e dê um nome', d: 'Clique no modelo, ajuste o nome do mural no rodapé e clique em "Usar modelo". Os prazos e datas de início dos exemplos são calculados a partir de hoje.' },
      { t: 'O que já vem pronto', d: 'Conforme o modelo: campos personalizados (ex.: Valor, Origem e Probabilidade no funil de vendas) já preenchidos nos exemplos, automações (ex.: card novo ganha prazo, ao entrar em uma coluna vira prioridade Alta), dependências entre etapas (veja na Linha do tempo) e um formulário público (Trabalhe conosco, Abrir chamado, Pedido de compra, Pedido de manutenção...). O formulário começa pausado: revise e ative em Compartilhar › Formulário.' },
      { t: 'Edite à vontade', d: 'O mural é seu: apague os cards de exemplo, renomeie colunas, ajuste campos (ícone de campos no topo) e automações (raio no topo). Nada muda nos outros murais.', img: 'quadro' },
    ], rel: ['criar-mural', 'cards'] },
  { slug: 'cards', cat: 'Murais e cards', title: 'Criar, mover e concluir cards', sum: 'Cada tarefa é um card. Ele guarda responsável, prazo, prioridade, etiquetas, checklist, comentários e anexos.',
    steps: [
      { t: 'Crie um card', d: 'Em qualquer coluna, clique em "Adicionar um cartão", escreva o título e pressione Enter.', img: 'quadro' },
      { t: 'Abra o card para detalhar', d: 'Clique no card para definir datas, membros, etiquetas, checklist, descrição e comentários. Tudo fica registrado no histórico de atividade.', img: 'card' },
      { t: 'Mova arrastando', d: 'Arraste o card para outra coluna. As automações da coluna (responsável, capa, subtarefas) são aplicadas na hora.' },
      { t: 'Conclua', d: 'Passe o mouse no card e clique no círculo, ou mova para a coluna de conclusão. O ewvon registra se foi concluído no prazo ou com atraso.' },
    ], tips: ['Use "Minhas tarefas" para ver todos os seus cards de todos os murais.'], rel: ['minhas-tarefas', 'lista', 'cronometro'] },
  { slug: 'minhas-tarefas', cat: 'Murais e cards', title: 'Minhas tarefas', sum: 'Uma lista única com todos os cards em que você é responsável, de todos os murais, organizada por prazo.',
    steps: [
      { t: 'Abra "Minhas tarefas"', d: 'Na lista de murais, clique em "Minhas tarefas".' },
      { t: 'Veja o que é prioridade', d: 'Os cards aparecem em Atrasadas, Hoje, Próximos 7 dias, Depois e Sem prazo. Concluídas nos últimos 7 dias ficam no fim.', img: 'minhas' },
      { t: 'Filtre e abra', d: 'Busque pelo nome ou escolha um mural. Clique num card para abrir direto no mural dele.' },
    ], rel: ['cards', 'agenda'] },
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
      { t: 'Abra os campos do mural', d: 'No topo do mural, clique no ícone de "Campos personalizados" (controles deslizantes). Só o dono ou administrador do mural cria campos.', img: 'campos' },
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
      { t: 'Abra as automações', d: 'No topo do mural, clique no raio ⚡ e em "Nova regra SE → ENTÃO".', img: 'automacoes' },
      { t: 'Escolha o gatilho (SE)', d: 'Instantâneos (⚡): card criado, entrou numa coluna, concluído, responsável definido. Periódicos (⏱): prazo chegando, card parado, checklist completo, etiqueta urgente.' },
      { t: 'Escolha a ação (ENTÃO)', d: 'Notificar, definir responsável, adicionar etiqueta, definir prazo (hoje + N dias), mudar prioridade, mover de coluna ou gerar alerta. Clique em "Criar regra".' },
    ], tips: ['Exemplo: SE o card entrar em "Revisão", ENTÃO o responsável vira a pessoa que revisa e ela recebe um aviso.'], rel: ['formulario', 'webhooks'] },
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
  { slug: 'importar', cat: 'Receber e compartilhar', title: 'Importar do Trello, Asana ou ClickUp', sum: 'Traga seus quadros com colunas, cards, etiquetas, checklists, comentários e responsáveis.',
    steps: [
      { t: 'Exporte da outra ferramenta', d: 'Trello: Menu do quadro › Imprimir, exportar e compartilhar › Exportar como JSON. Asana/ClickUp ou planilhas: exporte em CSV.' },
      { t: 'Importe no ewvon', d: 'Em Tarefas, clique em "Importar", escolha o arquivo e confira o resumo (colunas, cards, etiquetas).', img: 'importar' },
      { t: 'Confirme', d: 'Clique em importar. Um mural novo é criado; responsáveis são ligados pelo e-mail ou nome dos colaboradores da empresa.' },
    ], rel: ['criar-mural'] },
  { slug: 'agenda', cat: 'Integrações', title: 'Prazos no Google Agenda, Outlook e iPhone', sum: 'Assine um link pessoal e veja seus prazos e reuniões na agenda do celular, com atualização automática.',
    steps: [
      { t: 'Gere o link', d: 'Em Calendário, clique em "Agenda no celular".', img: 'agenda' },
      { t: 'Adicione à sua agenda', d: 'Clique em Google Agenda, iPhone/Mac ou Outlook, ou copie o link e cole em "Adicionar calendário pela URL".' },
      { t: 'Pronto', d: 'Cards com prazo e reuniões aparecem e se atualizam sozinhos (o Google pode levar algumas horas). Se o link vazar, gere um novo.' },
    ], rel: ['minhas-tarefas'] },
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
];
