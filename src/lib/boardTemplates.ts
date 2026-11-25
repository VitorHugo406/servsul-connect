// Ready-made mural templates (Tarefas › Modelos), grouped by area. A template is created in two steps:
//  1. templateToBoard → ImpBoard → importBoard(): columns (the last "done-like" column becomes the conclusion column),
//     labels, cards with checklists, start/due dates relative to today.
//  2. applyTemplateExtras(): custom fields (+ values on the example cards), dependencies between example cards,
//     instant automation rules and, when the template has one, the public request form (paused until the owner
//     reviews it). Everything is created inside the NEW mural only.
import { supabase } from '@/integrations/supabase/client';
import type { ImpBoard, ImpCard } from '@/lib/boardImport';
import { DEPTS, DEPT_OF, isDept } from '@/lib/templateDepts';

type FType = 'text' | 'number' | 'money' | 'date' | 'select' | 'checkbox';
type TField = { n: string; t: FType; o?: string[]; card?: boolean };
type C = { t: string; d?: string; col: number; st?: number; due?: number; p?: ImpCard['priority']; l?: number[]; ck?: [string, string[]][]; f?: Record<string, string | number | boolean>; dep?: number[] };
type Rule = { when: 'created' | 'moved' | 'completed' | 'assigned'; col?: string; act: 'priority' | 'due' | 'notify' | 'move' | 'label'; val?: string | number; label: string };
type TForm = { title: string; intro: string; q: [string, 'text' | 'long' | 'email' | 'phone' | 'date' | 'select' | 'number', boolean, string[]?][]; col?: string; due?: number; prio?: ImpCard['priority']; thanks?: string };
export type BoardTemplate = {
  id: string; area: string; name: string; desc: string; icon: string; cover: string;
  columns: [string, string][]; labels: [string, string][]; fields?: TField[]; rules?: Rule[]; form?: TForm; cards: C[];
  /** Process models: the cards become templates in a "Modelo do processo" column (Duplicar todos os cards), with
   *  due/start offsets around the process final date = <ref> − lead days. refDay = the day the example cards use as
   *  the reference (their st/due are relative to today), title = field appended to each created card's title. */
  proc?: { ref: string; refDay: number; lead: number; q: string; title?: string };
  /** index of the conclusion column (overrides DONE_COL) */
  done?: number;
};

export const TEMPLATE_AREAS = ['Recursos Humanos', 'Departamento Pessoal', 'Segurança do trabalho', 'TI e proteção de dados', 'Vendas e atendimento', 'Suporte e atendimento técnico', 'Marketing', 'Operações', 'Financeiro e compras', 'Projetos e tecnologia', 'Gestão e administração', 'Resolução de problemas'];

const day = (n: number, h = 18) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const ymd = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const G = '#6b7280', B = '#3b82f6', Y = '#eab308', O = '#f97316', P = '#8b5cf6', GR = '#22c55e', R = '#ef4444', S = '#0ea5e9', PK = '#ec4899';

