// Ready-made mural templates (Tarefas › Modelos), grouped by area. A template is created in two steps:
//  1. templateToBoard → ImpBoard → importBoard(): columns (the last "done-like" column becomes the conclusion column),
//     labels, cards with checklists, start/due dates relative to today.
//  2. applyTemplateExtras(): custom fields (+ values on the example cards), dependencies between example cards,
//     instant automation rules and, when the template has one, the public request form (paused until the owner
//     reviews it). Everything is created inside the NEW mural only.
import { supabase } from '@/integrations/supabase/client';
import type { ImpBoard, ImpCard } from '@/lib/boardImport';

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
};

export const TEMPLATE_AREAS = ['Recursos Humanos', 'Departamento Pessoal', 'Segurança do trabalho', 'TI e proteção de dados', 'Vendas e atendimento', 'Marketing', 'Operações', 'Financeiro e compras', 'Projetos e tecnologia', 'Gestão e administração', 'Resolução de problemas'];

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
      { t: 'Avaliação de 90 dias e efetivação', col: 4, st: 95, due: 98, p: 'high', l: [2, 4, 0], dep: [14], d: 'O contrato de experiência dura no máximo 90 dias; sem decisão no prazo, ele vira contrato por tempo indeterminado.', ck: [['Efetivação', ['Avaliação final do gestor', 'Comunicar o resultado ao colaborador', 'DP: atualizar o contrato e liberar benefícios pós-experiência', 'Plano de desenvolvimento (PDI) do primeiro ano']]] },
    ],
  },
  {
    id: 'offboarding', area: 'Recursos Humanos', icon: 'user-minus', cover: 'cover-purple', name: 'Desligamento (offboarding)',
    desc: 'Saída organizada e segura: comunicação, devolução de equipamentos, bloqueio de acessos, documentos e entrevista de desligamento.',
    columns: [['Comunicado', G], ['Em andamento', B], ['Acertos finais', O], ['Encerrado', GR]],
    labels: [['RH', PK], ['TI', S], ['Financeiro', Y], ['Urgente', R]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Último dia', t: 'date' }, { n: 'Tipo', t: 'select', o: ['Pedido de demissão', 'Dispensa', 'Fim de contrato', 'Acordo'] }],
    proc: { ref: 'Último dia', refDay: 10, lead: 1, q: 'Quantos dias antes do último dia o desligamento precisa estar concluído?', title: 'Colaborador' },
    cards: [
      { t: 'Registrar desligamento e comunicar a equipe', col: 0, st: 0, due: 1, p: 'high', l: [0], f: { Colaborador: 'Pessoa que sai', 'Último dia': ymd(10), Tipo: 'Pedido de demissão' } },
      { t: 'Transferir responsabilidades e conhecimento', col: 1, st: 1, due: 8, l: [0], dep: [0], ck: [['Passagem', ['Listar atividades em andamento', 'Definir quem assume cada uma', 'Documentar processos', 'Repassar contatos de clientes/fornecedores']]] },
      { t: 'Bloquear acessos no último dia', col: 1, st: 10, due: 10, p: 'urgent', l: [1, 3], dep: [1], ck: [['Acessos', ['E-mail', 'ewvon', 'Sistemas internos', 'VPN', 'Contas compartilhadas (trocar senhas)']]] },
      { t: 'Devolução de equipamentos', col: 1, st: 9, due: 10, l: [1], ck: [['Itens', ['Notebook', 'Celular corporativo', 'Crachá', 'Chaves']]] },
      { t: 'Cálculo e pagamento da rescisão', col: 2, st: 10, due: 20, p: 'high', l: [2], dep: [0] },
      { t: 'Entrevista de desligamento', col: 2, st: 9, due: 10, l: [0], ck: [['Perguntas', ['Motivo da saída', 'O que funcionou bem', 'O que pode melhorar', 'Indicaria a empresa?']]] },
    ],
  },
  {
    id: 'recrutamento', area: 'Recursos Humanos', icon: 'user-search', cover: 'cover-purple', name: 'Recrutamento e seleção',
    desc: 'Um card por candidato, da candidatura à contratação. Inclui formulário público de candidatura e campos de vaga e pretensão.',
    columns: [['Candidaturas', G], ['Triagem', B], ['Entrevista RH', Y], ['Entrevista gestor', O], ['Proposta', P], ['Contratado', GR], ['Não seguiu', R]],
    labels: [['Destaque', Y], ['Indicação', P], ['Banco de talentos', S]],
    fields: [{ n: 'Vaga', t: 'select', o: ['Comercial', 'Administrativo', 'Operações', 'Tecnologia'], card: true }, { n: 'Pretensão salarial', t: 'money' }, { n: 'Disponibilidade', t: 'select', o: ['Imediata', '15 dias', '30 dias'] }, { n: 'Nota da entrevista', t: 'number' }],
    rules: [{ when: 'created', act: 'due', val: 3, label: 'Nova candidatura: prazo de 3 dias para triagem' }, { when: 'moved', col: 'Proposta', act: 'priority', val: 'high', label: 'Ao entrar em "Proposta", prioridade Alta' }],
    form: { title: 'Trabalhe conosco', intro: 'Envie sua candidatura. Nossa equipe de RH vai analisar e entrar em contato.', col: 'Candidaturas', q: [['Nome completo', 'text', true], ['Vaga de interesse', 'select', true, ['Comercial', 'Administrativo', 'Operações', 'Tecnologia']], ['E-mail', 'email', true], ['Telefone', 'phone', true], ['Link do currículo (LinkedIn, Drive...)', 'text', false], ['Conte um pouco sobre você', 'long', false]], thanks: 'Recebemos sua candidatura! Se o seu perfil combinar com a vaga, entraremos em contato.' },
    cards: [
      { t: 'Candidato A', col: 1, due: 2, l: [1], f: { Vaga: 'Comercial', 'Pretensão salarial': 3500, Disponibilidade: 'Imediata' }, ck: [['Triagem', ['Ler currículo', 'Ligação de 10 minutos', 'Agendar entrevista']]] },
      { t: 'Candidata B', col: 3, due: 3, p: 'high', l: [0], f: { Vaga: 'Administrativo', 'Pretensão salarial': 4200, Disponibilidade: '15 dias', 'Nota da entrevista': 9 }, ck: [['Entrevistas', ['RH', 'Gestor', 'Teste prático', 'Referências']]] },
      { t: 'Candidato C', col: 0, due: 3, f: { Vaga: 'Tecnologia', Disponibilidade: '30 dias' } },
    ],
  },
  // ───────────────────────── Vendas e atendimento
  {
    id: 'vendas', area: 'Vendas e atendimento', icon: 'briefcase', cover: 'cover-green', name: 'Funil de vendas (CRM)',
    desc: 'Cada oportunidade do primeiro contato ao fechamento, com valor, origem e probabilidade. Use o Relatório do mural para ver o funil.',
    columns: [['Novos contatos', G], ['Qualificação', B], ['Proposta enviada', Y], ['Negociação', O], ['Ganho', GR], ['Perdido', R]],
    labels: [['Quente', R], ['Morno', O], ['Frio', S], ['Indicação', P]],
    fields: [{ n: 'Valor', t: 'money', card: true }, { n: 'Origem', t: 'select', o: ['Site', 'Indicação', 'Evento', 'Redes sociais', 'Prospecção'] }, { n: 'Probabilidade', t: 'select', o: ['10%', '25%', '50%', '75%', '90%'] }, { n: 'Contato', t: 'text' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Contato novo: retornar em até 2 dias' }, { when: 'moved', col: 'Negociação', act: 'priority', val: 'high', label: 'Em "Negociação", prioridade Alta' }, { when: 'moved', col: 'Ganho', act: 'notify', label: 'Venda ganha: avisar o responsável' }],
    form: { title: 'Fale com nosso time comercial', intro: 'Deixe seus dados e retornaremos em até 2 dias úteis.', col: 'Novos contatos', due: 2, q: [['Empresa', 'text', true], ['Seu nome', 'text', true], ['E-mail', 'email', true], ['Telefone', 'phone', false], ['O que você procura?', 'long', false]] },
    cards: [
      { t: 'Empresa Exemplo — primeiro contato', d: 'Veio pelo site, pediu demonstração.', col: 0, due: 1, l: [1], f: { Valor: 12000, Origem: 'Site', Probabilidade: '10%', Contato: 'Ana (compras)' }, ck: [['Próximos passos', ['Ligar e entender a necessidade', 'Enviar apresentação']]] },
      { t: 'Cliente Modelo — diagnóstico', col: 1, due: 3, p: 'high', l: [0, 3], f: { Valor: 28000, Origem: 'Indicação', Probabilidade: '50%' } },
      { t: 'Loja Demonstração — proposta', col: 2, due: 5, l: [1], f: { Valor: 9500, Origem: 'Evento', Probabilidade: '50%' }, ck: [['Proposta', ['Montar proposta', 'Revisar valores com o gestor', 'Enviar e confirmar recebimento', 'Agendar retorno']]] },
      { t: 'Indústria Fictícia — ajuste de contrato', col: 3, due: 2, p: 'urgent', l: [0], f: { Valor: 54000, Origem: 'Prospecção', Probabilidade: '75%' } },
    ],
  },
  {
    id: 'suporte', area: 'Vendas e atendimento', icon: 'headset', cover: 'cover-navy', name: 'Central de atendimento (help desk)',
    desc: 'Chamados de clientes com SLA, canal e cliente. Os pedidos chegam pelo formulário público e já entram com prazo.',
    columns: [['Novo', G], ['Em atendimento', B], ['Aguardando cliente', Y], ['Resolvido', GR]],
    labels: [['Dúvida', S], ['Problema', R], ['Sugestão', P], ['Financeiro', O]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Canal', t: 'select', o: ['Formulário', 'E-mail', 'Telefone', 'WhatsApp'] }, { n: 'SLA', t: 'select', o: ['4 horas', '1 dia', '3 dias'] }, { n: 'Satisfação', t: 'select', o: ['Ótimo', 'Bom', 'Regular', 'Ruim'] }],
    rules: [{ when: 'created', act: 'due', val: 1, label: 'Chamado novo: prazo de 1 dia' }, { when: 'moved', col: 'Em atendimento', act: 'notify', label: 'Ao entrar em atendimento, avisar o responsável' }],
    form: { title: 'Abrir chamado', intro: 'Descreva o que aconteceu. Você receberá retorno da nossa equipe.', col: 'Novo', due: 1, q: [['Assunto', 'text', true], ['Tipo', 'select', true, ['Dúvida', 'Problema', 'Sugestão', 'Financeiro']], ['Descreva o que aconteceu', 'long', true], ['Seu nome', 'text', true], ['E-mail', 'email', true], ['Empresa', 'text', false]], thanks: 'Chamado aberto! Guarde o número abaixo para acompanhar.' },
    cards: [
      { t: 'Cliente não consegue acessar a conta', col: 0, due: 0, p: 'urgent', l: [1], f: { Cliente: 'Cliente Exemplo', Canal: 'Formulário', SLA: '4 horas' }, ck: [['Atendimento', ['Confirmar e-mail do cliente', 'Redefinir senha', 'Testar acesso junto com o cliente', 'Registrar a causa']]] },
      { t: 'Dúvida sobre o relatório mensal', col: 1, due: 1, l: [0], f: { Cliente: 'Loja Modelo', Canal: 'E-mail', SLA: '1 dia' } },
      { t: 'Sugestão de nova funcionalidade', col: 2, due: 3, l: [2], f: { Cliente: 'Empresa Fictícia', Canal: 'WhatsApp', SLA: '3 dias' } },
    ],
  },
  {
    id: 'posvenda', area: 'Vendas e atendimento', icon: 'handshake', cover: 'cover-green', name: 'Implantação de clientes (pós-venda)',
    desc: 'Do contrato assinado ao cliente usando: kickoff, configuração, treinamento e acompanhamento de 30 dias.',
    columns: [['Contrato assinado', G], ['Kickoff', B], ['Configuração', Y], ['Treinamento', P], ['Acompanhamento', O], ['Cliente ativo', GR]],
    labels: [['Prioritário', R], ['Grande conta', P]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Valor mensal', t: 'money' }, { n: 'Plano', t: 'select', o: ['Básico', 'Profissional', 'Empresarial'] }, { n: 'Data do kickoff', t: 'date' }],
    rules: [{ when: 'moved', col: 'Cliente ativo', act: 'notify', label: 'Cliente ativo: avisar o responsável' }],
    proc: { ref: 'Data do kickoff', refDay: 2, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir do kickoff)', title: 'Cliente' },
    cards: [
      { t: 'Reunião de kickoff', col: 1, st: 0, due: 2, p: 'high', f: { Cliente: 'Cliente Exemplo', 'Valor mensal': 1500, Plano: 'Profissional' }, ck: [['Pauta', ['Objetivos do cliente', 'Responsáveis dos dois lados', 'Cronograma', 'Acessos necessários']]] },
      { t: 'Configurar conta e importar dados', col: 2, st: 3, due: 7, dep: [0], ck: [['Configuração', ['Criar usuários', 'Importar cadastros', 'Ajustar permissões']]] },
      { t: 'Treinamento da equipe do cliente', col: 3, st: 8, due: 10, dep: [1] },
      { t: 'Acompanhamento de 30 dias', col: 4, st: 30, due: 32, dep: [2], ck: [['Checagem', ['Uso pela equipe', 'Dúvidas abertas', 'Satisfação']]] },
    ],
  },
  // ───────────────────────── Marketing
  {
    id: 'marketing', area: 'Marketing', icon: 'megaphone', cover: 'cover-orange', name: 'Calendário editorial',
    desc: 'Posts, artigos e newsletters da ideia à publicação, com canal, data de publicação e revisão antes de publicar.',
    columns: [['Ideias', G], ['Em produção', B], ['Revisão', Y], ['Agendado', P], ['Publicado', GR]],
    labels: [['Instagram', PK], ['LinkedIn', S], ['Blog', O], ['E-mail', GR]],
    fields: [{ n: 'Canal', t: 'select', o: ['Instagram', 'LinkedIn', 'Blog', 'Newsletter', 'YouTube'], card: true }, { n: 'Publicação', t: 'date' }, { n: 'Formato', t: 'select', o: ['Post', 'Carrossel', 'Vídeo', 'Artigo', 'E-mail'] }],
    rules: [{ when: 'moved', col: 'Revisão', act: 'due', val: 1, label: 'Em "Revisão": revisar em até 1 dia' }],
    cards: [
      { t: 'Post: dica da semana', col: 0, l: [0], f: { Canal: 'Instagram', Formato: 'Carrossel' } },
      { t: 'Artigo: como organizar a rotina da equipe', col: 1, st: 0, due: 4, l: [2], f: { Canal: 'Blog', Formato: 'Artigo', Publicação: ymd(6) }, ck: [['Etapas', ['Pauta', 'Rascunho', 'Imagens', 'Revisão de SEO']]] },
      { t: 'Newsletter do mês', col: 2, st: 1, due: 3, p: 'high', l: [3], f: { Canal: 'Newsletter', Formato: 'E-mail', Publicação: ymd(4) } },
      { t: 'Vídeo de bastidores', col: 3, st: 2, due: 7, l: [0], f: { Canal: 'Instagram', Formato: 'Vídeo', Publicação: ymd(8) } },
    ],
  },
  {
    id: 'campanha', area: 'Marketing', icon: 'target', cover: 'cover-orange', name: 'Lançamento de campanha',
    desc: 'Planejamento e execução de uma campanha com etapas que dependem umas das outras — ideal para ver na Linha do tempo.',
    columns: [['Planejamento', G], ['Criação', B], ['Aprovação', Y], ['No ar', P], ['Resultados', GR]],
    labels: [['Pago', O], ['Orgânico', GR], ['Parceiros', P]],
    fields: [{ n: 'Orçamento', t: 'money', card: true }, { n: 'Meta', t: 'text' }, { n: 'Campanha', t: 'text' }, { n: 'Data de lançamento', t: 'date' }],
    proc: { ref: 'Data de lançamento', refDay: 13, lead: 0, q: 'Quantos dias antes da data de lançamento tudo precisa estar pronto?', title: 'Campanha' },
    cards: [
      { t: 'Definir objetivo, público e mensagem', col: 0, st: 0, due: 3, p: 'high', f: { Meta: '300 leads' } },
      { t: 'Criar peças e textos', col: 1, st: 4, due: 10, dep: [0], f: { Orçamento: 2500 }, ck: [['Peças', ['Banner do site', 'Posts', 'E-mail', 'Landing page']]] },
      { t: 'Aprovar com a diretoria', col: 2, st: 11, due: 12, p: 'high', dep: [1] },
      { t: 'Publicar e impulsionar', col: 3, st: 13, due: 27, l: [0], dep: [2], f: { Orçamento: 5000 } },
      { t: 'Relatório de resultados', col: 3, st: 28, due: 30, dep: [3] },
    ],
  },
  // ───────────────────────── Operações
  {
    id: 'manutencao', area: 'Operações', icon: 'wrench', cover: 'cover-navy', name: 'Manutenção e facilities',
    desc: 'Pedidos de manutenção chegam pelo formulário com local e urgência; a equipe acompanha até a conclusão.',
    columns: [['Solicitado', G], ['Agendado', B], ['Em execução', Y], ['Aguardando peça', O], ['Concluído', GR]],
    labels: [['Elétrica', Y], ['Hidráulica', S], ['Ar-condicionado', B], ['Mobiliário', O], ['Urgente', R]],
    fields: [{ n: 'Local', t: 'text', card: true }, { n: 'Tipo', t: 'select', o: ['Elétrica', 'Hidráulica', 'Ar-condicionado', 'Mobiliário', 'Limpeza', 'Outro'] }, { n: 'Custo', t: 'money' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Pedido novo: prazo de 2 dias' }],
    form: { title: 'Pedido de manutenção', intro: 'Informe o problema e o local. A equipe de manutenção vai agendar o atendimento.', col: 'Solicitado', due: 2, q: [['O que precisa de manutenção?', 'text', true], ['Local (andar, sala)', 'text', true], ['Tipo', 'select', true, ['Elétrica', 'Hidráulica', 'Ar-condicionado', 'Mobiliário', 'Limpeza', 'Outro']], ['Detalhes', 'long', false], ['Seu nome', 'text', true]] },
    cards: [
      { t: 'Lâmpada queimada na sala de reunião', col: 0, due: 1, l: [0], f: { Local: '2º andar — Sala 3', Tipo: 'Elétrica' } },
      { t: 'Ar-condicionado pingando', col: 1, due: 2, p: 'high', l: [2], f: { Local: 'Recepção', Tipo: 'Ar-condicionado' } },
      { t: 'Cadeira quebrada', col: 3, due: 5, l: [3], f: { Local: 'Financeiro', Tipo: 'Mobiliário', Custo: 380 } },
    ],
  },
  {
    id: 'eventos', area: 'Operações', icon: 'calendar-days', cover: 'cover-purple', name: 'Organização de evento',
    desc: 'Do orçamento ao pós-evento: local, fornecedores, convidados e comunicação, com prazos encadeados.',
    columns: [['A planejar', G], ['Contratações', B], ['Preparação', Y], ['Dia do evento', P], ['Pós-evento', GR]],
    labels: [['Fornecedor', O], ['Comunicação', PK], ['Logística', S]],
    fields: [{ n: 'Custo', t: 'money', card: true }, { n: 'Fornecedor', t: 'text' }, { n: 'Pago', t: 'checkbox' }, { n: 'Evento', t: 'text' }, { n: 'Data do evento', t: 'date' }],
    proc: { ref: 'Data do evento', refDay: 25, lead: 0, q: 'Quantos dias de folga antes da data do evento? (antecipa todos os prazos)', title: 'Evento' },
    cards: [
      { t: 'Definir data, público e orçamento', col: 0, st: 0, due: 3, p: 'high' },
      { t: 'Reservar local', col: 1, st: 4, due: 8, l: [0], dep: [0], f: { Custo: 6000, Fornecedor: 'Espaço Exemplo' } },
      { t: 'Contratar buffet', col: 1, st: 4, due: 12, l: [0], dep: [0], f: { Custo: 9000 } },
      { t: 'Enviar convites e confirmar presença', col: 2, st: 9, due: 20, l: [1], dep: [1], ck: [['Convites', ['Lista de convidados', 'Envio', 'Lembrete 3 dias antes', 'Lista final']]] },
      { t: 'Checklist do dia', col: 3, st: 25, due: 25, p: 'urgent', l: [2], dep: [2, 3], ck: [['No dia', ['Credenciamento', 'Som e projeção', 'Sinalização', 'Fotos']]] },
      { t: 'Pesquisa de satisfação e fechamento', col: 3, st: 26, due: 30, dep: [4] },
    ],
  },
  // ───────────────────────── Financeiro e compras
  {
    id: 'compras', area: 'Financeiro e compras', icon: 'shopping-cart', cover: 'cover-green', name: 'Compras e requisições',
    desc: 'Pedidos de compra com aprovação: valor, fornecedor e centro de custo. A equipe pede pelo formulário interno.',
    columns: [['Solicitado', G], ['Cotação', B], ['Em aprovação', Y], ['Aprovado', P], ['Comprado', O], ['Recebido', GR]],
    labels: [['Urgente', R], ['Recorrente', S]],
    fields: [{ n: 'Valor', t: 'money', card: true }, { n: 'Fornecedor', t: 'text' }, { n: 'Centro de custo', t: 'select', o: ['Administrativo', 'Comercial', 'Operações', 'TI', 'Marketing'] }, { n: 'Aprovado', t: 'checkbox' }],
    rules: [{ when: 'moved', col: 'Em aprovação', act: 'notify', label: 'Em aprovação: avisar o responsável' }, { when: 'created', act: 'due', val: 3, label: 'Pedido novo: cotar em até 3 dias' }],
    form: { title: 'Pedido de compra', intro: 'Peça o que sua área precisa. O financeiro faz a cotação e envia para aprovação.', col: 'Solicitado', due: 3, q: [['O que precisa ser comprado?', 'text', true], ['Quantidade', 'number', true], ['Área', 'select', true, ['Administrativo', 'Comercial', 'Operações', 'TI', 'Marketing']], ['Para quando?', 'date', false], ['Justificativa', 'long', false], ['Seu nome', 'text', true]] },
    cards: [
      { t: 'Notebooks para o time comercial (3)', col: 2, due: 2, p: 'high', f: { Valor: 13500, Fornecedor: 'Fornecedor Exemplo', 'Centro de custo': 'Comercial' }, ck: [['Cotação', ['Fornecedor 1', 'Fornecedor 2', 'Fornecedor 3']]] },
      { t: 'Material de escritório do mês', col: 4, due: 4, l: [1], f: { Valor: 640, 'Centro de custo': 'Administrativo', Aprovado: true } },
      { t: 'Licença de software de design', col: 1, due: 3, f: { 'Centro de custo': 'Marketing' } },
    ],
  },
  {
    id: 'contas', area: 'Financeiro e compras', icon: 'receipt', cover: 'cover-orange', name: 'Contas a pagar',
    desc: 'Boletos e pagamentos por vencimento, com valor, fornecedor e categoria. Veja tudo no Calendário do mural.',
    columns: [['A pagar', G], ['Agendado', B], ['Pago', GR], ['Atrasado / em negociação', R]],
    labels: [['Fixa', S], ['Variável', O], ['Imposto', P]],
    fields: [{ n: 'Valor', t: 'money', card: true }, { n: 'Fornecedor', t: 'text' }, { n: 'Categoria', t: 'select', o: ['Aluguel', 'Energia', 'Internet', 'Fornecedores', 'Impostos', 'Folha', 'Outros'] }, { n: 'Forma', t: 'select', o: ['Boleto', 'Pix', 'Cartão', 'Débito automático'] }],
    cards: [
      { t: 'Aluguel do escritório', col: 0, due: 5, l: [0], f: { Valor: 4800, Categoria: 'Aluguel', Forma: 'Boleto' } },
      { t: 'Energia elétrica', col: 1, due: 9, l: [1], f: { Valor: 760, Categoria: 'Energia', Forma: 'Débito automático' } },
      { t: 'Internet', col: 0, due: 12, l: [0], f: { Valor: 299, Categoria: 'Internet', Forma: 'Pix' } },
      { t: 'Guia de impostos do mês', col: 0, due: 15, p: 'high', l: [2], f: { Categoria: 'Impostos', Forma: 'Boleto' } },
    ],
  },
  {
    id: 'contratos', area: 'Financeiro e compras', icon: 'file-signature', cover: 'cover-navy', name: 'Contratos e jurídico',
    desc: 'Contratos da elaboração à vigência: revisão, assinatura, valor e data de renovação para não perder prazos.',
    columns: [['Elaboração', G], ['Revisão jurídica', Y], ['Negociação', O], ['Assinatura', P], ['Vigente', GR], ['Encerrado', R]],
    labels: [['Cliente', B], ['Fornecedor', O], ['Parceria', P]],
    fields: [{ n: 'Contraparte', t: 'text', card: true }, { n: 'Valor', t: 'money' }, { n: 'Renovação', t: 'date' }],
    rules: [{ when: 'moved', col: 'Revisão jurídica', act: 'due', val: 5, label: 'Revisão jurídica: prazo de 5 dias' }],
    cards: [
      { t: 'Contrato de prestação de serviços', col: 1, due: 4, l: [0], f: { Contraparte: 'Cliente Exemplo', Valor: 36000, Renovação: ymd(365) }, ck: [['Revisão', ['Objeto', 'Prazo e reajuste', 'Multas', 'LGPD e confidencialidade']]] },
      { t: 'Contrato de fornecedor de limpeza', col: 4, l: [1], f: { Contraparte: 'Fornecedor Modelo', Valor: 2400, Renovação: ymd(60) } },
    ],
  },
  // ───────────────────────── Projetos e tecnologia
  {
    id: 'projeto', area: 'Projetos e tecnologia', icon: 'rocket', cover: 'cover-orange', name: 'Projeto com etapas',
    desc: 'Planejamento, execução e entrega com etapas encadeadas, datas de início e fim e riscos — pronto para a Linha do tempo.',
    columns: [['A fazer', G], ['Em andamento', B], ['Em revisão', Y], ['Concluído', GR]],
    labels: [['Planejamento', P], ['Execução', B], ['Entrega', GR], ['Risco', R]],
    fields: [{ n: 'Fase', t: 'select', o: ['Planejamento', 'Execução', 'Entrega'], card: true }, { n: 'Horas estimadas', t: 'number' }, { n: 'Projeto', t: 'text' }, { n: 'Data de entrega', t: 'date' }],
    rules: [{ when: 'moved', col: 'Em revisão', act: 'notify', label: 'Em revisão: avisar o responsável' }],
    proc: { ref: 'Data de entrega', refDay: 18, lead: 0, q: 'Quantos dias antes da data de entrega tudo precisa estar pronto?', title: 'Projeto' },
    cards: [
      { t: 'Reunião de início (kick-off)', col: 1, st: 0, due: 1, p: 'high', l: [0], f: { Fase: 'Planejamento', 'Horas estimadas': 2 }, ck: [['Pauta', ['Objetivo', 'Escopo', 'Responsáveis', 'Datas']]] },
      { t: 'Levantamento de requisitos', col: 0, st: 2, due: 5, l: [0], dep: [0], f: { Fase: 'Planejamento', 'Horas estimadas': 12 } },
      { t: 'Execução — fase 1', col: 0, st: 6, due: 12, l: [1], dep: [1], f: { Fase: 'Execução', 'Horas estimadas': 40 } },
      { t: 'Revisão com o cliente', col: 0, st: 13, due: 15, l: [1, 3], dep: [2], f: { Fase: 'Execução', 'Horas estimadas': 4 } },
      { t: 'Entrega e encerramento', col: 0, st: 16, due: 18, p: 'high', l: [2], dep: [3], f: { Fase: 'Entrega', 'Horas estimadas': 6 } },
    ],
  },
  {
    id: 'sprint', area: 'Projetos e tecnologia', icon: 'code', cover: 'cover-purple', name: 'Sprint de desenvolvimento',
    desc: 'Backlog, sprint e entrega para times de software: tipo, pontos de estimativa, revisão de código e testes.',
    columns: [['Backlog', G], ['Sprint atual', B], ['Em desenvolvimento', Y], ['Code review', P], ['Teste', O], ['Pronto', GR]],
    labels: [['Bug', R], ['Melhoria', B], ['Nova funcionalidade', GR], ['Débito técnico', G]],
    fields: [{ n: 'Tipo', t: 'select', o: ['Bug', 'Melhoria', 'Funcionalidade'], card: true }, { n: 'Pontos', t: 'number', card: true }, { n: 'Versão', t: 'text' }],
    rules: [{ when: 'moved', col: 'Code review', act: 'notify', label: 'Em code review: avisar o responsável' }, { when: 'moved', col: 'Em desenvolvimento', act: 'due', val: 3, label: 'Em desenvolvimento: prazo de 3 dias' }],
    cards: [
      { t: 'Login com erro no Safari', col: 2, st: 0, due: 2, p: 'urgent', l: [0], f: { Tipo: 'Bug', Pontos: 3, Versão: '2.4' } },
      { t: 'Exportar relatório em Excel', col: 1, st: 1, due: 6, l: [2], f: { Tipo: 'Funcionalidade', Pontos: 5, Versão: '2.4' }, ck: [['Critérios de aceite', ['Botão no relatório', 'Mesmas colunas da tela', 'Testado com 1.000 linhas']]] },
      { t: 'Atualizar bibliotecas', col: 0, l: [3], f: { Tipo: 'Melhoria', Pontos: 2 } },
      { t: 'Tela de configurações mais rápida', col: 3, st: 0, due: 3, l: [1], f: { Tipo: 'Melhoria', Pontos: 3, Versão: '2.4' } },
    ],
  },
  {
    id: 'okrs', area: 'Projetos e tecnologia', icon: 'flag', cover: 'cover-navy', name: 'Metas e OKRs do trimestre',
    desc: 'Objetivos e resultados-chave com dono, meta e progresso. Cada iniciativa depende do seu resultado-chave.',
    columns: [['Objetivos', G], ['Em andamento', B], ['Em risco', R], ['Atingido', GR]],
    labels: [['Objetivo', P], ['Resultado-chave', B], ['Iniciativa', O]],
    fields: [{ n: 'Meta', t: 'number' }, { n: 'Atual', t: 'number', card: true }, { n: 'Confiança', t: 'select', o: ['Alta', 'Média', 'Baixa'] }],
    cards: [
      { t: 'Objetivo: encantar nossos clientes', col: 0, st: 0, due: 90, l: [0] },
      { t: 'RC: NPS acima de 70', col: 1, st: 0, due: 90, l: [1], f: { Meta: 70, Atual: 58, Confiança: 'Média' } },
      { t: 'Iniciativa: pesquisa trimestral de satisfação', col: 1, st: 5, due: 20, l: [2] },
      { t: 'RC: tempo de resposta menor que 4 horas', col: 2, st: 0, due: 90, p: 'high', l: [1], f: { Meta: 4, Atual: 7, Confiança: 'Baixa' } },
    ],
  },
  // ───────────────────────── Recursos Humanos (mais)
  {
    id: 'treinamento', area: 'Recursos Humanos', icon: 'graduation-cap', cover: 'cover-purple', name: 'Treinamento e desenvolvimento',
    desc: 'Plano de capacitação da equipe: cada treinamento com público, carga horária, instrutor, inscritos e avaliação de reação.',
    columns: [['Necessidades', G], ['Planejado', B], ['Inscrições abertas', Y], ['Em andamento', O], ['Concluído', GR]],
    labels: [['Obrigatório', R], ['Liderança', P], ['Técnico', S], ['Comportamental', PK]],
    fields: [{ n: 'Público', t: 'text', card: true }, { n: 'Carga horária', t: 'number' }, { n: 'Formato', t: 'select', o: ['Presencial', 'Online ao vivo', 'Gravado'] }, { n: 'Custo', t: 'money' }, { n: 'Nota de reação', t: 'number' }],
    rules: [{ when: 'moved', col: 'Inscrições abertas', act: 'notify', label: 'Inscrições abertas: avisar o responsável' }],
    cards: [
      { t: 'Levantar necessidades com os gestores', col: 0, st: 0, due: 7, p: 'high', ck: [['Levantamento', ['Enviar pesquisa aos gestores', 'Cruzar com as avaliações de desempenho', 'Priorizar os temas do semestre']]] },
      { t: 'Integração de segurança do trabalho', col: 1, st: 10, due: 12, l: [0, 2], f: { Público: 'Novos colaboradores', 'Carga horária': 4, Formato: 'Presencial' }, dep: [0] },
      { t: 'Liderança para novos gestores', col: 2, st: 15, due: 30, l: [1, 3], f: { Público: 'Gestores', 'Carga horária': 16, Formato: 'Online ao vivo', Custo: 4800 }, ck: [['Organização', ['Contratar instrutor', 'Reservar sala/link', 'Enviar convites', 'Lista de presença', 'Pesquisa de reação']]] },
      { t: 'Excel intermediário', col: 3, st: 2, due: 9, l: [2], f: { Público: 'Administrativo', 'Carga horária': 8, Formato: 'Gravado' } },
    ],
  },
  {
    id: 'ferias', area: 'Recursos Humanos', icon: 'palmtree', cover: 'cover-green', name: 'Férias e ausências da equipe',
    desc: 'Pedidos de férias, folgas e licenças com período, aprovação do gestor e quem cobre as atividades durante a ausência.',
    columns: [['Solicitado', G], ['Aprovado pelo gestor', B], ['Programado no RH', Y], ['Em gozo', O], ['Retornou', GR]],
    labels: [['Férias', S], ['Folga', P], ['Licença', PK], ['Atestado', R]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Início', t: 'date' }, { n: 'Fim', t: 'date' }, { n: 'Dias', t: 'number' }, { n: 'Substituto', t: 'text' }],
    rules: [{ when: 'created', act: 'due', val: 3, label: 'Novo pedido: o gestor responde em até 3 dias' }, { when: 'moved', col: 'Aprovado pelo gestor', act: 'notify', label: 'Pedido aprovado: avisar o responsável' }],
    form: { title: 'Pedido de férias ou folga', intro: 'Preencha o período. Seu gestor vai aprovar e o RH programa.', col: 'Solicitado', due: 3, q: [['Seu nome', 'text', true], ['Tipo', 'select', true, ['Férias', 'Folga', 'Licença']], ['Primeiro dia', 'date', true], ['Último dia', 'date', true], ['Quem cobre suas atividades?', 'text', false], ['Observações', 'long', false]] },
    cards: [
      { t: 'Férias — Pessoa A', col: 1, due: 2, l: [0], f: { Colaborador: 'Pessoa A', Início: ymd(30), Fim: ymd(44), Dias: 15, Substituto: 'Pessoa B' }, ck: [['Antes de sair', ['Passar atividades ao substituto', 'Resposta automática no e-mail', 'Avisar clientes/fornecedores']]] },
      { t: 'Folga — Pessoa C', col: 0, due: 3, l: [1], f: { Colaborador: 'Pessoa C', Início: ymd(10), Fim: ymd(10), Dias: 1 } },
    ],
  },
  {
    id: 'desempenho', area: 'Recursos Humanos', icon: 'star', cover: 'cover-navy', name: 'Ciclo de avaliação de desempenho',
    desc: 'Do calendário à devolutiva: autoavaliação, avaliação do gestor, calibração, feedback e plano de desenvolvimento.',
    columns: [['Preparação', G], ['Autoavaliação', B], ['Avaliação do gestor', Y], ['Calibração', P], ['Devolutivas', O], ['Concluído', GR]],
    labels: [['RH', PK], ['Gestores', O], ['Todos', S]],
    fields: [{ n: 'Ciclo', t: 'text', card: true }, { n: 'Data de fechamento', t: 'date' }, { n: 'Participantes', t: 'number' }],
    proc: { ref: 'Data de fechamento', refDay: 45, lead: 0, q: 'Quantos dias antes da data de fechamento o ciclo deve terminar?', title: 'Ciclo' },
    cards: [
      { t: 'Definir critérios e calendário do ciclo', col: 0, st: 0, due: 5, p: 'high', l: [0], f: { Ciclo: '1º semestre', 'Data de fechamento': ymd(45), Participantes: 40 } },
      { t: 'Comunicar o ciclo a toda a empresa', col: 0, st: 5, due: 7, l: [0, 2], dep: [0] },
      { t: 'Autoavaliação dos colaboradores', col: 1, st: 8, due: 15, l: [2], dep: [1] },
      { t: 'Avaliação dos gestores', col: 2, st: 15, due: 25, p: 'high', l: [1], dep: [2] },
      { t: 'Reunião de calibração', col: 3, st: 26, due: 30, l: [0, 1], dep: [3], ck: [['Calibração', ['Consolidar notas', 'Comparar entre equipes', 'Ajustar distorções', 'Registrar decisões']]] },
      { t: 'Devolutivas individuais e PDI', col: 4, st: 31, due: 45, p: 'high', l: [1], dep: [4], ck: [['Devolutiva', ['Agendar conversa', 'Pontos fortes', 'Pontos a desenvolver', 'Plano de desenvolvimento (PDI)']]] },
    ],
  },
  // ───────────────────────── Vendas e atendimento (mais)
  {
    id: 'prospeccao', area: 'Vendas e atendimento', icon: 'phone-call', cover: 'cover-green', name: 'Prospecção ativa',
    desc: 'Cadência de contatos com empresas-alvo: pesquisa, primeiro contato, follow-ups e reunião marcada para o time de vendas.',
    columns: [['Lista de alvos', G], ['Pesquisado', B], ['1º contato', Y], ['Follow-up', O], ['Reunião marcada', GR], ['Sem interesse', R]],
    labels: [['Perfil ideal', GR], ['Decisor', P], ['Retornar depois', S]],
    fields: [{ n: 'Empresa', t: 'text', card: true }, { n: 'Segmento', t: 'select', o: ['Indústria', 'Comércio', 'Serviços', 'Saúde', 'Educação'] }, { n: 'Contato', t: 'text' }, { n: 'Tentativas', t: 'number' }],
    rules: [{ when: 'moved', col: '1º contato', act: 'due', val: 3, label: 'Após o 1º contato: follow-up em 3 dias' }, { when: 'moved', col: 'Reunião marcada', act: 'notify', label: 'Reunião marcada: avisar o responsável' }],
    cards: [
      { t: 'Empresa Alfa', col: 1, due: 1, l: [0], f: { Empresa: 'Empresa Alfa', Segmento: 'Indústria', Tentativas: 0 }, ck: [['Pesquisa', ['Site e LinkedIn', 'Quem decide', 'Dor provável']]] },
      { t: 'Empresa Beta', col: 3, due: 2, l: [1], f: { Empresa: 'Empresa Beta', Segmento: 'Serviços', Contato: 'Diretor comercial', Tentativas: 2 } },
      { t: 'Empresa Gama', col: 0, l: [0], f: { Empresa: 'Empresa Gama', Segmento: 'Saúde' } },
    ],
  },
  {
    id: 'sucesso', area: 'Vendas e atendimento', icon: 'heart-handshake', cover: 'cover-navy', name: 'Sucesso do cliente e renovações',
    desc: 'Carteira de clientes com saúde, reuniões periódicas e renovação: avisa com antecedência e evita cancelamentos.',
    columns: [['Saudável', GR], ['Atenção', Y], ['Em risco', R], ['Renovação em andamento', B], ['Renovado', P]],
    labels: [['Expansão', GR], ['Reclamação', R], ['Grande conta', P]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Valor mensal', t: 'money' }, { n: 'Data de renovação', t: 'date' }, { n: 'Saúde', t: 'select', o: ['Ótima', 'Boa', 'Regular', 'Ruim'] }],
    rules: [{ when: 'moved', col: 'Em risco', act: 'priority', val: 'urgent', label: 'Cliente em risco: prioridade Urgente' }, { when: 'moved', col: 'Em risco', act: 'notify', label: 'Cliente em risco: avisar o responsável' }],
    proc: { ref: 'Data de renovação', refDay: 60, lead: 30, q: 'Quantos dias antes da renovação o contrato deve estar renovado?', title: 'Cliente' },
    cards: [
      { t: 'Reunião trimestral de resultados', col: 0, st: 0, due: 7, l: [2], f: { Cliente: 'Cliente Exemplo', 'Valor mensal': 2500, 'Data de renovação': ymd(60), Saúde: 'Boa' }, ck: [['Pauta', ['Resultados do período', 'Uso da solução', 'Próximos objetivos']]] },
      { t: 'Pesquisa de satisfação (NPS)', col: 0, st: 10, due: 15 },
      { t: 'Proposta de renovação', col: 3, st: 20, due: 30, p: 'high', dep: [0, 1], ck: [['Renovação', ['Revisar valores', 'Enviar proposta', 'Negociar', 'Assinar aditivo']]] },
    ],
  },
  // ───────────────────────── Marketing (mais)
  {
    id: 'redes', area: 'Marketing', icon: 'share-2', cover: 'cover-orange', name: 'Redes sociais da semana',
    desc: 'Grade semanal de posts por rede, com legenda, arte, aprovação e métricas depois de publicado.',
    columns: [['Ideias', G], ['Roteiro e legenda', B], ['Arte', P], ['Aprovação', Y], ['Agendado', O], ['Publicado', GR]],
    labels: [['Instagram', PK], ['LinkedIn', B], ['TikTok', G], ['Facebook', S]],
    fields: [{ n: 'Data de publicação', t: 'date', card: true }, { n: 'Formato', t: 'select', o: ['Carrossel', 'Reels/vídeo', 'Imagem', 'Stories', 'Texto'] }, { n: 'Alcance', t: 'number' }, { n: 'Engajamento (%)', t: 'number' }],
    rules: [{ when: 'moved', col: 'Aprovação', act: 'notify', label: 'Post em aprovação: avisar o responsável' }],
    cards: [
      { t: 'Carrossel: 5 dicas do nosso produto', col: 1, st: 0, due: 2, l: [0, 1], f: { 'Data de publicação': ymd(3), Formato: 'Carrossel' }, ck: [['Produção', ['Roteiro', 'Legenda', 'Arte', 'Hashtags', 'Aprovação']]] },
      { t: 'Bastidores da equipe', col: 0, l: [0, 2], f: { Formato: 'Reels/vídeo' } },
      { t: 'Depoimento de cliente', col: 3, st: 1, due: 2, l: [1], f: { 'Data de publicação': ymd(4), Formato: 'Imagem' } },
    ],
  },
  {
    id: 'design', area: 'Marketing', icon: 'palette', cover: 'cover-purple', name: 'Pedidos de design e criação',
    desc: 'As áreas pedem artes pelo formulário; o time de criação organiza a fila, faz as versões e entrega os arquivos finais.',
    columns: [['Pedidos', G], ['Briefing ok', B], ['Criando', P], ['Revisão do solicitante', Y], ['Entregue', GR]],
    labels: [['Urgente', R], ['Redes sociais', PK], ['Impresso', O], ['Apresentação', S]],
    fields: [{ n: 'Solicitante', t: 'text', card: true }, { n: 'Formato', t: 'select', o: ['Post', 'Banner', 'Apresentação', 'Folder', 'Vídeo'] }, { n: 'Versões', t: 'number' }],
    rules: [{ when: 'created', act: 'due', val: 5, label: 'Novo pedido: entrega em até 5 dias' }, { when: 'moved', col: 'Revisão do solicitante', act: 'notify', label: 'Arte em revisão: avisar o responsável' }],
    form: { title: 'Pedir uma arte', intro: 'Conte o que você precisa. O time de criação entra em contato se faltar alguma informação.', col: 'Pedidos', due: 5, q: [['O que você precisa?', 'text', true], ['Formato', 'select', true, ['Post', 'Banner', 'Apresentação', 'Folder', 'Vídeo']], ['Seu nome e área', 'text', true], ['Para quando?', 'date', true], ['Textos, referências e detalhes', 'long', true]] },
    cards: [
      { t: 'Banner da campanha de fim de ano', col: 2, st: 0, due: 3, p: 'high', l: [2], f: { Solicitante: 'Comercial', Formato: 'Banner', Versões: 1 }, ck: [['Criação', ['Rascunho', 'Versão 1', 'Ajustes', 'Arquivo final (PDF/PNG)']]] },
      { t: 'Apresentação institucional', col: 1, due: 6, l: [3], f: { Solicitante: 'Diretoria', Formato: 'Apresentação' } },
    ],
  },
  // ───────────────────────── Operações (mais)
  {
    id: 'estoque', area: 'Operações', icon: 'package', cover: 'cover-green', name: 'Estoque e reposição',
    desc: 'Itens abaixo do mínimo viram cards: cotação, pedido, recebimento e conferência até voltar para a prateleira.',
    columns: [['Abaixo do mínimo', R], ['Cotando', Y], ['Pedido feito', B], ['Recebido', P], ['Conferido e guardado', GR]],
    labels: [['Crítico', R], ['Material de escritório', S], ['Produção', O], ['Limpeza', GR]],
    fields: [{ n: 'Item', t: 'text', card: true }, { n: 'Quantidade', t: 'number' }, { n: 'Fornecedor', t: 'text' }, { n: 'Valor total', t: 'money' }],
    rules: [{ when: 'created', act: 'priority', val: 'high', label: 'Item novo abaixo do mínimo: prioridade Alta' }, { when: 'moved', col: 'Recebido', act: 'due', val: 1, label: 'Recebido: conferir em 1 dia' }],
    cards: [
      { t: 'Papel A4 (caixas)', col: 0, due: 2, l: [1], f: { Item: 'Papel A4', Quantidade: 10 } },
      { t: 'Embalagens de envio', col: 2, due: 5, p: 'high', l: [0, 2], f: { Item: 'Caixas de papelão', Quantidade: 500, Fornecedor: 'Fornecedor Exemplo', 'Valor total': 1350 }, ck: [['Recebimento', ['Conferir quantidade', 'Conferir nota fiscal', 'Guardar no estoque', 'Atualizar planilha/sistema']]] },
    ],
  },
  {
    id: 'entregas', area: 'Operações', icon: 'truck', cover: 'cover-navy', name: 'Entregas e logística',
    desc: 'Cada pedido do separado ao entregue, com rota, transportadora e rastreio; ocorrências em destaque.',
    columns: [['A separar', G], ['Separado', B], ['Em rota', O], ['Entregue', GR], ['Ocorrência', R]],
    labels: [['Expresso', R], ['Retirada', S], ['Frágil', Y]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Cidade', t: 'text' }, { n: 'Transportadora', t: 'select', o: ['Própria', 'Correios', 'Transportadora', 'Motoboy'] }, { n: 'Rastreio', t: 'text' }],
    rules: [{ when: 'moved', col: 'Ocorrência', act: 'priority', val: 'urgent', label: 'Ocorrência: prioridade Urgente' }, { when: 'moved', col: 'Ocorrência', act: 'notify', label: 'Ocorrência: avisar o responsável' }],
    cards: [
      { t: 'Pedido 1001', col: 1, due: 1, l: [2], f: { Cliente: 'Cliente Exemplo', Cidade: 'São Paulo', Transportadora: 'Própria' }, ck: [['Expedição', ['Separar itens', 'Embalar', 'Emitir nota', 'Etiquetar']]] },
      { t: 'Pedido 1002', col: 2, due: 2, l: [0], f: { Cliente: 'Loja Modelo', Cidade: 'Campinas', Transportadora: 'Transportadora', Rastreio: 'BR123456' } },
    ],
  },
  {
    id: 'qualidade', area: 'Operações', icon: 'clipboard-check', cover: 'cover-purple', name: 'Auditoria e qualidade',
    desc: 'Preparação da auditoria, não conformidades encontradas e ações corretivas com responsável e prazo.',
    columns: [['Preparação', G], ['Auditoria', B], ['Não conformidades', R], ['Ação corretiva', O], ['Verificado', GR]],
    labels: [['Maior', R], ['Menor', Y], ['Observação', S]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Data da auditoria', t: 'date' }, { n: 'Requisito', t: 'text' }],
    proc: { ref: 'Data da auditoria', refDay: 20, lead: 0, q: 'Quantos dias antes da auditoria tudo precisa estar pronto?', title: 'Área' },
    cards: [
      { t: 'Revisar procedimentos e registros', col: 0, st: 0, due: 10, p: 'high', f: { Área: 'Produção', 'Data da auditoria': ymd(20) }, ck: [['Documentos', ['Procedimentos atualizados', 'Registros de treinamento', 'Indicadores do período', 'Ações da auditoria anterior']]] },
      { t: 'Auditoria interna', col: 1, st: 20, due: 21, p: 'high', dep: [0] },
      { t: 'Tratar não conformidades', col: 3, st: 22, due: 35, l: [0], dep: [1], ck: [['Ação corretiva', ['Causa raiz', 'Plano de ação', 'Implantar', 'Verificar eficácia']]] },
    ],
  },
  // ───────────────────────── Financeiro e compras (mais)
  {
    id: 'fechamento', area: 'Financeiro e compras', icon: 'calculator', cover: 'cover-navy', name: 'Fechamento mensal',
    desc: 'Rotina do fechamento do mês: conciliações, provisões, impostos, relatórios e envio para a contabilidade.',
    columns: [['A fazer', G], ['Em conciliação', B], ['Revisão', Y], ['Enviado à contabilidade', GR]],
    labels: [['Bancos', S], ['Impostos', R], ['Folha', PK], ['Relatórios', P]],
    fields: [{ n: 'Mês', t: 'text', card: true }, { n: 'Dia do fechamento', t: 'date' }],
    proc: { ref: 'Dia do fechamento', refDay: 10, lead: 0, q: 'Quantos dias antes do dia do fechamento tudo deve estar pronto?', title: 'Mês' },
    cards: [
      { t: 'Conciliar contas bancárias', col: 1, st: 0, due: 3, p: 'high', l: [0], f: { Mês: 'Mês de referência', 'Dia do fechamento': ymd(10) } },
      { t: 'Lançar notas de entrada e saída', col: 0, st: 0, due: 4 },
      { t: 'Apurar impostos do mês', col: 0, st: 4, due: 7, p: 'high', l: [1], dep: [1] },
      { t: 'Conferir folha de pagamento', col: 0, st: 2, due: 5, l: [2] },
      { t: 'DRE e relatório gerencial', col: 2, st: 7, due: 9, l: [3], dep: [0, 2, 3] },
      { t: 'Enviar documentos à contabilidade', col: 2, st: 9, due: 10, p: 'high', dep: [4] },
    ],
  },
  {
    id: 'reembolso', area: 'Financeiro e compras', icon: 'wallet', cover: 'cover-green', name: 'Reembolso de despesas',
    desc: 'Colaboradores pedem reembolso pelo formulário com valor e comprovante; gestor aprova e o financeiro paga.',
    columns: [['Solicitado', G], ['Aprovado pelo gestor', B], ['Conferido', Y], ['Pago', GR], ['Recusado', R]],
    labels: [['Viagem', S], ['Alimentação', O], ['Transporte', P], ['Outros', G]],
    fields: [{ n: 'Valor', t: 'money', card: true }, { n: 'Colaborador', t: 'text' }, { n: 'Data da despesa', t: 'date' }, { n: 'Centro de custo', t: 'text' }],
    rules: [{ when: 'created', act: 'due', val: 5, label: 'Pedido novo: decidir em até 5 dias' }, { when: 'moved', col: 'Pago', act: 'notify', label: 'Reembolso pago: avisar o responsável' }],
    form: { title: 'Pedir reembolso', intro: 'Informe a despesa e o link do comprovante. O pagamento sai depois da aprovação do seu gestor.', col: 'Solicitado', due: 5, q: [['Descrição da despesa', 'text', true], ['Valor (R$)', 'number', true], ['Categoria', 'select', true, ['Viagem', 'Alimentação', 'Transporte', 'Outros']], ['Data da despesa', 'date', true], ['Seu nome', 'text', true], ['Link do comprovante (foto/PDF)', 'text', true]] },
    cards: [
      { t: 'Táxi para visita ao cliente', col: 1, due: 3, l: [2], f: { Valor: 86.5, Colaborador: 'Pessoa A', 'Data da despesa': ymd(-2) } },
      { t: 'Hotel — viagem a Curitiba', col: 2, due: 2, l: [0], f: { Valor: 640, Colaborador: 'Pessoa B', 'Data da despesa': ymd(-6) }, ck: [['Conferência', ['Comprovante legível', 'Dentro da política', 'Centro de custo correto']]] },
    ],
  },
  // ───────────────────────── Projetos e tecnologia (mais)
  {
    id: 'bugs', area: 'Projetos e tecnologia', icon: 'bug', cover: 'cover-purple', name: 'Bugs e incidentes',
    desc: 'Problemas reportados pelo formulário entram com gravidade; o time investiga, corrige, testa e publica.',
    columns: [['Reportado', G], ['Investigando', B], ['Corrigindo', O], ['Em teste', Y], ['Resolvido', GR], ['Não é bug', R]],
    labels: [['Crítico', R], ['Alto', O], ['Médio', Y], ['Baixo', S]],
    fields: [{ n: 'Gravidade', t: 'select', o: ['Crítica', 'Alta', 'Média', 'Baixa'], card: true }, { n: 'Sistema', t: 'text' }, { n: 'Usuários afetados', t: 'number' }, { n: 'Versão', t: 'text' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Bug novo: primeira análise em 2 dias' }, { when: 'moved', col: 'Investigando', act: 'notify', label: 'Em investigação: avisar o responsável' }],
    form: { title: 'Reportar um problema', intro: 'Descreva o que aconteceu e como repetir. Isso ajuda a corrigir mais rápido.', col: 'Reportado', due: 2, prio: 'high', q: [['Resumo do problema', 'text', true], ['Onde aconteceu (sistema/tela)', 'text', true], ['O que você fez e o que aconteceu', 'long', true], ['Quantas pessoas são afetadas?', 'select', false, ['Só eu', 'Algumas', 'Todos']], ['Seu e-mail', 'email', true]] },
    cards: [
      { t: 'Erro ao exportar relatório em PDF', col: 1, due: 1, p: 'high', l: [1], f: { Gravidade: 'Alta', Sistema: 'Portal', 'Usuários afetados': 30 }, ck: [['Correção', ['Reproduzir', 'Encontrar a causa', 'Corrigir', 'Teste', 'Publicar']]] },
      { t: 'Botão desalinhado no celular', col: 0, due: 4, l: [3], f: { Gravidade: 'Baixa', Sistema: 'App' } },
    ],
  },
  {
    id: 'implantacao', area: 'Projetos e tecnologia', icon: 'server', cover: 'cover-navy', name: 'Implantação de sistema',
    desc: 'Troca ou implantação de um sistema: levantamento, configuração, migração de dados, treinamento e entrada no ar.',
    columns: [['Levantamento', G], ['Configuração', B], ['Migração de dados', P], ['Treinamento', Y], ['Entrada no ar', O], ['Concluído', GR]],
    labels: [['Fornecedor', S], ['TI', B], ['Usuários', PK], ['Risco', R]],
    fields: [{ n: 'Sistema', t: 'text', card: true }, { n: 'Data de entrada no ar', t: 'date' }, { n: 'Fornecedor', t: 'text' }],
    proc: { ref: 'Data de entrada no ar', refDay: 40, lead: 0, q: 'Quantos dias antes da entrada no ar tudo deve estar pronto?', title: 'Sistema' },
    cards: [
      { t: 'Levantar processos e requisitos', col: 0, st: 0, due: 7, p: 'high', l: [1, 2], f: { Sistema: 'Novo sistema', 'Data de entrada no ar': ymd(40), Fornecedor: 'Fornecedor Exemplo' } },
      { t: 'Configurar o sistema', col: 1, st: 8, due: 20, l: [0, 1], dep: [0] },
      { t: 'Migrar e validar os dados', col: 2, st: 18, due: 28, p: 'high', l: [1, 3], dep: [1], ck: [['Migração', ['Exportar do sistema antigo', 'Limpar dados', 'Importar', 'Conferir amostras']]] },
      { t: 'Treinar os usuários', col: 3, st: 28, due: 35, l: [2], dep: [1] },
      { t: 'Entrada no ar e acompanhamento', col: 4, st: 40, due: 47, p: 'urgent', l: [1, 2], dep: [2, 3], ck: [['Go-live', ['Plano de volta (rollback)', 'Comunicar a empresa', 'Plantão de suporte na 1ª semana']]] },
    ],
  },
  // ───────────────────────── Gestão e administração
  {
    id: 'reunioes', area: 'Gestão e administração', icon: 'users', cover: 'cover-navy', name: 'Reuniões e decisões da diretoria',
    desc: 'Pautas, decisões tomadas e encaminhamentos com responsável e prazo, para nada se perder entre uma reunião e outra.',
    columns: [['Pauta da próxima reunião', G], ['Em discussão', B], ['Decidido', P], ['Encaminhamentos', O], ['Concluído', GR]],
    labels: [['Estratégico', P], ['Financeiro', Y], ['Pessoas', PK], ['Operacional', S]],
    fields: [{ n: 'Reunião', t: 'date', card: true }, { n: 'Decisão', t: 'text' }],
    rules: [{ when: 'moved', col: 'Encaminhamentos', act: 'due', val: 7, label: 'Encaminhamento: prazo de 7 dias' }],
    cards: [
      { t: 'Orçamento do próximo trimestre', col: 0, l: [1], f: { Reunião: ymd(7) } },
      { t: 'Abertura de nova vaga comercial', col: 2, l: [2], f: { Decisão: 'Aprovada, início no próximo mês' } },
      { t: 'Revisar contrato de aluguel', col: 3, due: 7, l: [3] },
    ],
  },
  {
    id: 'planejamento', area: 'Gestão e administração', icon: 'compass', cover: 'cover-purple', name: 'Planejamento estratégico anual',
    desc: 'Diagnóstico, objetivos do ano, plano de ação por área e acompanhamento trimestral.',
    columns: [['Diagnóstico', G], ['Objetivos', B], ['Plano de ação', P], ['Em execução', O], ['Revisão trimestral', Y], ['Concluído', GR]],
    labels: [['Comercial', GR], ['Operações', S], ['Pessoas', PK], ['Finanças', Y]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Indicador', t: 'text' }, { n: 'Meta', t: 'number' }],
    cards: [
      { t: 'Análise SWOT', col: 0, st: 0, due: 10, p: 'high', ck: [['SWOT', ['Forças', 'Fraquezas', 'Oportunidades', 'Ameaças']]] },
      { t: 'Definir objetivos do ano', col: 1, st: 10, due: 20, p: 'high', dep: [0] },
      { t: 'Plano de ação — Comercial', col: 2, st: 20, due: 30, l: [0], f: { Área: 'Comercial', Indicador: 'Faturamento', Meta: 20 }, dep: [1] },
      { t: 'Plano de ação — Pessoas', col: 2, st: 20, due: 30, l: [2], f: { Área: 'Pessoas', Indicador: 'Turnover', Meta: 10 }, dep: [1] },
      { t: 'Revisão do 1º trimestre', col: 4, st: 90, due: 95, dep: [2, 3] },
    ],
  },
  {
    id: 'fornecedores', area: 'Gestão e administração', icon: 'building', cover: 'cover-green', name: 'Gestão de fornecedores',
    desc: 'Cadastro, homologação e avaliação periódica dos fornecedores, com documentos e vencimentos de contrato.',
    columns: [['Novos', G], ['Documentação', B], ['Homologado', GR], ['Em avaliação', Y], ['Bloqueado', R]],
    labels: [['Crítico', R], ['Serviços', S], ['Materiais', O]],
    fields: [{ n: 'Fornecedor', t: 'text', card: true }, { n: 'CNPJ', t: 'text' }, { n: 'Vencimento do contrato', t: 'date' }, { n: 'Nota', t: 'number' }],
    rules: [{ when: 'moved', col: 'Bloqueado', act: 'notify', label: 'Fornecedor bloqueado: avisar o responsável' }],
    cards: [
      { t: 'Fornecedor de limpeza', col: 1, due: 5, l: [1], f: { Fornecedor: 'Limpeza Exemplo' }, ck: [['Documentos', ['Contrato social', 'Certidões negativas', 'Comprovante bancário', 'Contrato assinado']]] },
      { t: 'Gráfica', col: 3, due: 10, l: [2], f: { Fornecedor: 'Gráfica Modelo', 'Vencimento do contrato': ymd(60), Nota: 8 } },
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
    id: 'dp-rescisao', area: 'Departamento Pessoal', icon: 'door-open', cover: 'cover-purple', name: 'Rescisão de contrato (DP)',
    desc: 'Cálculo, exame demissional, pagamento em até 10 dias do fim do contrato, eSocial, FGTS e seguro-desemprego, sem perder prazo.',
    columns: [['Comunicado', G], ['Cálculo', B], ['Documentos e exame', P], ['Pagamento', O], ['Encerrado', GR], ['Pendência', R]],
    labels: [['Sem justa causa', B], ['Pedido de demissão', S], ['Justa causa', R], ['Acordo', Y]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Último dia', t: 'date' }, { n: 'Tipo de desligamento', t: 'select', o: ['Sem justa causa', 'Pedido de demissão', 'Justa causa', 'Acordo (484-A)', 'Término de experiência'] }, { n: 'Aviso prévio', t: 'select', o: ['Trabalhado', 'Indenizado', 'Dispensado'] }],
    proc: { ref: 'Último dia', refDay: 5, lead: 0, q: 'Antecipar os prazos em quantos dias? (0 = contar a partir do último dia)', title: 'Colaborador' },
    rules: [{ when: 'moved', col: 'Pendência', act: 'priority', val: 'urgent', label: 'Pendência na rescisão: prioridade Urgente' }],
    cards: [
      { t: 'Registrar o desligamento e o aviso prévio', col: 0, st: 0, due: 1, p: 'high', f: { Colaborador: 'Nome do colaborador', 'Último dia': ymd(5), 'Tipo de desligamento': 'Sem justa causa', 'Aviso prévio': 'Indenizado' } },
      { t: 'Calcular as verbas rescisórias', col: 1, st: 3, due: 7, p: 'high', dep: [0], ck: [['Verbas', ['Saldo de salário', 'Aviso prévio', 'Férias vencidas e proporcionais + 1/3', '13º proporcional', 'Multa do FGTS (quando houver)', 'Descontos']]] },
      { t: 'Exame demissional (ASO)', col: 2, st: 3, due: 10, d: 'Até 10 dias após o término do contrato (dispensado se o último exame for recente, conforme a NR-7).' },
      { t: 'Pagar a rescisão', col: 3, st: 7, due: 15, p: 'urgent', dep: [1], d: 'Prazo legal: até 10 dias corridos após o término do contrato (CLT art. 477).' },
      { t: 'Enviar ao eSocial (S-2299) e liberar FGTS e seguro-desemprego', col: 3, st: 8, due: 15, p: 'high', dep: [1], ck: [['Encerramento', ['Evento S-2299', 'Guia do FGTS rescisório', 'Comunicação para seguro-desemprego', 'Baixa na carteira digital', 'Termo de quitação assinado']]] },
    ],
  },
  {
    id: 'dp-ferias', area: 'Departamento Pessoal', icon: 'sun', cover: 'cover-orange', name: 'Processamento de férias',
    desc: 'Aviso com 30 dias de antecedência, cálculo, pagamento até 2 dias antes do início e controle de férias vencendo.',
    columns: [['Programadas', G], ['Aviso entregue', B], ['Calculado', Y], ['Pago', O], ['Em férias', P], ['Retornou', GR]],
    labels: [['Vencendo', R], ['Abono pecuniário', S], ['Parcelada', PK]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Início das férias', t: 'date' }, { n: 'Dias', t: 'number' }, { n: 'Período aquisitivo', t: 'text' }],
    proc: { ref: 'Início das férias', refDay: 32, lead: 0, q: 'Antecipar todos os prazos em quantos dias?', title: 'Colaborador' },
    cards: [
      { t: 'Entregar o aviso de férias', col: 0, st: 0, due: 2, p: 'high', f: { Colaborador: 'Nome do colaborador', 'Início das férias': ymd(32), Dias: 30 }, d: 'O aviso deve ser dado com pelo menos 30 dias de antecedência.' },
      { t: 'Calcular as férias', col: 1, st: 20, due: 26, dep: [0], ck: [['Cálculo', ['Média de variáveis', '1/3 constitucional', 'Abono (se pedido)', 'Adiantamento do 13º (se pedido)']]] },
      { t: 'Pagar as férias', col: 2, st: 27, due: 30, p: 'urgent', dep: [1], d: 'Pagamento até 2 dias antes do início das férias.' },
      { t: 'Conferir o retorno e o ponto', col: 4, st: 62, due: 63, dep: [2] },
    ],
  },
  {
    id: 'dp-afastamentos', area: 'Departamento Pessoal', icon: 'stethoscope', cover: 'cover-navy', name: 'Atestados e afastamentos (INSS)',
    desc: 'Atestados recebidos, lançamento no ponto, afastamentos acima de 15 dias encaminhados ao INSS, eSocial (S-2230) e exame de retorno.',
    columns: [['Recebido', G], ['Lançado', B], ['Encaminhado ao INSS', P], ['Afastado', O], ['Exame de retorno', Y], ['Retornou', GR]],
    labels: [['Até 15 dias', S], ['Mais de 15 dias', O], ['Acidente de trabalho', R], ['Licença-maternidade', PK]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Início do afastamento', t: 'date' }, { n: 'Dias de atestado', t: 'number' }, { n: 'CID informado', t: 'checkbox' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Atestado novo: lançar em até 2 dias' }, { when: 'moved', col: 'Encaminhado ao INSS', act: 'priority', val: 'high', label: 'Encaminhado ao INSS: prioridade Alta' }],
    form: { title: 'Enviar atestado', intro: 'Envie seu atestado para o Departamento Pessoal. Guarde o original até o DP confirmar o recebimento.', col: 'Recebido', due: 2, q: [['Seu nome', 'text', true], ['Primeiro dia do atestado', 'date', true], ['Quantidade de dias', 'number', true], ['Link da foto ou PDF do atestado', 'text', true], ['Observações', 'long', false]] },
    cards: [
      { t: 'Atestado de 3 dias', col: 1, due: 1, l: [0], f: { Colaborador: 'Pessoa A', 'Início do afastamento': ymd(-2), 'Dias de atestado': 3 } },
      { t: 'Afastamento acima de 15 dias', col: 2, due: 3, p: 'high', l: [1], f: { Colaborador: 'Pessoa B', 'Início do afastamento': ymd(-16), 'Dias de atestado': 30 }, ck: [['INSS', ['Empresa paga os 15 primeiros dias', 'Agendar perícia / requerimento no INSS', 'Enviar S-2230 ao eSocial', 'Acompanhar resultado da perícia', 'Agendar exame de retorno']]] },
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
    id: 'dp-duvidas', area: 'Departamento Pessoal', icon: 'message-circle-question', cover: 'cover-green', name: 'Dúvidas e pedidos ao DP',
    desc: 'Central do Departamento Pessoal: holerite, informe de rendimentos, declarações, benefícios e dúvidas, com prazo de resposta.',
    columns: [['Novo', G], ['Em atendimento', B], ['Aguardando colaborador', Y], ['Resolvido', GR]],
    labels: [['Holerite', S], ['Benefícios', PK], ['Declaração', P], ['Informe de rendimentos', O], ['Outros', G]],
    fields: [{ n: 'Solicitante', t: 'text', card: true }, { n: 'Tipo', t: 'select', o: ['Holerite', 'Benefícios', 'Declaração', 'Informe de rendimentos', 'Férias', 'Outros'] }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Pedido novo: responder em até 2 dias' }, { when: 'moved', col: 'Em atendimento', act: 'notify', label: 'Em atendimento: avisar o responsável' }],
    form: { title: 'Fale com o DP', intro: 'Mande sua dúvida ou pedido ao Departamento Pessoal. Respondemos em até 2 dias úteis.', col: 'Novo', due: 2, q: [['Assunto', 'text', true], ['Tipo', 'select', true, ['Holerite', 'Benefícios', 'Declaração', 'Informe de rendimentos', 'Férias', 'Outros']], ['Detalhes', 'long', true], ['Seu nome', 'text', true], ['Seu e-mail', 'email', true]] },
    cards: [
      { t: 'Declaração de vínculo para financiamento', col: 1, due: 1, l: [2], f: { Solicitante: 'Pessoa A', Tipo: 'Declaração' } },
      { t: 'Desconto de vale-transporte diferente', col: 0, due: 2, l: [0], f: { Solicitante: 'Pessoa B', Tipo: 'Holerite' } },
    ],
  },
  {
    id: 'dp-beneficios', area: 'Departamento Pessoal', icon: 'gift', cover: 'cover-orange', name: 'Benefícios: inclusões e exclusões',
    desc: 'Movimentações de plano de saúde, odontológico, vale-refeição e vale-transporte antes do corte da operadora.',
    columns: [['Solicitado', G], ['Documentos', B], ['Enviado à operadora', P], ['Ativo', GR], ['Cancelado', R]],
    labels: [['Saúde', R], ['Odonto', S], ['Refeição/alimentação', O], ['Transporte', P]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Benefício', t: 'select', o: ['Plano de saúde', 'Odontológico', 'Vale-refeição', 'Vale-alimentação', 'Vale-transporte'] }, { n: 'Movimento', t: 'select', o: ['Inclusão', 'Exclusão', 'Inclusão de dependente', 'Troca de plano'] }, { n: 'Data de corte', t: 'date' }],
    cards: [
      { t: 'Incluir dependente no plano de saúde', col: 1, due: 4, l: [0], f: { Colaborador: 'Pessoa A', Benefício: 'Plano de saúde', Movimento: 'Inclusão de dependente', 'Data de corte': ymd(6) }, ck: [['Documentos', ['Certidão do dependente', 'CPF do dependente', 'Formulário da operadora assinado']]] },
      { t: 'Excluir benefícios de desligado', col: 2, due: 2, p: 'high', l: [0, 2], f: { Colaborador: 'Pessoa B', Movimento: 'Exclusão' } },
    ],
  },
  {
    id: 'dp-cat', area: 'Departamento Pessoal', icon: 'hard-hat', cover: 'cover-purple', name: 'Acidente de trabalho (CAT)',
    desc: 'Atendimento ao colaborador, CAT até o 1º dia útil seguinte, investigação da causa e ações para não repetir.',
    columns: [['Ocorrido', R], ['CAT e eSocial', O], ['Investigação', B], ['Ações preventivas', P], ['Encerrado', GR]],
    labels: [['Típico', R], ['Trajeto', Y], ['Doença ocupacional', P], ['Quase acidente', S]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Data do acidente', t: 'date' }, { n: 'Local', t: 'text' }, { n: 'Afastamento', t: 'checkbox' }],
    rules: [{ when: 'created', act: 'priority', val: 'urgent', label: 'Acidente registrado: prioridade Urgente' }, { when: 'created', act: 'due', val: 1, label: 'CAT até o 1º dia útil seguinte' }],
    cards: [
      { t: 'Emitir a CAT (S-2210)', col: 1, due: 1, p: 'urgent', l: [0], f: { Colaborador: 'Nome do colaborador', 'Data do acidente': ymd(0), Local: 'Setor' }, d: 'Prazo: até o 1º dia útil após o acidente (em caso de morte, imediatamente).', ck: [['CAT', ['Atendimento médico', 'Atestado/relatório médico', 'Testemunhas', 'Envio do S-2210']]] },
      { t: 'Investigar a causa raiz', col: 2, st: 1, due: 7, p: 'high', dep: [0], ck: [['Investigação', ['Ouvir o acidentado e testemunhas', 'Fotos do local', '5 porquês', 'Relatório com a CIPA/SESMT']]] },
      { t: 'Implantar ações preventivas', col: 3, st: 7, due: 30, dep: [1], ck: [['Ações', ['Corrigir a condição insegura', 'Treinar a equipe', 'Revisar EPIs', 'Verificar eficácia em 30 dias']]] },
    ],
  },
  {
    id: 'dp-trabalhista', area: 'Departamento Pessoal', icon: 'scale', cover: 'cover-navy', name: 'Processos trabalhistas',
    desc: 'Reclamações trabalhistas com prazos, audiências, documentos para o advogado, acordos e pagamentos.',
    columns: [['Citação recebida', R], ['Documentos para defesa', B], ['Aguardando audiência', Y], ['Acordo / sentença', P], ['Pagamento', O], ['Arquivado', GR]],
    labels: [['Horas extras', O], ['Verbas rescisórias', B], ['Insalubridade', Y], ['Dano moral', R]],
    fields: [{ n: 'Reclamante', t: 'text', card: true }, { n: 'Número do processo', t: 'text' }, { n: 'Audiência', t: 'date' }, { n: 'Valor em discussão', t: 'money' }, { n: 'Advogado', t: 'text' }],
    rules: [{ when: 'created', act: 'priority', val: 'high', label: 'Processo novo: prioridade Alta' }],
    cards: [
      { t: 'Reunir documentos para a defesa', col: 1, due: 10, p: 'high', l: [0, 1], f: { Reclamante: 'Ex-colaborador', 'Número do processo': '0000000-00.0000.0.00.0000', Audiência: ymd(30) }, ck: [['Documentos', ['Contrato e aditivos', 'Cartões de ponto', 'Holerites', 'TRCT e comprovantes', 'Advertências e registros']]] },
      { t: 'Preparar preposto e testemunhas', col: 2, st: 20, due: 28, dep: [0] },
    ],
  },
  // ───────────────────────── Recursos Humanos: problemas de gestão de pessoas
  {
    id: 'rh-turnover', area: 'Recursos Humanos', icon: 'trending-down', cover: 'cover-orange', name: 'Plano contra rotatividade (turnover)',
    desc: 'Muita gente saindo? Levante os números, entenda as causas nas entrevistas de desligamento e acompanhe as ações de retenção.',
    columns: [['Diagnóstico', G], ['Causas', B], ['Ações', P], ['Em execução', O], ['Medindo resultado', Y], ['Concluído', GR]],
    labels: [['Salário e benefícios', O], ['Liderança', R], ['Carreira', P], ['Clima', PK], ['Recrutamento', S]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Turnover atual (%)', t: 'number' }, { n: 'Meta (%)', t: 'number' }],
    cards: [
      { t: 'Calcular turnover por área nos últimos 12 meses', col: 0, st: 0, due: 7, p: 'high', f: { Área: 'Empresa toda' } },
      { t: 'Analisar entrevistas de desligamento', col: 0, st: 0, due: 10, dep: [], ck: [['Análise', ['Motivos mais citados', 'Tempo de casa de quem sai', 'Saídas no período de experiência', 'Áreas e líderes com mais saídas']]] },
      { t: 'Definir as 3 causas principais', col: 1, st: 10, due: 14, p: 'high', dep: [0, 1] },
      { t: 'Plano de ação por causa', col: 2, st: 14, due: 21, dep: [2], ck: [['Ações possíveis', ['Pesquisa salarial', 'Treinamento de líderes', 'Trilha de carreira', 'Melhorar a integração']]] },
      { t: 'Medir o turnover após 90 dias', col: 4, st: 111, due: 114, dep: [3] },
    ],
  },
  {
    id: 'rh-clima', area: 'Recursos Humanos', icon: 'thermometer', cover: 'cover-green', name: 'Ação pós-pesquisa de clima',
    desc: 'Transforme o resultado da pesquisa de clima ou eNPS em ações com dono e prazo, e devolva o retorno à equipe.',
    columns: [['Resultado', G], ['Prioridades', B], ['Plano de ação', P], ['Em execução', O], ['Concluído', GR]],
    labels: [['Comunicação', S], ['Liderança', R], ['Reconhecimento', Y], ['Estrutura', P], ['Carga de trabalho', O]],
    fields: [{ n: 'Tema', t: 'text', card: true }, { n: 'Nota na pesquisa', t: 'number' }, { n: 'Meta na próxima pesquisa', t: 'number' }],
    cards: [
      { t: 'Apresentar o resultado para a liderança', col: 0, st: 0, due: 5, p: 'high' },
      { t: 'Escolher os 3 temas com pior nota', col: 1, st: 5, due: 8, dep: [0] },
      { t: 'Dar retorno da pesquisa para toda a equipe', col: 2, st: 8, due: 12, l: [0], dep: [1], d: 'Mostrar o que será feito evita a sensação de que responder não adianta.' },
      { t: 'Ação: rotina de reconhecimento mensal', col: 3, st: 12, due: 45, l: [2], f: { Tema: 'Reconhecimento', 'Nota na pesquisa': 5.8, 'Meta na próxima pesquisa': 7 }, dep: [1] },
    ],
  },
  {
    id: 'rh-conduta', area: 'Recursos Humanos', icon: 'shield-alert', cover: 'cover-purple', name: 'Denúncias e ocorrências de conduta',
    desc: 'Relatos de assédio, conflitos ou descumprimento de regras: triagem, apuração imparcial, decisão e medidas, com sigilo.',
    columns: [['Recebido', G], ['Triagem', B], ['Apuração', P], ['Decisão', Y], ['Medida aplicada', O], ['Encerrado', GR]],
    labels: [['Assédio', R], ['Conflito', O], ['Conduta', Y], ['Fraude', P], ['Sigiloso', G]],
    fields: [{ n: 'Área', t: 'text', card: true }, { n: 'Gravidade', t: 'select', o: ['Baixa', 'Média', 'Alta', 'Grave'] }, { n: 'Anônimo', t: 'checkbox' }, { n: 'Medida', t: 'select', o: ['Nenhuma', 'Orientação', 'Advertência', 'Suspensão', 'Desligamento'] }],
    rules: [{ when: 'created', act: 'due', val: 3, label: 'Relato novo: triagem em até 3 dias' }],
    form: { title: 'Canal de relatos', intro: 'Relate uma situação de assédio, conflito ou conduta inadequada. Você pode não se identificar. Tudo é tratado com sigilo.', col: 'Recebido', due: 3, prio: 'high', q: [['Resumo do que aconteceu', 'text', true], ['Descreva com detalhes (quando, onde, quem)', 'long', true], ['Área envolvida', 'text', false], ['Seu nome (opcional)', 'text', false]] },
    cards: [
      { t: 'Relato de conflito entre equipes', col: 2, due: 7, l: [1, 4], f: { Área: 'Operações', Gravidade: 'Média', Anônimo: true }, ck: [['Apuração', ['Ouvir quem relatou', 'Ouvir os envolvidos', 'Ouvir testemunhas', 'Registrar tudo por escrito', 'Parecer do comitê']]] },
    ],
  },
  {
    id: 'rh-disciplinar', area: 'Recursos Humanos', icon: 'gavel', cover: 'cover-navy', name: 'Medidas disciplinares',
    desc: 'Advertências e suspensões com registro dos fatos, conversa, documento assinado e acompanhamento, de forma justa e consistente.',
    columns: [['Fato registrado', G], ['Análise com o gestor', B], ['Conversa e documento', P], ['Acompanhamento', Y], ['Encerrado', GR]],
    labels: [['Atrasos/faltas', O], ['Conduta', R], ['Segurança', Y], ['Desempenho', S]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Data do fato', t: 'date' }, { n: 'Medida', t: 'select', o: ['Orientação verbal', 'Advertência escrita', 'Suspensão'] }, { n: 'Reincidência', t: 'checkbox' }],
    cards: [
      { t: 'Faltas sem justificativa', col: 1, due: 2, l: [0], f: { Colaborador: 'Pessoa A', 'Data do fato': ymd(-1), Medida: 'Advertência escrita' }, ck: [['Medida', ['Conferir o histórico', 'Aplicar logo após o fato (imediatidade)', 'Conversa registrada', 'Documento assinado (ou com 2 testemunhas)', 'Arquivar no prontuário']]] },
    ],
  },
  {
    id: 'rh-aso', area: 'Recursos Humanos', icon: 'heart-pulse', cover: 'cover-green', name: 'Exames ocupacionais e treinamentos obrigatórios',
    desc: 'Controle de ASO periódico, NRs e reciclagens que vencem, para ninguém trabalhar com exame ou treinamento vencido.',
    columns: [['Vence em 60 dias', G], ['Agendado', B], ['Realizado', GR], ['Vencido', R]],
    labels: [['ASO periódico', S], ['NR-35', O], ['NR-10', Y], ['NR-06 / EPI', P], ['Brigada', R]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Vencimento', t: 'date' }, { n: 'Clínica / instrutor', t: 'text' }],
    rules: [{ when: 'moved', col: 'Vencido', act: 'priority', val: 'urgent', label: 'Vencido: prioridade Urgente' }],
    cards: [
      { t: 'ASO periódico', col: 0, due: 50, l: [0], f: { Colaborador: 'Pessoa A', Vencimento: ymd(55) } },
      { t: 'Reciclagem NR-35 (trabalho em altura)', col: 1, due: 20, l: [1], f: { Colaborador: 'Pessoa B', Vencimento: ymd(25) } },
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
    id: 'plano5w2h', area: 'Resolução de problemas', icon: 'list-checks', cover: 'cover-green', name: 'Plano de ação 5W2H',
    desc: 'Cada ação com o quê, por quê, onde, quando, quem, como e quanto custa — ideal depois de reuniões e auditorias.',
    columns: [['Ações planejadas', G], ['Em andamento', B], ['Atrasadas', R], ['Concluídas', GR]],
    labels: [['Curto prazo', S], ['Médio prazo', Y], ['Longo prazo', P]],
    fields: [{ n: 'Por quê', t: 'text' }, { n: 'Onde', t: 'text' }, { n: 'Como', t: 'text' }, { n: 'Quanto custa', t: 'money', card: true }],
    cards: [
      { t: 'Treinar a equipe no novo procedimento', col: 0, st: 2, due: 15, l: [0], f: { 'Por quê': 'Reduzir retrabalho', Onde: 'Sala de treinamento', Como: 'Duas turmas de 2 horas', 'Quanto custa': 0 }, d: 'O quê = título · Quem = responsável · Quando = prazo.' },
      { t: 'Comprar etiquetadora para o estoque', col: 1, due: 10, l: [1], f: { 'Por quê': 'Evitar trocas de produto', Onde: 'Estoque', Como: 'Três orçamentos', 'Quanto custa': 900 } },
    ],
  },
  {
    id: 'crise', area: 'Resolução de problemas', icon: 'siren', cover: 'cover-orange', name: 'Gestão de crise',
    desc: 'Quando algo grave acontece: contenção imediata, comunicação com equipe e clientes, correção e lições aprendidas.',
    columns: [['Contenção', R], ['Comunicação', O], ['Correção', B], ['Monitoramento', Y], ['Lições aprendidas', P], ['Encerrado', GR]],
    labels: [['Clientes', S], ['Imprensa/redes', PK], ['Equipe', P], ['Jurídico', Y]],
    fields: [{ n: 'Crise', t: 'text', card: true }, { n: 'Início', t: 'date' }, { n: 'Porta-voz', t: 'text' }],
    rules: [{ when: 'created', act: 'priority', val: 'urgent', label: 'Item novo na crise: prioridade Urgente' }],
    cards: [
      { t: 'Conter o problema', col: 0, due: 0, p: 'urgent', f: { Crise: 'Descrição curta', Início: ymd(0) }, ck: [['Contenção', ['O que precisa parar agora', 'Quem decide', 'Registrar a linha do tempo']]] },
      { t: 'Comunicado para clientes e equipe', col: 1, due: 1, p: 'urgent', l: [0, 2], dep: [0], ck: [['Comunicação', ['Mensagem única aprovada', 'Porta-voz definido', 'Canais (e-mail, redes, telefone)', 'Respostas para perguntas comuns']]] },
      { t: 'Corrigir a causa', col: 2, st: 1, due: 7, p: 'high', dep: [0] },
      { t: 'Reunião de lições aprendidas', col: 4, st: 10, due: 14, dep: [2], d: 'Sem procurar culpados: o que funcionou, o que falhou e o que muda.' },
    ],
  },
  {
    id: 'reclamacoes', area: 'Resolução de problemas', icon: 'gauge', cover: 'cover-purple', name: 'Reclamações de clientes',
    desc: 'Cada reclamação com prazo de resposta, causa, solução combinada e confirmação de que o cliente ficou satisfeito.',
    columns: [['Recebida', G], ['Em análise', B], ['Solução proposta', P], ['Aguardando cliente', Y], ['Resolvida', GR], ['Sem solução', R]],
    labels: [['Atraso', O], ['Produto com defeito', R], ['Atendimento', S], ['Cobrança', Y]],
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Canal', t: 'select', o: ['Telefone', 'E-mail', 'WhatsApp', 'Site', 'Redes sociais', 'Reclame em sites de avaliação'] }, { n: 'Pedido / protocolo', t: 'text' }, { n: 'Cliente satisfeito', t: 'checkbox' }],
    rules: [{ when: 'created', act: 'due', val: 2, label: 'Reclamação nova: responder em até 2 dias' }, { when: 'moved', col: 'Sem solução', act: 'notify', label: 'Sem solução: avisar o responsável' }],
    form: { title: 'Registrar reclamação', intro: 'Conte o que aconteceu. Respondemos em até 2 dias úteis.', col: 'Recebida', due: 2, prio: 'high', q: [['Resumo', 'text', true], ['O que aconteceu', 'long', true], ['Número do pedido ou protocolo', 'text', false], ['Seu nome', 'text', true], ['Seu e-mail', 'email', true], ['Telefone', 'phone', false]] },
    cards: [
      { t: 'Entrega atrasada há 5 dias', col: 1, due: 1, p: 'high', l: [0], f: { Cliente: 'Cliente Exemplo', Canal: 'WhatsApp', 'Pedido / protocolo': '12345' }, ck: [['Tratativa', ['Pedir desculpas e dar um prazo', 'Descobrir a causa', 'Combinar a solução', 'Confirmar a satisfação']]] },
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
    id: 'rh-retorno', area: 'Recursos Humanos', icon: 'rotate-ccw', cover: 'cover-purple', name: 'Retorno de licença ou afastamento longo',
    desc: 'Volta planejada depois de licença-maternidade, auxílio-doença ou acidente: exame de retorno, estabilidade, acessos e readaptação.',
    columns: [['Antes do retorno', G], ['Dia do retorno', B], ['Readaptação', P], ['Concluído', GR]],
    labels: [['RH', PK], ['DP', Y], ['Gestor', O], ['Saúde', R]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Tipo de afastamento', t: 'select', o: ['Licença-maternidade', 'Licença-paternidade', 'Auxílio-doença', 'Acidente de trabalho', 'Outro'] }, { n: 'Data de retorno', t: 'date' }, { n: 'Fim da estabilidade', t: 'date' }],
    proc: { ref: 'Data de retorno', refDay: 10, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data de retorno)', title: 'Colaborador' },
    cards: [
      { t: 'Confirmar a data de retorno', col: 0, st: 0, due: 3, p: 'high', l: [0, 1], f: { Colaborador: 'Nome do colaborador', 'Tipo de afastamento': 'Licença-maternidade', 'Data de retorno': ymd(10) }, ck: [['Confirmação', ['Conferir a data com o colaborador', 'Documento de alta ou fim do benefício (INSS)', 'Avisar o gestor']]] },
      { t: 'Exame de retorno ao trabalho', col: 0, st: 5, due: 9, p: 'high', l: [3], dep: [0], d: 'Obrigatório antes de voltar quando o afastamento por doença ou acidente foi de 30 dias ou mais (NR-7).', ck: [['Exame', ['Agendar na clínica', 'Receber o ASO de retorno', 'Verificar restrições médicas']]] },
      { t: 'Preparar a volta: acessos e estação', col: 0, st: 6, due: 9, l: [0], dep: [0], ck: [['Preparação', ['Reativar acessos e e-mail', 'Estação de trabalho', 'Ponto e escala atualizados']]] },
      { t: 'Registrar o retorno e a estabilidade', col: 1, st: 10, due: 11, p: 'high', l: [1], dep: [0], d: 'Gestante: estabilidade até 5 meses após o parto (ADCT art. 10). Acidente de trabalho: estabilidade de 12 meses após o fim do auxílio-doença acidentário (Lei 8.213 art. 118).', ck: [['DP', ['Retorno informado no eSocial', 'Fim da estabilidade anotado', 'Intervalos para amamentação, se for o caso (2 de 30 min até o bebê completar 6 meses, CLT art. 396)', 'Benefícios retomados']]] },
      { t: 'Conversa de retorno com o gestor', col: 1, st: 10, due: 10, p: 'high', l: [2], dep: [1, 2], ck: [['Conversa', ['O que mudou no período', 'Prioridades das primeiras semanas', 'Ajustes de horário, tarefas ou restrições']]] },
      { t: 'Atualização sobre o que mudou', col: 2, st: 10, due: 17, l: [2], dep: [4], ck: [['Atualização', ['Processos e sistemas novos', 'Pessoas novas na equipe', 'Projetos em andamento']]] },
      { t: 'Acompanhamento de 30 dias', col: 2, st: 40, due: 42, l: [0, 2], dep: [4] },
    ],
  },
  {
    id: 'rh-experiencia', area: 'Recursos Humanos', icon: 'hourglass', cover: 'cover-orange', name: 'Fim do contrato de experiência',
    desc: 'Avaliações e decisões no 45º e no 90º dia, com os prazos da CLT, para ninguém ser efetivado ou desligado por esquecimento.',
    columns: [['Primeiro período (45 dias)', G], ['Decisão do 45º dia', Y], ['Segundo período (90 dias)', B], ['Efetivado', GR], ['Desligado', R]],
    labels: [['RH', PK], ['DP', Y], ['Gestor', O]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Data de admissão', t: 'date' }, { n: 'Gestor', t: 'text' }, { n: 'Decisão', t: 'select', o: ['Prorrogar', 'Efetivar', 'Encerrar'] }],
    proc: { ref: 'Data de admissão', refDay: 0, lead: 0, q: 'Antecipar todos os prazos em quantos dias? (0 = contar a partir da data de admissão)', title: 'Colaborador' },
    cards: [
      { t: 'Avaliação dos primeiros 45 dias', col: 0, st: 35, due: 40, p: 'high', l: [0, 2], f: { Colaborador: 'Nome do colaborador', 'Data de admissão': ymd(0) }, ck: [['Avaliação', ['Entregas e qualidade', 'Comportamento e integração', 'Pontos a melhorar', 'Recomendação do gestor']]] },
      { t: 'Decidir: prorrogar ou encerrar no 45º dia', col: 1, st: 40, due: 43, p: 'urgent', l: [2], dep: [0], d: 'O contrato de experiência dura no máximo 90 dias e pode ser prorrogado uma única vez (CLT arts. 445 e 451). Se nada for feito no fim do prazo, ele vira contrato por tempo indeterminado.' },
      { t: 'Formalizar a decisão do 45º dia', col: 1, st: 43, due: 44, p: 'high', l: [1], dep: [1], ck: [['DP', ['Termo de prorrogação assinado (se prorrogar)', 'Rescisão por término de contrato (se encerrar no prazo)', 'Sistema de folha atualizado']]] },
      { t: 'Avaliação dos 90 dias', col: 2, st: 80, due: 85, p: 'high', l: [0, 2], dep: [2], ck: [['Avaliação', ['Evolução desde os 45 dias', 'Entregas e qualidade', 'Comportamento e integração', 'Recomendação do gestor']]] },
      { t: 'Decisão final: efetivar ou encerrar', col: 2, st: 85, due: 88, p: 'urgent', l: [2], dep: [3] },
      { t: 'Comunicar o resultado ao colaborador', col: 2, st: 88, due: 89, l: [0, 2], dep: [4] },
      { t: 'Efetivação: ajustes no DP', col: 2, st: 89, due: 90, l: [1], dep: [4], ck: [['Efetivação', ['Contrato passa a prazo indeterminado', 'Benefícios liberados após a experiência', 'Comunicar a equipe']]] },
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
    labels: [['Escola', S], ['DP', Y], ['Supervisor', O]],
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
    labels: [['Legal', Y], ['TI', S], ['Facilities', O], ['Comunicação', PK], ['Financeiro', GR]],
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
      { t: 'Lembrete amigável antes do vencimento', col: 0, st: 0, due: 0, l: [0], f: { Cliente: 'Nome do cliente', Vencimento: ymd(3), Valor: 1500 }, d: 'Cobre sempre sem constranger nem ameaçar (CDC art. 42).' },
      { t: 'Aviso no dia seguinte ao vencimento', col: 1, st: 4, due: 4, l: [1], dep: [0] },
      { t: 'Enviar a segunda via atualizada', col: 1, st: 8, due: 8, l: [1], dep: [1] },
      { t: 'Ligação de cobrança', col: 1, st: 13, due: 13, p: 'high', l: [1], dep: [2], ck: [['Ligação', ['Entender o motivo do atraso', 'Propor uma data de pagamento', 'Registrar o combinado']]] },
      { t: 'Proposta de acordo ou parcelamento', col: 2, st: 18, due: 20, p: 'high', l: [2], dep: [3] },
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
];

const ICON_OK = new Set(BOARD_TEMPLATES.map((t) => t.icon));
export const templateIcons = () => ICON_OK;

// conclusion column of each model (finished cards count as done there; e.g. "Ganho", "Pago", "Contratado")
const DONE_COL: Record<string, number> = { onboarding: 5, offboarding: 3, recrutamento: 5, vendas: 4, suporte: 3, posvenda: 5, marketing: 4, campanha: 4, manutencao: 4, eventos: 4, compras: 5, contas: 2, contratos: 4, projeto: 3, sprint: 5, okrs: 3,
  treinamento: 4, ferias: 4, desempenho: 5, prospeccao: 4, sucesso: 4, redes: 5, design: 4, estoque: 4, entregas: 3, qualidade: 4,
  fechamento: 3, reembolso: 3, bugs: 4, implantacao: 5, reunioes: 4, planejamento: 5, fornecedores: 2,
  'dp-folha': 4, 'dp-rescisao': 4, 'dp-ferias': 5, 'dp-afastamentos': 5, 'dp-ponto': 4, 'dp-duvidas': 3, 'dp-beneficios': 3, 'dp-cat': 4, 'dp-trabalhista': 5,
  'rh-turnover': 5, 'rh-clima': 4, 'rh-conduta': 5, 'rh-disciplinar': 4, 'rh-aso': 2, pdca: 5, plano5w2h: 3, crise: 5, reclamacoes: 4,
  'rh-promocao': 4, 'rh-transferencia': 4, 'rh-retorno': 3, 'rh-experiencia': 3, 'rh-sucessao': 4, 'dp-estagio': 4, 'dp-aprendiz': 4,
  'sst-cipa': 4, 'sst-simulado': 4, 'sst-revisao': 3, 'ti-acessos': 4, 'lgpd-titular': 3, 'lgpd-incidente': 4, 'ti-backup': 4,
  'adm-vencimentos': 3, 'adm-licitacao': 4, 'adm-mudanca': 4, 'adm-troca-gestor': 3, 'adm-fiscalizacao': 4, 'fin-cobranca': 3, 'fin-caixa': 3,
  'op-unidade': 3, 'op-recall': 4, 'op-inventario': 4 };

export function templateToBoard(t: BoardTemplate): ImpBoard {
  return {
    source: 'modelo', doneCol: DONE_COL[t.id], name: t.name, desc: t.desc,
    columns: t.columns.map(([title, color]) => ({ title, color })),
    labels: t.labels.map(([name, color]) => ({ name, color })),
    cards: t.cards.map((c) => ({
      title: c.t, desc: c.d || '', col: c.col, due: c.due != null ? day(c.due) : null, start: c.st != null ? day(c.st, 9) : null,
      done: false, priority: c.p || 'medium', labels: c.l || [], comments: [], people: [],
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
