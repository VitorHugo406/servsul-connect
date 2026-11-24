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

export const TEMPLATE_AREAS = ['Recursos Humanos', 'Departamento Pessoal', 'Vendas e atendimento', 'Marketing', 'Operações', 'Financeiro e compras', 'Projetos e tecnologia', 'Gestão e administração', 'Resolução de problemas'];

const day = (n: number, h = 18) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const ymd = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const G = '#6b7280', B = '#3b82f6', Y = '#eab308', O = '#f97316', P = '#8b5cf6', GR = '#22c55e', R = '#ef4444', S = '#0ea5e9', PK = '#ec4899';

export const BOARD_TEMPLATES: BoardTemplate[] = [
  // ───────────────────────── Recursos Humanos
  {
    id: 'onboarding', area: 'Recursos Humanos', icon: 'user-plus', cover: 'cover-navy', name: 'Onboarding de colaborador',
    desc: 'Da contratação aos primeiros 90 dias: documentos, acessos, integração, acompanhamento e avaliações de experiência.',
    columns: [['Pré-admissão', G], ['Primeira semana', B], ['Primeiros 30 dias', P], ['Experiência (45/90 dias)', O], ['Concluído', GR]],
    labels: [['RH', PK], ['TI', S], ['Gestor', O], ['Documentação', Y]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Cargo', t: 'text' }, { n: 'Data de admissão', t: 'date' }, { n: 'Modalidade', t: 'select', o: ['Presencial', 'Híbrido', 'Remoto'] }],
    rules: [{ when: 'moved', col: 'Primeira semana', act: 'priority', val: 'high', label: 'Ao entrar em "Primeira semana", prioridade Alta' }, { when: 'completed', act: 'notify', label: 'Ao concluir, avisar o responsável' }],
    proc: { ref: 'Data de admissão', refDay: 7, lead: 0, q: 'Quantos dias antes da data de admissão o processo deve ser adiantado? (0 = prazos contados a partir da admissão)', title: 'Colaborador' },
    cards: [
      { t: 'Coletar documentos de admissão', col: 0, st: 0, due: 3, p: 'high', l: [0, 3], f: { Colaborador: 'Nova pessoa', Cargo: 'Analista', 'Data de admissão': ymd(7), Modalidade: 'Híbrido' }, ck: [['Documentos', ['RG e CPF', 'Comprovante de residência', 'Carteira de trabalho digital', 'Dados bancários', 'Foto 3x4', 'Certidão de casamento/filhos (se houver)']], ['Exames', ['Agendar exame admissional', 'Receber ASO']]] },
      { t: 'Assinar contrato e termos', col: 0, st: 3, due: 5, l: [0, 3], dep: [0], ck: [['Assinaturas', ['Contrato de trabalho', 'Termo de confidencialidade', 'Política de uso de equipamentos', 'Ciência do código de conduta']]] },
      { t: 'Criar acessos e e-mail', col: 0, st: 4, due: 6, l: [1], dep: [1], ck: [['Acessos', ['E-mail corporativo', 'Usuário no ewvon', 'Sistemas da área', 'VPN / Wi-Fi', 'Grupos e canais do time']]] },
      { t: 'Preparar estação e equipamentos', col: 0, st: 4, due: 6, l: [1], ck: [['Itens', ['Notebook configurado', 'Headset', 'Crachá', 'Mesa e cadeira']]] },
      { t: 'Dia 1: boas-vindas e apresentação', col: 1, st: 7, due: 7, p: 'high', l: [2], dep: [2, 3], ck: [['Roteiro', ['Tour pela empresa', 'Apresentar equipe', 'Explicar rotina e ferramentas', 'Almoço de boas-vindas']]] },
      { t: 'Definir metas e plano dos 30 dias', col: 1, st: 8, due: 10, l: [2], dep: [4] },
      { t: 'Conversa de acompanhamento (30 dias)', col: 2, st: 35, due: 37, l: [0, 2] },
      { t: 'Avaliação de experiência — 45 dias', col: 3, st: 50, due: 52, p: 'high', l: [0, 2], dep: [6] },
      { t: 'Avaliação de experiência — 90 dias', col: 3, st: 95, due: 97, p: 'high', l: [0, 2], dep: [7] },
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
      { t: 'Relatório de resultados', col: 4, st: 28, due: 30, dep: [3] },
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
      { t: 'Pesquisa de satisfação e fechamento', col: 4, st: 26, due: 30, dep: [4] },
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
      { t: 'Iniciativa: pesquisa trimestral de satisfação', col: 1, st: 5, due: 20, l: [2], dep: [1] },
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
    id: 'dp-admissao', area: 'Departamento Pessoal', icon: 'file-text', cover: 'cover-navy', name: 'Admissão no DP (documentos e eSocial)',
    desc: 'Do aceite ao primeiro dia: documentos, exame admissional (ASO), contrato, envio ao eSocial até o dia anterior ao início e benefícios.',
    columns: [['Aguardando documentos', G], ['Exame admissional', B], ['Contrato e cadastro', P], ['eSocial e benefícios', O], ['Admitido', GR], ['Pendência', R]],
    labels: [['CLT', B], ['Estágio', S], ['Temporário', Y], ['Urgente', R]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Data de início', t: 'date' }, { n: 'Cargo', t: 'text' }, { n: 'Salário', t: 'money' }, { n: 'Tipo de contrato', t: 'select', o: ['CLT', 'Estágio', 'Temporário', 'Experiência 45+45'] }],
    proc: { ref: 'Data de início', refDay: 10, lead: 0, q: 'Quantos dias antes do início a admissão deve estar pronta?', title: 'Colaborador' },
    rules: [{ when: 'moved', col: 'Pendência', act: 'priority', val: 'urgent', label: 'Pendência na admissão: prioridade Urgente' }],
    cards: [
      { t: 'Receber e conferir documentos', col: 0, st: 0, due: 3, p: 'high', f: { Colaborador: 'Nome do colaborador', 'Data de início': ymd(10), 'Tipo de contrato': 'CLT' }, ck: [['Documentos', ['RG e CPF', 'Carteira de trabalho digital', 'Comprovante de residência', 'Título de eleitor', 'Certidão de casamento/filhos', 'Dados bancários', 'Foto 3x4']]] },
      { t: 'Agendar e receber o ASO admissional', col: 1, st: 1, due: 6, p: 'high', ck: [['Exame', ['Agendar na clínica', 'Guia entregue ao candidato', 'ASO apto recebido']]] },
      { t: 'Contrato de trabalho e termos assinados', col: 2, st: 5, due: 8, dep: [0], ck: [['Assinaturas', ['Contrato (experiência)', 'Acordo de compensação/banco de horas', 'Termo de uso de imagem', 'Opção de vale-transporte']]] },
      { t: 'Enviar admissão ao eSocial (S-2200)', col: 3, st: 7, due: 9, p: 'urgent', dep: [1, 2], d: 'O envio precisa acontecer até o dia anterior ao início das atividades.' },
      { t: 'Cadastrar benefícios e ponto', col: 3, st: 8, due: 10, dep: [2], ck: [['Benefícios', ['Vale-transporte', 'Vale-refeição/alimentação', 'Plano de saúde', 'Cadastro no relógio de ponto']]] },
    ],
  },
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
    id: 'dp-ponto', area: 'Departamento Pessoal', icon: 'clock', cover: 'cover-purple', name: 'Ponto, horas extras e banco de horas',
    desc: 'Divergências de ponto, esquecimentos de marcação e horas extras que precisam de aprovação antes do fechamento.',
    columns: [['Solicitado', G], ['Com o gestor', B], ['Aprovado', GR], ['Ajustado no ponto', P], ['Recusado', R]],
    labels: [['Esqueceu de marcar', S], ['Hora extra', O], ['Banco de horas', P], ['Falta', R]],
    fields: [{ n: 'Colaborador', t: 'text', card: true }, { n: 'Data', t: 'date' }, { n: 'Horas', t: 'number' }],
    rules: [{ when: 'created', act: 'due', val: 3, label: 'Pedido novo: decidir em até 3 dias' }],
    form: { title: 'Ajuste de ponto', intro: 'Peça um ajuste de marcação ou informe horas extras. Seu gestor aprova antes do fechamento.', col: 'Solicitado', due: 3, q: [['Seu nome', 'text', true], ['Data', 'date', true], ['O que precisa ajustar?', 'select', true, ['Esqueci de marcar', 'Hora extra', 'Compensação de banco de horas', 'Outro']], ['Horário correto / quantidade de horas', 'text', true], ['Justificativa', 'long', true]] },
    cards: [
      { t: 'Esqueceu de marcar a saída', col: 1, due: 2, l: [0], f: { Colaborador: 'Pessoa A', Data: ymd(-1) } },
      { t: '2 horas extras — inventário', col: 0, due: 3, l: [1], f: { Colaborador: 'Pessoa B', Data: ymd(-3), Horas: 2 } },
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
      { t: 'Padronizar e treinar', col: 5, st: 35, due: 40, dep: [4], ck: [['Padronizar', ['Atualizar o procedimento', 'Treinar a equipe', 'Comunicar a mudança']]] },
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
];

const ICON_OK = new Set(BOARD_TEMPLATES.map((t) => t.icon));
export const templateIcons = () => ICON_OK;

// conclusion column of each model (finished cards count as done there; e.g. "Ganho", "Pago", "Contratado")
const DONE_COL: Record<string, number> = { onboarding: 4, offboarding: 3, recrutamento: 5, vendas: 4, suporte: 3, posvenda: 5, marketing: 4, campanha: 4, manutencao: 4, eventos: 4, compras: 5, contas: 2, contratos: 4, projeto: 3, sprint: 5, okrs: 3,
  treinamento: 4, ferias: 4, desempenho: 5, prospeccao: 4, sucesso: 4, redes: 5, design: 4, estoque: 4, entregas: 3, qualidade: 4,
  fechamento: 3, reembolso: 3, bugs: 4, implantacao: 5, reunioes: 4, planejamento: 5, fornecedores: 2,
  'dp-admissao': 4, 'dp-folha': 4, 'dp-rescisao': 4, 'dp-ferias': 5, 'dp-afastamentos': 5, 'dp-ponto': 3, 'dp-duvidas': 3, 'dp-beneficios': 3, 'dp-cat': 4, 'dp-trabalhista': 5,
  'rh-turnover': 5, 'rh-clima': 4, 'rh-conduta': 5, 'rh-disciplinar': 4, 'rh-aso': 2, pdca: 5, plano5w2h: 3, crise: 5, reclamacoes: 4 };

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