export const BOARD_TEMPLATES: BoardTemplate[] = [
  // ───────────────────────── Recursos Humanos
  {
    id: 'onboarding', area: 'Recursos Humanos', icon: 'user-plus', cover: 'cover-navy', name: 'Admissão e onboarding de colaborador',
    desc: 'O processo inteiro da contratação aos 90 dias, com cada área na sua etapa: DP (documentos, exame, contrato, eSocial, folha), RH (proposta e comunicação), DHO (integração, treinamentos e avaliações), TI (acessos e equipamentos) e gestor.',
    columns: [['Pré-admissão', G], ['Contratação e eSocial', Y], ['Primeira semana', B], ['Primeiros 30 dias', P], ['Experiência (45/90 dias)', O], ['Concluído', GR]],
    labels: [['DP', Y], ['RH', PK], ['DHO', P], ['TI', S], ['Gestor', O]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Cargo', t: 'text' }, { n: 'Data de admissão', t: 'date' }, { n: 'Tipo de contrato', t: 'select', o: ['Experiência 45+45', 'Experiência 90', 'Prazo indeterminado', 'Estágio', 'Temporário'] }, { n: 'Salário', t: 'money' }, { n: 'Modalidade', t: 'select', o: ['Presencial', 'Híbrido', 'Remoto'] }, { n: 'Gestor', t: 'text' }],
    rules: [{ when: 'moved', col: 'Primeira semana', act: 'priority', val: 'high', label: 'Ao entrar em "Primeira semana", prioridade Alta' }, { when: 'completed', act: 'notify', label: 'Ao concluir, avisar o responsável' }],
    proc: { ref: 'Data de admissão', refDay: 10, lead: 0, q: 'Quantos dias antes da data de admissão o processo deve ser adiantado? (0 = prazos contados a partir da admissão)', title: 'Colaborador' },
    cards: [
      { t: 'Carta proposta aceita e dados enviados ao DP', col: 0, st: 0, due: 1, p: 'high', l: [1], f: { Colaborador: 'Nova pessoa', Cargo: 'Analista', 'Data de admissão': ymd(10), 'Tipo de contrato': 'Experiência 45+45', Modalidade: 'Híbrido' }, ck: [['Proposta', ['Carta proposta assinada', 'Cargo, salário e data de início confirmados', 'Gestor e equipe definidos', 'Dados enviados ao DP']]] },
      { t: 'Receber e conferir os documentos', col: 0, st: 1, due: 4, p: 'high', l: [0], dep: [0], ck: [['Documentos', ['RG e CPF', 'Carteira de trabalho digital', 'Comprovante de residência', 'Título de eleitor', 'Certidão de casamento e de nascimento dos filhos (se houver)', 'Dados bancários ou PIX', 'Foto 3x4']]] },
      { t: 'Exame admissional (ASO)', col: 0, st: 1, due: 6, p: 'high', l: [0], dep: [0], d: 'O exame admissional é feito antes de a pessoa começar a trabalhar (NR-7).', ck: [['Exame', ['Agendar na clínica', 'Guia entregue ao candidato', 'ASO "apto" recebido']]] },
      { t: 'Contrato e termos assinados', col: 1, st: 5, due: 8, p: 'high', l: [0, 1], dep: [1], ck: [['Assinaturas', ['Contrato de trabalho (experiência)', 'Acordo de banco de horas ou compensação', 'Termo de confidencialidade e LGPD', 'Autorização de uso de imagem', 'Opção de vale-transporte', 'Ciência do código de conduta']]] },
      { t: 'Enviar a admissão ao eSocial (S-2200)', col: 1, st: 8, due: 9, p: 'urgent', l: [0], dep: [2, 3], d: 'O envio precisa acontecer até o dia anterior ao início das atividades.' },
      { t: 'Cadastrar folha, benefícios e ponto', col: 1, st: 8, due: 10, l: [0], dep: [3], ck: [['Cadastros', ['Sistema de folha', 'Vale-transporte', 'Vale-refeição ou alimentação', 'Plano de saúde e odontológico', 'Relógio ou aplicativo de ponto e escala']]] },
      { t: 'Criar acessos e e-mail', col: 1, st: 7, due: 9, l: [3], dep: [3], ck: [['Acessos', ['E-mail corporativo', 'Usuário no ewvon', 'Sistemas da área', 'VPN e Wi-Fi', 'Grupos e canais da equipe']]] },
      { t: 'Preparar estação e equipamentos', col: 1, st: 6, due: 9, l: [3], dep: [0], ck: [['Itens', ['Notebook configurado', 'Headset', 'Crachá', 'Mesa e cadeira']]] },
      { t: 'Planejar a integração e escolher o padrinho', col: 1, st: 5, due: 9, l: [2, 4], dep: [0], ck: [['Integração', ['Agenda da primeira semana', 'Padrinho ou madrinha', 'Kit de boas-vindas', 'Trilha de treinamentos da função']]] },
      { t: 'Dia 1: boas-vindas e integração', col: 2, st: 10, due: 10, p: 'high', l: [2, 4], dep: [4, 6, 7, 8], ck: [['Roteiro', ['Recepção e tour pela empresa', 'Cultura, missão e valores', 'Apresentar a equipe e o padrinho', 'Rotina e ferramentas', 'Almoço de boas-vindas']]] },
      { t: 'Treinamentos obrigatórios da função', col: 2, st: 10, due: 15, l: [2], dep: [9], ck: [['Treinamentos', ['Políticas internas e segurança da informação', 'Normas de segurança da função (NRs, se houver)', 'Sistemas da área']]] },
      { t: 'Definir metas e plano dos 30 dias', col: 2, st: 11, due: 13, l: [4], dep: [9] },
      { t: 'Conversa de acompanhamento (30 dias)', col: 3, st: 38, due: 40, l: [2, 4], dep: [11], ck: [['Conversa', ['Adaptação à equipe e à rotina', 'Dificuldades e treinamentos que faltam', 'Andamento das metas']]] },
      { t: 'Pesquisa de onboarding com o colaborador', col: 3, st: 40, due: 42, l: [2], dep: [12], ck: [['Perguntas', ['Recebeu tudo o que precisava no primeiro dia?', 'A integração ajudou?', 'O que poderia ser melhor?']]] },
      { t: 'Avaliação de experiência — 45 dias', col: 4, st: 50, due: 53, p: 'high', l: [2, 4], dep: [12], d: 'Decida se prorroga ou encerra antes do 45º dia (CLT arts. 445 e 451).', ck: [['Avaliação', ['Entregas e qualidade', 'Comportamento e integração', 'Pontos a melhorar', 'Decisão: prorrogar ou encerrar']]] },
      { t: 'Formalizar a decisão do 45º dia', col: 4, st: 53, due: 54, p: 'high', l: [0], dep: [14], ck: [['DP', ['Termo de prorrogação assinado (se prorrogar)', 'Rescisão por término de contrato (se encerrar no prazo)', 'Sistema da folha atualizado']]] },
      { t: 'Avaliação de 90 dias e efetivação', col: 4, st: 95, due: 98, p: 'high', l: [2, 4, 0], dep: [15], d: 'O contrato de experiência dura no máximo 90 dias; sem decisão no prazo, ele vira contrato por tempo indeterminado.', ck: [['Efetivação', ['Avaliação final do gestor', 'Comunicar o resultado ao colaborador', 'DP: atualizar o contrato e liberar benefícios pós-experiência', 'Plano de desenvolvimento (PDI) do primeiro ano']]] },
    ],
  },
  {
    id: 'offboarding', area: 'Recursos Humanos', icon: 'user-minus', cover: 'cover-purple', name: 'Desligamento e rescisão', done: 5,
    desc: 'A saída inteira, com cada área na sua etapa: RH (comunicação e entrevista), DP (verbas, exame demissional, pagamento em 10 dias, eSocial, FGTS e seguro-desemprego), TI (acessos e equipamentos) e gestor (passagem do trabalho).',
    columns: [['Comunicado', G], ['Passagem e cálculo', B], ['Último dia', O], ['Pagamento e eSocial', P], ['Pós-desligamento', Y], ['Encerrado', GR]],
    labels: [['DP', Y], ['RH', PK], ['DHO', P], ['TI', S], ['Gestor', O], ['Financeiro', GR]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Último dia', t: 'date' }, { n: 'Tipo de desligamento', t: 'select', o: ['Pedido de demissão', 'Sem justa causa', 'Justa causa', 'Acordo (art. 484-A)', 'Término de experiência', 'Término de contrato'] }, { n: 'Aviso prévio', t: 'select', o: ['Trabalhado', 'Indenizado', 'Dispensado'] }, { n: 'Gestor', t: 'text' }],
    proc: { ref: 'Último dia', refDay: 10, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do último dia)', title: 'Colaborador' },
    rules: [{ when: 'moved', col: 'Último dia', act: 'priority', val: 'urgent', label: 'Ao entrar em "Último dia", prioridade Urgente' }],
    cards: [
      { t: 'Registrar o desligamento e o aviso prévio', col: 0, st: 0, due: 1, p: 'high', l: [0, 4], f: { Colaborador: 'Pessoa que sai', 'Último dia': ymd(10), 'Tipo de desligamento': 'Sem justa causa', 'Aviso prévio': 'Trabalhado' }, ck: [['Registro', ['Carta de pedido de demissão ou comunicado de dispensa assinado', 'Tipo de desligamento e aviso prévio definidos', 'Último dia confirmado', 'Estabilidades conferidas (gestante, acidente, CIPA)']]] },
      { t: 'Comunicar a equipe e os clientes', col: 0, st: 1, due: 2, l: [1, 4], dep: [0], d: 'Combine com a pessoa o que será dito. Nunca comente o motivo do desligamento com a equipe.' },
      { t: 'Passar as responsabilidades e o conhecimento', col: 1, st: 1, due: 8, l: [4], dep: [0], ck: [['Passagem', ['Atividades em andamento e quem assume cada uma', 'Documentar os processos que só ela fazia', 'Contatos de clientes e fornecedores', 'Arquivos movidos para pastas da empresa']]] },
      { t: 'Calcular as verbas rescisórias', col: 1, st: 3, due: 8, p: 'high', l: [0], dep: [0], ck: [['Verbas', ['Saldo de salário', 'Aviso prévio (trabalhado ou indenizado)', 'Férias vencidas e proporcionais + 1/3', '13º proporcional', 'Multa do FGTS (quando houver)', 'Descontos (adiantamentos, faltas, vale-transporte)']]] },
      { t: 'Agendar o exame demissional', col: 1, st: 3, due: 9, l: [0], dep: [0], d: 'Feito em até 10 dias após o fim do contrato; pode ser dispensado se o último exame for recente, conforme a NR-7.' },
      { t: 'Entrevista de desligamento', col: 2, st: 9, due: 10, l: [2], dep: [0], ck: [['Perguntas', ['Motivo real da saída', 'O que funcionou bem', 'O que pode melhorar (liderança, salário, carreira, clima)', 'Indicaria a empresa?']]] },
      { t: 'Devolução de equipamentos', col: 2, st: 9, due: 10, l: [3], dep: [0], ck: [['Itens', ['Notebook e carregador', 'Celular corporativo', 'Crachá e chaves', 'Uniforme e EPIs', 'Cartão corporativo']]] },
      { t: 'Bloquear os acessos no último dia', col: 2, st: 10, due: 10, p: 'urgent', l: [3], dep: [2], ck: [['Acessos', ['E-mail (redirecionar para o gestor)', 'ewvon', 'Sistemas internos e VPN', 'Trocar senhas de contas compartilhadas', 'Remover de grupos e canais']]] },
      { t: 'Pagar a rescisão', col: 3, st: 10, due: 20, p: 'urgent', l: [0, 5], dep: [3], d: 'Prazo legal: até 10 dias corridos após o término do contrato (CLT art. 477, § 6º). Atraso gera multa de um salário.' },
      { t: 'eSocial, FGTS e seguro-desemprego', col: 3, st: 10, due: 20, p: 'high', l: [0], dep: [3], ck: [['Encerramento', ['Desligamento no eSocial (S-2299)', 'Guia do FGTS rescisório', 'Comunicação para o seguro-desemprego (quando houver direito)', 'Baixa na carteira de trabalho digital', 'Termo de quitação assinado']]] },
      { t: 'Excluir benefícios e fechar pendências', col: 4, st: 10, due: 15, l: [0, 5], dep: [0], ck: [['Pendências', ['Plano de saúde (informar direito de permanência, Lei 9.656 arts. 30/31)', 'Vale-refeição e alimentação', 'Consignado e empréstimos', 'Reembolsos em aberto']]] },
      { t: 'Analisar o motivo da saída (DHO)', col: 4, st: 20, due: 25, l: [2], dep: [5], d: 'Junte as respostas das entrevistas para o plano contra rotatividade.' },
    ],
  },
  {
    id: 'recrutamento', area: 'Recursos Humanos', icon: 'user-search', cover: 'cover-purple', name: 'Recrutamento e seleção', done: 4,
    desc: 'Uma vaga do começo ao fim: perfil com o gestor, divulgação, triagem, entrevistas, teste, referências, proposta e retorno a todos. Os candidatos entram pelo formulário público.',
    columns: [['Vaga aberta', G], ['Triagem', B], ['Entrevistas', P], ['Proposta', O], ['Contratado', GR], ['Não seguiu', R]],
    labels: [['RH', PK], ['Gestor', O], ['Teste técnico', S], ['Banco de talentos', Y]],
    fields: [{ n: 'Vaga', t: 'text', card: true }, { n: 'Abertura da vaga', t: 'date' }, { n: 'Pretensão', t: 'money' }, { n: 'Origem', t: 'select', o: ['Site', 'Indicação', 'LinkedIn', 'Sites de vagas', 'Agência', 'Outro'] }],
    proc: { ref: 'Abertura da vaga', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da abertura da vaga)', title: 'Vaga' },
    rules: [{ when: 'created', act: 'due', val: 3, label: 'Nova candidatura: triagem em até 3 dias' }, { when: 'moved', col: 'Proposta', act: 'priority', val: 'high', label: 'Em "Proposta", prioridade Alta' }],
    form: { title: 'Trabalhe conosco', intro: 'Candidate-se à vaga. Responderemos a todos que participarem das entrevistas.', col: 'Triagem', due: 3, q: [['Seu nome', 'text', true], ['Vaga de interesse', 'text', true], ['E-mail', 'email', true], ['Telefone', 'phone', true], ['Link do currículo ou LinkedIn', 'text', true], ['Pretensão salarial (R$)', 'number', false], ['Por que você quer trabalhar aqui?', 'long', false]] },
    cards: [
      { t: 'Definir o perfil da vaga com o gestor', col: 0, st: 0, due: 2, p: 'high', l: [0, 1], f: { Vaga: 'Analista financeiro', 'Abertura da vaga': ymd(0) }, ck: [['Perfil', ['Responsabilidades', 'Requisitos obrigatórios e desejáveis', 'Faixa salarial e benefícios', 'Modelo de trabalho', 'Orçamento aprovado']]] },
      { t: 'Divulgar a vaga', col: 0, st: 2, due: 4, l: [0], dep: [0], d: 'O anúncio não pode ter exigências discriminatórias (sexo, idade, estado civil, aparência — Lei 9.029/1995).', ck: [['Divulgação', ['Site e redes da empresa', 'Indicação interna', 'Sites de vagas', 'Banco de talentos']]] },
      { t: 'Triagem dos currículos', col: 1, st: 4, due: 9, l: [0], dep: [1], ck: [['Triagem', ['Requisitos obrigatórios', 'Pretensão salarial', 'Disponibilidade', 'Separar os melhores']]] },
      { t: 'Entrevistas com o RH', col: 2, st: 9, due: 14, l: [0], dep: [2], ck: [['Entrevista', ['Mesmo roteiro de perguntas para todos', 'Comportamento e motivação', 'Anotar as impressões logo depois']]] },
      { t: 'Teste técnico ou case', col: 2, st: 12, due: 16, l: [2], dep: [2] },
      { t: 'Entrevista final com o gestor', col: 2, st: 16, due: 19, p: 'high', l: [1], dep: [3, 4] },
      { t: 'Checar referências', col: 3, st: 19, due: 21, l: [0], dep: [5] },
      { t: 'Proposta e aceite', col: 3, st: 21, due: 23, p: 'high', l: [0, 1], dep: [6], ck: [['Proposta', ['Carta proposta', 'Data de início', 'Aceite por escrito', 'Abrir o mural de Admissão e onboarding']]] },
      { t: 'Dar retorno a todos os candidatos', col: 3, st: 23, due: 25, l: [0, 3], dep: [7], d: 'Guarde no banco de talentos quem pode servir para outras vagas, com o consentimento da pessoa (LGPD).' },
    ],
  },
  // ───────────────────────── Vendas e atendimento
  {
    id: 'vendas', area: 'Vendas e atendimento', icon: 'briefcase', cover: 'cover-green', name: 'Funil de vendas: da prospecção ao fechamento', done: 5,
    desc: 'Um card por oportunidade, do primeiro contato ao pós-venda: prospecção, qualificação, diagnóstico, proposta, negociação e fechamento, com valor, origem e probabilidade.',
    columns: [['Prospecção', G], ['Qualificação', B], ['Diagnóstico', S], ['Proposta', P], ['Negociação', O], ['Ganho', GR], ['Perdido', R]],
    labels: [['Quente', R], ['Morno', O], ['Frio', S], ['Indicação', GR], ['Inbound', P]],
    fields: [{ n: 'Empresa', t: 'text', card: true }, { n: 'Valor', t: 'money' }, { n: 'Origem', t: 'select', o: ['Site', 'Indicação', 'Prospecção ativa', 'Evento', 'Redes sociais', 'Outro'] }, { n: 'Probabilidade', t: 'select', o: ['10%', '25%', '50%', '75%', '90%'] }, { n: 'Motivo da perda', t: 'select', o: ['Preço', 'Concorrente', 'Sem orçamento', 'Sem resposta', 'Timing', 'Outro'] }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Contato novo: retornar em até 2 dias' }, { when: 'moved', col: 'Negociação', act: 'priority', val: 'high', label: 'Em "Negociação", prioridade Alta' }, { when: 'moved', col: 'Ganho', act: 'notify', label: 'Venda ganha: avisar o responsável' }],
    form: { title: 'Fale com um consultor', intro: 'Conte rapidamente o que você precisa. Retornamos em até 2 dias úteis.', col: 'Qualificação', due: 2, q: [['Seu nome', 'text', true], ['Empresa', 'text', true], ['E-mail', 'email', true], ['Telefone', 'phone', true], ['O que você procura?', 'long', true], ['Tamanho da empresa', 'select', false, ['1 a 10', '11 a 50', '51 a 200', 'Mais de 200']]] },
    cards: [
      { t: 'Prospectar e fazer o primeiro contato', col: 0, st: 0, due: 3, l: [2], f: { Empresa: 'Empresa Exemplo', Valor: 12000, Origem: 'Prospecção ativa', Probabilidade: '10%' }, ck: [['Cadência', ['Pesquisar a empresa e o decisor', 'Ligação ou mensagem 1', 'E-mail com conteúdo útil (dia 3)', 'Ligação 2 (dia 7)', 'Último contato (dia 14)']]] },
      { t: 'Qualificar a oportunidade', col: 1, st: 3, due: 5, p: 'high', l: [1], dep: [0], ck: [['Qualificação', ['Tem a necessidade?', 'Tem orçamento?', 'Quem decide?', 'Quando precisa?']]] },
      { t: 'Reunião de diagnóstico', col: 2, st: 5, due: 10, l: [1], dep: [1], ck: [['Diagnóstico', ['Situação atual e dores', 'Impacto do problema em números', 'Critérios de escolha', 'Próximos passos combinados']]] },
      { t: 'Enviar a proposta', col: 3, st: 10, due: 12, p: 'high', dep: [2], ck: [['Proposta', ['Escopo e entregáveis', 'Preço e condições', 'Prazo de validade', 'Cases ou referências']]] },
      { t: 'Follow-up da proposta', col: 3, st: 14, due: 15, dep: [3] },
      { t: 'Negociar e fechar', col: 4, st: 15, due: 25, p: 'high', l: [0], dep: [4], ck: [['Fechamento', ['Objeções respondidas', 'Aprovação do desconto (se houver)', 'Contrato assinado', 'Pagamento combinado']]] },
      { t: 'Passar o cliente para a implantação', col: 4, st: 25, due: 27, dep: [5], d: 'Abra o mural de Implantação de clientes (pós-venda) com tudo o que foi combinado.' },
    ],
  },
  {
    id: 'suporte', area: 'Suporte e atendimento técnico', icon: 'headset', cover: 'cover-navy', name: 'Central de atendimento (help desk)', done: 3,
    desc: 'Chamados com prazo (SLA), prioridade e passo a passo por tipo: dúvida, problema técnico, pedido de mudança e reclamação. Inclui a revisão semanal e a base de respostas.',
    columns: [['Novo', G], ['Em atendimento', B], ['Aguardando cliente', Y], ['Resolvido', GR], ['Escalado', R]],
    labels: [['Dúvida', S], ['Problema', R], ['Pedido', P], ['Reclamação', O], ['Urgente', R]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Canal', t: 'select', o: ['E-mail', 'Telefone', 'WhatsApp', 'Chat', 'Formulário'] }, { n: 'Prioridade do SLA', t: 'select', o: ['Crítica (4 h)', 'Alta (1 dia)', 'Normal (2 dias)', 'Baixa (5 dias)'] }, { n: 'Satisfação', t: 'select', o: ['Ótimo', 'Bom', 'Regular', 'Ruim'] }],
    rules: [{ when: 'created', act: 'due', val: 1, label: 'Chamado novo: prazo de 1 dia' }, { when: 'moved', col: 'Escalado', act: 'priority', val: 'urgent', label: 'Escalado: prioridade Urgente' }],
    form: { title: 'Abrir chamado', intro: 'Descreva o que aconteceu. Você recebe o retorno pelo e-mail informado.', col: 'Novo', due: 1, q: [['Resumo', 'text', true], ['Tipo', 'select', true, ['Dúvida', 'Problema', 'Pedido', 'Reclamação']], ['Detalhes (o que fez e o que aconteceu)', 'long', true], ['Seu nome', 'text', true], ['Seu e-mail', 'email', true]] },
    cards: [
      { t: 'Chamado de problema técnico', col: 1, st: 0, due: 1, p: 'high', l: [1], f: { Cliente: 'Cliente Exemplo', Canal: 'E-mail', 'Prioridade do SLA': 'Alta (1 dia)' }, ck: [['Atendimento', ['Confirmar o recebimento ao cliente', 'Reproduzir o problema', 'Resolver ou escalar ao time técnico', 'Confirmar com o cliente que resolveu', 'Registrar a solução na base de respostas']]] },
      { t: 'Chamado de dúvida', col: 0, st: 0, due: 2, l: [0], ck: [['Atendimento', ['Responder com passo a passo', 'Enviar link ou vídeo, se houver', 'Perguntar se ficou claro']]] },
      { t: 'Pedido de mudança ou nova funcionalidade', col: 0, st: 0, due: 5, l: [2], ck: [['Atendimento', ['Entender o objetivo do pedido', 'Registrar para o time de produto', 'Dar previsão realista ao cliente']]] },
      { t: 'Revisão semanal dos chamados', col: 0, st: 0, due: 7, ck: [['Revisão', ['Chamados fora do SLA', 'Problemas que se repetem', 'Satisfação média', 'Novas respostas para a base']]] },
    ],
  },
  {
    id: 'posvenda', area: 'Vendas e atendimento', icon: 'handshake', cover: 'cover-green', name: 'Implantação de clientes (pós-venda)', done: 5,
    desc: 'Do contrato assinado ao cliente usando sozinho: passagem do comercial, kickoff, configuração e dados, treinamento, entrada em uso e acompanhamento dos 30 dias.',
    columns: [['Contrato assinado', G], ['Kickoff', B], ['Configuração', P], ['Treinamento', Y], ['Acompanhamento', O], ['Cliente ativo', GR]],
    labels: [['Comercial', GR], ['Implantação', S], ['Suporte', P], ['Cliente', O]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Data do kickoff', t: 'date' }, { n: 'Valor mensal', t: 'money' }, { n: 'Plano', t: 'text' }, { n: 'Responsável no cliente', t: 'text' }],
    proc: { ref: 'Data do kickoff', refDay: 5, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do kickoff)', title: 'Cliente' },
    cards: [
      { t: 'Passagem do comercial para a implantação', col: 0, st: 0, due: 2, p: 'high', l: [0], f: { Cliente: 'Cliente Exemplo', 'Data do kickoff': ymd(5), Plano: 'Plano contratado' }, ck: [['Passagem', ['O que foi vendido e prometido', 'Contatos do cliente', 'Prazo combinado', 'Riscos percebidos']]] },
      { t: 'Reunião de kickoff', col: 1, st: 5, due: 5, p: 'high', l: [1, 3], dep: [0], ck: [['Pauta', ['Objetivos do cliente', 'Cronograma e responsáveis', 'Dados e acessos necessários', 'Como medir o sucesso']]] },
      { t: 'Configurar a conta e importar os dados', col: 2, st: 6, due: 15, l: [1], dep: [1], ck: [['Configuração', ['Usuários e permissões', 'Importação dos dados', 'Integrações', 'Conferência com o cliente']]] },
      { t: 'Treinar a equipe do cliente', col: 3, st: 15, due: 20, l: [1, 3], dep: [2], ck: [['Treinamento', ['Treinamento dos usuários', 'Treinamento do administrador', 'Material de apoio enviado']]] },
      { t: 'Entrada em uso', col: 4, st: 20, due: 21, p: 'high', l: [1], dep: [3] },
      { t: 'Acompanhamento de 30 dias', col: 4, st: 50, due: 52, l: [2], dep: [4], ck: [['Checagem', ['Está usando de verdade?', 'Dúvidas e problemas abertos', 'Satisfação (NPS)', 'Passar para o sucesso do cliente']]] },
    ],
  },
  // ───────────────────────── Marketing
  {
    id: 'marketing', area: 'Marketing', icon: 'megaphone', cover: 'cover-orange', name: 'Calendário de conteúdo e redes sociais', done: 5,
    desc: 'Pauta do mês, roteiro, criação, revisão, agendamento por rede e relatório de resultados, para blog, Instagram, LinkedIn e newsletter.',
    columns: [['Ideias', G], ['Pauta do mês', B], ['Em produção', P], ['Revisão', Y], ['Agendado', O], ['Publicado', GR]],
    labels: [['Instagram', PK], ['LinkedIn', S], ['Blog', P], ['Newsletter', O], ['Vídeo', R]],
    fields: [{ n: 'Peça', t: 'text', card: true }, { n: 'Data de publicação', t: 'date' }, { n: 'Formato', t: 'select', o: ['Post', 'Carrossel', 'Reels/vídeo', 'Stories', 'Artigo', 'E-mail'] }, { n: 'Alcance', t: 'number' }],
    proc: { ref: 'Data de publicação', refDay: 10, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da publicação)', title: 'Peça' },
    cards: [
      { t: 'Definir a pauta do mês', col: 1, st: 0, due: 2, p: 'high', f: { Peça: 'Tema do conteúdo', 'Data de publicação': ymd(10), Formato: 'Carrossel' }, ck: [['Pauta', ['Datas importantes do mês', 'Temas por objetivo (atrair, educar, vender)', 'Distribuição por rede', 'Responsável por peça']]] },
      { t: 'Roteiro e texto', col: 2, st: 2, due: 5, dep: [0], ck: [['Roteiro', ['Gancho nos primeiros segundos ou linhas', 'Mensagem principal', 'Chamada para ação', 'Hashtags e marcações']]] },
      { t: 'Criar as artes ou o vídeo', col: 2, st: 4, due: 7, l: [0, 4], dep: [1] },
      { t: 'Revisar e aprovar', col: 3, st: 7, due: 8, p: 'high', dep: [2], ck: [['Revisão', ['Ortografia', 'Identidade visual', 'Direitos de imagem e música', 'Aprovação do responsável']]] },
      { t: 'Agendar nas redes', col: 4, st: 8, due: 9, dep: [3] },
      { t: 'Responder comentários (primeiras 24 h)', col: 4, st: 10, due: 11, l: [0, 1], dep: [4] },
      { t: 'Relatório do mês', col: 4, st: 30, due: 32, dep: [4], ck: [['Resultados', ['Alcance e engajamento por rede', 'Melhores e piores conteúdos', 'Seguidores e leads gerados', 'O que repetir no próximo mês']]] },
    ],
  },
  {
    id: 'campanha', area: 'Marketing', icon: 'target', cover: 'cover-orange', name: 'Lançamento de campanha', done: 5,
    desc: 'Objetivo e público, criação das peças, aprovação, testes de link e rastreio, publicação, otimização durante a campanha e relatório com o custo por resultado.',
    columns: [['Planejamento', G], ['Criação', P], ['Aprovação', Y], ['No ar', B], ['Resultados', O], ['Concluído', GR]],
    labels: [['Anúncios pagos', R], ['E-mail', O], ['Redes sociais', PK], ['Site', S]],
    fields: [{ n: 'Campanha', t: 'text', card: true }, { n: 'Data de lançamento', t: 'date' }, { n: 'Orçamento', t: 'money' }, { n: 'Meta', t: 'text' }, { n: 'Custo por resultado', t: 'money' }],
    proc: { ref: 'Data de lançamento', refDay: 14, lead: 0, q: 'Quantos dias antes do lançamento tudo precisa estar pronto?', title: 'Campanha' },
    cards: [
      { t: 'Definir objetivo, público e mensagem', col: 0, st: 0, due: 3, p: 'high', f: { Campanha: 'Campanha de lançamento', 'Data de lançamento': ymd(14), Orçamento: 5000, Meta: '200 leads' }, ck: [['Briefing', ['Objetivo e meta em número', 'Público e segmentação', 'Mensagem e oferta', 'Canais e orçamento por canal']]] },
      { t: 'Criar as peças e os textos', col: 1, st: 3, due: 8, dep: [0], ck: [['Peças', ['Anúncios', 'Página de destino', 'E-mails', 'Posts orgânicos']]] },
      { t: 'Aprovar com a diretoria', col: 2, st: 8, due: 10, p: 'high', dep: [1] },
      { t: 'Testar links, formulários e rastreio', col: 2, st: 10, due: 12, l: [3], dep: [1], ck: [['Testes', ['Links com UTM', 'Formulário chegando no CRM', 'Pixel ou conversões configurados', 'Página no celular']]] },
      { t: 'Publicar e impulsionar', col: 3, st: 14, due: 14, p: 'urgent', l: [0, 2], dep: [2, 3] },
      { t: 'Otimizar durante a campanha', col: 3, st: 16, due: 26, l: [0], dep: [4], ck: [['Otimização', ['Pausar anúncios ruins', 'Reforçar os melhores', 'Ajustar público e orçamento']]] },
      { t: 'Relatório de resultados', col: 4, st: 28, due: 30, dep: [5], ck: [['Relatório', ['Meta x resultado', 'Custo por resultado', 'Aprendizados para a próxima']]] },
    ],
  },
  // ───────────────────────── Operações
  {
    id: 'manutencao', area: 'Operações', icon: 'wrench', cover: 'cover-navy', name: 'Manutenção e facilities', done: 4,
    desc: 'Chamados de manutenção pelo formulário com prioridade por risco, mais o plano de manutenção preventiva (ar-condicionado, elétrica, extintores, caixa d\'água) com datas fixas.',
    columns: [['Aberto', G], ['Avaliado', B], ['Em execução', O], ['Aguardando peça ou terceiro', Y], ['Concluído', GR]],
    labels: [['Corretiva', R], ['Preventiva', S], ['Elétrica', Y], ['Hidráulica', B], ['Ar-condicionado', P], ['Limpeza', GR]],
    fields: [{ n: 'Local', t: 'text', card: true }, { n: 'Custo', t: 'money' }, { n: 'Fornecedor', t: 'text' }, { n: 'Próxima preventiva', t: 'date' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Chamado novo: avaliar em até 2 dias' }],
    form: { title: 'Pedido de manutenção', intro: 'Informe o problema e o local. Situações de risco (fios expostos, vazamentos) ligue também para o responsável.', col: 'Aberto', due: 2, q: [['O que aconteceu?', 'text', true], ['Local exato', 'text', true], ['Há risco para pessoas?', 'select', true, ['Não', 'Sim']], ['Detalhes ou link de foto', 'long', false], ['Seu nome', 'text', true]] },
    cards: [
      { t: 'Chamado corretivo', col: 1, st: 0, due: 2, p: 'high', l: [0], f: { Local: 'Copa do 2º andar' }, ck: [['Fluxo', ['Avaliar o risco e isolar se preciso', 'Orçamento (3 cotações acima do limite)', 'Executar ou chamar o terceiro', 'Conferir o serviço com quem pediu', 'Registrar o custo']]] },
      { t: 'Limpeza do ar-condicionado (PMOC)', col: 0, st: 0, due: 30, l: [1, 4], d: 'Prédios com ar-condicionado acima de 60.000 BTU/h precisam de Plano de Manutenção, Operação e Controle (Lei 13.589/2018).', ck: [['Preventiva', ['Limpeza dos filtros', 'Registro no plano', 'Próxima data agendada']]] },
      { t: 'Inspeção elétrica e de iluminação de emergência', col: 0, st: 0, due: 30, l: [1, 2], ck: [['Inspeção', ['Quadros de energia', 'Tomadas e fios', 'Luzes de emergência funcionando']]] },
      { t: 'Limpeza da caixa d\'água', col: 0, st: 0, due: 60, l: [1, 3], d: 'Recomendado a cada 6 meses; guarde o certificado da empresa que fez.' },
      { t: 'Recarga e inspeção dos extintores', col: 0, st: 0, due: 90, l: [1], ck: [['Extintores', ['Validade da carga', 'Teste hidrostático', 'Sinalização e acesso livre']]] },
    ],
  },
  {
    id: 'eventos', area: 'Operações', icon: 'calendar-days', cover: 'cover-purple', name: 'Organização de evento', done: 5,
    desc: 'Do orçamento ao pós-evento: local, fornecedores, convites e confirmações, roteiro do dia, ensaio, checklist da montagem e pesquisa de satisfação.',
    columns: [['A planejar', G], ['Contratações', B], ['Preparação', P], ['Dia do evento', O], ['Pós-evento', Y], ['Concluído', GR]],
    labels: [['Local', S], ['Buffet', O], ['Convidados', PK], ['Fornecedores', P], ['Comunicação', Y]],
    fields: [{ n: 'Evento', t: 'text', card: true }, { n: 'Data do evento', t: 'date' }, { n: 'Convidados', t: 'number' }, { n: 'Custo', t: 'money' }, { n: 'Fornecedor', t: 'text' }],
    proc: { ref: 'Data do evento', refDay: 30, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data do evento)', title: 'Evento' },
    cards: [
      { t: 'Definir objetivo, público e orçamento', col: 0, st: 0, due: 3, p: 'high', f: { Evento: 'Confraternização', 'Data do evento': ymd(30), Convidados: 80 } },
      { t: 'Reservar o local', col: 1, st: 3, due: 7, p: 'high', l: [0], dep: [0], ck: [['Local', ['Capacidade e acessibilidade', 'Estrutura (som, projetor, Wi-Fi)', 'Contrato e sinal pago', 'Plano B para chuva']]] },
      { t: 'Contratar buffet e fornecedores', col: 1, st: 5, due: 12, l: [1, 3], dep: [0], ck: [['Fornecedores', ['Buffet (restrições alimentares)', 'Som e iluminação', 'Fotografia', 'Decoração']]] },
      { t: 'Enviar convites e confirmar presença', col: 2, st: 7, due: 25, l: [2], dep: [1], ck: [['Convites', ['Convite com data, local e traje', 'Lembrete 7 dias antes', 'Lista de confirmados', 'Número final ao buffet']]] },
      { t: 'Roteiro do evento', col: 2, st: 15, due: 25, l: [4], dep: [1], ck: [['Roteiro', ['Horário de cada momento', 'Quem fala e quanto tempo', 'Músicas e vídeos', 'Responsável por cada parte']]] },
      { t: 'Montagem e checklist do dia', col: 3, st: 30, due: 30, p: 'urgent', dep: [2, 3, 4], ck: [['No dia', ['Fornecedores chegaram no horário', 'Teste de som e projetor', 'Recepção e lista de convidados', 'Fotos']]] },
      { t: 'Pesquisa de satisfação e fechamento', col: 4, st: 31, due: 35, dep: [5], ck: [['Fechamento', ['Pesquisa com os participantes', 'Pagamento dos fornecedores', 'Custo final x orçamento', 'Lições para o próximo']]] },
    ],
  },
  // ───────────────────────── Financeiro e compras
  {
    id: 'compras', area: 'Financeiro e compras', icon: 'shopping-cart', cover: 'cover-green', name: 'Compras e requisições', done: 5,
    desc: 'Requisições pelo formulário, 3 cotações acima do limite, aprovação por alçada, pedido, recebimento conferido com a nota e pagamento.',
    columns: [['Requisição', G], ['Cotação', B], ['Aprovação', Y], ['Pedido feito', P], ['Recebido', O], ['Concluído', GR], ['Recusado', R]],
    labels: [['Material', S], ['Serviço', P], ['Urgente', R], ['TI', B]],
    fields: [{ n: 'Item', t: 'text', card: true }, { n: 'Valor', t: 'money' }, { n: 'Centro de custo', t: 'text' }, { n: 'Fornecedor escolhido', t: 'text' }, { n: 'Necessário até', t: 'date' }],
    rules: [{ when: 'created', act: 'due', val: 3, label: 'Requisição nova: cotação em até 3 dias' }],
    form: { title: 'Requisição de compra', intro: 'Peça o que sua área precisa. Compras acima do limite passam por 3 cotações e aprovação.', col: 'Requisição', due: 3, q: [['O que precisa comprar?', 'text', true], ['Quantidade e especificação', 'long', true], ['Para quando?', 'date', true], ['Centro de custo / área', 'text', true], ['Seu nome', 'text', true]] },
    cards: [
      { t: 'Compra de material', col: 1, st: 0, due: 7, l: [0], f: { Item: 'Cadeiras para a sala de reunião', Valor: 3600, 'Centro de custo': 'Administrativo' }, ck: [['Fluxo', ['Especificação clara', '3 cotações (acima do limite da empresa)', 'Aprovação pela alçada do valor', 'Pedido enviado ao fornecedor', 'Recebimento conferido com a nota', 'Nota enviada ao financeiro']]] },
      { t: 'Contratação de serviço', col: 0, st: 0, due: 10, l: [1], d: 'Serviço recorrente precisa de contrato (veja o modelo Contratos e jurídico).', ck: [['Fluxo', ['Escopo do serviço', 'Propostas comparáveis', 'Documentos do fornecedor', 'Aprovação', 'Ordem de serviço ou contrato']]] },
      { t: 'Avaliar os fornecedores do mês', col: 0, st: 0, due: 30, ck: [['Avaliação', ['Prazo de entrega cumprido', 'Qualidade', 'Preço x mercado']]] },
    ],
  },
  {
    id: 'contas', area: 'Financeiro e compras', icon: 'receipt', cover: 'cover-orange', name: 'Contas a pagar', done: 3,
    desc: 'Cada conta do recebimento ao arquivo: conferência da nota, aprovação, agendamento no banco, pagamento e baixa com comprovante, mais a programação semanal.',
    columns: [['A conferir', G], ['Aprovado e agendado', B], ['Pago', GR], ['Atrasado', R]],
    labels: [['Fornecedor', S], ['Imposto', R], ['Folha', PK], ['Aluguel e contas fixas', Y]],
    fields: [{ n: 'Favorecido', t: 'text', card: true }, { n: 'Valor', t: 'money' }, { n: 'Vencimento', t: 'date' }, { n: 'Centro de custo', t: 'text' }, { n: 'Forma de pagamento', t: 'select', o: ['Boleto', 'Pix', 'Transferência', 'Débito automático', 'Cartão'] }],
    proc: { ref: 'Vencimento', refDay: 5, lead: 0, q: 'Quantos dias antes do vencimento a conta deve estar agendada?', title: 'Favorecido' },
    rules: [{ when: 'moved', col: 'Atrasado', act: 'priority', val: 'urgent', label: 'Conta atrasada: prioridade Urgente' }],
    cards: [
      { t: 'Conferir a nota e o boleto', col: 0, st: 0, due: 2, l: [0], f: { Favorecido: 'Fornecedor Exemplo', Valor: 1200, Vencimento: ymd(5), 'Forma de pagamento': 'Boleto' }, ck: [['Conferência', ['Nota bate com o pedido', 'Dados do boleto ou Pix conferidos (golpe do boleto falso)', 'Retenções de impostos, se houver', 'Centro de custo']]] },
      { t: 'Aprovar e agendar no banco', col: 1, st: 2, due: 4, p: 'high', dep: [0] },
      { t: 'Baixa e comprovante', col: 1, st: 5, due: 5, dep: [1], ck: [['Baixa', ['Comprovante anexado', 'Baixa no sistema financeiro', 'Arquivo para a contabilidade']]] },
      { t: 'Programação de pagamentos da semana', col: 0, st: 0, due: 1, l: [3], ck: [['Programação', ['Contas que vencem em 7 dias', 'Saldo disponível', 'Prioridades (impostos, folha, fornecedores críticos)']]] },
    ],
  },
  {
    id: 'contratos', area: 'Financeiro e compras', icon: 'file-signature', cover: 'cover-navy', name: 'Contratos e jurídico', done: 4,
    desc: 'Um contrato da minuta à renovação: elaboração, revisão jurídica, negociação, assinatura, guarda, obrigações acompanhadas e aviso de renovação ou encerramento.',
    columns: [['Elaboração', G], ['Revisão jurídica', B], ['Negociação', Y], ['Assinatura', P], ['Vigente', GR], ['Encerrado', R]],
    labels: [['Cliente', GR], ['Fornecedor', S], ['Trabalhista', PK], ['Imóvel', O], ['Confidencialidade', P]],
    fields: [{ n: 'Contraparte', t: 'text', card: true }, { n: 'Valor', t: 'money' }, { n: 'Início da vigência', t: 'date' }, { n: 'Renovação', t: 'date' }, { n: 'Aviso prévio para cancelar (dias)', t: 'number' }],
    proc: { ref: 'Início da vigência', refDay: 20, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do início da vigência)', title: 'Contraparte' },
    cards: [
      { t: 'Elaborar a minuta', col: 0, st: 0, due: 5, p: 'high', f: { Contraparte: 'Empresa contratada', 'Início da vigência': ymd(20), 'Aviso prévio para cancelar (dias)': 30 }, ck: [['Minuta', ['Objeto e escopo', 'Preço, reajuste e forma de pagamento', 'Prazo e renovação', 'Multas e rescisão', 'Proteção de dados (LGPD)']]] },
      { t: 'Revisão jurídica', col: 1, st: 5, due: 10, p: 'high', dep: [0], ck: [['Revisão', ['Riscos e responsabilidades', 'Foro e lei aplicável', 'Garantias']]] },
      { t: 'Negociar as cláusulas', col: 2, st: 10, due: 15, dep: [1] },
      { t: 'Assinar e guardar', col: 3, st: 15, due: 18, p: 'high', dep: [2], ck: [['Assinatura', ['Assinatura eletrônica das partes', 'Cópia no repositório da empresa', 'Datas cadastradas (renovação, reajuste)']]] },
      { t: 'Acompanhar as obrigações', col: 3, st: 20, due: 110, dep: [3], d: 'Entregas, níveis de serviço e reajuste anual.' },
      { t: 'Decidir renovar ou encerrar', col: 3, st: 320, due: 335, p: 'high', dep: [3], d: 'Decida antes do prazo de aviso prévio do contrato; muitos renovam sozinhos se ninguém avisar.' },
    ],
  },
  // ───────────────────────── Projetos e tecnologia
  {
    id: 'projeto', area: 'Projetos e tecnologia', icon: 'rocket', cover: 'cover-orange', name: 'Projeto com etapas', done: 5,
    desc: 'Um projeto do kickoff à entrega: escopo, cronograma, riscos, execução em fases, revisões com o cliente, entrega, aceite e lições aprendidas.',
    columns: [['Iniciação', G], ['Planejamento', B], ['Execução', P], ['Revisão', Y], ['Entrega', O], ['Concluído', GR]],
    labels: [['Escopo', S], ['Risco', R], ['Cliente', O], ['Equipe', P]],
    fields: [{ n: 'Projeto', t: 'text', card: true }, { n: 'Data de entrega', t: 'date' }, { n: 'Fase', t: 'select', o: ['Iniciação', 'Planejamento', 'Execução', 'Encerramento'] }, { n: 'Horas estimadas', t: 'number' }, { n: 'Orçamento', t: 'money' }],
    proc: { ref: 'Data de entrega', refDay: 60, lead: 0, q: 'Quantos dias antes da data de entrega o projeto deve estar concluído?', title: 'Projeto' },
    cards: [
      { t: 'Reunião de início (kickoff)', col: 0, st: 0, due: 2, p: 'high', l: [2, 3], f: { Projeto: 'Nome do projeto', 'Data de entrega': ymd(60), Fase: 'Iniciação' }, ck: [['Pauta', ['Objetivo e critérios de sucesso', 'Quem decide e quem participa', 'Datas importantes', 'Forma de comunicação']]] },
      { t: 'Escopo e requisitos', col: 1, st: 2, due: 8, p: 'high', l: [0], dep: [0], ck: [['Escopo', ['O que está dentro', 'O que está fora', 'Entregáveis', 'Aprovação do cliente']]] },
      { t: 'Cronograma e riscos', col: 1, st: 8, due: 12, l: [1], dep: [1], ck: [['Plano', ['Fases e marcos', 'Responsáveis', 'Riscos e como evitar cada um']]] },
      { t: 'Execução — fase 1', col: 2, st: 12, due: 28, dep: [2] },
      { t: 'Revisão da fase 1 com o cliente', col: 3, st: 28, due: 30, l: [2], dep: [3] },
      { t: 'Execução — fase 2', col: 2, st: 30, due: 50, dep: [4] },
      { t: 'Entrega e aceite', col: 4, st: 55, due: 60, p: 'high', l: [2], dep: [5], ck: [['Entrega', ['Entregáveis conferidos com o escopo', 'Treinamento ou documentação', 'Termo de aceite']]] },
      { t: 'Lições aprendidas', col: 4, st: 60, due: 63, l: [3], dep: [6] },
    ],
  },
  {
    id: 'sprint', area: 'Projetos e tecnologia', icon: 'code', cover: 'cover-purple', name: 'Sprint de desenvolvimento', done: 5,
    desc: 'Um ciclo de 2 semanas: planejamento, desenvolvimento, revisão de código, testes, publicação, demonstração e retrospectiva.',
    columns: [['Backlog', G], ['Sprint atual', B], ['Em desenvolvimento', P], ['Code review', Y], ['Teste', O], ['Pronto', GR]],
    labels: [['Funcionalidade', GR], ['Bug', R], ['Melhoria', S], ['Dívida técnica', Y]],
    fields: [{ n: 'Sprint', t: 'text', card: true }, { n: 'Fim da sprint', t: 'date' }, { n: 'Pontos', t: 'number' }, { n: 'Versão', t: 'text' }],
    proc: { ref: 'Fim da sprint', refDay: 14, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do fim da sprint)', title: 'Sprint' },
    cards: [
      { t: 'Planejamento da sprint', col: 1, st: 0, due: 0, p: 'high', f: { Sprint: 'Sprint 1', 'Fim da sprint': ymd(14) }, ck: [['Planejamento', ['Objetivo da sprint', 'Itens escolhidos do backlog', 'Critérios de aceite de cada item', 'Capacidade da equipe']]] },
      { t: 'Desenvolver os itens da sprint', col: 2, st: 1, due: 10, dep: [0] },
      { t: 'Revisão de código', col: 3, st: 3, due: 11, dep: [0], ck: [['Code review', ['Legibilidade', 'Testes automáticos', 'Segurança e desempenho']]] },
      { t: 'Testes e homologação', col: 4, st: 9, due: 12, p: 'high', dep: [1, 2], ck: [['Testes', ['Critérios de aceite', 'Testes no celular e no computador', 'Nada quebrou no que já existia']]] },
      { t: 'Publicar a versão', col: 4, st: 13, due: 13, p: 'high', l: [0], dep: [3], ck: [['Publicação', ['Notas da versão', 'Plano de volta (rollback)', 'Monitorar erros depois de publicar']]] },
      { t: 'Demonstração e retrospectiva', col: 4, st: 14, due: 14, dep: [4], ck: [['Retrospectiva', ['O que foi bem', 'O que atrapalhou', 'Uma melhoria para a próxima sprint']]] },
    ],
  },
  {
    id: 'okrs', area: 'Projetos e tecnologia', icon: 'flag', cover: 'cover-navy', name: 'Metas e OKRs do trimestre', done: 4,
    desc: 'Objetivos do trimestre com resultados-chave medidos em número, iniciativas com dono, check-in semanal de confiança e fechamento com nota.',
    columns: [['Objetivos', G], ['No caminho', GR], ['Atenção', Y], ['Em risco', R], ['Fechamento', P]],
    labels: [['Objetivo', P], ['Resultado-chave', S], ['Iniciativa', O]],
    fields: [{ n: 'Meta', t: 'number', card: true }, { n: 'Atual', t: 'number' }, { n: 'Confiança', t: 'select', o: ['Alta', 'Média', 'Baixa'] }, { n: 'Fim do trimestre', t: 'date' }],
    proc: { ref: 'Fim do trimestre', refDay: 90, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do fim do trimestre)', title: '' },
    cards: [
      { t: 'Definir os objetivos do trimestre', col: 0, st: 0, due: 5, p: 'high', l: [0], f: { 'Fim do trimestre': ymd(90) }, ck: [['Objetivos', ['No máximo 3 objetivos', 'Ligados à estratégia do ano', 'Escritos de forma inspiradora']]] },
      { t: 'Resultados-chave com número', col: 0, st: 5, due: 8, p: 'high', l: [1], dep: [0], ck: [['Resultados-chave', ['2 a 4 por objetivo', 'Valor inicial e meta', 'Dono de cada um']]] },
      { t: 'Iniciativas e donos', col: 0, st: 8, due: 10, l: [2], dep: [1] },
      { t: 'Check-in semanal de confiança', col: 1, st: 10, due: 85, l: [1], dep: [2], d: 'Toda semana: valor atual, confiança (alta, média, baixa) e o que mudou.' },
      { t: 'Revisão do meio do trimestre', col: 1, st: 45, due: 46, dep: [2] },
      { t: 'Fechamento e nota final', col: 1, st: 88, due: 90, p: 'high', dep: [3], ck: [['Fechamento', ['Nota de 0 a 1 por resultado-chave', 'O que aprendemos', 'O que continua no próximo trimestre']]] },
    ],
  },
  // ───────────────────────── Recursos Humanos (mais)
  {
    id: 'treinamento', area: 'Recursos Humanos', icon: 'graduation-cap', cover: 'cover-purple', name: 'Treinamento e desenvolvimento', done: 5,
    desc: 'Um treinamento do começo ao fim: necessidade, formato e orçamento, convocação, realização com lista de presença, certificados e avaliação de eficácia 30 dias depois.',
    columns: [['Levantamento', G], ['Planejamento', B], ['Convocação', Y], ['Realização', O], ['Avaliação', P], ['Concluído', GR]],
    labels: [['DHO', P], ['Obrigatório (NR)', R], ['Técnico', S], ['Comportamental', PK], ['Liderança', O]],
    fields: [{ n: 'Treinamento', t: 'text', card: true }, { n: 'Data', t: 'date' }, { n: 'Público', t: 'text' }, { n: 'Carga horária', t: 'number' }, { n: 'Custo', t: 'money' }],
    proc: { ref: 'Data', refDay: 30, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data do treinamento)', title: 'Treinamento' },
    cards: [
      { t: 'Levantar a necessidade', col: 0, st: 0, due: 5, p: 'high', l: [0], f: { Treinamento: 'Nome do treinamento', Data: ymd(30), Público: 'Equipe comercial' }, ck: [['Necessidade', ['Problema ou meta que o treinamento resolve', 'Quem precisa participar', 'É obrigatório por norma?', 'Resultado esperado e como medir']]] },
      { t: 'Definir formato, instrutor e orçamento', col: 1, st: 5, due: 10, l: [0], dep: [0], ck: [['Formato', ['Interno ou externo', 'Presencial ou online', 'Instrutor ou fornecedor', 'Orçamento aprovado']]] },
      { t: 'Preparar o conteúdo, o material e o local', col: 1, st: 10, due: 25, dep: [1], ck: [['Preparação', ['Conteúdo e exercícios', 'Material dos participantes', 'Sala, equipamento ou link', 'Lista de presença e avaliação de reação']]] },
      { t: 'Convocar os participantes', col: 2, st: 18, due: 25, l: [0], dep: [1], ck: [['Convocação', ['Convite com data, horário e local', 'Liberação dos gestores', 'Lembrete na véspera']]] },
      { t: 'Realizar o treinamento', col: 3, st: 30, due: 30, p: 'high', dep: [2, 3], ck: [['No dia', ['Lista de presença assinada', 'Avaliação de reação no final', 'Fotos e materiais arquivados']]] },
      { t: 'Emitir os certificados', col: 4, st: 31, due: 35, l: [1], dep: [4], d: 'Treinamentos de NR exigem certificado com conteúdo, carga horária, data e assinaturas do instrutor e do responsável técnico.' },
      { t: 'Avaliar se funcionou (30 dias depois)', col: 4, st: 60, due: 65, l: [0], dep: [4], ck: [['Eficácia', ['Conversa com os gestores', 'Indicador antes x depois', 'Precisa de reforço?']]] },
    ],
  },
  {
    id: 'ferias', area: 'Departamento Pessoal', icon: 'palmtree', cover: 'cover-green', name: 'Férias: programação, aviso e pagamento', done: 5,
    desc: 'Das férias pedidas pelo colaborador ao retorno: aprovação do gestor, cobertura da equipe, aviso com 30 dias, cálculo, pagamento até 2 dias antes e controle dos períodos que vencem.',
    columns: [['Pedido', G], ['Aprovado pelo gestor', B], ['Aviso e cálculo', Y], ['Pago', O], ['Em férias', P], ['Retornou', GR]],
    labels: [['DP', Y], ['Gestor', O], ['RH', PK], ['Vencendo', R], ['Abono', S]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Início das férias', t: 'date' }, { n: 'Dias', t: 'number' }, { n: 'Período aquisitivo', t: 'text' }, { n: 'Vende 1/3 (abono)', t: 'checkbox' }],
    proc: { ref: 'Início das férias', refDay: 35, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do início das férias)', title: 'Colaborador' },
    form: { title: 'Pedir férias', intro: 'Escolha o período. Seu gestor aprova e o DP avisa você com 30 dias de antecedência.', col: 'Pedido', due: 5, q: [['Seu nome', 'text', true], ['Primeiro dia das férias', 'date', true], ['Quantos dias', 'select', true, ['30', '20', '15', '14', '10', '5']], ['Quer vender 1/3 (abono)?', 'select', true, ['Não', 'Sim']], ['Quer adiantar a 1ª parcela do 13º?', 'select', true, ['Não', 'Sim']], ['Observações', 'long', false]] },
    cards: [
      { t: 'Aprovar o período com o gestor', col: 0, st: 0, due: 3, p: 'high', l: [1], f: { Colaborador: 'Nome do colaborador', 'Início das férias': ymd(35), Dias: 30, 'Período aquisitivo': 'Período aquisitivo' }, d: 'Férias podem ser divididas em até 3 períodos, um deles com pelo menos 14 dias e os outros com pelo menos 5 (CLT art. 134). Não podem começar nos 2 dias antes de feriado ou do descanso semanal.', ck: [['Aprovação', ['Período sem conflito com outras férias da equipe', 'Dentro do período concessivo', 'Divisão em períodos respeita a lei']]] },
      { t: 'Combinar quem cobre as atividades', col: 1, st: 3, due: 25, l: [1], dep: [0], ck: [['Cobertura', ['Atividades em andamento', 'Quem responde por cada uma', 'Resposta automática do e-mail']]] },
      { t: 'Entregar o aviso de férias', col: 2, st: 3, due: 5, p: 'high', l: [0], dep: [0], d: 'O aviso por escrito deve ser dado com pelo menos 30 dias de antecedência (CLT art. 135).' },
      { t: 'Calcular as férias', col: 2, st: 25, due: 30, l: [0], dep: [2], ck: [['Cálculo', ['Média das variáveis (horas extras, comissões)', '1/3 constitucional', 'Abono de 1/3, se pedido', 'Adiantamento do 13º, se pedido']]] },
      { t: 'Pagar as férias', col: 3, st: 30, due: 33, p: 'urgent', l: [0], dep: [3], d: 'Pagamento até 2 dias antes do início das férias (CLT art. 145).' },
      { t: 'Retorno e conferência do ponto', col: 4, st: 65, due: 66, l: [0, 1], dep: [4] },
      { t: 'Revisar férias vencendo na empresa (mensal)', col: 0, st: 0, due: 5, l: [3, 2], d: 'Férias concedidas fora do período concessivo são pagas em dobro (CLT art. 137).', ck: [['Controle', ['Lista de períodos que vencem nos próximos 90 dias', 'Avisar os gestores', 'Programar as datas']]] },
    ],
  },
  {
    id: 'desempenho', area: 'Recursos Humanos', icon: 'star', cover: 'cover-navy', name: 'Ciclo de avaliação de desempenho', done: 5,
    desc: 'Um ciclo completo: critérios e calendário, autoavaliação, avaliação do gestor, calibração, devolutivas com PDI e acompanhamento das metas, conduzido pelo DHO.',
    columns: [['Preparação', G], ['Autoavaliação', B], ['Avaliação do gestor', P], ['Calibração', Y], ['Devolutivas e PDI', O], ['Concluído', GR]],
    labels: [['DHO', P], ['Gestor', O], ['Colaborador', S], ['Diretoria', PK]],
    fields: [{ n: 'Ciclo', t: 'text', card: true }, { n: 'Data de fechamento', t: 'date' }, { n: 'Participantes', t: 'number' }],
    proc: { ref: 'Data de fechamento', refDay: 45, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data de fechamento do ciclo)', title: 'Ciclo' },
    cards: [
      { t: 'Definir critérios e calendário do ciclo', col: 0, st: 0, due: 5, p: 'high', l: [0], f: { Ciclo: 'Ciclo anual', 'Data de fechamento': ymd(45) }, ck: [['Preparação', ['Competências e metas avaliadas', 'Escala de notas com descrição', 'Quem avalia quem', 'Datas de cada etapa']]] },
      { t: 'Treinar os gestores para avaliar', col: 0, st: 5, due: 8, l: [0, 1], dep: [0], ck: [['Treinamento', ['Como dar notas com exemplos', 'Vieses comuns (último mês, simpatia)', 'Como conduzir a devolutiva']]] },
      { t: 'Comunicar o ciclo a toda a empresa', col: 0, st: 8, due: 9, l: [0], dep: [0] },
      { t: 'Autoavaliação dos colaboradores', col: 1, st: 9, due: 16, l: [2], dep: [2] },
      { t: 'Avaliação dos gestores', col: 2, st: 16, due: 25, p: 'high', l: [1], dep: [3] },
      { t: 'Reunião de calibração', col: 3, st: 26, due: 28, p: 'high', l: [0, 3], dep: [4], ck: [['Calibração', ['Comparar notas entre áreas', 'Ajustar diferenças de rigor', 'Definir talentos e quem precisa de apoio', 'Registrar decisões']]] },
      { t: 'Devolutivas individuais e PDI', col: 4, st: 29, due: 40, p: 'high', l: [1, 2], dep: [5], ck: [['Devolutiva', ['Pontos fortes com exemplos', 'O que melhorar', 'Plano de desenvolvimento (PDI) com 2 ou 3 ações', 'Registro assinado']]] },
      { t: 'Relatório do ciclo para a diretoria', col: 4, st: 40, due: 45, l: [0, 3], dep: [6] },
      { t: 'Acompanhar os PDIs (90 dias)', col: 4, st: 130, due: 135, l: [0, 1], dep: [6] },
    ],
  },
  // ───────────────────────── Vendas e atendimento (mais)
  {
    id: 'sucesso', area: 'Vendas e atendimento', icon: 'heart-handshake', cover: 'cover-navy', name: 'Sucesso do cliente e renovações', done: 4,
    desc: 'Clientes acompanhados pela saúde da conta: reuniões trimestrais, NPS, plano de recuperação dos que estão em risco e renovação começando 60 dias antes.',
    columns: [['Saudável', GR], ['Atenção', Y], ['Em risco', R], ['Renovação em andamento', B], ['Renovado', G], ['Cancelado', R]],
    labels: [['Expansão', GR], ['Risco de cancelamento', R], ['Baixo uso', O], ['Promotor', S]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Data de renovação', t: 'date' }, { n: 'Valor mensal', t: 'money' }, { n: 'Saúde', t: 'select', o: ['Saudável', 'Atenção', 'Em risco'] }, { n: 'NPS', t: 'number' }],
    proc: { ref: 'Data de renovação', refDay: 90, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da renovação)', title: 'Cliente' },
    cards: [
      { t: 'Reunião trimestral de resultados', col: 0, st: 0, due: 7, l: [3], f: { Cliente: 'Cliente Exemplo', 'Data de renovação': ymd(90), Saúde: 'Saudável' }, ck: [['Pauta', ['Resultados obtidos no período', 'Uso da solução', 'Próximos objetivos', 'Oportunidades de expansão']]] },
      { t: 'Pesquisa de satisfação (NPS)', col: 0, st: 7, due: 14, dep: [0] },
      { t: 'Plano de recuperação (se estiver em risco)', col: 2, st: 14, due: 30, p: 'high', l: [1, 2], dep: [1], ck: [['Recuperação', ['Entender o motivo real', 'Envolver o decisor do cliente', 'Ações com prazo', 'Reavaliar a saúde em 30 dias']]] },
      { t: 'Preparar a renovação (60 dias antes)', col: 3, st: 30, due: 40, p: 'high', dep: [1], ck: [['Renovação', ['Resumo de valor entregue no ano', 'Reajuste e condições', 'Oferta de expansão']]] },
      { t: 'Negociar e assinar a renovação', col: 3, st: 40, due: 85, p: 'high', dep: [3] },
    ],
  },
  // ───────────────────────── Marketing (mais)
  {
    id: 'design', area: 'Marketing', icon: 'palette', cover: 'cover-purple', name: 'Pedidos de design e criação', done: 4,
    desc: 'Pedidos das áreas entram pelo formulário com briefing; cada peça passa por criação, revisão com o solicitante (até 2 rodadas) e entrega dos arquivos finais.',
    columns: [['Pedido', G], ['Briefing completo', B], ['Em criação', P], ['Revisão', Y], ['Entregue', GR], ['Cancelado', R]],
    labels: [['Redes sociais', PK], ['Impresso', O], ['Apresentação', S], ['Vídeo', R], ['Urgente', R]],
    fields: [{ n: 'Solicitante', t: 'text', card: true }, { n: 'Formato', t: 'select', o: ['Post', 'Banner', 'Apresentação', 'Folder/impresso', 'Vídeo', 'Outro'] }, { n: 'Rodadas de revisão', t: 'number' }, { n: 'Data de uso', t: 'date' }],
    rules: [{ when: 'created', act: 'due', val: 5, label: 'Pedido novo: entrega em até 5 dias' }],
    form: { title: 'Pedir uma arte', intro: 'Quanto mais completo o briefing, mais rápida a entrega. Prazo padrão: 5 dias úteis.', col: 'Pedido', due: 5, q: [['O que você precisa?', 'text', true], ['Formato', 'select', true, ['Post', 'Banner', 'Apresentação', 'Folder/impresso', 'Vídeo', 'Outro']], ['Texto que deve aparecer', 'long', true], ['Tamanho ou onde será usado', 'text', true], ['Quando será usado', 'date', true], ['Seu nome', 'text', true]] },
    cards: [
      { t: 'Peça para redes sociais', col: 2, st: 0, due: 5, l: [0], f: { Solicitante: 'Área comercial', Formato: 'Post', 'Rodadas de revisão': 0 }, ck: [['Fluxo', ['Briefing conferido (texto, tamanho, prazo)', 'Primeira versão', 'Revisão 1 com o solicitante', 'Ajustes (máximo 2 rodadas)', 'Arquivos finais exportados e entregues']]] },
      { t: 'Apresentação institucional', col: 0, st: 0, due: 10, l: [2], ck: [['Fluxo', ['Conteúdo de cada slide recebido', 'Modelo da identidade visual', 'Primeira versão', 'Revisão com o solicitante', 'Entrega em PPT e PDF']]] },
      { t: 'Material impresso', col: 0, st: 0, due: 12, l: [1], d: 'Peça a prova de cor da gráfica antes de aprovar a tiragem.', ck: [['Fluxo', ['Medidas e sangria da gráfica', 'Arte em CMYK', 'Prova aprovada', 'Arquivo enviado à gráfica']]] },
    ],
  },
  // ───────────────────────── Operações (mais)
  {
    id: 'estoque', area: 'Operações', icon: 'package', cover: 'cover-green', name: 'Estoque e reposição', done: 4,
    desc: 'Itens abaixo do estoque mínimo viram pedido: cotação, compra, recebimento conferido com a nota e entrada no sistema, com controle de validade e curva ABC.',
    columns: [['Abaixo do mínimo', R], ['Cotação', Y], ['Pedido feito', B], ['Recebimento', P], ['Reposto', GR]],
    labels: [['Curva A', R], ['Curva B', O], ['Curva C', S], ['Validade próxima', Y]],
    fields: [{ n: 'Item', t: 'text', card: true }, { n: 'Estoque atual', t: 'number' }, { n: 'Estoque mínimo', t: 'number' }, { n: 'Fornecedor', t: 'text' }, { n: 'Previsão de entrega', t: 'date' }],
    cards: [
      { t: 'Repor item abaixo do mínimo', col: 0, st: 0, due: 1, p: 'high', l: [0], f: { Item: 'Papel A4', 'Estoque atual': 4, 'Estoque mínimo': 10 }, ck: [['Reposição', ['Conferir o consumo médio', 'Calcular a quantidade (até o máximo)', 'Cotação com 3 fornecedores', 'Pedido aprovado e enviado']]] },
      { t: 'Receber e conferir a mercadoria', col: 3, st: 5, due: 7, dep: [0], ck: [['Recebimento', ['Quantidade x nota fiscal', 'Avarias e validade', 'Nota lançada no sistema', 'Guardar no endereço certo (o mais antigo na frente)']]] },
      { t: 'Revisar validades (mensal)', col: 0, st: 0, due: 30, l: [3], ck: [['Validade', ['Itens que vencem em 60 dias', 'Promover ou usar primeiro', 'Separar vencidos para descarte correto']]] },
      { t: 'Revisar mínimos e curva ABC (trimestral)', col: 0, st: 0, due: 90, ck: [['Revisão', ['Itens que mais pesam no valor (curva A)', 'Ajustar estoque mínimo pelo consumo', 'Itens parados há mais de 90 dias']]] },
    ],
  },
  {
    id: 'entregas', area: 'Operações', icon: 'truck', cover: 'cover-navy', name: 'Entregas e logística', done: 4,
    desc: 'Cada pedido da separação à entrega: conferência, nota fiscal, rota, comprovante assinado e tratativa de ocorrências (avaria, ausente, endereço errado).',
    columns: [['A separar', G], ['Separado e conferido', B], ['Em rota', O], ['Ocorrência', R], ['Entregue', GR]],
    labels: [['Própria', S], ['Transportadora', P], ['Expressa', R], ['Retirada', Y]],
    fields: [{ n: 'Pedido', t: 'text', card: true }, { n: 'Cliente', t: 'text' }, { n: 'Data prometida', t: 'date' }, { n: 'Código de rastreio', t: 'text' }],
    proc: { ref: 'Data prometida', refDay: 3, lead: 0, q: 'Quantos dias antes da data prometida o pedido deve sair?', title: 'Pedido' },
    rules: [{ when: 'moved', col: 'Ocorrência', act: 'priority', val: 'urgent', label: 'Ocorrência na entrega: prioridade Urgente' }],
    cards: [
      { t: 'Separar e conferir o pedido', col: 0, st: 0, due: 1, p: 'high', f: { Pedido: 'Pedido 0000', Cliente: 'Cliente Exemplo', 'Data prometida': ymd(3) }, ck: [['Separação', ['Itens e quantidades', 'Embalagem adequada', 'Etiqueta com endereço']]] },
      { t: 'Emitir a nota e agendar a coleta', col: 1, st: 1, due: 2, dep: [0], ck: [['Expedição', ['Nota fiscal emitida', 'Coleta ou rota definida', 'Código de rastreio enviado ao cliente']]] },
      { t: 'Entrega e comprovante', col: 2, st: 2, due: 3, p: 'high', dep: [1], ck: [['Entrega', ['Comprovante assinado ou foto', 'Baixa no sistema', 'Aviso ao cliente']]] },
      { t: 'Tratar ocorrências', col: 2, st: 3, due: 5, l: [1], dep: [2], d: 'Avaria, cliente ausente ou endereço errado: registre com foto e combine a nova entrega no mesmo dia.' },
    ],
  },
  {
    id: 'qualidade', area: 'Operações', icon: 'clipboard-check', cover: 'cover-purple', name: 'Auditoria interna e qualidade', done: 5,
    desc: 'Programa da auditoria, preparação das áreas, auditoria, relatório, ações corretivas com causa raiz e verificação de eficácia.',
    columns: [['Preparação', G], ['Auditoria', B], ['Não conformidades', R], ['Ação corretiva', O], ['Verificação', Y], ['Concluído', GR]],
    labels: [['Maior', R], ['Menor', Y], ['Observação', S], ['Oportunidade de melhoria', GR]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Data da auditoria', t: 'date' }, { n: 'Requisito', t: 'text' }, { n: 'Auditor', t: 'text' }],
    proc: { ref: 'Data da auditoria', refDay: 20, lead: 0, q: 'Quantos dias antes da auditoria tudo precisa estar pronto?', title: 'Área' },
    cards: [
      { t: 'Planejar o programa da auditoria', col: 0, st: 0, due: 5, p: 'high', f: { Área: 'Produção', 'Data da auditoria': ymd(20) }, ck: [['Programa', ['Áreas e processos auditados', 'Auditores sem conflito com a área', 'Lista de verificação', 'Agenda enviada às áreas']]] },
      { t: 'Revisar procedimentos e registros', col: 0, st: 5, due: 15, l: [3], dep: [0], ck: [['Documentos', ['Procedimentos atualizados', 'Registros de treinamento', 'Indicadores do período', 'Ações da auditoria anterior concluídas']]] },
      { t: 'Realizar a auditoria', col: 1, st: 20, due: 21, p: 'high', dep: [1], ck: [['Auditoria', ['Reunião de abertura', 'Entrevistas e evidências', 'Reunião de encerramento com as constatações']]] },
      { t: 'Relatório da auditoria', col: 2, st: 21, due: 24, dep: [2] },
      { t: 'Tratar as não conformidades', col: 3, st: 24, due: 45, p: 'high', l: [0], dep: [3], ck: [['Ação corretiva', ['Correção imediata', 'Causa raiz (5 porquês)', 'Plano de ação', 'Implantar']]] },
      { t: 'Verificar a eficácia', col: 4, st: 60, due: 65, dep: [4], d: 'A não conformidade só é encerrada quando o problema não voltou a acontecer.' },
    ],
  },
  // ───────────────────────── Financeiro e compras (mais)
  {
    id: 'fechamento', area: 'Financeiro e compras', icon: 'calculator', cover: 'cover-navy', name: 'Fechamento mensal', done: 3,
    desc: 'Rotina do fechamento do mês: conciliações, notas, provisões, impostos, folha, DRE e relatório gerencial, com a entrega à contabilidade no dia combinado.',
    columns: [['A fazer', G], ['Em conciliação', B], ['Revisão', Y], ['Enviado à contabilidade', GR]],
    labels: [['Bancos', S], ['Impostos', R], ['Folha', PK], ['Relatórios', P]],
    fields: [{ n: 'Mês', t: 'text', card: true }, { n: 'Dia do fechamento', t: 'date' }, { n: 'Resultado do mês', t: 'money' }],
    proc: { ref: 'Dia do fechamento', refDay: 10, lead: 0, q: 'Quantos dias antes do dia do fechamento tudo deve estar pronto?', title: 'Mês' },
    cards: [
      { t: 'Conciliar contas bancárias e cartões', col: 1, st: 0, due: 3, p: 'high', l: [0], f: { Mês: 'Mês de referência', 'Dia do fechamento': ymd(10) }, ck: [['Conciliação', ['Extratos de todas as contas', 'Recebimentos de cartão x adquirente', 'Tarifas e juros lançados', 'Saldos batendo com o sistema']]] },
      { t: 'Lançar notas de entrada e saída', col: 0, st: 0, due: 4, ck: [['Notas', ['Notas de fornecedores recebidas', 'Notas emitidas', 'Notas canceladas conferidas']]] },
      { t: 'Provisões do mês', col: 0, st: 3, due: 5, ck: [['Provisões', ['Férias e 13º', 'Contas a pagar sem nota', 'Receitas a faturar']]] },
      { t: 'Apurar os impostos do mês', col: 0, st: 4, due: 7, p: 'high', l: [1], dep: [1] },
      { t: 'Conferir a folha de pagamento', col: 0, st: 2, due: 5, l: [2] },
      { t: 'DRE e relatório gerencial', col: 2, st: 7, due: 9, l: [3], dep: [0, 2, 3, 4], ck: [['Relatório', ['DRE do mês x orçamento', 'Fluxo de caixa', 'Contas a receber vencidas', 'Comentários das variações']]] },
      { t: 'Enviar os documentos à contabilidade', col: 2, st: 9, due: 10, p: 'high', dep: [5] },
    ],
  },
  {
    id: 'reembolso', area: 'Financeiro e compras', icon: 'wallet', cover: 'cover-green', name: 'Reembolso de despesas', done: 3,
    desc: 'Colaboradores pedem reembolso pelo formulário com valor e comprovante; o gestor aprova, o financeiro confere a política e paga na data combinada.',
    columns: [['Solicitado', G], ['Aprovado pelo gestor', B], ['Conferido', Y], ['Pago', GR], ['Recusado', R]],
    labels: [['Viagem', S], ['Alimentação', O], ['Transporte', P], ['Outros', G]],
    fields: [{ n: 'Valor', t: 'money', card: true }, { n: 'Colaborador', t: 'text' }, { n: 'Data da despesa', t: 'date' }, { n: 'Centro de custo', t: 'text' }],
    rules: [{ when: 'created', act: 'due', val: 5, label: 'Pedido novo: decidir em até 5 dias' }, { when: 'moved', col: 'Pago', act: 'notify', label: 'Reembolso pago: avisar o responsável' }],
    form: { title: 'Pedir reembolso', intro: 'Informe a despesa e o link do comprovante. O pagamento sai depois da aprovação do seu gestor.', col: 'Solicitado', due: 5, q: [['Descrição da despesa', 'text', true], ['Valor (R$)', 'number', true], ['Categoria', 'select', true, ['Viagem', 'Alimentação', 'Transporte', 'Outros']], ['Data da despesa', 'date', true], ['Seu nome', 'text', true], ['Link do comprovante (foto/PDF)', 'text', true]] },
    cards: [
      { t: 'Reembolso de despesa', col: 1, st: 0, due: 5, l: [2], f: { Valor: 86.5, Colaborador: 'Pessoa A', 'Data da despesa': ymd(-2) }, ck: [['Fluxo', ['Aprovação do gestor', 'Comprovante legível em nome da empresa ou do colaborador', 'Dentro da política (limites por categoria)', 'Centro de custo', 'Pagamento e aviso ao colaborador']]] },
      { t: 'Prestação de contas de viagem', col: 0, st: 0, due: 7, l: [0], ck: [['Viagem', ['Adiantamento recebido', 'Todos os comprovantes', 'Saldo a devolver ou a receber', 'Relatório da viagem']]] },
      { t: 'Revisar a política de reembolso (semestral)', col: 0, st: 0, due: 180, ck: [['Política', ['Limites por categoria', 'Despesas mais pedidas', 'Prazo para pedir após a despesa']]] },
    ],
  },
  // ───────────────────────── Projetos e tecnologia (mais)
  {
    id: 'bugs', area: 'Projetos e tecnologia', icon: 'bug', cover: 'cover-purple', name: 'Bugs e incidentes', done: 4,
    desc: 'Problemas reportados pelo formulário com gravidade e prazo; investigação, correção, teste, publicação e comunicação aos afetados, mais revisão das causas.',
    columns: [['Reportado', G], ['Investigando', B], ['Corrigindo', O], ['Em teste', Y], ['Resolvido', GR], ['Não é bug', R]],
    labels: [['Crítico', R], ['Alto', O], ['Médio', Y], ['Baixo', S]],
    fields: [{ n: 'Gravidade', t: 'select', o: ['Crítica', 'Alta', 'Média', 'Baixa'], card: true }, { n: 'Sistema', t: 'text' }, { n: 'Usuários afetados', t: 'number' }, { n: 'Versão', t: 'text' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Bug novo: primeira análise em 2 dias' }, { when: 'moved', col: 'Investigando', act: 'notify', label: 'Em investigação: avisar o responsável' }],
    form: { title: 'Reportar um problema', intro: 'Descreva o que aconteceu e como repetir. Isso ajuda a corrigir mais rápido.', col: 'Reportado', due: 2, prio: 'high', q: [['Resumo do problema', 'text', true], ['Onde aconteceu (sistema/tela)', 'text', true], ['O que você fez e o que aconteceu', 'long', true], ['Quantas pessoas são afetadas?', 'select', false, ['Só eu', 'Algumas', 'Todos']], ['Seu e-mail', 'email', true]] },
    cards: [
      { t: 'Bug reportado', col: 1, st: 0, due: 2, p: 'high', l: [1], f: { Gravidade: 'Alta', Sistema: 'Portal', 'Usuários afetados': 30 }, ck: [['Correção', ['Reproduzir o problema', 'Definir a gravidade', 'Encontrar a causa', 'Corrigir', 'Testar a correção e o que está em volta', 'Publicar', 'Avisar quem reportou']]] },
      { t: 'Incidente crítico (sistema fora do ar)', col: 0, st: 0, due: 0, p: 'urgent', l: [0], ck: [['Incidente', ['Avisar os usuários afetados', 'Contornar (voltar versão, desligar recurso)', 'Corrigir a causa', 'Comunicar o fim do incidente', 'Relatório pós-incidente']]] },
      { t: 'Revisão mensal dos bugs', col: 0, st: 0, due: 30, ck: [['Revisão', ['Bugs que voltaram', 'Áreas com mais problemas', 'Testes automáticos que faltam']]] },
    ],
  },
  {
    id: 'implantacao', area: 'Projetos e tecnologia', icon: 'server', cover: 'cover-navy', name: 'Implantação de sistema', done: 5,
    desc: 'Troca ou implantação de um sistema: levantamento, escolha e contrato, configuração, migração de dados, testes, treinamento, entrada no ar e acompanhamento.',
    columns: [['Levantamento', G], ['Configuração', B], ['Migração de dados', P], ['Treinamento', Y], ['Entrada no ar', O], ['Concluído', GR]],
    labels: [['Fornecedor', S], ['TI', B], ['Usuários', PK], ['Risco', R]],
    fields: [{ n: 'Sistema', t: 'text', card: true }, { n: 'Data de entrada no ar', t: 'date' }, { n: 'Fornecedor', t: 'text' }, { n: 'Usuários', t: 'number' }],
    proc: { ref: 'Data de entrada no ar', refDay: 40, lead: 0, q: 'Quantos dias antes da entrada no ar tudo deve estar pronto?', title: 'Sistema' },
    cards: [
      { t: 'Levantar processos e requisitos', col: 0, st: 0, due: 7, p: 'high', l: [1, 2], f: { Sistema: 'Novo sistema', 'Data de entrada no ar': ymd(40), Fornecedor: 'Fornecedor Exemplo' }, ck: [['Levantamento', ['Como é feito hoje', 'O que precisa mudar', 'Integrações necessárias', 'Usuários-chave de cada área']]] },
      { t: 'Configurar o sistema', col: 1, st: 8, due: 20, l: [0, 1], dep: [0], ck: [['Configuração', ['Cadastros básicos', 'Permissões por perfil', 'Integrações', 'Modelos e relatórios']]] },
      { t: 'Migrar e validar os dados', col: 2, st: 18, due: 28, p: 'high', l: [1, 3], dep: [1], ck: [['Migração', ['Exportar do sistema antigo', 'Limpar dados duplicados ou errados', 'Importar', 'Conferir amostras com os usuários']]] },
      { t: 'Testes com os usuários-chave', col: 2, st: 26, due: 32, l: [2], dep: [2], ck: [['Testes', ['Rotinas do dia a dia', 'Relatórios', 'Integrações']]] },
      { t: 'Treinar os usuários', col: 3, st: 28, due: 36, l: [2], dep: [1], ck: [['Treinamento', ['Turmas por área', 'Manual ou vídeos', 'Quem tira dúvidas']]] },
      { t: 'Entrada no ar', col: 4, st: 40, due: 40, p: 'urgent', l: [1, 2], dep: [3, 4], ck: [['Go-live', ['Plano de volta (rollback)', 'Congelar o sistema antigo', 'Comunicar a empresa', 'Plantão de suporte']]] },
      { t: 'Acompanhamento da 1ª semana', col: 4, st: 40, due: 47, dep: [5] },
    ],
  },
  // ───────────────────────── Gestão e administração
  {
    id: 'reunioes', area: 'Gestão e administração', icon: 'users', cover: 'cover-navy', name: 'Reuniões, decisões e plano de ação 5W2H', done: 5,
    desc: 'Pauta, ata e decisões, e cada encaminhamento vira uma ação 5W2H (o quê, por quê, onde, quando, quem, como e quanto custa) acompanhada até a próxima reunião.',
    columns: [['Pauta da próxima reunião', G], ['Em discussão', B], ['Decidido', P], ['Ações em andamento', O], ['Atrasadas', R], ['Concluídas', GR]],
    labels: [['Estratégico', P], ['Financeiro', Y], ['Pessoas', PK], ['Operacional', S]],
    fields: [{ n: 'Reunião', t: 'date', card: true }, { n: 'Por quê', t: 'text' }, { n: 'Onde', t: 'text' }, { n: 'Como', t: 'text' }, { n: 'Quanto custa', t: 'money' }],
    proc: { ref: 'Reunião', refDay: 7, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data da reunião)', title: '' },
    rules: [{ when: 'moved', col: 'Ações em andamento', act: 'due', val: 7, label: 'Nova ação: prazo de 7 dias' }],
    cards: [
      { t: 'Montar e enviar a pauta', col: 0, st: 0, due: 5, p: 'high', f: { Reunião: ymd(7) }, ck: [['Pauta', ['Ações pendentes da reunião anterior (primeiro item)', 'Assuntos com tempo e responsável', 'Material enviado antes']]] },
      { t: 'Revisar as ações da reunião anterior', col: 1, st: 7, due: 7, p: 'high', dep: [0], d: 'Comece a reunião pelo que ficou pendente: é assim que os combinados saem do papel.' },
      { t: 'Registrar a ata e as decisões', col: 2, st: 7, due: 8, dep: [1], ck: [['Ata', ['Decisões tomadas', 'Quem participou', 'Assuntos para a próxima']]] },
      { t: 'Transformar cada encaminhamento em ação 5W2H', col: 2, st: 8, due: 9, p: 'high', dep: [2], d: 'O quê = título · Quem = responsável · Quando = prazo · Por quê, Onde, Como e Quanto custa = campos do card.' },
      { t: 'Acompanhar as ações até a próxima reunião', col: 3, st: 9, due: 14, dep: [3] },
    ],
  },
  {
    id: 'planejamento', area: 'Gestão e administração', icon: 'compass', cover: 'cover-purple', name: 'Planejamento estratégico anual', done: 5,
    desc: 'Diagnóstico, missão e objetivos do ano, metas e orçamento por área, plano de ação e revisões trimestrais com indicadores.',
    columns: [['Diagnóstico', G], ['Objetivos', B], ['Plano de ação', P], ['Em execução', O], ['Revisão trimestral', Y], ['Concluído', GR]],
    labels: [['Comercial', GR], ['Operações', S], ['RH', PK], ['Financeiro', Y]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Indicador', t: 'text' }, { n: 'Meta', t: 'number' }, { n: 'Início do ano', t: 'date' }],
    proc: { ref: 'Início do ano', refDay: 45, lead: 0, q: 'Quantos dias antes do início do ano o plano deve estar pronto?', title: 'Área' },
    cards: [
      { t: 'Diagnóstico e análise SWOT', col: 0, st: 0, due: 10, p: 'high', f: { Área: 'Empresa toda', 'Início do ano': ymd(45) }, ck: [['SWOT', ['Forças', 'Fraquezas', 'Oportunidades', 'Ameaças', 'Resultados do ano anterior']]] },
      { t: 'Definir os objetivos do ano', col: 1, st: 10, due: 20, p: 'high', dep: [0], ck: [['Objetivos', ['No máximo 5 objetivos', 'Um indicador e uma meta para cada', 'Aprovação da diretoria']]] },
      { t: 'Orçamento do ano', col: 1, st: 15, due: 30, l: [3], dep: [1] },
      { t: 'Plano de ação — Comercial', col: 2, st: 20, due: 35, l: [0], f: { Área: 'Comercial', Indicador: 'Faturamento', Meta: 20 }, dep: [1] },
      { t: 'Plano de ação — Pessoas', col: 2, st: 20, due: 35, l: [2], f: { Área: 'Pessoas', Indicador: 'Turnover', Meta: 10 }, dep: [1] },
      { t: 'Apresentar o plano a toda a empresa', col: 2, st: 40, due: 45, dep: [2, 3, 4] },
      { t: 'Revisão do 1º trimestre', col: 4, st: 135, due: 140, dep: [5], ck: [['Revisão', ['Indicadores x metas', 'Ações atrasadas', 'Ajustes no plano']]] },
    ],
  },
  {
    id: 'fornecedores', area: 'Gestão e administração', icon: 'building', cover: 'cover-green', name: 'Homologação e avaliação de fornecedores', done: 3,
    desc: 'Cadastro e homologação com documentos e due diligence, avaliação periódica (prazo, qualidade, preço) e bloqueio de quem não atende.',
    columns: [['Novos', G], ['Documentação', B], ['Avaliação', Y], ['Homologado', GR], ['Bloqueado', R]],
    labels: [['Crítico', R], ['Serviços', S], ['Materiais', O], ['Trata dados pessoais', P]],
    fields: [{ n: 'Fornecedor', t: 'text', card: true }, { n: 'CNPJ', t: 'text' }, { n: 'Vencimento do contrato', t: 'date' }, { n: 'Nota', t: 'number' }],
    rules: [{ when: 'moved', col: 'Bloqueado', act: 'notify', label: 'Fornecedor bloqueado: avisar o responsável' }],
    cards: [
      { t: 'Homologar novo fornecedor', col: 1, st: 0, due: 7, p: 'high', l: [1], f: { Fornecedor: 'Fornecedor Exemplo' }, ck: [['Documentos', ['Contrato social e cartão CNPJ', 'Certidões negativas (federal, FGTS, trabalhista)', 'Dados bancários em nome do CNPJ', 'Referências de outros clientes', 'Acordo de proteção de dados, se tratar dados pessoais']]] },
      { t: 'Avaliação semestral', col: 2, st: 0, due: 180, ck: [['Critérios', ['Prazo de entrega', 'Qualidade', 'Preço x mercado', 'Atendimento', 'Certidões em dia']]] },
      { t: 'Plano de ação com fornecedor mal avaliado', col: 2, st: 180, due: 200, dep: [1], d: 'Combine melhorias com prazo; sem melhora, bloqueie e busque alternativa.' },
    ],
  },
  // ───────────────────────── Departamento Pessoal (rotinas com prazo legal)
  {
    id: 'dp-folha', area: 'Departamento Pessoal', icon: 'banknote', cover: 'cover-green', name: 'Folha de pagamento do mês',
    desc: 'Fechamento do ponto, variáveis, cálculo, conferência, pagamento até o 5º dia útil e guias (FGTS Digital e DCTFWeb até o dia 20).',
    columns: [['Coleta de variáveis', G], ['Cálculo', B], ['Conferência', Y], ['Pagamento e guias', O], ['Fechado', GR]],
    labels: [['Ponto', S], ['Variáveis', P], ['Encargos', R], ['Benefícios', PK]],
    fields: [{ n: 'Competência', t: 'text', card: true }, { n: 'Data do pagamento', t: 'date' }, { n: 'Total líquido', t: 'money' }],
    proc: { ref: 'Data do pagamento', refDay: 12, lead: 0, q: 'Quantos dias antes da data de pagamento a folha deve estar fechada?', title: 'Competência' },
    cards: [
      { t: 'Fechar o ponto e tratar divergências', col: 0, st: 0, due: 4, p: 'high', l: [0], f: { Competência: 'Mês de referência', 'Data do pagamento': ymd(12) }, ck: [['Ponto', ['Faltas e atrasos', 'Horas extras aprovadas', 'Banco de horas', 'Atestados lançados']]] },
      { t: 'Lançar variáveis (comissões, adicionais, descontos)', col: 0, st: 2, due: 6, l: [1], ck: [['Variáveis', ['Comissões', 'Adicional noturno/insalubridade', 'Pensão alimentícia', 'Consignado', 'Adiantamento']]] },
      { t: 'Calcular a folha', col: 1, st: 6, due: 8, p: 'high', dep: [0, 1] },
      { t: 'Conferir a folha e os encargos', col: 2, st: 8, due: 10, p: 'high', l: [2], dep: [2], ck: [['Conferência', ['Comparar com o mês anterior', 'Admitidos e desligados do mês', 'INSS/IRRF', 'FGTS']]] },
      { t: 'Pagar salários e disponibilizar holerites', col: 3, st: 11, due: 12, p: 'urgent', dep: [3], d: 'Prazo legal: até o 5º dia útil do mês seguinte.' },
      { t: 'Enviar eventos ao eSocial e emitir guias', col: 3, st: 12, due: 18, l: [2], dep: [3], ck: [['Guias', ['Fechamento dos eventos periódicos', 'DCTFWeb (vence dia 20)', 'FGTS Digital (vence dia 20)']]] },
    ],
  },
  {
    id: 'dp-afastamentos', area: 'Departamento Pessoal', icon: 'stethoscope', cover: 'cover-navy', name: 'Atestados, afastamentos e retorno', done: 5,
    desc: 'Do atestado recebido ao retorno ao trabalho: lançamento no ponto, afastamentos de mais de 15 dias no INSS, eSocial, exame de retorno, estabilidade e readaptação.',
    columns: [['Recebido', G], ['Lançado', B], ['Afastado (INSS)', P], ['Preparando o retorno', Y], ['Readaptação', O], ['Retornou', GR]],
    labels: [['DP', Y], ['RH', PK], ['Gestor', O], ['Saúde', R], ['Acidente de trabalho', R], ['Maternidade', PK]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Início do afastamento', t: 'date' }, { n: 'Dias de atestado', t: 'number' }, { n: 'Tipo', t: 'select', o: ['Doença', 'Acidente de trabalho', 'Licença-maternidade', 'Licença-paternidade', 'Outro'] }, { n: 'Fim da estabilidade', t: 'date' }],
    proc: { ref: 'Início do afastamento', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do início do afastamento)', title: 'Colaborador' },
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Atestado novo: lançar em até 2 dias' }],
    form: { title: 'Enviar atestado', intro: 'Envie seu atestado para o Departamento Pessoal. Guarde o original até o DP confirmar o recebimento.', col: 'Recebido', due: 2, q: [['Seu nome', 'text', true], ['Primeiro dia do atestado', 'date', true], ['Quantidade de dias', 'number', true], ['Link da foto ou PDF do atestado', 'text', true], ['Observações', 'long', false]] },
    cards: [
      { t: 'Receber e validar o atestado', col: 0, st: 0, due: 1, p: 'high', l: [0], f: { Colaborador: 'Nome do colaborador', 'Início do afastamento': ymd(0), 'Dias de atestado': 20, Tipo: 'Doença' }, ck: [['Validação', ['Nome, data e dias de afastamento legíveis', 'Assinatura e registro do profissional', 'Somar com atestados do mesmo motivo nos últimos 60 dias']]] },
      { t: 'Lançar no ponto e avisar o gestor', col: 1, st: 0, due: 2, l: [0, 2], dep: [0] },
      { t: 'Encaminhar ao INSS (mais de 15 dias)', col: 2, st: 1, due: 5, p: 'high', l: [0], dep: [0], d: 'A empresa paga os 15 primeiros dias; a partir do 16º, o colaborador é encaminhado ao INSS (Lei 8.213 art. 60).', ck: [['INSS', ['Requerimento do benefício (Meu INSS)', 'Afastamento no eSocial (S-2230)', 'Acompanhar a perícia e o resultado']]] },
      { t: 'Acidente de trabalho: emitir a CAT', col: 2, st: 0, due: 1, p: 'urgent', l: [4], dep: [0], d: 'Só quando o afastamento for por acidente ou doença do trabalho: CAT até o 1º dia útil seguinte (veja o modelo Acidente de trabalho).' },
      { t: 'Acompanhar o colaborador afastado', col: 2, st: 15, due: 45, l: [1], dep: [2], d: 'Um contato a cada 15 dias, sem cobrar trabalho: só para saber como está e se precisa de algo.' },
      { t: 'Exame de retorno ao trabalho', col: 3, st: 40, due: 44, p: 'high', l: [3], dep: [2], d: 'Obrigatório antes de voltar quando o afastamento por doença ou acidente foi de 30 dias ou mais (NR-7).', ck: [['Exame', ['Agendar na clínica', 'ASO de retorno recebido', 'Restrições médicas anotadas']]] },
      { t: 'Preparar a volta: acessos, ponto e estação', col: 3, st: 40, due: 44, l: [0], dep: [2], ck: [['Preparação', ['Reativar acessos', 'Escala e ponto', 'Retomar benefícios']]] },
      { t: 'Registrar o retorno e a estabilidade', col: 3, st: 44, due: 45, p: 'high', l: [0], dep: [5], d: 'Acidente de trabalho: estabilidade de 12 meses após o fim do auxílio-doença acidentário (Lei 8.213 art. 118). Gestante: até 5 meses após o parto (ADCT art. 10).', ck: [['DP', ['Retorno informado no eSocial', 'Fim da estabilidade anotado', 'Intervalos para amamentação, se for o caso (CLT art. 396)']]] },
      { t: 'Conversa de retorno com o gestor', col: 4, st: 45, due: 45, l: [2], dep: [5, 6], ck: [['Conversa', ['O que mudou no período', 'Prioridades das primeiras semanas', 'Ajustes por restrição médica']]] },
      { t: 'Acompanhamento de 30 dias após a volta', col: 4, st: 74, due: 76, l: [1, 2], dep: [8] },
    ],
  },
  {
    id: 'dp-ponto', area: 'Departamento Pessoal', icon: 'clock', cover: 'cover-purple', name: 'Fechamento do ponto e banco de horas',
    desc: 'O fechamento do ponto do mês como processo: marcações, inconsistências, atestados, aprovação das horas extras pelos gestores, saldo do banco de horas, espelho assinado e envio para a folha. Inclui formulário de pedido de ajuste.',
    columns: [['Pedidos de ajuste', G], ['Coleta e conferência', B], ['Aprovação dos gestores', Y], ['Banco de horas e espelho', P], ['Lançado na folha', GR]],
    labels: [['Esqueceu de marcar', S], ['Hora extra', O], ['Banco de horas', P], ['Falta ou atraso', R], ['Atestado', PK]],
    fields: [{ n: 'Competência', t: 'text', card: true }, { n: 'Fechamento do ponto', t: 'date' }, { n: 'Colaborador', t: 'text' }, { n: 'Horas', t: 'number' }],
    proc: { ref: 'Fechamento do ponto', refDay: 7, lead: 0, q: 'Quantos dias antes do fechamento da folha o ponto deve estar fechado?', title: 'Competência' },
    form: { title: 'Ajuste de ponto', intro: 'Peça um ajuste de marcação ou informe horas extras. Seu gestor aprova antes do fechamento do ponto.', col: 'Pedidos de ajuste', due: 3, q: [['Seu nome', 'text', true], ['Data', 'date', true], ['O que precisa ajustar?', 'select', true, ['Esqueci de marcar', 'Hora extra', 'Compensação de banco de horas', 'Falta ou atraso justificado', 'Outro']], ['Horário correto ou quantidade de horas', 'text', true], ['Justificativa', 'long', true]] },
    cards: [
      { t: 'Exportar as marcações do período', col: 1, st: 0, due: 1, p: 'high', f: { Competência: 'Mês de referência', 'Fechamento do ponto': ymd(7) }, ck: [['Coleta', ['Relógio ou aplicativo de ponto', 'Marcações de quem trabalha externo', 'Escalas e plantões do mês', 'Pedidos de ajuste recebidos pelo formulário']]] },
      { t: 'Tratar as inconsistências', col: 1, st: 1, due: 3, p: 'high', l: [0, 3], dep: [0], d: 'Marcação corrigida precisa de justificativa e ciência do colaborador.', ck: [['Inconsistências', ['Marcações faltando (esqueceu de bater)', 'Atrasos e saídas antecipadas', 'Intervalo de almoço menor que o mínimo', 'Descanso entre jornadas menor que 11 horas (CLT art. 66)', 'Faltas sem justificativa']]] },
      { t: 'Lançar atestados e abonos', col: 1, st: 1, due: 3, l: [4], dep: [0], ck: [['Abonos', ['Atestados médicos do mês', 'Faltas legais (casamento, falecimento, doação de sangue…)', 'Declarações de comparecimento']]] },
      { t: 'Aprovar as horas extras com os gestores', col: 2, st: 3, due: 5, p: 'high', l: [1], dep: [1], d: 'Limite de 2 horas extras por dia (CLT art. 59). Hora extra trabalhada sem autorização também precisa ser paga.', ck: [['Aprovação', ['Relatório de horas enviado a cada gestor', 'Justificativa das horas', 'Pagar ou mandar para o banco de horas']]] },
      { t: 'Apurar o saldo do banco de horas', col: 3, st: 5, due: 6, l: [2], dep: [3], d: 'Acordo individual: compensar em até 6 meses; acordo ou convenção coletiva: em até 1 ano (CLT art. 59). Saldo não compensado no prazo é pago como hora extra.', ck: [['Banco de horas', ['Saldo de cada pessoa', 'Horas que vencem no próximo mês', 'Avisar os gestores sobre saldos altos']]] },
      { t: 'Disponibilizar o espelho de ponto', col: 3, st: 6, due: 7, l: [0], dep: [1, 2, 3], ck: [['Espelho', ['Gerar o espelho de cada colaborador', 'Colher a ciência ou assinatura', 'Corrigir as contestações']]] },
      { t: 'Lançar horas extras, faltas e DSR na folha', col: 3, st: 7, due: 7, p: 'urgent', l: [1, 3], dep: [4, 5], d: 'Falta injustificada na semana também desconta o descanso semanal remunerado (DSR).' },
    ],
  },
  {
    id: 'dp-duvidas', area: 'Departamento Pessoal', icon: 'message-circle-question', cover: 'cover-green', name: 'Central de atendimento do DP', done: 3,
    desc: 'Pedidos e dúvidas dos colaboradores ao Departamento Pessoal com prazo de resposta: holerite, declarações, informe de rendimentos, benefícios e férias. Cada tipo de pedido já vem com o passo a passo.',
    columns: [['Novo', G], ['Em atendimento', B], ['Aguardando colaborador', Y], ['Resolvido', GR]],
    labels: [['Holerite', S], ['Declaração', P], ['Informe de rendimentos', O], ['Benefícios', PK], ['Cadastro', G]],
    fields: [{ n: 'Solicitante', t: 'text', card: true }, { n: 'Tipo', t: 'select', o: ['Holerite', 'Declaração', 'Informe de rendimentos', 'Benefícios', 'Férias', 'Atualização de cadastro', 'Outros'] }, { n: 'Satisfação', t: 'select', o: ['Ótimo', 'Bom', 'Regular', 'Ruim'] }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Pedido novo: responder em até 2 dias' }, { when: 'moved', col: 'Em atendimento', act: 'notify', label: 'Em atendimento: avisar o responsável' }],
    form: { title: 'Fale com o DP', intro: 'Mande sua dúvida ou pedido ao Departamento Pessoal. Respondemos em até 2 dias úteis.', col: 'Novo', due: 2, q: [['Assunto', 'text', true], ['Tipo', 'select', true, ['Holerite', 'Declaração', 'Informe de rendimentos', 'Benefícios', 'Férias', 'Atualização de cadastro', 'Outros']], ['Detalhes', 'long', true], ['Seu nome', 'text', true], ['Seu e-mail', 'email', true]] },
    cards: [
      { t: 'Declaração de vínculo ou de salário', col: 1, st: 0, due: 2, l: [1], f: { Solicitante: 'Nome do colaborador', Tipo: 'Declaração' }, ck: [['Passo a passo', ['Confirmar para que serve (banco, aluguel, escola)', 'Emitir no modelo da empresa', 'Assinatura do responsável', 'Enviar em PDF e registrar']]] },
      { t: 'Dúvida ou erro no holerite', col: 0, st: 0, due: 2, l: [0], ck: [['Passo a passo', ['Identificar a verba questionada', 'Conferir ponto, variáveis e descontos', 'Explicar ou corrigir na próxima folha', 'Responder por escrito']]] },
      { t: 'Informe de rendimentos', col: 0, st: 0, due: 2, l: [2], d: 'O informe do ano anterior é entregue até o último dia útil de fevereiro.', ck: [['Passo a passo', ['Gerar no sistema da folha', 'Conferir CPF e valores', 'Enviar ao colaborador']]] },
      { t: 'Atualização de cadastro (endereço, dependentes, banco)', col: 0, st: 0, due: 3, l: [4], ck: [['Passo a passo', ['Receber o comprovante', 'Atualizar no sistema da folha', 'Enviar a alteração ao eSocial (S-2205) quando necessário', 'Ajustar vale-transporte e dependentes de IR/plano']]] },
      { t: 'Revisão semanal dos pedidos', col: 0, st: 0, due: 7, ck: [['Revisão', ['Pedidos fora do prazo', 'Dúvidas que se repetem (viram comunicado ou base de conhecimento)', 'Satisfação dos atendimentos']]] },
    ],
  },
  {
    id: 'dp-beneficios', area: 'Departamento Pessoal', icon: 'gift', cover: 'cover-orange', name: 'Benefícios: inclusões, exclusões e renovação', done: 4,
    desc: 'Movimentações de plano de saúde, odontológico, vale-refeição e vale-transporte antes do corte da operadora, mais a conferência da fatura e a renovação anual do contrato.',
    columns: [['Solicitado', G], ['Documentos', B], ['Enviado à operadora', P], ['Conferência da fatura', Y], ['Ativo', GR], ['Cancelado', R]],
    labels: [['Saúde', R], ['Odonto', S], ['Refeição/alimentação', O], ['Transporte', P], ['Renovação', Y]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Benefício', t: 'select', o: ['Plano de saúde', 'Odontológico', 'Vale-refeição', 'Vale-alimentação', 'Vale-transporte', 'Seguro de vida'] }, { n: 'Movimento', t: 'select', o: ['Inclusão', 'Exclusão', 'Inclusão de dependente', 'Troca de plano'] }, { n: 'Data de corte', t: 'date' }],
    proc: { ref: 'Data de corte', refDay: 7, lead: 0, q: 'Quantos dias antes do corte da operadora tudo deve ser enviado?', title: 'Colaborador' },
    cards: [
      { t: 'Receber o pedido e conferir a regra do benefício', col: 0, st: 0, due: 1, l: [0], f: { Colaborador: 'Nome do colaborador', Benefício: 'Plano de saúde', Movimento: 'Inclusão de dependente', 'Data de corte': ymd(7) }, ck: [['Regra', ['Quem pode ser dependente', 'Carência', 'Coparticipação e desconto em folha']]] },
      { t: 'Reunir os documentos', col: 1, st: 1, due: 4, l: [0], dep: [0], ck: [['Documentos', ['Certidão de nascimento ou casamento do dependente', 'CPF do dependente', 'Formulário da operadora assinado', 'Autorização de desconto em folha']]] },
      { t: 'Enviar a movimentação antes do corte', col: 2, st: 4, due: 7, p: 'high', l: [0], dep: [1], d: 'O que for enviado depois do corte só entra no mês seguinte.' },
      { t: 'Conferir a fatura do mês', col: 3, st: 10, due: 15, l: [0], dep: [2], ck: [['Fatura', ['Vidas cobradas x quadro ativo', 'Desligados ainda cobrados', 'Coparticipação lançada na folha']]] },
      { t: 'Confirmar ativação e avisar o colaborador', col: 3, st: 12, due: 15, l: [0], dep: [2], ck: [['Ativação', ['Carteirinha ou cartão emitido', 'Orientar o uso (rede, app, reembolso)']]] },
      { t: 'Renovação anual e reajuste', col: 0, st: 0, due: 60, l: [4], d: 'Peça o relatório de sinistralidade e negocie 60 dias antes do aniversário do contrato.', ck: [['Renovação', ['Relatório de sinistralidade', 'Cotar outras operadoras', 'Negociar o reajuste', 'Comunicar mudanças aos colaboradores']]] },
    ],
  },
  {
    id: 'dp-cat', area: 'Segurança do trabalho', icon: 'hard-hat', cover: 'cover-purple', name: 'Acidente de trabalho (CAT)', done: 5,
    desc: 'Atendimento ao acidentado, CAT até o 1º dia útil seguinte, afastamento e estabilidade, investigação da causa raiz com a CIPA e ações para não repetir.',
    columns: [['Ocorrido', R], ['CAT e eSocial', O], ['Investigação', B], ['Ações preventivas', P], ['Acompanhamento', Y], ['Encerrado', GR]],
    labels: [['Típico', R], ['Trajeto', Y], ['Doença ocupacional', P], ['Quase acidente', S], ['CIPA', O]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Data do acidente', t: 'date' }, { n: 'Local', t: 'text' }, { n: 'Afastamento', t: 'checkbox' }, { n: 'Dias afastado', t: 'number' }],
    proc: { ref: 'Data do acidente', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do acidente)', title: 'Colaborador' },
    rules: [{ when: 'created', act: 'priority', val: 'urgent', label: 'Acidente registrado: prioridade Urgente' }],
    cards: [
      { t: 'Atender o acidentado e registrar a ocorrência', col: 0, st: 0, due: 0, p: 'urgent', l: [0], f: { Colaborador: 'Nome do colaborador', 'Data do acidente': ymd(0), Local: 'Setor' }, ck: [['Primeiro atendimento', ['Socorro e encaminhamento médico', 'Isolar o local se houver risco', 'Fotos e nomes das testemunhas', 'Avisar o gestor e o SESMT']]] },
      { t: 'Emitir a CAT (S-2210)', col: 1, st: 0, due: 1, p: 'urgent', l: [0], dep: [0], d: 'Até o 1º dia útil após o acidente; em caso de morte, imediatamente (Lei 8.213 art. 22). Vale também para trajeto e doença ocupacional.', ck: [['CAT', ['Atestado ou relatório médico', 'Descrição do acidente', 'Envio do S-2210 ao eSocial', 'Cópia ao acidentado e ao sindicato']]] },
      { t: 'Afastamento e estabilidade', col: 1, st: 1, due: 3, l: [0], dep: [1], d: 'Mais de 15 dias de afastamento: INSS (auxílio-doença acidentário) e estabilidade de 12 meses após a volta (Lei 8.213 art. 118). Siga no modelo Atestados, afastamentos e retorno.' },
      { t: 'Investigar a causa raiz com a CIPA', col: 2, st: 1, due: 7, p: 'high', l: [4], dep: [0], ck: [['Investigação', ['Ouvir o acidentado e as testemunhas', 'Analisar o local, a máquina e o procedimento', 'Árvore de causas ou 5 porquês', 'Relatório assinado com a CIPA']]] },
      { t: 'Implantar as ações preventivas', col: 3, st: 7, due: 30, p: 'high', dep: [3], ck: [['Ações', ['Corrigir a condição insegura', 'Revisar o procedimento', 'Treinar a equipe', 'Revisar EPIs', 'Atualizar o PGR']]] },
      { t: 'Verificar a eficácia (30 dias)', col: 4, st: 37, due: 40, dep: [4] },
    ],
  },
  {
    id: 'dp-trabalhista', area: 'Departamento Pessoal', icon: 'scale', cover: 'cover-navy', name: 'Processos trabalhistas', done: 6,
    desc: 'Reclamação trabalhista do começo ao fim: citação, documentos para a defesa, preposto e testemunhas, audiência, acordo ou sentença, pagamento e prevenção para não se repetir.',
    columns: [['Citação recebida', R], ['Documentos para defesa', B], ['Audiência', Y], ['Acordo ou sentença', P], ['Pagamento', O], ['Prevenção', S], ['Arquivado', GR]],
    labels: [['Horas extras', O], ['Verbas rescisórias', B], ['Insalubridade', Y], ['Dano moral', R], ['Vínculo', P]],
    fields: [{ n: 'Reclamante', t: 'text', card: true }, { n: 'Número do processo', t: 'text' }, { n: 'Data da audiência', t: 'date' }, { n: 'Valor da causa', t: 'money' }, { n: 'Advogado', t: 'text' }],
    proc: { ref: 'Data da audiência', refDay: 30, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da audiência)', title: 'Reclamante' },
    rules: [{ when: 'created', act: 'priority', val: 'high', label: 'Processo novo: prioridade Alta' }],
    cards: [
      { t: 'Registrar a citação e avisar o advogado', col: 0, st: 0, due: 1, p: 'urgent', f: { Reclamante: 'Ex-colaborador', 'Número do processo': '0000000-00.0000.0.00.0000', 'Data da audiência': ymd(30) }, ck: [['Registro', ['Data e forma da citação', 'Data e tipo da audiência', 'Pedidos da reclamação', 'Enviar ao advogado no mesmo dia']]] },
      { t: 'Reunir os documentos para a defesa', col: 1, st: 1, due: 15, p: 'high', l: [0, 1], dep: [0], ck: [['Documentos', ['Contrato e aditivos', 'Cartões de ponto', 'Holerites e recibos', 'Rescisão e comprovantes de pagamento', 'Advertências, avaliações e e-mails relevantes']]] },
      { t: 'Avaliar acordo com o advogado', col: 1, st: 10, due: 20, dep: [1], ck: [['Análise', ['Chance de perda em cada pedido', 'Valor provável de condenação', 'Faixa de acordo aceitável']]] },
      { t: 'Preparar preposto e testemunhas', col: 2, st: 20, due: 28, l: [1], dep: [1], d: 'O preposto precisa conhecer os fatos; pode ser qualquer pessoa indicada pela empresa (CLT art. 843, § 3º).' },
      { t: 'Audiência', col: 2, st: 30, due: 30, p: 'urgent', dep: [3] },
      { t: 'Cumprir o acordo ou a sentença', col: 3, st: 31, due: 60, p: 'high', dep: [4], ck: [['Cumprimento', ['Prazo e forma de pagamento', 'Guias de INSS e IR do acordo', 'Comprovar o pagamento no processo']]] },
      { t: 'Corrigir a causa para não se repetir', col: 5, st: 31, due: 75, dep: [4], d: 'Ex.: ponto mal controlado, horas extras sem pagamento, rescisões fora do prazo.' },
    ],
  },
  // ───────────────────────── Recursos Humanos: problemas de gestão de pessoas
  {
    id: 'rh-turnover', area: 'Recursos Humanos', icon: 'trending-down', cover: 'cover-orange', name: 'Plano contra rotatividade (turnover)', done: 5,
    desc: 'Muita gente saindo? Calcule o turnover por área, entenda as causas nas entrevistas de desligamento, ataque as 3 principais e meça de novo depois de 90 dias.',
    columns: [['Diagnóstico', G], ['Causas', B], ['Ações', P], ['Em execução', O], ['Medindo resultado', Y], ['Concluído', GR]],
    labels: [['Salário e benefícios', O], ['Liderança', R], ['Carreira', P], ['Clima', PK], ['Recrutamento', S]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Turnover atual (%)', t: 'number' }, { n: 'Meta (%)', t: 'number' }],
    cards: [
      { t: 'Calcular o turnover por área (12 meses)', col: 0, st: 0, due: 7, p: 'high', f: { Área: 'Empresa toda' }, d: 'Turnover mensal = ((admissões + desligamentos) ÷ 2) ÷ quadro médio × 100. O Dash do ewvon calcula quando há datas de admissão e desligamento.' },
      { t: 'Analisar as entrevistas de desligamento', col: 0, st: 0, due: 10, ck: [['Análise', ['Motivos mais citados', 'Tempo de casa de quem sai', 'Saídas no período de experiência', 'Áreas e líderes com mais saídas']]] },
      { t: 'Ouvir quem fica (entrevistas de permanência)', col: 0, st: 3, due: 14, l: [3], ck: [['Perguntas', ['O que faz você ficar?', 'O que faria você sair?', 'O que mudaria amanhã?']]] },
      { t: 'Definir as 3 causas principais', col: 1, st: 14, due: 17, p: 'high', dep: [0, 1, 2] },
      { t: 'Plano de ação por causa', col: 2, st: 17, due: 24, dep: [3], ck: [['Ações possíveis', ['Pesquisa salarial', 'Treinamento de líderes', 'Trilha de carreira', 'Melhorar a integração dos novos', 'Revisar o perfil das vagas']]] },
      { t: 'Executar e acompanhar mensalmente', col: 3, st: 24, due: 114, dep: [4] },
      { t: 'Medir o turnover após 90 dias', col: 4, st: 114, due: 117, p: 'high', dep: [4] },
    ],
  },
  {
    id: 'rh-clima', area: 'Recursos Humanos', icon: 'thermometer', cover: 'cover-green', name: 'Pesquisa de clima e plano de ação', done: 5,
    desc: 'Da pesquisa ao resultado: perguntas, divulgação, coleta anônima, análise por área, devolutiva para a equipe e plano de ação com dono e prazo até a próxima pesquisa.',
    columns: [['Preparação', G], ['Coleta', B], ['Análise', Y], ['Devolutiva', P], ['Plano de ação', O], ['Concluído', GR]],
    labels: [['DHO', P], ['Liderança', R], ['Comunicação', S], ['Reconhecimento', Y], ['Carga de trabalho', O]],
    fields: [{ n: 'Tema', t: 'text', card: true }, { n: 'Data de abertura', t: 'date' }, { n: 'Nota atual', t: 'number' }, { n: 'Meta na próxima', t: 'number' }],
    proc: { ref: 'Data de abertura', refDay: 7, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da abertura da pesquisa)', title: 'Tema' },
    cards: [
      { t: 'Montar as perguntas da pesquisa', col: 0, st: 0, due: 5, p: 'high', l: [0], f: { Tema: 'Pesquisa de clima', 'Data de abertura': ymd(7) }, d: 'Use a aba RH › Pesquisas do ewvon: as respostas são anônimas e os resultados por setor só aparecem com 5 ou mais respostas.', ck: [['Perguntas', ['Liderança', 'Comunicação', 'Reconhecimento', 'Carga de trabalho', 'eNPS (indicaria a empresa?)']]] },
      { t: 'Divulgar e garantir o anonimato', col: 0, st: 5, due: 7, l: [0, 2], dep: [0] },
      { t: 'Período de respostas', col: 1, st: 7, due: 17, dep: [1], d: 'Lembretes no meio e no fim do prazo; meta de adesão acima de 70%.' },
      { t: 'Analisar os resultados por área', col: 2, st: 17, due: 22, p: 'high', l: [0], dep: [2], ck: [['Análise', ['Notas por tema', 'Comparar com a pesquisa anterior', 'Comentários abertos agrupados', 'Escolher os 3 temas prioritários']]] },
      { t: 'Apresentar à liderança', col: 3, st: 22, due: 24, l: [1], dep: [3] },
      { t: 'Devolutiva para toda a equipe', col: 3, st: 24, due: 28, p: 'high', l: [2], dep: [4], d: 'Mostrar o que será feito evita a sensação de que responder não adianta.' },
      { t: 'Plano de ação por tema', col: 4, st: 28, due: 35, l: [0, 1], dep: [5], ck: [['Plano', ['Uma ação por tema prioritário', 'Dono e prazo de cada ação', 'Como medir']]] },
      { t: 'Acompanhar as ações (mensal)', col: 4, st: 60, due: 62, l: [0], dep: [6] },
    ],
  },
  {
    id: 'rh-conduta', area: 'Recursos Humanos', icon: 'shield-alert', cover: 'cover-purple', name: 'Denúncias, apuração e medidas disciplinares', done: 5,
    desc: 'Do relato à medida: canal com sigilo, triagem, apuração imparcial, decisão do comitê e, quando cabe, orientação, advertência ou suspensão aplicadas de forma justa e documentada.',
    columns: [['Recebido', G], ['Triagem', B], ['Apuração', P], ['Decisão', Y], ['Medida aplicada', O], ['Encerrado', GR]],
    labels: [['Assédio', R], ['Conflito', O], ['Atrasos e faltas', Y], ['Conduta', P], ['Segurança', S], ['Sigiloso', G]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Gravidade', t: 'select', o: ['Baixa', 'Média', 'Alta', 'Grave'] }, { n: 'Anônimo', t: 'checkbox' }, { n: 'Medida', t: 'select', o: ['Nenhuma', 'Orientação verbal', 'Advertência escrita', 'Suspensão', 'Desligamento'] }, { n: 'Data do fato', t: 'date' }],
    rules: [{ when: 'created', act: 'due', val: 3, label: 'Relato novo: triagem em até 3 dias' }],
    form: { title: 'Canal de relatos', intro: 'Relate uma situação de assédio, conflito ou conduta inadequada. Você pode não se identificar. Tudo é tratado com sigilo.', col: 'Recebido', due: 3, prio: 'high', q: [['Resumo do que aconteceu', 'text', true], ['Descreva com detalhes (quando, onde, quem)', 'long', true], ['Área envolvida', 'text', false], ['Seu nome (opcional)', 'text', false]] },
    cards: [
      { t: 'Triagem do relato', col: 1, st: 0, due: 3, p: 'high', l: [5], f: { Área: 'Área envolvida', Gravidade: 'Média', Anônimo: true }, d: 'Assédio sexual ou moral: a empresa deve ter canal de denúncia e procedimento de apuração (Lei 14.457/2022, com CIPA).', ck: [['Triagem', ['Classificar o tipo e a gravidade', 'Afastar conflito de interesse de quem vai apurar', 'Proteger quem relatou de retaliação', 'Decidir se precisa de medida imediata']]] },
      { t: 'Apuração com escuta das partes', col: 2, st: 3, due: 15, p: 'high', l: [5], dep: [0], ck: [['Apuração', ['Ouvir quem relatou', 'Ouvir a pessoa apontada', 'Ouvir testemunhas', 'Reunir provas (mensagens, câmeras, documentos)', 'Registrar tudo por escrito']]] },
      { t: 'Parecer e decisão do comitê', col: 3, st: 15, due: 18, p: 'high', dep: [1], d: 'A medida deve ser proporcional ao fato e coerente com casos parecidos.' },
      { t: 'Aplicar a medida disciplinar', col: 4, st: 18, due: 19, p: 'high', l: [3], dep: [2], d: 'Aplique logo após a decisão (imediatidade) e uma única medida por fato. Suspensão não passa de 30 dias (CLT art. 474).', ck: [['Medida', ['Conferir o histórico da pessoa', 'Conversa registrada', 'Documento assinado (ou com 2 testemunhas se recusar)', 'Arquivar no prontuário']]] },
      { t: 'Dar retorno a quem relatou', col: 4, st: 19, due: 20, dep: [2], d: 'Sem expor detalhes da medida: informe que o caso foi apurado e tratado.' },
      { t: 'Ações para não se repetir', col: 4, st: 20, due: 45, dep: [2], ck: [['Prevenção', ['Treinamento da equipe ou da liderança', 'Revisar regras e comunicados', 'Acompanhar o clima da área']]] },
    ],
  },
  {
    id: 'rh-aso', area: 'Segurança do trabalho', icon: 'heart-pulse', cover: 'cover-green', name: 'Exames ocupacionais e treinamentos que vencem', done: 3,
    desc: 'Controle de ASO periódico, NRs e reciclagens por pessoa: aviso 60 dias antes, agendamento, realização e certificado, para ninguém trabalhar com exame ou treinamento vencido.',
    columns: [['Vence em 60 dias', G], ['Agendado', B], ['Realizado', Y], ['Em dia', GR], ['Vencido', R]],
    labels: [['ASO periódico', S], ['NR-35', O], ['NR-10', Y], ['NR-06 / EPI', P], ['Brigada', R], ['Direção defensiva', G]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Vencimento', t: 'date' }, { n: 'Clínica ou instrutor', t: 'text' }, { n: 'Função', t: 'text' }],
    proc: { ref: 'Vencimento', refDay: 60, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do vencimento)', title: 'Colaborador' },
    rules: [{ when: 'moved', col: 'Vencido', act: 'priority', val: 'urgent', label: 'Vencido: prioridade Urgente' }],
    cards: [
      { t: 'Conferir o que vence e a periodicidade', col: 0, st: 0, due: 5, l: [0], f: { Colaborador: 'Nome do colaborador', Vencimento: ymd(60), Função: 'Operador' }, d: 'A periodicidade do ASO vem do PCMSO; a das reciclagens, de cada NR (ex.: NR-35 a cada 2 anos, NR-10 a cada 2 anos).' },
      { t: 'Agendar o exame ou o treinamento', col: 1, st: 5, due: 20, p: 'high', dep: [0], ck: [['Agendamento', ['Clínica ou instrutor', 'Liberação do gestor', 'Guia ou convocação entregue']]] },
      { t: 'Realizar e receber o documento', col: 2, st: 30, due: 50, p: 'high', dep: [1], ck: [['Documento', ['ASO "apto" ou certificado', 'Carga horária e conteúdo no certificado', 'Restrições anotadas, se houver']]] },
      { t: 'Arquivar e enviar ao eSocial', col: 2, st: 50, due: 55, dep: [2], d: 'ASO vai ao eSocial no evento S-2220 (monitoramento da saúde).' },
      { t: 'Afastar da atividade se vencer', col: 0, st: 60, due: 60, p: 'urgent', l: [1, 2], d: 'Quem está com NR vencida não deve executar a atividade de risco até a reciclagem.' },
    ],
  },
  // ───────────────────────── Resolução de problemas (qualquer área)
  {
    id: 'pdca', area: 'Resolução de problemas', icon: 'search-check', cover: 'cover-navy', name: 'Resolução de problemas (PDCA + 5 porquês)',
    desc: 'Para problemas que se repetem: descreva, encontre a causa raiz com os 5 porquês, teste a solução, verifique e padronize.',
    columns: [['Problema', R], ['Causa raiz', O], ['Plano (P)', B], ['Execução (D)', P], ['Verificação (C)', Y], ['Padronizado (A)', GR]],
    labels: [['Qualidade', P], ['Prazo', O], ['Custo', Y], ['Cliente', S], ['Segurança', R]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Indicador', t: 'text' }, { n: 'Valor atual', t: 'number' }, { n: 'Meta', t: 'number' }],
    cards: [
      { t: 'Descrever o problema com números', col: 0, st: 0, due: 2, p: 'high', f: { Área: 'Área afetada' }, ck: [['Descrição', ['O que acontece', 'Onde e desde quando', 'Quantas vezes / quanto custa', 'Quem é afetado']]] },
      { t: 'Encontrar a causa raiz (5 porquês)', col: 1, st: 2, due: 5, p: 'high', dep: [0], ck: [['5 porquês', ['Por quê? (1)', 'Por quê? (2)', 'Por quê? (3)', 'Por quê? (4)', 'Por quê? (5) — causa raiz']]] },
      { t: 'Plano de ação', col: 2, st: 5, due: 7, dep: [1] },
      { t: 'Executar as ações', col: 3, st: 7, due: 21, dep: [2] },
      { t: 'Verificar se o problema parou', col: 4, st: 21, due: 35, dep: [3], d: 'Compare o indicador antes e depois. Se não melhorou, volte à causa raiz.' },
      { t: 'Padronizar e treinar', col: 4, st: 35, due: 40, dep: [4], ck: [['Padronizar', ['Atualizar o procedimento', 'Treinar a equipe', 'Comunicar a mudança']]] },
    ],
  },
  {
    id: 'crise', area: 'Resolução de problemas', icon: 'siren', cover: 'cover-orange', name: 'Gestão de crise', done: 5,
    desc: 'Quando algo grave acontece: comitê, contenção, mensagem única para equipe, clientes e imprensa, correção da causa, monitoramento e lições aprendidas.',
    columns: [['Contenção', R], ['Comunicação', O], ['Correção', B], ['Monitoramento', Y], ['Lições aprendidas', P], ['Encerrado', GR]],
    labels: [['Clientes', S], ['Imprensa/redes', PK], ['Equipe', P], ['Jurídico', Y]],
    fields: [{ n: 'Crise', t: 'text', card: true }, { n: 'Início', t: 'date' }, { n: 'Porta-voz', t: 'text' }],
    proc: { ref: 'Início', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do início da crise)', title: 'Crise' },
    rules: [{ when: 'created', act: 'priority', val: 'urgent', label: 'Item novo na crise: prioridade Urgente' }],
    cards: [
      { t: 'Montar o comitê de crise', col: 0, st: 0, due: 0, p: 'urgent', f: { Crise: 'Descrição curta', Início: ymd(0) }, ck: [['Comitê', ['Quem decide', 'Porta-voz', 'Jurídico', 'Canal único de comunicação interna (War Room do ewvon)']]] },
      { t: 'Conter o problema', col: 0, st: 0, due: 0, p: 'urgent', dep: [0], ck: [['Contenção', ['O que precisa parar agora', 'Proteger pessoas e dados', 'Registrar a linha do tempo dos fatos']]] },
      { t: 'Mensagem única para clientes e equipe', col: 1, st: 0, due: 1, p: 'urgent', l: [0, 2], dep: [1], ck: [['Comunicação', ['Texto aprovado pelo comitê e pelo jurídico', 'Canais (e-mail, redes, telefone)', 'Respostas para perguntas comuns', 'Atualizações em horários combinados']]] },
      { t: 'Monitorar redes e imprensa', col: 1, st: 0, due: 7, l: [1], dep: [2] },
      { t: 'Corrigir a causa', col: 2, st: 1, due: 7, p: 'high', dep: [1] },
      { t: 'Comunicar o encerramento', col: 3, st: 7, due: 8, l: [0, 2], dep: [4] },
      { t: 'Reunião de lições aprendidas', col: 4, st: 10, due: 14, dep: [5], d: 'Sem procurar culpados: o que funcionou, o que falhou e o que muda.' },
    ],
  },
  {
    id: 'reclamacoes', area: 'Resolução de problemas', icon: 'gauge', cover: 'cover-purple', name: 'Reclamações de clientes', done: 4,
    desc: 'Cada reclamação com prazo de resposta, causa, solução combinada e confirmação de satisfação, mais a análise mensal das causas que se repetem.',
    columns: [['Recebida', G], ['Em análise', B], ['Solução proposta', P], ['Aguardando cliente', Y], ['Resolvida', GR], ['Sem solução', R]],
    labels: [['Atraso', O], ['Produto com defeito', R], ['Atendimento', S], ['Cobrança', Y], ['Reclamação pública', PK]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Canal', t: 'select', o: ['Telefone', 'E-mail', 'WhatsApp', 'Site', 'Redes sociais', 'Sites de reclamação', 'Procon'] }, { n: 'Pedido ou protocolo', t: 'text' }, { n: 'Cliente satisfeito', t: 'checkbox' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Reclamação nova: responder em até 2 dias' }, { when: 'moved', col: 'Sem solução', act: 'notify', label: 'Sem solução: avisar o responsável' }],
    form: { title: 'Registrar reclamação', intro: 'Conte o que aconteceu. Respondemos em até 2 dias úteis.', col: 'Recebida', due: 2, prio: 'high', q: [['Resumo', 'text', true], ['O que aconteceu', 'long', true], ['Número do pedido ou protocolo', 'text', false], ['Seu nome', 'text', true], ['Seu e-mail', 'email', true], ['Telefone', 'phone', false]] },
    cards: [
      { t: 'Tratar a reclamação', col: 1, st: 0, due: 2, p: 'high', l: [0], f: { Cliente: 'Cliente Exemplo', Canal: 'WhatsApp', 'Pedido ou protocolo': '12345' }, ck: [['Tratativa', ['Responder em até 24 h: pedir desculpas e dar um prazo', 'Descobrir a causa', 'Combinar a solução (troca, reembolso, reenvio)', 'Cumprir o combinado', 'Confirmar a satisfação']]] },
      { t: 'Reclamação pública (redes ou sites)', col: 0, st: 0, due: 1, p: 'urgent', l: [4], d: 'Responda em público com educação e leve os detalhes para o privado. Atenção ao Procon: o prazo é o indicado na notificação.', ck: [['Resposta pública', ['Responder em público sem expor dados', 'Resolver no privado', 'Pedir para o cliente atualizar a avaliação']]] },
      { t: 'Análise mensal das causas', col: 0, st: 0, due: 30, ck: [['Análise', ['Reclamações por causa', 'Causas que mais se repetem', 'Ação para a principal causa (use o modelo PDCA)']]] },
    ],
  },
  // ───────────────────────── Pacote 25/11/2026: processos raros que quase nenhuma empresa tem roteiro
  // Recursos Humanos
  {
    id: 'rh-promocao', area: 'Recursos Humanos', icon: 'trending-up', cover: 'cover-green', name: 'Promoção e mudança de cargo',
    desc: 'Da aprovação ao acompanhamento no cargo novo: conversa, aditivo, eSocial, acessos, passagem das atividades antigas e avaliação de 90 dias.',
    columns: [['Aprovação', G], ['Formalização', B], ['Comunicação e transição', P], ['Acompanhamento', O], ['Concluído', GR]],
    labels: [['RH', PK], ['DP', Y], ['Gestor', O], ['TI', S]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Cargo atual', t: 'text' }, { n: 'Novo cargo', t: 'text' }, { n: 'Novo salário', t: 'money' }, { n: 'Data de vigência', t: 'date' }],
    proc: { ref: 'Data de vigência', refDay: 15, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data de vigência)', title: 'Colaborador' },
    rules: [{ when: 'moved', col: 'Formalização', act: 'priority', val: 'high', label: 'Em "Formalização", prioridade Alta' }],
    cards: [
      { t: 'Aprovar a promoção e o orçamento', col: 0, st: 0, due: 4, p: 'high', l: [0, 2], f: { Colaborador: 'Nome do colaborador', 'Cargo atual': 'Analista', 'Novo cargo': 'Coordenador', 'Data de vigência': ymd(15) }, ck: [['Aprovação', ['Justificativa do gestor', 'Faixa salarial do novo cargo', 'Aprovação da diretoria', 'Impacto no orçamento da área']]] },
      { t: 'Conversa com o colaborador', col: 1, st: 5, due: 6, p: 'high', l: [2], dep: [0], ck: [['Conversa', ['Motivo da promoção', 'Novas responsabilidades e metas', 'Novo salário e data de vigência', 'Dúvidas do colaborador']]] },
      { t: 'Aditivo de contrato e alteração no eSocial', col: 1, st: 6, due: 12, p: 'high', l: [1], dep: [1], d: 'Envie a alteração contratual (S-2206) antes do fechamento da folha do mês da vigência.', ck: [['Formalização', ['Aditivo de cargo e salário assinado', 'Ficha de registro atualizada', 'Alteração contratual no eSocial (S-2206)', 'Adicionais e benefícios do novo cargo revisados']]] },
      { t: 'Definir quem assume as atividades antigas', col: 2, st: 7, due: 14, l: [2], dep: [1], ck: [['Passagem', ['Listar atividades do cargo anterior', 'Escolher quem assume cada uma', 'Combinar o período de transição']]] },
      { t: 'Ajustar acessos e ferramentas', col: 2, st: 12, due: 15, l: [3], dep: [1], ck: [['Acessos', ['Novos sistemas e permissões', 'Retirar acessos que não fazem mais sentido', 'Grupos e canais da nova função']]] },
      { t: 'Comunicar a promoção à empresa', col: 2, st: 15, due: 15, l: [0, 2], dep: [2] },
      { t: 'Acompanhamento de 30 dias no novo cargo', col: 3, st: 44, due: 46, l: [0, 2], dep: [5], ck: [['Acompanhamento', ['Adaptação às novas tarefas', 'Dificuldades e treinamentos necessários', 'Metas do novo cargo']]] },
      { t: 'Avaliação de 90 dias no novo cargo', col: 3, st: 104, due: 106, p: 'high', l: [0, 2], dep: [6] },
    ],
  },
  {
    id: 'rh-transferencia', area: 'Recursos Humanos', icon: 'arrow-left-right', cover: 'cover-navy', name: 'Transferência de setor, filial ou cidade',
    desc: 'Aprovação dos dois gestores, regras da CLT quando muda de cidade, cadastro, acessos, passagem das atividades e recepção no destino.',
    columns: [['Solicitação', G], ['Preparação', B], ['Primeiro dia no destino', P], ['Adaptação', O], ['Concluído', GR]],
    labels: [['RH', PK], ['DP', Y], ['TI', S], ['Gestor', O]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Origem', t: 'text' }, { n: 'Destino', t: 'text' }, { n: 'Data da transferência', t: 'date' }, { n: 'Muda de cidade', t: 'checkbox' }],
    proc: { ref: 'Data da transferência', refDay: 20, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data da transferência)', title: 'Colaborador' },
    cards: [
      { t: 'Aprovar a transferência', col: 0, st: 0, due: 3, p: 'high', l: [0, 3], f: { Colaborador: 'Nome do colaborador', Origem: 'Setor/filial atual', Destino: 'Novo setor/filial', 'Data da transferência': ymd(20), 'Muda de cidade': false }, ck: [['Aprovação', ['Gestor de origem', 'Gestor de destino', 'Vaga e orçamento no destino', 'Concordância do colaborador']]] },
      { t: 'Conferir as regras se mudar de cidade', col: 0, st: 2, due: 5, l: [1], dep: [0], d: 'Transferência com mudança de domicílio exige a concordância do colaborador (salvo as exceções do art. 469 da CLT) e, quando provisória, adicional de transferência de no mínimo 25%. As despesas da mudança ficam com a empresa (art. 470).', ck: [['Mudança de cidade', ['Concordância por escrito', 'Adicional de transferência (se provisória)', 'Ajuda de custo da mudança', 'Prazo para a família se mudar']]] },
      { t: 'Atualizar cadastro, centro de custo e eSocial', col: 1, st: 8, due: 18, l: [1], dep: [0], ck: [['Cadastro', ['Nova lotação e centro de custo', 'Novo gestor no sistema', 'Escala e jornada do destino', 'Alteração no eSocial (S-2206), se o contrato mudar', 'Vale-transporte do novo trajeto']]] },
      { t: 'Passar as atividades na origem', col: 1, st: 8, due: 19, l: [3], dep: [0], ck: [['Passagem', ['Atividades em andamento', 'Quem assume cada uma', 'Contatos e acessos repassados']]] },
      { t: 'Acessos, equipamentos e estação no destino', col: 1, st: 15, due: 19, l: [2], dep: [0], ck: [['TI', ['Acessos do novo setor', 'Retirar acessos do setor antigo', 'Equipamentos e ramal', 'Mesa no destino']]] },
      { t: 'Recepção no destino', col: 2, st: 20, due: 20, p: 'high', l: [3], dep: [2, 3, 4], ck: [['Recepção', ['Apresentar a nova equipe', 'Explicar rotina e metas', 'Padrinho ou madrinha nos primeiros dias']]] },
      { t: 'Conversa de adaptação (30 dias)', col: 3, st: 50, due: 52, l: [0, 3], dep: [5] },
    ],
  },
  {
    id: 'rh-sucessao', area: 'Recursos Humanos', icon: 'crown', cover: 'cover-purple', name: 'Sucessão de cargos-chave',
    desc: 'Quem assume se uma pessoa-chave sair amanhã? Mapeie os cargos críticos, documente o conhecimento e prepare sucessores.',
    columns: [['Mapeamento', G], ['Sucessores', B], ['Desenvolvimento', P], ['Pronto para assumir', O], ['Concluído', GR]],
    labels: [['Liderança', P], ['Técnico', S], ['Crítico', R]],
    fields: [{ n: 'Cargo', t: 'text', card: true }, { n: 'Ocupante atual', t: 'text' }, { n: 'Sucessor', t: 'text' }, { n: 'Prontidão', t: 'select', o: ['Pronto agora', 'Em até 1 ano', '2 anos ou mais'] }],
    cards: [
      { t: 'Listar os cargos críticos', col: 0, st: 0, due: 7, p: 'high', l: [2], ck: [['Critérios', ['Se a pessoa sair, o trabalho para?', 'Ela tem conhecimento que ninguém mais tem?', 'Ela tem contatos-chave?', 'Qual o risco de saída?']]] },
      { t: 'Documentar o conhecimento do cargo', col: 0, st: 7, due: 30, l: [2], dep: [0], f: { Cargo: 'Gerente de operações', 'Ocupante atual': 'Pessoa A', Prontidão: 'Em até 1 ano' }, ck: [['Conhecimento', ['Rotinas diárias e mensais', 'Contatos de clientes e fornecedores', 'Acessos e senhas (no cofre da empresa)', 'Decisões recorrentes e critérios']]] },
      { t: 'Escolher 1 ou 2 sucessores', col: 1, st: 7, due: 14, p: 'high', l: [0], dep: [0] },
      { t: 'Plano de desenvolvimento do sucessor', col: 2, st: 14, due: 21, dep: [2], ck: [['Plano', ['Treinamentos', 'Acompanhar o titular em reuniões', 'Assumir tarefas aos poucos', 'Mentoria']]] },
      { t: 'Substituição de teste nas férias do titular', col: 2, st: 60, due: 75, dep: [3] },
      { t: 'Revisão semestral do plano', col: 3, st: 180, due: 182, dep: [4] },
    ],
  },
  // Departamento Pessoal
  {
    id: 'dp-estagio', area: 'Departamento Pessoal', icon: 'school', cover: 'cover-navy', name: 'Programa de estágio',
    desc: 'Termo de compromisso, seguro, relatórios semestrais, recesso e o limite de 2 anos da Lei do Estágio, do início ao encerramento.',
    columns: [['Contratação', G], ['Em estágio', B], ['Renovação', Y], ['Encerramento', P], ['Concluído', GR]],
    labels: [['Escola', S], ['DP', Y], ['Gestor', O]],
    fields: [{ n: 'Estagiário', t: 'text', card: true }, { n: 'Instituição de ensino', t: 'text' }, { n: 'Início', t: 'date' }, { n: 'Fim do termo', t: 'date' }, { n: 'Supervisor', t: 'text' }],
    proc: { ref: 'Início', refDay: 7, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do início do estágio)', title: 'Estagiário' },
    cards: [
      { t: 'Termo de compromisso com a escola', col: 0, st: 0, due: 5, p: 'high', l: [0, 1], f: { Estagiário: 'Nome do estagiário', 'Instituição de ensino': 'Faculdade', Início: ymd(7) }, d: 'Lei 11.788/2008: jornada de até 6 horas por dia (30 por semana) no ensino superior e médio regular; supervisor com formação ou experiência na área, com até 10 estagiários por supervisor.', ck: [['Contratação', ['Termo de compromisso assinado pelas 3 partes', 'Plano de atividades', 'Seguro contra acidentes pessoais (obrigatório)', 'Bolsa e auxílio-transporte definidos']]] },
      { t: 'Integração do estagiário', col: 1, st: 7, due: 8, l: [2], dep: [0], ck: [['Integração', ['Apresentar equipe e supervisor', 'Acessos e equipamentos', 'Explicar o plano de atividades']]] },
      { t: 'Relatório de atividades (6 meses)', col: 1, st: 187, due: 190, p: 'high', l: [0, 2], dep: [1], d: 'Entregue à instituição de ensino no mínimo a cada 6 meses (Lei 11.788 art. 9º).' },
      { t: 'Recesso remunerado', col: 1, st: 360, due: 372, l: [1], dep: [1], d: '30 dias após 1 ano de estágio, de preferência nas férias escolares; proporcional nos contratos menores (art. 13).' },
      { t: 'Renovar ou encerrar o termo', col: 2, st: 360, due: 365, p: 'high', l: [0, 1], dep: [2], d: 'O estágio na mesma empresa dura no máximo 2 anos, exceto para pessoa com deficiência (art. 11).' },
      { t: 'Relatório de atividades (12 meses)', col: 1, st: 367, due: 370, l: [0, 2], dep: [2] },
      { t: 'Encerramento e termo de realização', col: 3, st: 725, due: 730, l: [0, 1, 2], dep: [4], ck: [['Encerramento', ['Termo de realização do estágio com o resumo das atividades', 'Relatório final', 'Avaliar a efetivação']]] },
    ],
  },
  {
    id: 'dp-aprendiz', area: 'Departamento Pessoal', icon: 'sprout', cover: 'cover-green', name: 'Jovem aprendiz e cotas',
    desc: 'Cálculo das cotas de aprendizes e de pessoas com deficiência, matrícula, contrato, frequência no curso e encerramento.',
    columns: [['Cota e vaga', G], ['Contratação', B], ['Em aprendizagem', P], ['Encerramento', Y], ['Concluído', GR]],
    labels: [['Entidade formadora', S], ['DP', Y], ['Gestor', O], ['PCD', PK]],
    fields: [{ n: 'Aprendiz', t: 'text', card: true }, { n: 'Entidade formadora', t: 'text' }, { n: 'Início', t: 'date' }, { n: 'Fim do contrato', t: 'date' }],
    proc: { ref: 'Início', refDay: 15, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do início do contrato)', title: 'Aprendiz' },
    cards: [
      { t: 'Calcular as cotas de aprendizes e de PCD', col: 0, st: 0, due: 5, p: 'high', l: [1, 3], d: 'Aprendizes: de 5% a 15% das funções que exigem formação profissional (CLT art. 429). Pessoas com deficiência: de 2% a 5% para empresas com 100 ou mais empregados (Lei 8.213 art. 93).', ck: [['Cotas', ['Contar as funções que exigem formação', 'Número mínimo de aprendizes', 'Número mínimo de pessoas com deficiência', 'Comparar com o quadro atual']]] },
      { t: 'Matricular na entidade formadora', col: 0, st: 3, due: 10, l: [0], dep: [0], f: { Aprendiz: 'Nome do aprendiz', 'Entidade formadora': 'Senai/Senac/ONG', Início: ymd(15) } },
      { t: 'Contrato de aprendizagem', col: 1, st: 10, due: 14, p: 'high', l: [1], dep: [1], d: 'Contrato escrito, por até 2 anos, para jovens de 14 a 24 anos (sem limite de idade para pessoa com deficiência). O FGTS do aprendiz é de 2%.', ck: [['Contratação', ['Contrato com curso, jornada e cronograma', 'Registro e eSocial', 'Exame admissional', 'Vale-transporte']]] },
      { t: 'Integração e monitor na empresa', col: 2, st: 15, due: 16, l: [2], dep: [2] },
      { t: 'Conferir frequência no curso (todo mês)', col: 2, st: 45, due: 46, l: [0, 1], dep: [2], d: 'Faltas no curso sem justificativa podem encerrar o contrato antes do prazo.' },
      { t: 'Avaliação do aprendiz (6 meses)', col: 2, st: 195, due: 198, l: [0, 2], dep: [3] },
      { t: 'Encerramento ou efetivação', col: 3, st: 710, due: 720, p: 'high', l: [1, 2], dep: [5], ck: [['Fim do contrato', ['Certificado do curso', 'Avaliar a contratação efetiva', 'Rescisão por término do contrato']]] },
    ],
  },
  // Segurança do trabalho
  {
    id: 'sst-cipa', area: 'Segurança do trabalho', icon: 'vote', cover: 'cover-orange', name: 'Eleição da CIPA',
    desc: 'Calendário completo da NR-5: edital 60 dias antes, inscrições, votação até 30 dias antes, resultado, treinamento e posse.',
    columns: [['Convocação', G], ['Inscrições', B], ['Eleição', P], ['Treinamento e posse', O], ['Concluído', GR]],
    labels: [['Edital', S], ['Votação', P], ['Treinamento', O], ['Documentos', Y]],
    fields: [{ n: 'Gestão', t: 'text', card: true }, { n: 'Fim do mandato atual', t: 'date' }, { n: 'Grau de risco', t: 'select', o: ['1', '2', '3', '4'] }],
    proc: { ref: 'Fim do mandato atual', refDay: 70, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do fim do mandato atual)', title: 'Gestão' },
    cards: [
      { t: 'Publicar o edital de convocação', col: 0, st: 0, due: 10, p: 'urgent', l: [0], f: { Gestão: 'CIPA próxima gestão', 'Fim do mandato atual': ymd(70), 'Grau de risco': '2' }, d: 'NR-5: edital publicado e divulgado no mínimo 60 dias antes do fim do mandato em curso, com cópia ao sindicato da categoria.', ck: [['Convocação', ['Formar a comissão eleitoral', 'Edital no mural e nos canais internos', 'Cópia enviada ao sindicato']]] },
      { t: 'Período de inscrições (mínimo 15 dias)', col: 1, st: 12, due: 27, l: [0], dep: [0], ck: [['Inscrições', ['Ficha de inscrição disponível', 'Comprovante de inscrição para cada candidato', 'Lista de candidatos divulgada']]] },
      { t: 'Organizar a votação', col: 2, st: 27, due: 35, l: [1], dep: [1], ck: [['Votação', ['Cédulas ou sistema de votação', 'Lista de eleitores', 'Local e horário que atendam todos os turnos']]] },
      { t: 'Eleição (até 30 dias antes do fim do mandato)', col: 2, st: 38, due: 40, p: 'urgent', l: [1], dep: [2], d: 'A eleição acontece no mínimo 30 dias antes do fim do mandato atual, em horário normal de trabalho e com voto secreto.' },
      { t: 'Apuração e divulgação do resultado', col: 2, st: 40, due: 42, p: 'high', l: [1, 3], dep: [3], ck: [['Resultado', ['Ata da eleição', 'Lista dos eleitos e suplentes', 'Resultado divulgado para todos']]] },
      { t: 'Treinamento dos membros da CIPA', col: 3, st: 45, due: 65, p: 'high', l: [2], dep: [4], d: 'Concluir antes da posse. Carga horária da NR-5 pelo grau de risco: 8 h (grau 1), 12 h (grau 2), 16 h (grau 3) ou 20 h (grau 4).' },
      { t: 'Posse dos novos membros', col: 3, st: 71, due: 71, p: 'high', l: [3], dep: [5], d: 'No primeiro dia útil após o fim do mandato anterior.', ck: [['Posse', ['Ata de posse', 'Presidente e vice designados', 'Calendário das reuniões mensais']]] },
    ],
  },
  {
    id: 'sst-simulado', area: 'Segurança do trabalho', icon: 'flame', cover: 'cover-orange', name: 'Simulado de evacuação e brigada',
    desc: 'Plano de emergência revisado, brigada em dia, equipamentos inspecionados, simulado cronometrado e correção das falhas.',
    columns: [['Planejamento', G], ['Preparação', B], ['Simulado', R], ['Correções', Y], ['Concluído', GR]],
    labels: [['Brigada', R], ['Rotas', S], ['Equipamentos', O], ['Relatório', P]],
    fields: [{ n: 'Unidade', t: 'text', card: true }, { n: 'Data do simulado', t: 'date' }, { n: 'Tempo de evacuação (min)', t: 'number' }],
    proc: { ref: 'Data do simulado', refDay: 21, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data do simulado)', title: 'Unidade' },
    cards: [
      { t: 'Revisar o plano de emergência e as rotas', col: 0, st: 0, due: 7, p: 'high', l: [1], f: { Unidade: 'Sede', 'Data do simulado': ymd(21) }, d: 'A frequência e as regras do simulado seguem a instrução técnica do Corpo de Bombeiros do seu estado.', ck: [['Plano', ['Rotas de fuga e saídas sinalizadas', 'Ponto de encontro', 'Pessoas com mobilidade reduzida', 'Contatos de emergência atualizados']]] },
      { t: 'Conferir a brigada de incêndio', col: 0, st: 0, due: 10, l: [0], ck: [['Brigada', ['Brigadistas suficientes em cada turno', 'Treinamento e reciclagem em dia', 'Identificação dos brigadistas']]] },
      { t: 'Inspecionar os equipamentos', col: 1, st: 7, due: 14, l: [2], ck: [['Equipamentos', ['Extintores (carga e validade)', 'Hidrantes e mangueiras', 'Iluminação de emergência', 'Alarme', 'Portas corta-fogo']]] },
      { t: 'Comunicar o simulado', col: 1, st: 14, due: 18, dep: [0], ck: [['Comunicação', ['Data e horário para a liderança', 'Vizinhos e condomínio, se preciso', 'Orientação para visitantes no dia']]] },
      { t: 'Realizar o simulado', col: 2, st: 21, due: 21, p: 'urgent', l: [0, 1], dep: [1, 2, 3], ck: [['No dia', ['Acionar o alarme', 'Cronometrar a saída', 'Contar as pessoas no ponto de encontro', 'Observadores anotando falhas']]] },
      { t: 'Relatório e lições aprendidas', col: 3, st: 22, due: 25, l: [3], dep: [4] },
      { t: 'Corrigir as falhas encontradas', col: 3, st: 25, due: 45, p: 'high', dep: [5] },
    ],
  },
  {
    id: 'sst-revisao', area: 'Segurança do trabalho', icon: 'shield-plus', cover: 'cover-navy', name: 'Revisão de SST (PGR e PCMSO)',
    desc: 'Inventário de riscos do PGR, relatório analítico anual do PCMSO, EPIs e treinamentos obrigatórios do ano, com o plano de ação.',
    columns: [['Levantamento', G], ['Revisão', B], ['Implantação', P], ['Concluído', GR]],
    labels: [['PGR', O], ['PCMSO', R], ['Treinamento', S], ['EPI', Y]],
    fields: [{ n: 'Unidade', t: 'text', card: true }, { n: 'Data da revisão', t: 'date' }, { n: 'Responsável técnico', t: 'text' }],
    proc: { ref: 'Data da revisão', refDay: 30, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data da revisão)', title: 'Unidade' },
    cards: [
      { t: 'Atualizar o inventário de riscos (PGR)', col: 0, st: 0, due: 15, p: 'high', l: [0], f: { Unidade: 'Sede', 'Data da revisão': ymd(30) }, d: 'NR-1: a avaliação de riscos é revista no máximo a cada 2 anos (3 com certificação) e sempre que houver mudança de processo, acidente ou nova tecnologia.', ck: [['Inventário', ['Visitar todos os setores', 'Máquinas, produtos e funções novas', 'Acidentes e doenças do período', 'Medições ambientais']]] },
      { t: 'Relatório analítico anual do PCMSO', col: 0, st: 0, due: 20, p: 'high', l: [1], d: 'NR-7: o médico responsável faz o relatório analítico todo ano, com os exames e resultados do período.', ck: [['PCMSO', ['Exames realizados x previstos', 'Resultados alterados', 'Periodicidade dos exames revisada pelos riscos do PGR']]] },
      { t: 'Revisar o plano de ação do PGR', col: 1, st: 15, due: 25, l: [0], dep: [0] },
      { t: 'Conferir EPIs e fichas de entrega', col: 1, st: 10, due: 25, l: [3], ck: [['EPI', ['Certificado de aprovação (CA) válido', 'Fichas de entrega assinadas', 'Estoque e trocas']]] },
      { t: 'Treinamentos obrigatórios do ano', col: 2, st: 25, due: 60, l: [2], dep: [0], ck: [['Treinamentos', ['NR-35 (trabalho em altura)', 'NR-10 (eletricidade)', 'NR-12 (máquinas)', 'Brigada de incêndio', 'CIPA']]] },
      { t: 'Apresentar os resultados à direção e à CIPA', col: 2, st: 30, due: 32, dep: [1, 2] },
    ],
  },
  // TI e proteção de dados
  {
    id: 'ti-acessos', area: 'TI e proteção de dados', icon: 'key-round', cover: 'cover-navy', name: 'Acessos: entrada, mudança e saída',
    desc: 'Liga o RH à TI: quais sistemas liberar pelo cargo, aprovação do gestor, retirada no último dia e revisão trimestral de quem ainda tem acesso.',
    columns: [['Pedido', G], ['Aprovação', Y], ['Em execução', B], ['Revisão trimestral', P], ['Concluído', GR]],
    labels: [['Entrada', GR], ['Mudança', S], ['Saída', R], ['Revisão', P]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Movimento', t: 'select', o: ['Entrada', 'Mudança de cargo', 'Saída'] }, { n: 'Data efetiva', t: 'date' }, { n: 'Sistemas', t: 'text' }],
    proc: { ref: 'Data efetiva', refDay: 5, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data efetiva)', title: 'Colaborador' },
    cards: [
      { t: 'Listar os sistemas pelo cargo', col: 0, st: 0, due: 2, p: 'high', f: { Colaborador: 'Nome do colaborador', Movimento: 'Entrada', 'Data efetiva': ymd(5) }, ck: [['Sistemas', ['E-mail e ewvon', 'ERP / financeiro', 'Pastas compartilhadas', 'Sistemas da área', 'Redes sociais e sites da empresa']]] },
      { t: 'Aprovar os acessos com o gestor', col: 1, st: 1, due: 3, l: [0], dep: [0], d: 'Dê só o acesso necessário para a função (menor privilégio).' },
      { t: 'Criar ou ajustar os acessos', col: 2, st: 3, due: 5, p: 'high', l: [0, 1], dep: [1], ck: [['Execução', ['Criar os usuários', 'Ativar a verificação em duas etapas', 'Entregar as senhas de forma segura', 'Registrar o que foi liberado']]] },
      { t: 'Retirar os acessos no último dia', col: 2, st: 5, due: 5, p: 'urgent', l: [2], dep: [0], ck: [['Saída', ['Bloquear e-mail e ewvon', 'Bloquear sistemas e VPN', 'Trocar senhas compartilhadas', 'Transferir arquivos e caixa de e-mail', 'Recolher token ou certificado digital']]] },
      { t: 'Revisão trimestral de acessos', col: 3, st: 90, due: 95, l: [3], ck: [['Revisão', ['Lista de usuários ativos de cada sistema', 'Comparar com quem trabalha hoje', 'Remover contas sem dono', 'Revisar quem é administrador']]] },
    ],
  },
  {
    id: 'lgpd-titular', area: 'TI e proteção de dados', icon: 'file-lock', cover: 'cover-purple', name: 'Pedidos de titulares (LGPD)',
    desc: 'Cliente, colaborador ou ex-colaborador pede acesso, correção ou exclusão dos dados: identidade, levantamento e resposta em até 15 dias.',
    columns: [['Recebido', G], ['Identidade confirmada', Y], ['Em levantamento', B], ['Respondido', GR], ['Recusado', R]],
    labels: [['Acesso', S], ['Correção', Y], ['Exclusão', R], ['Portabilidade', P], ['Revogação', O]],
    fields: [{ n: 'Titular', t: 'text', card: true }, { n: 'Tipo de pedido', t: 'select', o: ['Acesso aos dados', 'Correção', 'Exclusão', 'Portabilidade', 'Revogação do consentimento', 'Informação sobre compartilhamento'] }, { n: 'Data do pedido', t: 'date' }],
    proc: { ref: 'Data do pedido', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data do pedido)', title: 'Titular' },
    form: { title: 'Pedido sobre seus dados pessoais', intro: 'Use este formulário para pedir acesso, correção ou exclusão dos seus dados (LGPD). Vamos confirmar sua identidade antes de responder.', col: 'Recebido', due: 15, prio: 'high', q: [['Seu nome completo', 'text', true], ['Seu e-mail', 'email', true], ['O que você quer?', 'select', true, ['Acesso aos dados', 'Correção', 'Exclusão', 'Portabilidade', 'Revogação do consentimento', 'Saber com quem os dados foram compartilhados']], ['Sua relação com a empresa', 'select', true, ['Cliente', 'Colaborador', 'Ex-colaborador', 'Candidato', 'Outro']], ['Detalhes do pedido', 'long', false]] },
    cards: [
      { t: 'Registrar o pedido', col: 0, st: 0, due: 0, p: 'high', f: { Titular: 'Nome do titular', 'Tipo de pedido': 'Acesso aos dados', 'Data do pedido': ymd(0) }, ck: [['Registro', ['Canal e data do pedido', 'Direito pedido (LGPD art. 18)', 'Contato do titular']]] },
      { t: 'Responder de forma simplificada', col: 0, st: 0, due: 0, dep: [0], d: 'Confirmação da existência ou acesso aos dados em formato simplificado: imediatamente (LGPD art. 19, I).' },
      { t: 'Confirmar a identidade do titular', col: 1, st: 0, due: 2, p: 'high', dep: [0], d: 'Nunca entregue dados sem ter certeza de que é a própria pessoa.' },
      { t: 'Levantar os dados em todos os sistemas', col: 2, st: 2, due: 10, p: 'high', dep: [2], ck: [['Onde procurar', ['Cadastros e sistemas internos', 'E-mails e planilhas', 'Fornecedores que tratam os dados', 'Backups']]] },
      { t: 'Corrigir ou excluir (se pedido)', col: 2, st: 10, due: 15, l: [1, 2], dep: [3], d: 'Dados que a lei obriga a guardar (por exemplo, trabalhistas e fiscais) podem ser mantidos: explique isso ao titular.' },
      { t: 'Enviar a resposta completa', col: 2, st: 10, due: 15, p: 'urgent', dep: [3], d: 'Declaração completa em até 15 dias do pedido (LGPD art. 19, II).', ck: [['Resposta', ['Origem dos dados', 'Finalidade e base legal', 'Com quem foram compartilhados', 'Por quanto tempo serão guardados']]] },
      { t: 'Arquivar o registro do atendimento', col: 2, st: 15, due: 16, dep: [5] },
    ],
  },
  {
    id: 'lgpd-incidente', area: 'TI e proteção de dados', icon: 'server-crash', cover: 'cover-orange', name: 'Incidente de segurança com dados',
    desc: 'Vazamento, invasão ou perda de dados pessoais: contenção, avaliação do risco, comunicação à ANPD e aos titulares em 3 dias úteis e correção.',
    columns: [['Contenção', R], ['Avaliação', O], ['Comunicação', Y], ['Correção', B], ['Encerrado', GR]],
    labels: [['Urgente', R], ['Técnico', S], ['Jurídico', P], ['Comunicação', O]],
    fields: [{ n: 'Incidente', t: 'text', card: true }, { n: 'Data em que soube', t: 'date' }, { n: 'Dados afetados', t: 'text' }, { n: 'Pessoas afetadas', t: 'number' }],
    proc: { ref: 'Data em que soube', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do dia em que a empresa soube)', title: 'Incidente' },
    cards: [
      { t: 'Conter o incidente', col: 0, st: 0, due: 0, p: 'urgent', l: [0, 1], f: { Incidente: 'Descrição curta', 'Data em que soube': ymd(0) }, ck: [['Contenção', ['Isolar sistemas ou contas afetadas', 'Trocar senhas e revogar acessos', 'Preservar os registros (logs) como prova', 'Avisar o encarregado de dados (DPO)']]] },
      { t: 'Avaliar o risco para os titulares', col: 1, st: 0, due: 1, p: 'urgent', l: [2], dep: [0], ck: [['Avaliação', ['Quais dados (sensíveis? financeiros?)', 'Quantas pessoas', 'Os dados estavam criptografados?', 'Há risco ou dano relevante?']]] },
      { t: 'Comunicar a ANPD (se houver risco relevante)', col: 2, st: 1, due: 3, p: 'urgent', l: [2, 3], dep: [1], d: 'Resolução CD/ANPD nº 15/2024: comunicar a ANPD em até 3 dias úteis a partir do conhecimento, quando o incidente puder causar risco ou dano relevante aos titulares.' },
      { t: 'Comunicar os titulares afetados', col: 2, st: 1, due: 3, p: 'urgent', l: [3], dep: [1], ck: [['Mensagem', ['O que aconteceu e quando', 'Quais dados', 'O que a empresa já fez', 'O que a pessoa deve fazer', 'Contato do encarregado']]] },
      { t: 'Corrigir a causa', col: 3, st: 1, due: 15, p: 'high', l: [1], dep: [0] },
      { t: 'Registrar o incidente', col: 3, st: 15, due: 16, l: [2], dep: [2, 3, 4], d: 'Guarde o registro do incidente por no mínimo 5 anos, mesmo quando ele não precisar ser comunicado.' },
      { t: 'Reunião de lições aprendidas', col: 3, st: 16, due: 20, dep: [4] },
    ],
  },
  {
    id: 'ti-backup', area: 'TI e proteção de dados', icon: 'database-backup', cover: 'cover-green', name: 'Teste de restauração de backup',
    desc: 'Todo mundo faz backup, quase ninguém testa se ele volta. Rotina conferida, restauração em ambiente separado e tempo medido.',
    columns: [['Planejamento', G], ['Restauração', B], ['Validação', Y], ['Correções', O], ['Concluído', GR]],
    labels: [['Servidor', S], ['Nuvem', P], ['Banco de dados', O], ['Arquivos', Y]],
    fields: [{ n: 'Sistema', t: 'text', card: true }, { n: 'Data do teste', t: 'date' }, { n: 'Tempo de restauração (min)', t: 'number' }],
    proc: { ref: 'Data do teste', refDay: 7, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data do teste)', title: 'Sistema' },
    cards: [
      { t: 'Escolher o que será testado', col: 0, st: 0, due: 3, f: { Sistema: 'Sistema mais crítico', 'Data do teste': ymd(7) }, d: 'Regra 3-2-1: 3 cópias, em 2 meios diferentes, 1 fora da empresa.', ck: [['Escopo', ['Sistema mais crítico do mês', 'Backup de qual data', 'Ambiente separado para restaurar']]] },
      { t: 'Conferir a rotina de backup', col: 0, st: 0, due: 5, ck: [['Rotina', ['Backups rodando sem erro', 'Por quantos dias as cópias são guardadas', 'Cópia fora do local ou na nuvem', 'Cópia protegida contra ransomware (offline ou imutável)']]] },
      { t: 'Restaurar em ambiente de teste', col: 1, st: 7, due: 7, p: 'high', dep: [0, 1] },
      { t: 'Validar os dados restaurados', col: 2, st: 7, due: 8, p: 'high', dep: [2], ck: [['Validação', ['Arquivos abrem', 'Banco de dados íntegro', 'Dados da data esperada', 'Tempo gasto anotado']]] },
      { t: 'Registrar o resultado', col: 2, st: 8, due: 9, dep: [3] },
      { t: 'Corrigir as falhas encontradas', col: 3, st: 8, due: 20, dep: [3] },
    ],
  },
  // Gestão e administração
  {
    id: 'adm-vencimentos', area: 'Gestão e administração', icon: 'calendar-clock', cover: 'cover-orange', name: 'Vencimentos e renovações (alvará, AVCB, certificados)',
    desc: 'Um processo por documento que vence: conferência, pendências, pedido, vistoria, arquivo e o próximo vencimento já agendado.',
    columns: [['Vence em breve', G], ['Em renovação', B], ['Aguardando o órgão', Y], ['Renovado', GR], ['Vencido', R]],
    labels: [['Alvará', S], ['Bombeiros (AVCB)', R], ['Certificado digital', P], ['Licença', O], ['Seguro', Y], ['Contrato', G]],
    fields: [{ n: 'Documento', t: 'text', card: true }, { n: 'Vencimento', t: 'date' }, { n: 'Órgão ou fornecedor', t: 'text' }, { n: 'Custo', t: 'money' }],
    proc: { ref: 'Vencimento', refDay: 60, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do vencimento)', title: 'Documento' },
    rules: [{ when: 'moved', col: 'Vencido', act: 'priority', val: 'urgent', label: 'Documento vencido: prioridade Urgente' }],
    cards: [
      { t: 'Conferir as exigências da renovação', col: 0, st: 0, due: 7, p: 'high', l: [1], f: { Documento: 'AVCB da sede', Vencimento: ymd(60), 'Órgão ou fornecedor': 'Corpo de Bombeiros' }, ck: [['Conferência', ['Documentos exigidos', 'Taxas', 'Precisa de vistoria?', 'Mudou algo no imóvel ou na atividade?']]] },
      { t: 'Resolver as pendências antes da vistoria', col: 1, st: 7, due: 30, dep: [0], ck: [['Pendências', ['Extintores e sinalização', 'Laudos técnicos (elétrica, gás)', 'Projeto aprovado atualizado']]] },
      { t: 'Pedir a renovação e pagar a taxa', col: 1, st: 20, due: 30, p: 'high', dep: [0] },
      { t: 'Acompanhar a vistoria e a resposta do órgão', col: 2, st: 30, due: 55, dep: [1, 2] },
      { t: 'Receber e arquivar o documento novo', col: 2, st: 50, due: 58, p: 'high', dep: [3], ck: [['Arquivo', ['Guardar o PDF ou cópia', 'Expor o original, se exigido', 'Avisar quem precisa']]] },
      { t: 'Agendar o próximo vencimento', col: 2, st: 58, due: 60, dep: [4], d: 'Depois de renovar, use "Duplicar todos os cards" com a nova data de vencimento para deixar a próxima renovação pronta.' },
    ],
  },
  {
    id: 'adm-licitacao', area: 'Gestão e administração', icon: 'landmark', cover: 'cover-navy', name: 'Licitação pública',
    desc: 'Da leitura do edital à assinatura do contrato, com os prazos da Lei 14.133 para esclarecimento, impugnação e recurso.',
    columns: [['Análise do edital', G], ['Documentação', B], ['Proposta', P], ['Sessão e recursos', O], ['Ganha', GR], ['Perdida', R]],
    labels: [['Habilitação', S], ['Proposta', P], ['Prazo', R], ['Jurídico', Y]],
    fields: [{ n: 'Órgão', t: 'text', card: true }, { n: 'Número do edital', t: 'text' }, { n: 'Data da sessão', t: 'date' }, { n: 'Valor estimado', t: 'money' }],
    proc: { ref: 'Data da sessão', refDay: 15, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data da sessão)', title: 'Órgão' },
    cards: [
      { t: 'Ler o edital e decidir se vale participar', col: 0, st: 0, due: 2, p: 'high', f: { Órgão: 'Prefeitura', 'Número do edital': 'Pregão eletrônico 00/0000', 'Data da sessão': ymd(15) }, ck: [['Análise', ['Objeto e quantidades', 'Exigências de habilitação', 'Prazo de entrega e garantia', 'Critério de julgamento', 'Multas e riscos']]] },
      { t: 'Pedir esclarecimento ou impugnar (se preciso)', col: 0, st: 2, due: 12, l: [2, 3], dep: [0], d: 'Esclarecimentos e impugnações: até 3 dias úteis antes da data de abertura (Lei 14.133 art. 164).' },
      { t: 'Reunir os documentos de habilitação', col: 1, st: 2, due: 12, p: 'high', l: [0], dep: [0], ck: [['Habilitação', ['Contrato social e procurações', 'Certidões negativas (federal, estadual, municipal)', 'Regularidade do FGTS (CRF) e trabalhista (CNDT)', 'Balanço e índices', 'Atestados de capacidade técnica']]] },
      { t: 'Montar a proposta e a planilha de preços', col: 2, st: 5, due: 13, p: 'high', l: [1], dep: [0], ck: [['Proposta', ['Custos e impostos', 'Margem', 'Validade da proposta', 'Assinatura']]] },
      { t: 'Cadastrar a proposta no sistema de compras', col: 2, st: 13, due: 14, p: 'urgent', l: [1, 2], dep: [2, 3] },
      { t: 'Sessão pública e lances', col: 3, st: 15, due: 15, p: 'urgent', dep: [4] },
      { t: 'Recurso (se necessário)', col: 3, st: 15, due: 18, l: [3], dep: [5], d: 'Manifestar a intenção de recorrer e apresentar as razões em até 3 dias úteis (Lei 14.133 art. 165).' },
      { t: 'Assinar o contrato ou a ata', col: 3, st: 18, due: 25, p: 'high', dep: [5] },
    ],
  },
  {
    id: 'adm-mudanca', area: 'Gestão e administração', icon: 'map-pinned', cover: 'cover-purple', name: 'Mudança de escritório ou abertura de filial',
    desc: 'Imóvel, registros e licenças, internet, obras, avisos a clientes e bancos, dia da mudança e primeira semana no endereço novo.',
    columns: [['Planejamento', G], ['Legal e registros', B], ['Estrutura', P], ['Mudança', O], ['Concluído', GR]],
    labels: [['Jurídico', Y], ['TI', S], ['Administrativo', O], ['Comunicação', PK], ['Financeiro', GR]],
    fields: [{ n: 'Unidade', t: 'text', card: true }, { n: 'Data da inauguração', t: 'date' }, { n: 'Endereço', t: 'text' }, { n: 'Orçamento', t: 'money' }],
    proc: { ref: 'Data da inauguração', refDay: 60, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data da inauguração ou mudança)', title: 'Unidade' },
    cards: [
      { t: 'Definir orçamento e cronograma', col: 0, st: 0, due: 7, p: 'high', l: [4], f: { Unidade: 'Nova unidade', 'Data da inauguração': ymd(60) } },
      { t: 'Contrato de locação e vistoria do imóvel', col: 0, st: 5, due: 15, l: [0], dep: [0], ck: [['Imóvel', ['Contrato assinado', 'Laudo de vistoria com fotos', 'Adequações permitidas pelo proprietário']]] },
      { t: 'Registros e licenças', col: 1, st: 15, due: 35, p: 'high', l: [0], dep: [1], ck: [['Registros', ['Alteração contratual na Junta Comercial', 'CNPJ da filial ou novo endereço', 'Inscrição municipal e estadual (se houver)', 'Alvará de funcionamento', 'Licença do Corpo de Bombeiros']]] },
      { t: 'Internet, telefonia e rede', col: 2, st: 15, due: 45, l: [1], dep: [1], ck: [['TI', ['Link de internet (duas operadoras, se possível)', 'Rede e Wi-Fi', 'Impressoras', 'Câmeras e controle de acesso']]] },
      { t: 'Obras, mobiliário e sinalização', col: 2, st: 15, due: 50, l: [2], dep: [1] },
      { t: 'Avisar clientes, fornecedores e bancos', col: 3, st: 45, due: 55, l: [3], ck: [['Avisos', ['Endereço novo no site e nas redes', 'Notas fiscais com o endereço novo', 'Bancos e cartórios', 'Correios e transportadoras']]] },
      { t: 'Dia da mudança', col: 3, st: 58, due: 60, p: 'urgent', l: [2], dep: [2, 3, 4] },
      { t: 'Primeira semana: ajustes', col: 3, st: 60, due: 67, dep: [6] },
    ],
  },
  {
    id: 'adm-troca-gestor', area: 'Gestão e administração', icon: 'user-cog', cover: 'cover-green', name: 'Troca de gestor de equipe',
    desc: 'Passagem completa entre o gestor que sai e o que chega: projetos, combinados com cada pessoa, permissões e os primeiros 30 dias.',
    columns: [['Preparação', G], ['Passagem', B], ['Primeiros 30 dias', P], ['Concluído', GR]],
    labels: [['Gestor que sai', O], ['Novo gestor', GR], ['Equipe', S], ['RH', PK]],
    fields: [{ n: 'Equipe', t: 'text', card: true }, { n: 'Data da troca', t: 'date' }, { n: 'Gestor anterior', t: 'text' }, { n: 'Novo gestor', t: 'text' }],
    proc: { ref: 'Data da troca', refDay: 14, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data da troca)', title: 'Equipe' },
    cards: [
      { t: 'Comunicar a troca à equipe', col: 0, st: 0, due: 2, p: 'high', l: [3], f: { Equipe: 'Nome da equipe', 'Data da troca': ymd(14) } },
      { t: 'Documento de passagem', col: 0, st: 0, due: 10, p: 'high', l: [0], dep: [0], ck: [['Passagem', ['Projetos em andamento e prazos', 'Combinados com cada pessoa (metas, promessas, 1:1)', 'Clientes e parceiros-chave', 'Problemas em aberto', 'Orçamento da área']]] },
      { t: 'Reuniões de passagem', col: 1, st: 7, due: 13, l: [0, 1], dep: [1] },
      { t: 'Ajustar permissões e aprovações', col: 1, st: 13, due: 14, l: [3], ck: [['Sistemas', ['Aprovações de ponto e férias', 'Murais e grupos da equipe', 'Centro de custo', 'Acessos do gestor anterior']]] },
      { t: 'Conversa individual com cada pessoa', col: 2, st: 14, due: 28, p: 'high', l: [1, 2], dep: [2], ck: [['1:1', ['Expectativas', 'O que funciona e o que não funciona', 'Combinados anteriores mantidos?']]] },
      { t: 'Plano dos 90 dias do novo gestor', col: 2, st: 20, due: 30, l: [1], dep: [4] },
      { t: 'Pulso da equipe após 30 dias', col: 2, st: 44, due: 46, l: [3], dep: [4] },
    ],
  },
  {
    id: 'adm-fiscalizacao', area: 'Gestão e administração', icon: 'file-search', cover: 'cover-navy', name: 'Fiscalização ou auditoria externa',
    desc: 'Chegou uma notificação: prazo registrado, um responsável, documentos reunidos, irregularidades corrigidas e resposta com protocolo.',
    columns: [['Notificação recebida', R], ['Levantamento', B], ['Resposta', Y], ['Acompanhamento', P], ['Encerrado', GR]],
    labels: [['Trabalhista', PK], ['Fiscal', Y], ['Sanitária', GR], ['Ambiental', S], ['Cliente', O]],
    fields: [{ n: 'Órgão', t: 'text', card: true }, { n: 'Número da notificação', t: 'text' }, { n: 'Prazo de resposta', t: 'date' }, { n: 'Valor envolvido', t: 'money' }],
    proc: { ref: 'Prazo de resposta', refDay: 10, lead: 0, q: 'Quantos dias antes do prazo do órgão a resposta deve estar pronta?', title: 'Órgão' },
    cards: [
      { t: 'Registrar a notificação e o prazo', col: 0, st: 0, due: 0, p: 'urgent', f: { Órgão: 'Órgão fiscalizador', 'Prazo de resposta': ymd(10) }, ck: [['Registro', ['Quem recebeu e quando', 'Prazo exato da resposta', 'O que está sendo pedido', 'Avisar o contador e o jurídico']]] },
      { t: 'Nomear o responsável pelo atendimento', col: 0, st: 0, due: 1, p: 'high', dep: [0], d: 'Uma pessoa centraliza o contato com o fiscal; tudo o que for entregue fica registrado.' },
      { t: 'Reunir os documentos pedidos', col: 1, st: 1, due: 7, p: 'high', dep: [1], ck: [['Documentos', ['Lista de tudo o que foi pedido', 'Cópias (nunca entregar originais sem recibo)', 'Revisão do contador ou do jurídico']]] },
      { t: 'Corrigir o que estiver irregular', col: 1, st: 1, due: 8, dep: [1] },
      { t: 'Entregar a resposta dentro do prazo', col: 2, st: 8, due: 10, p: 'urgent', dep: [2, 3], ck: [['Entrega', ['Protocolo de entrega', 'Cópia de tudo o que foi entregue']]] },
      { t: 'Acompanhar o resultado e os prazos de defesa', col: 3, st: 10, due: 40, dep: [4], d: 'Se vier um auto de infração, anote o prazo de defesa indicado no próprio documento.' },
    ],
  },
  // Financeiro e compras
  {
    id: 'fin-cobranca', area: 'Financeiro e compras', icon: 'hand-coins', cover: 'cover-green', name: 'Régua de cobrança',
    desc: 'Um cliente em atraso, uma régua com dia certo para cada contato: lembrete, aviso, segunda via, ligação, acordo e notificação formal.',
    columns: [['A vencer', G], ['Vencido', O], ['Negociação', Y], ['Recuperado', GR], ['Protesto ou jurídico', R]],
    labels: [['Lembrete', S], ['Cobrança', O], ['Acordo', Y], ['Protesto', R]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Vencimento', t: 'date' }, { n: 'Valor', t: 'money' }, { n: 'Telefone', t: 'text' }],
    proc: { ref: 'Vencimento', refDay: 3, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do vencimento)', title: 'Cliente' },
    cards: [
      { t: 'Lembrete amigável antes do vencimento', col: 0, st: 0, due: 0, l: [0], f: { Cliente: 'Nome do cliente', Vencimento: ymd(3), Valor: 1500 }, d: 'Cobre sempre sem constranger nem ameaçar (CDC art. 42).', ck: [['Lembrete', ['Mensagem com valor e vencimento', 'Link do boleto ou chave Pix', 'Canal preferido do cliente']]] },
      { t: 'Aviso no dia seguinte ao vencimento', col: 1, st: 4, due: 4, l: [1], dep: [0] },
      { t: 'Enviar a segunda via atualizada', col: 1, st: 8, due: 8, l: [1], dep: [1] },
      { t: 'Ligação de cobrança', col: 1, st: 13, due: 13, p: 'high', l: [1], dep: [2], ck: [['Ligação', ['Entender o motivo do atraso', 'Propor uma data de pagamento', 'Registrar o combinado']]] },
      { t: 'Proposta de acordo ou parcelamento', col: 2, st: 18, due: 20, p: 'high', l: [2], dep: [3], ck: [['Acordo', ['Valor atualizado (multa e juros do contrato)', 'Entrada e número de parcelas', 'Acordo por escrito', 'Novos boletos enviados']]] },
      { t: 'Notificação formal antes de negativar ou protestar', col: 2, st: 33, due: 35, p: 'urgent', l: [3], dep: [4], d: 'A inclusão em cadastro de inadimplentes exige comunicação prévia por escrito ao consumidor (CDC art. 43, § 2º).' },
      { t: 'Protesto ou envio ao jurídico', col: 2, st: 48, due: 50, l: [3], dep: [5] },
    ],
  },
  {
    id: 'fin-caixa', area: 'Financeiro e compras', icon: 'coins', cover: 'cover-orange', name: 'Fechamento de caixa diário',
    desc: 'Abertura com troco, sangrias, fechamento, conciliação de cartões e Pix no dia seguinte e depósito, com divergências tratadas.',
    columns: [['Abertura', G], ['Durante o dia', B], ['Fechamento', P], ['Conferido', GR], ['Divergência', R]],
    labels: [['Dinheiro', GR], ['Cartão', S], ['Pix', P], ['Sangria', O]],
    fields: [{ n: 'Caixa', t: 'text', card: true }, { n: 'Data do caixa', t: 'date' }, { n: 'Diferença', t: 'money' }],
    proc: { ref: 'Data do caixa', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = o próprio dia do caixa)', title: 'Caixa' },
    rules: [{ when: 'moved', col: 'Divergência', act: 'priority', val: 'high', label: 'Divergência no caixa: prioridade Alta' }, { when: 'moved', col: 'Divergência', act: 'notify', label: 'Divergência no caixa: avisar o responsável' }],
    cards: [
      { t: 'Abrir o caixa com o fundo de troco', col: 0, st: 0, due: 0, f: { Caixa: 'Caixa 1', 'Data do caixa': ymd(0) }, ck: [['Abertura', ['Contar o fundo de troco', 'Registrar o valor inicial', 'Maquininhas ligadas e com bateria']]] },
      { t: 'Sangrias durante o dia', col: 1, st: 0, due: 0, l: [3], dep: [0], ck: [['Sangria', ['Retirar o excesso de dinheiro', 'Recibo assinado', 'Guardar no cofre']]] },
      { t: 'Fechar o caixa', col: 2, st: 0, due: 0, p: 'high', l: [0, 1, 2], dep: [1], ck: [['Fechamento', ['Contar o dinheiro', 'Relatório das maquininhas', 'Pix recebidos no extrato', 'Comparar com o sistema de vendas']]] },
      { t: 'Conciliar cartões e Pix (dia seguinte)', col: 2, st: 1, due: 1, l: [1, 2], dep: [2], ck: [['Conciliação', ['Vendas x extrato da adquirente', 'Taxas cobradas', 'Pix x extrato bancário']]] },
      { t: 'Depositar e registrar', col: 2, st: 1, due: 1, l: [0], dep: [2] },
    ],
  },
  // Operações
  {
    id: 'op-unidade', area: 'Operações', icon: 'store', cover: 'cover-navy', name: 'Abertura e fechamento de unidade',
    desc: 'Rotina diária de lojas, clínicas e unidades: checklist de abertura, ronda, passagem de turno e fechamento com alarme.',
    columns: [['Abertura', G], ['Durante o expediente', B], ['Fechamento', P], ['Concluído', GR]],
    labels: [['Segurança', R], ['Limpeza', S], ['Estoque', O], ['Equipe', PK]],
    fields: [{ n: 'Unidade', t: 'text', card: true }, { n: 'Data', t: 'date' }, { n: 'Responsável do turno', t: 'text' }],
    proc: { ref: 'Data', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = o próprio dia)', title: 'Unidade' },
    cards: [
      { t: 'Checklist de abertura', col: 0, st: 0, due: 0, p: 'high', l: [0, 3], f: { Unidade: 'Loja Centro', Data: ymd(0) }, ck: [['Abertura', ['Desligar o alarme e conferir as portas', 'Luzes, ar-condicionado e equipamentos', 'Caixa aberto com troco', 'Vitrine e área de atendimento organizadas', 'Equipe completa (faltas?)']]] },
      { t: 'Ronda do meio do dia', col: 1, st: 0, due: 0, l: [1, 2], dep: [0], ck: [['Ronda', ['Limpeza de banheiros e salão', 'Reposição das prateleiras', 'Validade dos produtos expostos']]] },
      { t: 'Passagem de turno', col: 1, st: 0, due: 0, l: [3], dep: [0], ck: [['Passagem', ['Pendências do turno', 'Ocorrências com clientes', 'Recados para o próximo turno']]] },
      { t: 'Checklist de fechamento', col: 2, st: 0, due: 0, p: 'high', l: [0], dep: [1, 2], ck: [['Fechamento', ['Fechar o caixa', 'Desligar os equipamentos', 'Conferir portas e janelas', 'Retirar o lixo', 'Ativar o alarme']]] },
    ],
  },
  {
    id: 'op-recall', area: 'Operações', icon: 'package-x', cover: 'cover-orange', name: 'Recolhimento de produto (recall)',
    desc: 'Produto com defeito que oferece risco: lotes identificados, vendas bloqueadas, comunicação às autoridades e aos consumidores e recolhimento.',
    columns: [['Identificação', R], ['Contenção', O], ['Comunicação', Y], ['Recolhimento', B], ['Encerrado', GR]],
    labels: [['Qualidade', P], ['Jurídico', Y], ['Comunicação', PK], ['Logística', S]],
    fields: [{ n: 'Produto', t: 'text', card: true }, { n: 'Lotes', t: 'text' }, { n: 'Data da descoberta', t: 'date' }, { n: 'Unidades vendidas', t: 'number' }],
    proc: { ref: 'Data da descoberta', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da descoberta)', title: 'Produto' },
    cards: [
      { t: 'Confirmar o defeito e os lotes afetados', col: 0, st: 0, due: 1, p: 'urgent', l: [0], f: { Produto: 'Nome do produto', Lotes: 'Lote 000', 'Data da descoberta': ymd(0) }, ck: [['Identificação', ['Descrever o risco', 'Lotes e datas de fabricação', 'Quantidade vendida e onde', 'Estoque ainda na empresa']]] },
      { t: 'Bloquear estoque e vendas', col: 1, st: 0, due: 1, p: 'urgent', l: [3], dep: [0] },
      { t: 'Comunicar as autoridades', col: 2, st: 1, due: 3, p: 'urgent', l: [1], dep: [0], d: 'Produto que oferece risco exige comunicação imediata às autoridades e aos consumidores (CDC art. 10). O recall é comunicado à Senacon (Ministério da Justiça) e, conforme o produto, ao órgão regulador (Anvisa, Inmetro, Mapa).' },
      { t: 'Avisar os consumidores', col: 2, st: 1, due: 4, p: 'urgent', l: [2], dep: [0], ck: [['Aviso', ['Anúncios na imprensa, rádio e TV (CDC art. 10, § 2º)', 'Site e redes sociais', 'Contato direto com clientes conhecidos', 'Canal de atendimento do recall']]] },
      { t: 'Recolher, trocar ou reembolsar', col: 3, st: 4, due: 60, p: 'high', l: [3], dep: [3] },
      { t: 'Relatórios de andamento', col: 3, st: 30, due: 31, l: [1], dep: [2], d: 'Acompanhe quantos consumidores já foram atendidos e envie os relatórios que o órgão pedir.' },
      { t: 'Corrigir a causa na produção', col: 3, st: 3, due: 30, l: [0], dep: [0] },
    ],
  },
  {
    id: 'op-inventario', area: 'Operações', icon: 'boxes', cover: 'cover-green', name: 'Inventário de estoque',
    desc: 'Planejamento, estoque organizado, contagem cega, recontagem das diferenças, análise das causas e ajuste no sistema e na contabilidade.',
    columns: [['Preparação', G], ['Contagem', B], ['Divergências', Y], ['Ajustes', P], ['Concluído', GR]],
    labels: [['Contagem', S], ['Sistema', P], ['Financeiro', GR]],
    fields: [{ n: 'Unidade', t: 'text', card: true }, { n: 'Data da contagem', t: 'date' }, { n: 'Diferença total', t: 'money' }],
    proc: { ref: 'Data da contagem', refDay: 14, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data da contagem)', title: 'Unidade' },
    cards: [
      { t: 'Planejar o inventário', col: 0, st: 0, due: 5, p: 'high', f: { Unidade: 'Depósito', 'Data da contagem': ymd(14) }, ck: [['Planejamento', ['Equipes e áreas de contagem', 'Parar ou limitar as movimentações no dia', 'Etiquetas ou listas de contagem', 'Avisar fornecedores e clientes']]] },
      { t: 'Organizar o estoque antes da contagem', col: 0, st: 7, due: 13, dep: [0], ck: [['Organização', ['Agrupar itens iguais', 'Separar avariados e vencidos', 'Lançar as notas de entrada pendentes']]] },
      { t: 'Contagem cega', col: 1, st: 14, due: 14, p: 'urgent', l: [0], dep: [1], d: 'Quem conta não vê a quantidade que está no sistema.' },
      { t: 'Recontar as divergências', col: 2, st: 14, due: 15, p: 'high', l: [0], dep: [2] },
      { t: 'Analisar as causas das diferenças', col: 2, st: 15, due: 18, l: [1], dep: [3], ck: [['Causas', ['Erro de entrada ou saída', 'Perdas e avarias', 'Furtos', 'Unidade de medida errada']]] },
      { t: 'Ajustar o estoque no sistema e na contabilidade', col: 3, st: 18, due: 20, p: 'high', l: [1, 2], dep: [4] },
    ],
  },
  // ───────────────────────── Suporte e atendimento técnico
  {
    id: 'sup-niveis', area: 'Suporte e atendimento técnico', icon: 'layers', cover: 'cover-navy', name: 'Suporte em níveis (N1, N2 e N3) com SLA', done: 5,
    desc: 'Cada chamado com dono e prazo: o N1 faz a triagem e resolve o simples, o N2 analisa a parte técnica e o N3 (especialista ou desenvolvimento) corrige o que é defeito. Prazos de resposta e de solução por gravidade, lembretes ao cliente e revisão semanal do SLA.',
    columns: [['Novo', G], ['Triagem N1', S], ['Atendimento N2', B], ['Especialista N3', P], ['Aguardando cliente', Y], ['Resolvido', GR]],
    labels: [['Atendimento', B], ['TI', S], ['Desenvolvimento', P], ['Gestor', O], ['Crítico', R], ['Alto', O], ['Médio', Y], ['Baixo', S], ['Fornecedor', G]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Nº do chamado', t: 'text' }, { n: 'Canal', t: 'select', o: ['E-mail', 'Telefone', 'WhatsApp', 'Chat', 'Formulário'] }, { n: 'Gravidade', t: 'select', o: ['Crítico (resposta 30 min / solução 4 h)', 'Alto (resposta 1 h / solução 8 h)', 'Médio (resposta 4 h / solução 2 dias)', 'Baixo (resposta 1 dia / solução 5 dias)'] }, { n: 'Sistema ou produto', t: 'text' }, { n: 'Prazo de solução', t: 'date' }],
    rules: [{ when: 'created', act: 'due', val: 1, label: 'Chamado novo: prazo de 1 dia' }, { when: 'moved', col: 'Especialista N3', act: 'priority', val: 'high', label: 'Ao entrar em "Especialista N3", prioridade Alta' }, { when: 'completed', act: 'notify', label: 'Ao resolver, avisar o responsável' }],
    form: { title: 'Abrir chamado de suporte', intro: 'Conte o que aconteceu. Você recebe o número do chamado e o retorno pelo e-mail informado.', col: 'Novo', due: 1, prio: 'high', q: [['Resumo do problema', 'text', true], ['Sistema ou produto', 'text', true], ['Gravidade', 'select', true, ['Parou tudo', 'Atrapalha muito', 'Atrapalha pouco', 'Só uma dúvida']], ['O que você fez e o que aconteceu', 'long', true], ['Seu nome', 'text', true], ['Seu e-mail', 'email', true], ['Telefone', 'phone', false]] },
    cards: [
      { t: 'Chamado crítico: sistema parado', col: 1, st: 0, due: 0, p: 'urgent', l: [0, 4], f: { Cliente: 'Cliente Exemplo', Canal: 'Telefone', Gravidade: 'Crítico (resposta 30 min / solução 4 h)' }, d: 'Crítico = a operação do cliente está parada. Se vários clientes estão afetados ao mesmo tempo, abra também o modelo "Incidente grave".', ck: [['Triagem N1', ['Confirmar o recebimento ao cliente em até 30 minutos', 'Registrar o impacto: quantos usuários e desde quando', 'Acionar o N2 imediatamente', 'Avisar o gestor de plantão']], ['Atualizações', ['Dar retorno ao cliente a cada 1 hora', 'Registrar cada tentativa no card']]] },
      { t: 'Chamado de erro em funcionalidade', col: 1, st: 0, due: 1, p: 'high', l: [0, 5], ck: [['Triagem N1', ['Reproduzir o erro com o passo a passo do cliente', 'Coletar prints, horário e usuário afetado', 'Procurar na base de conhecimento', 'Resolver ou escalar ao N2 com tudo anotado']]] },
      { t: 'Análise técnica N2', col: 2, st: 0, due: 2, p: 'high', l: [1, 5], dep: [1], ck: [['N2', ['Analisar logs e configuração', 'Testar em ambiente de homologação', 'Corrigir configuração ou dados, se for o caso', 'Se for defeito de código, escalar ao N3 com as evidências']]] },
      { t: 'Correção pelo especialista N3', col: 3, st: 1, due: 5, p: 'high', l: [2], dep: [2], d: 'Defeito confirmado também vira card no mural de bugs ou sprint, com o número deste chamado.', ck: [['N3', ['Confirmar a causa no código', 'Corrigir e testar', 'Publicar a correção', 'Avisar o N1 para dar o retorno ao cliente']]] },
      { t: 'Dúvida de uso', col: 0, st: 0, due: 1, l: [0, 7], ck: [['Atendimento', ['Responder com passo a passo', 'Enviar o artigo ou vídeo da base de conhecimento', 'Confirmar se ficou claro']]] },
      { t: 'Pedido de configuração ou acesso', col: 0, st: 0, due: 2, l: [0, 6], ck: [['Atendimento', ['Confirmar quem autorizou do lado do cliente', 'Fazer a configuração', 'Validar com o cliente']]] },
      { t: 'Chamado que depende de fornecedor', col: 2, st: 0, due: 5, l: [1, 8], ck: [['Fornecedor', ['Abrir chamado no fornecedor e anotar o protocolo', 'Cobrar o retorno no prazo do contrato', 'Atualizar o cliente a cada etapa']]] },
      { t: 'Aguardando retorno do cliente', col: 4, st: 0, due: 3, l: [0], ck: [['Lembretes', ['1º lembrete em 24 horas', '2º lembrete em 48 horas', 'Encerrar após 3 dias sem resposta, avisando o cliente']]] },
      { t: 'Revisão semanal do SLA', col: 0, st: 0, due: 7, l: [3], ck: [['Indicadores', ['Chamados fora do prazo de resposta e de solução', 'Tempo médio em cada nível', 'Chamados reabertos', 'Escalonamentos ao N3 que o N2 poderia resolver', 'Assuntos para a base de conhecimento']]] },
    ],
  },
  {
    id: 'sup-servicedesk', area: 'Suporte e atendimento técnico', icon: 'monitor-cog', cover: 'cover-purple', name: 'Service desk interno de TI', done: 4,
    desc: 'Os pedidos dos colaboradores para a TI num lugar só, com formulário: senha, acesso, equipamento, programa, rede e impressora. Cada tipo com o passo a passo, a aprovação do gestor quando há custo e a revisão mensal.',
    columns: [['Solicitado', G], ['Aprovação', O], ['Em execução', B], ['Aguardando usuário', Y], ['Entregue', GR]],
    labels: [['TI', S], ['Gestor', O], ['Compras', GR], ['Financeiro', GR], ['Senha e acesso', S], ['Equipamento', O], ['Software', P], ['Rede e impressora', B], ['Urgente', R]],
    fields: [{ n: 'Solicitante', t: 'text', card: true }, { n: 'Setor', t: 'text' }, { n: 'Tipo', t: 'select', o: ['Senha e acesso', 'Equipamento', 'Programa ou licença', 'Rede ou internet', 'Impressora', 'Outro'] }, { n: 'Patrimônio', t: 'text' }, { n: 'Precisa de compra', t: 'checkbox' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Pedido novo: prazo de 2 dias' }, { when: 'moved', col: 'Aprovação', act: 'notify', label: 'Ao entrar em "Aprovação", avisar o responsável' }],
    form: { title: 'Pedido para a TI', intro: 'Peça aqui o que precisa da TI. Você acompanha pelo e-mail informado.', col: 'Solicitado', due: 2, q: [['O que você precisa', 'text', true], ['Tipo', 'select', true, ['Senha e acesso', 'Equipamento', 'Programa ou licença', 'Rede ou internet', 'Impressora', 'Outro']], ['Detalhes', 'long', true], ['Seu nome', 'text', true], ['Seu setor', 'text', true], ['Seu e-mail', 'email', true]] },
    cards: [
      { t: 'Redefinir senha ou desbloquear usuário', col: 0, st: 0, due: 0, p: 'high', l: [0, 4], f: { Solicitante: 'Colaborador Exemplo', Tipo: 'Senha e acesso' }, ck: [['Passo a passo', ['Confirmar a identidade de quem pede (nunca por mensagem de terceiros)', 'Redefinir e enviar senha temporária por canal seguro', 'Exigir a troca no primeiro acesso', 'Registrar no histórico']]] },
      { t: 'Liberar acesso a sistema ou pasta', col: 1, st: 0, due: 2, l: [0, 1, 4], ck: [['Aprovação', ['Gestor aprova por escrito', 'Conferir se o acesso é necessário para a função']], ['Execução', ['Criar o acesso com o menor nível necessário', 'Avisar o solicitante', 'Incluir na revisão trimestral de acessos']]] },
      { t: 'Equipamento novo ou substituição', col: 1, st: 0, due: 10, l: [0, 2, 5], ck: [['Aprovação', ['Justificativa do pedido', 'Aprovação do gestor e do orçamento']], ['Compra', ['3 cotações', 'Pedido de compra emitido']], ['Entrega', ['Configurar e cadastrar o patrimônio', 'Termo de responsabilidade assinado', 'Recolher o equipamento antigo']]] },
      { t: 'Instalar programa ou licença', col: 1, st: 0, due: 3, l: [0, 6], ck: [['Passo a passo', ['Conferir se há licença disponível ou se precisa comprar', 'Aprovação do gestor, se tiver custo', 'Instalar e testar', 'Registrar a licença no inventário']]] },
      { t: 'Problema de rede, internet ou impressora', col: 0, st: 0, due: 1, p: 'high', l: [0, 7], ck: [['Passo a passo', ['Ver se é só um usuário ou o setor inteiro', 'Testar cabo, Wi-Fi e fila de impressão', 'Resolver ou acionar o provedor', 'Confirmar com o usuário']]] },
      { t: 'Computador lento ou com erro', col: 0, st: 0, due: 2, l: [0, 6], ck: [['Passo a passo', ['Verificar disco, memória e atualizações', 'Rodar o antivírus', 'Limpar ou reinstalar o necessário', 'Avaliar a troca se tiver mais de 5 anos']]] },
      { t: 'Aprovar as compras de TI do mês', col: 1, st: 0, due: 15, l: [3, 2], ck: [['Financeiro', ['Somar os pedidos aprovados', 'Conferir o orçamento do mês', 'Liberar o pagamento']]] },
      { t: 'Revisão mensal dos pedidos', col: 0, st: 0, due: 30, l: [0], ck: [['Revisão', ['Pedidos por tipo e por setor', 'Tempo médio de atendimento', 'Pedidos repetidos que viram treinamento ou automação', 'Equipamentos para renovar no próximo trimestre']]] },
    ],
  },
  {
    id: 'sup-incidente', area: 'Suporte e atendimento técnico', icon: 'activity', cover: 'cover-orange', name: 'Incidente grave: sistema fora do ar', done: 5,
    desc: 'O roteiro para quando tudo para: confirmar, conter, avisar clientes e diretoria com mensagem única, restabelecer, validar e aprender com o relatório pós-incidente — sem caça a culpados e com ações para não se repetir.',
    columns: [['Detecção', R], ['Contenção', O], ['Comunicação', Y], ['Restabelecimento', B], ['Pós-incidente', P], ['Encerrado', GR]],
    labels: [['TI', S], ['Desenvolvimento', P], ['Atendimento', B], ['Marketing', PK], ['Diretoria', G], ['Gestor', O], ['Crítico', R], ['Cliente afetado', PK]],
    fields: [{ n: 'Incidente', t: 'text', card: true }, { n: 'Início do incidente', t: 'date' }, { n: 'Sistemas afetados', t: 'text' }, { n: 'Impacto', t: 'select', o: ['Todos os clientes', 'Parte dos clientes', 'Uso interno'] }, { n: 'Líder do incidente', t: 'text' }, { n: 'Tempo fora do ar (minutos)', t: 'number' }],
    proc: { ref: 'Início do incidente', refDay: 0, lead: 0, q: 'Antecipar os prazos em quantos dias? (0 = contar a partir do início do incidente)', title: 'Incidente' },
    rules: [{ when: 'moved', col: 'Restabelecimento', act: 'priority', val: 'urgent', label: 'Ao entrar em "Restabelecimento", prioridade Urgente' }],
    cards: [
      { t: 'Confirmar o incidente e abrir a sala de crise', col: 0, st: 0, due: 0, p: 'urgent', l: [0, 6], f: { Incidente: 'Sistema principal fora do ar', Impacto: 'Todos os clientes' }, ck: [['Início', ['Confirmar que não é falso alarme', 'Definir o líder do incidente (quem comanda)', 'Abrir um canal único (War Room do ewvon)', 'Registrar o horário de início']]] },
      { t: 'Avaliar o impacto', col: 0, st: 0, due: 0, p: 'urgent', l: [0, 7], dep: [0], ck: [['Impacto', ['Quais sistemas e funções estão fora', 'Quantos clientes e usuários afetados', 'Há risco de perda de dados?', 'Classificar: todos, parte ou só uso interno']]] },
      { t: 'Conter o problema', col: 1, st: 0, due: 0, p: 'urgent', l: [0, 1], dep: [1], d: 'Primeiro estabilizar, depois investigar a causa.', ck: [['Contenção', ['Desfazer a última mudança, se houver', 'Ativar a contingência ou o modo manual', 'Isolar o componente com falha', 'Registrar cada ação com o horário']]] },
      { t: 'Avisar clientes e equipe (1ª mensagem)', col: 2, st: 0, due: 0, p: 'urgent', l: [2, 3], dep: [1], ck: [['Comunicação', ['Mensagem única aprovada pelo líder', 'Página de status, e-mail ou WhatsApp', 'Roteiro para o suporte responder', 'Horário da próxima atualização']]] },
      { t: 'Atualizar o status a cada hora', col: 2, st: 0, due: 0, p: 'high', l: [2], dep: [3], ck: [['Cada atualização', ['O que já se sabe', 'O que está sendo feito', 'Previsão, sem prometer o que não se sabe']]] },
      { t: 'Informar a diretoria', col: 2, st: 0, due: 0, p: 'high', l: [4, 5], dep: [1], ck: [['Diretoria', ['Impacto e clientes afetados', 'Ações em andamento', 'Decisões necessárias (custos, fornecedores)']]] },
      { t: 'Restabelecer o serviço', col: 3, st: 0, due: 1, p: 'urgent', l: [1, 0], dep: [2], ck: [['Volta', ['Aplicar a correção', 'Testar as funções principais', 'Monitorar por 1 hora', 'Confirmar que os dados estão íntegros']]] },
      { t: 'Validar com clientes e encerrar a comunicação', col: 3, st: 0, due: 1, p: 'high', l: [2], dep: [6], ck: [['Encerramento', ['Confirmar com os clientes principais', 'Mensagem de normalização', 'Responder os chamados abertos sobre o incidente']]] },
      { t: 'Relatório pós-incidente', col: 4, st: 1, due: 5, l: [5, 0], dep: [6], d: 'Sem caça a culpados: o objetivo é que não se repita.', ck: [['Relatório', ['Linha do tempo com horários', 'Causa raiz (5 porquês)', 'O que funcionou e o que falhou', 'Tempo fora do ar e clientes afetados']]] },
      { t: 'Ações para não se repetir', col: 4, st: 5, due: 20, l: [1, 0], dep: [8], ck: [['Ações', ['Uma ação por causa, com dono e prazo', 'Melhorar os alertas de monitoramento', 'Atualizar o plano de contingência', 'Simulado do plano em até 90 dias']]] },
      { t: 'Compensar clientes (se o contrato prever)', col: 4, st: 2, due: 10, l: [4, 2], dep: [8], ck: [['Compensação', ['Conferir o SLA do contrato', 'Calcular o desconto ou crédito', 'Comunicar e aplicar na fatura']]] },
    ],
  },
  {
    id: 'sup-recorrente', area: 'Suporte e atendimento técnico', icon: 'repeat', cover: 'cover-green', name: 'Problema recorrente: da causa à solução definitiva', done: 4,
    desc: 'Para o chamado que volta toda semana: juntar os casos, medir quanto custam, publicar um contorno, achar a causa raiz, corrigir de vez e confirmar em 30 dias que parou.',
    columns: [['Identificado', G], ['Análise', B], ['Solução', P], ['Acompanhamento', O], ['Resolvido', GR]],
    labels: [['Atendimento', B], ['Desenvolvimento', P], ['Qualidade', S], ['TI', S], ['Gestor', O], ['Alto volume', R], ['Contorno ativo', Y]],
    fields: [{ n: 'Problema', t: 'text', card: true }, { n: 'Chamados relacionados', t: 'number' }, { n: 'Custo estimado por mês', t: 'money' }, { n: 'Sistema ou processo', t: 'text' }],
    cards: [
      { t: 'Juntar os chamados repetidos', col: 0, st: 0, due: 2, l: [0, 5], f: { Problema: 'Erro ao gerar relatório', 'Chamados relacionados': 12 }, ck: [['Levantamento', ['Buscar chamados com o mesmo sintoma nos últimos 90 dias', 'Contar quantos são e de quais clientes', 'Anotar o contorno usado hoje']]] },
      { t: 'Medir o impacto', col: 0, st: 2, due: 4, l: [4], dep: [0], ck: [['Impacto', ['Horas do suporte gastas por mês', 'Clientes afetados e risco de cancelamento', 'Prioridade em relação aos outros problemas']]] },
      { t: 'Publicar o contorno provisório', col: 0, st: 1, due: 3, l: [0, 6], dep: [0], ck: [['Contorno', ['Passo a passo do contorno', 'Artigo na base de conhecimento', 'Avisar todo o N1']]] },
      { t: 'Encontrar a causa raiz (5 porquês)', col: 1, st: 4, due: 10, l: [2, 1], dep: [1], ck: [['Análise', ['Reproduzir o problema', 'Perguntar "por quê?" até chegar à causa', 'Confirmar a causa com dados']]] },
      { t: 'Definir a solução definitiva', col: 2, st: 10, due: 14, l: [1, 3, 4], dep: [3], ck: [['Decisão', ['Opções de solução com custo e prazo', 'Aprovação do gestor', 'Card de correção no mural de desenvolvimento']]] },
      { t: 'Implantar a solução', col: 2, st: 14, due: 30, p: 'high', l: [1], dep: [4], ck: [['Implantação', ['Corrigir', 'Testar', 'Publicar', 'Avisar o suporte']]] },
      { t: 'Atualizar a base de conhecimento', col: 3, st: 30, due: 32, l: [0], dep: [5], ck: [['Base', ['Retirar o contorno', 'Registrar a causa e a solução', 'Responder os clientes dos chamados ligados']]] },
      { t: 'Confirmar que parou (30 dias)', col: 3, st: 30, due: 60, l: [2, 0], dep: [5], ck: [['Acompanhamento', ['Contar os chamados do mesmo sintoma após a correção', 'Se voltou, reabrir a análise', 'Encerrar registrando o resultado']]] },
    ],
  },
  {
    id: 'sup-garantia', area: 'Suporte e atendimento técnico', icon: 'shield-check', cover: 'cover-navy', name: 'Assistência técnica, garantia e troca', done: 4,
    desc: 'Do pedido do cliente à devolução do produto: conferência da garantia, coleta, laudo técnico, reparo, troca ou devolução do valor dentro do prazo de 30 dias do Código de Defesa do Consumidor, pesquisa de satisfação e análise mensal dos defeitos.',
    columns: [['Abertura', G], ['Coleta e análise', B], ['Reparo ou troca', P], ['Devolução ao cliente', O], ['Encerrado', GR]],
    labels: [['Atendimento', B], ['Logística', O], ['Qualidade', S], ['Financeiro', GR], ['Jurídico', G], ['Dentro da garantia', S], ['Fora da garantia', Y], ['Prazo legal', R]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Produto', t: 'text' }, { n: 'Nº de série', t: 'text' }, { n: 'Nota fiscal', t: 'text' }, { n: 'Data da compra', t: 'date' }, { n: 'Data da reclamação', t: 'date' }, { n: 'Solução', t: 'select', o: ['Reparo', 'Troca', 'Devolução do valor', 'Abatimento no preço'] }],
    proc: { ref: 'Data da reclamação', refDay: 0, lead: 0, q: 'Antecipar os prazos em quantos dias? (0 = contar a partir da data da reclamação)', title: 'Cliente' },
    rules: [{ when: 'moved', col: 'Devolução ao cliente', act: 'priority', val: 'high', label: 'Ao entrar em "Devolução ao cliente", prioridade Alta' }],
    form: { title: 'Solicitar assistência ou troca', intro: 'Informe o produto e o defeito. Você recebe o número do protocolo pelo e-mail.', col: 'Abertura', due: 1, q: [['Produto', 'text', true], ['Nº de série ou do pedido', 'text', true], ['Data da compra', 'date', true], ['O que aconteceu', 'long', true], ['Seu nome', 'text', true], ['Seu e-mail', 'email', true], ['Telefone', 'phone', false]] },
    cards: [
      { t: 'Registrar a reclamação e conferir a garantia', col: 0, st: 0, due: 1, p: 'high', l: [0, 5], f: { Cliente: 'Cliente Exemplo', Produto: 'Produto Exemplo' }, d: 'Pelo Código de Defesa do Consumidor (art. 18), o defeito deve ser resolvido em até 30 dias; depois disso o cliente pode escolher a troca, a devolução do valor ou o abatimento no preço. O prazo para reclamar de defeito aparente é de 30 dias (produtos não duráveis) ou 90 dias (duráveis), art. 26.', ck: [['Abertura', ['Nota fiscal e data da compra', 'Garantia legal e contratual conferidas', 'Fotos ou vídeo do defeito', 'Número do protocolo enviado ao cliente']]] },
      { t: 'Agendar a coleta ou o envio', col: 1, st: 1, due: 3, l: [1], dep: [0], ck: [['Logística', ['Etiqueta ou coleta agendada', 'Orientação de embalagem', 'Código de rastreio enviado ao cliente']]] },
      { t: 'Análise técnica do produto', col: 1, st: 3, due: 8, l: [2], dep: [1], ck: [['Laudo', ['Confirmar o defeito', 'Verificar sinais de mau uso (com fotos)', 'Emitir o laudo técnico', 'Decidir: reparo, troca ou fora da garantia']]] },
      { t: 'Reparar o produto', col: 2, st: 8, due: 20, l: [2], dep: [2], ck: [['Reparo', ['Peças disponíveis', 'Reparo e teste', 'Registrar o que foi trocado']]] },
      { t: 'Trocar o produto ou devolver o valor', col: 2, st: 8, due: 15, l: [3, 1], dep: [2], ck: [['Troca ou devolução', ['Escolha do cliente registrada', 'Separar o produto novo ou programar o estorno', 'Nota fiscal de troca ou devolução']]] },
      { t: 'Orçamento fora da garantia', col: 2, st: 8, due: 12, l: [0, 6], dep: [2], ck: [['Orçamento', ['Enviar o orçamento com o laudo', 'Aprovação do cliente', 'Se recusar, devolver o produto (combinar o frete)']]] },
      { t: 'Devolver o produto ao cliente', col: 3, st: 20, due: 25, p: 'high', l: [1, 7], dep: [3], ck: [['Devolução', ['Envio dentro dos 30 dias', 'Rastreio enviado', 'Recebimento confirmado']]] },
      { t: 'Pesquisa de satisfação e encerramento', col: 3, st: 25, due: 28, l: [0], dep: [6], ck: [['Encerramento', ['Cliente satisfeito?', 'Registrar o motivo do defeito para a Qualidade', 'Encerrar o protocolo']]] },
      { t: 'Prazo legal vencido ou reclamação no Procon', col: 0, st: 0, due: 2, p: 'urgent', l: [4, 0, 7], ck: [['Jurídico', ['Avaliar o risco com o jurídico', 'Propor acordo ao cliente', 'Responder dentro do prazo do órgão']]] },
      { t: 'Análise mensal dos defeitos', col: 0, st: 0, due: 30, l: [2], ck: [['Análise', ['Defeitos por produto e lote', 'Custo de garantia do mês', 'Ação com o fornecedor ou a produção']]] },
    ],
  },
  {
    id: 'sup-conhecimento', area: 'Suporte e atendimento técnico', icon: 'book-open', cover: 'cover-purple', name: 'Base de conhecimento do suporte', done: 3,
    desc: 'Transforma o que só algumas pessoas sabem em artigos: levanta as dúvidas mais frequentes, escreve passo a passo e erros conhecidos, revisa, publica na Base de conhecimento do ewvon e mede quantos chamados deixaram de chegar.',
    columns: [['Ideias', G], ['Escrevendo', B], ['Revisão', Y], ['Publicado', GR]],
    labels: [['Atendimento', B], ['TI', S], ['Desenvolvimento', P], ['Qualidade', S], ['Gestor', O], ['Passo a passo', S], ['Erro conhecido', R], ['Política', P]],
    fields: [{ n: 'Artigo', t: 'text', card: true }, { n: 'Tema', t: 'text' }, { n: 'Público', t: 'select', o: ['Clientes', 'Equipe interna', 'Ambos'] }, { n: 'Chamados evitados por mês', t: 'number' }, { n: 'Próxima revisão', t: 'date' }],
    cards: [
      { t: 'Levantar as dúvidas mais frequentes', col: 0, st: 0, due: 5, l: [0, 4], ck: [['Levantamento', ['Os 20 assuntos mais comuns nos chamados (90 dias)', 'Perguntas que só uma pessoa sabe responder', 'Ordem de prioridade pelo volume']]] },
      { t: 'Escrever artigo passo a passo', col: 1, st: 3, due: 8, l: [0, 5], dep: [0], f: { Artigo: 'Como emitir a segunda via', Público: 'Clientes' }, ck: [['Estrutura', ['Título com a pergunta do cliente', 'Passo a passo numerado com prints', 'O que fazer se não funcionar', 'Palavras-chave para a busca']]] },
      { t: 'Documentar erro conhecido e contorno', col: 1, st: 3, due: 8, l: [1, 6], dep: [0], ck: [['Estrutura', ['Sintoma como o cliente descreve', 'Causa, se conhecida', 'Contorno passo a passo', 'Previsão da correção definitiva']]] },
      { t: 'Revisão técnica do artigo', col: 2, st: 8, due: 10, l: [2, 3], dep: [1, 2], ck: [['Revisão', ['Passos testados de verdade', 'Prints atualizados', 'Linguagem simples, sem jargão']]] },
      { t: 'Publicar e divulgar ao time', col: 2, st: 10, due: 11, l: [0], dep: [3], ck: [['Publicação', ['Publicar na Base de conhecimento do ewvon', 'Avisar o N1 e o N2', 'Usar o link nas respostas aos clientes']]] },
      { t: 'Medir os chamados evitados', col: 0, st: 30, due: 40, l: [4], dep: [4], ck: [['Medição', ['Chamados do tema antes e depois do artigo', 'Artigos mais acessados', 'Artigos sem uso para revisar ou apagar']]] },
      { t: 'Revisão semestral dos artigos', col: 0, st: 0, due: 180, l: [3, 0], ck: [['Revisão', ['Artigos com tela ou processo que mudou', 'Erros conhecidos que já foram corrigidos', 'Datas da próxima revisão']]] },
    ],
  },
];

const ICON_OK = new Set(BOARD_TEMPLATES.map((t) => t.icon));
export const templateIcons = () => ICON_OK;

// conclusion column of each model (finished cards count as done there; e.g. "Ganho", "Pago", "Contratado")
const DONE_COL: Record<string, number> = { onboarding: 5, offboarding: 3, recrutamento: 5, vendas: 4, suporte: 3, posvenda: 5, marketing: 4, campanha: 4, manutencao: 4, eventos: 4, compras: 5, contas: 2, contratos: 4, projeto: 3, sprint: 5, okrs: 3,
  treinamento: 4, ferias: 4, desempenho: 5, sucesso: 4, design: 4, estoque: 4, entregas: 3, qualidade: 4,
  fechamento: 3, reembolso: 3, bugs: 4, implantacao: 5, reunioes: 4, planejamento: 5, fornecedores: 2,
  'dp-folha': 4, 'dp-afastamentos': 5, 'dp-ponto': 4, 'dp-duvidas': 3, 'dp-beneficios': 3, 'dp-cat': 4, 'dp-trabalhista': 5,
  'rh-turnover': 5, 'rh-clima': 4, 'rh-conduta': 5, 'rh-aso': 2, pdca: 5, crise: 5, reclamacoes: 4,
  'rh-promocao': 4, 'rh-transferencia': 4, 'rh-sucessao': 4, 'dp-estagio': 4, 'dp-aprendiz': 4,
  'sst-cipa': 4, 'sst-simulado': 4, 'sst-revisao': 3, 'ti-acessos': 4, 'lgpd-titular': 3, 'lgpd-incidente': 4, 'ti-backup': 4,
  'adm-vencimentos': 3, 'adm-licitacao': 4, 'adm-mudanca': 4, 'adm-troca-gestor': 3, 'adm-fiscalizacao': 4, 'fin-cobranca': 3, 'fin-caixa': 3,
  'op-unidade': 3, 'op-recall': 4, 'op-inventario': 4 };

/** Labels of a model as the mural gets them: department labels first (same colour in every model), then the model's
 *  own theme labels; cardLabels[i] = label indexes of card i (its departments first). */
export function templateLabels(t: BoardTemplate) {
  const extra = DEPT_OF[t.id] || [];
  const cardDepts = t.cards.map((c, i) => {
    const own = (c.l || []).map((j) => t.labels[j]?.[0]).filter((n): n is string => !!n && isDept(n));
    const add = (extra[i] || '').split('+').map((x) => x.trim()).filter(Boolean);
    return [...new Set(add.length ? [...add, ...own] : own)];
  });
  const depts: string[] = [];
  for (const ds of cardDepts) for (const d of ds) if (!depts.includes(d)) depts.push(d);
  depts.sort((a, b) => Object.keys(DEPTS).indexOf(a) - Object.keys(DEPTS).indexOf(b));
  const themes = t.labels.filter(([n]) => !isDept(n));
  const labels: [string, string][] = [...depts.map((d) => [d, DEPTS[d]] as [string, string]), ...themes];
  const idx = (name: string) => labels.findIndex(([n]) => n === name);
  const cardLabels = t.cards.map((c, i) => [...new Set([...cardDepts[i].map(idx), ...(c.l || []).map((j) => t.labels[j]?.[0]).filter((n) => n && !isDept(n)).map((n) => idx(n!))])].filter((x) => x >= 0));
  return { labels, depts, cardDepts, cardLabels };
}

export function templateToBoard(t: BoardTemplate): ImpBoard {
  const L = templateLabels(t);
  return {
    source: 'modelo', doneCol: t.done ?? DONE_COL[t.id], name: t.name, desc: t.desc,
    columns: t.columns.map(([title, color]) => ({ title, color })),
    labels: L.labels.map(([name, color]) => ({ name, color })),
    cards: t.cards.map((c, i) => ({
      title: c.t, desc: c.d || '', col: c.col, due: c.due != null ? day(c.due) : null, start: c.st != null ? day(c.st, 9) : null,
      done: false, priority: c.p || 'medium', labels: L.cardLabels[i], comments: [], people: [],
      checklists: (c.ck || []).map(([title, items]) => ({ title, items: items.map((x) => ({ t: x, done: false })) })),
    })),
  };
}

const db = supabase as any;
const TRIG: Record<Rule['when'], string> = { created: 'card_created', moved: 'moved_to_column', completed: 'card_completed', assigned: 'card_assigned' };
const ACT: Record<Rule['act'], string> = { priority: 'set_priority', due: 'set_due_days', notify: 'notify', move: 'move_column', label: 'add_label' };

/** Custom fields + values, dependencies, automations and form of a template, inside the mural just created. */
export async function applyTemplateExtras(boardId: string, t: BoardTemplate, profileId: string) {
  const [{ data: cols }, { data: labs }, { data: tasks }] = await Promise.all([
    db.from('task_board_columns').select('id,title').eq('board_id', boardId),
    db.from('task_labels').select('id,name').eq('board_id', boardId),
    db.from('tasks').select('id,title').eq('board_id', boardId),
  ]);
  const colId = (title?: string) => (cols || []).find((c: { title: string }) => c.title === title)?.id || null;
  const taskId = (i: number) => (tasks || []).find((x: { title: string }) => x.title === t.cards[i]?.t)?.id || null;

  let fid = new Map<string, string>();
  if (t.fields?.length) {
    const { data: fs } = await db.from('board_custom_fields').insert(t.fields.map((f, i) => ({ board_id: boardId, name: f.n, type: f.t, options: f.o || [], show_on_card: !!f.card, position: i }))).select('id,name');
    fid = new Map(((fs || []) as { id: string; name: string }[]).map((f) => [f.name, f.id]));
    const vals: { task_id: string; field_id: string; value: unknown }[] = [];
    t.cards.forEach((c, i) => { const tid = taskId(i); if (!tid || !c.f) return; for (const [k, v] of Object.entries(c.f)) { const f = fid.get(k); if (f) vals.push({ task_id: tid, field_id: f, value: v }); } });
    if (vals.length) await db.from('task_field_values').insert(vals);
  }
  const deps: { task_id: string; depends_on: string }[] = [];
  t.cards.forEach((c, i) => { const a = taskId(i); for (const j of c.dep || []) { const b = taskId(j); if (a && b) deps.push({ task_id: a, depends_on: b }); } });
  if (deps.length) await db.from('task_dependencies').insert(deps);

  if (t.rules?.length) {
    const rows = t.rules.map((r) => {
      const trigger_config: Record<string, unknown> = {}; const action_config: Record<string, unknown> = {};
      if (r.when === 'moved') { const c = colId(r.col); if (!c) return null; trigger_config.column_id = c; }
      if (r.act === 'priority') action_config.priority = r.val;
      if (r.act === 'due') action_config.days = r.val;
      if (r.act === 'move') { const c = colId(String(r.val)); if (!c) return null; action_config.column_id = c; }
      if (r.act === 'label') { const l = (labs || []).find((x: { name: string }) => x.name === r.val); if (!l) return null; action_config.label_id = l.id; }
      return { board_id: boardId, trigger_type: TRIG[r.when], trigger_config, action_type: ACT[r.act], action_config, created_by: profileId, is_active: true };
    }).filter(Boolean);
    if (rows.length) await db.from('task_automation_rules').insert(rows);
  }
  await makeProcessTemplates(boardId, t, fid);
  if (t.form) {
    await db.from('board_forms').insert({
      board_id: boardId, enabled: false, title: t.form.title, intro: t.form.intro, column_id: colId(t.form.col), due_days: t.form.due ?? null,
      priority: t.form.prio || 'medium', thank_you: t.form.thanks || null,
      questions: t.form.q.map(([label, type, required, options], i) => ({ id: 'q' + (i + 1), label, type, required, ...(options ? { options } : {}) })),
    });
  }
}

/** Process models: a "Modelo do processo" template column (first, configured with the reference date, lead days,
 *  question and title field) holds the model's cards as templates with relative due/start offsets; the regular
 *  columns start empty and "Duplicar todos os cards" creates the real cards. */
async function makeProcessTemplates(boardId: string, t: BoardTemplate, fid: Map<string, string>) {
  // EVERY model gets the "Modelo do processo" column; process models also know their reference date (onboarding =
  // Data de admissão…); the others count the dates from the day of the duplication. Each template remembers the column
  // its real card goes to (template_target_column), so "Duplicar todos os cards" puts every card in its own column.
  const p = t.proc || { ref: '', refDay: 0, lead: 0, q: '' };
  const { data: cols } = await db.from('task_board_columns').select('id,position').eq('board_id', boardId).order('position');
  for (const c of (cols || []) as { id: string; position: number }[]) await db.from('task_board_columns').update({ position: (c.position ?? 0) + 1 }).eq('id', c.id);
  const { data: col, error } = await db.from('task_board_columns').insert({
    board_id: boardId, title: 'Modelo do processo', color: '#64748b', position: 0, is_template_column: true,
    template_ref_field: p.ref ? fid.get(p.ref) || null : null, template_lead_days: p.lead, template_lead_label: p.q || null, template_title_field: p.title ? fid.get(p.title) || null : null,
  }).select('id').single();
  if (error || !col) return;
  const { data: tasks } = await db.from('tasks').select('id,title,status').eq('board_id', boardId);
  const final = p.refDay - p.lead;
  for (let i = 0; i < t.cards.length; i++) {
    const c = t.cards[i];
    const row = ((tasks || []) as { id: string; title: string; status: string }[]).find((x) => x.title === c.t);
    if (!row) continue;
    await db.from('tasks').update({
      status: col.id, is_template: true, position: i, due_date: null, start_date: null, completed_at: null, template_target_column: row.status,
      template_offset_days: c.due != null ? c.due - final : null, template_start_offset_days: c.st != null ? c.st - final : null,
    }).eq('id', row.id);
  }
}

/** What a template brings, for the preview. */
export const templateSummary = (t: BoardTemplate) => ({ proc: true, cards: t.cards.length, fields: t.fields?.length || 0, rules: t.rules?.length || 0, deps: t.cards.reduce((a, c) => a + (c.dep?.length || 0), 0), form: !!t.form, checklists: t.cards.reduce((a, c) => a + (c.ck?.length || 0), 0) });
