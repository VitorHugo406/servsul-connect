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
};

export const TEMPLATE_AREAS = ['Recursos Humanos', 'Vendas e atendimento', 'Marketing', 'Operações', 'Financeiro e compras', 'Projetos e tecnologia'];

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
    rules: [{ when: 'created', act: 'due', val: 5, label: 'Card novo ganha prazo de 5 dias' }],
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
    fields: [{ n: 'Cliente', t: 'text', card: true }, { n: 'Valor mensal', t: 'money' }, { n: 'Plano', t: 'select', o: ['Básico', 'Profissional', 'Empresarial'] }],
    rules: [{ when: 'moved', col: 'Cliente ativo', act: 'notify', label: 'Cliente ativo: avisar o responsável' }],
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
    fields: [{ n: 'Orçamento', t: 'money', card: true }, { n: 'Meta', t: 'text' }],
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
    fields: [{ n: 'Custo', t: 'money', card: true }, { n: 'Fornecedor', t: 'text' }, { n: 'Pago', t: 'checkbox' }],
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
    fields: [{ n: 'Fase', t: 'select', o: ['Planejamento', 'Execução', 'Entrega'], card: true }, { n: 'Horas estimadas', t: 'number' }],
    rules: [{ when: 'moved', col: 'Em revisão', act: 'notify', label: 'Em revisão: avisar o responsável' }],
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
];

const ICON_OK = new Set(BOARD_TEMPLATES.map((t) => t.icon));
export const templateIcons = () => ICON_OK;

// conclusion column of each model (finished cards count as done there; e.g. "Ganho", "Pago", "Contratado")
const DONE_COL: Record<string, number> = { onboarding: 4, offboarding: 3, recrutamento: 5, vendas: 4, suporte: 3, posvenda: 5, marketing: 4, campanha: 4, manutencao: 4, eventos: 4, compras: 5, contas: 2, contratos: 4, projeto: 3, sprint: 5, okrs: 3 };

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

  if (t.fields?.length) {
    const { data: fs } = await db.from('board_custom_fields').insert(t.fields.map((f, i) => ({ board_id: boardId, name: f.n, type: f.t, options: f.o || [], show_on_card: !!f.card, position: i }))).select('id,name');
    const fid = new Map(((fs || []) as { id: string; name: string }[]).map((f) => [f.name, f.id]));
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
  if (t.form) {
    await db.from('board_forms').insert({
      board_id: boardId, enabled: false, title: t.form.title, intro: t.form.intro, column_id: colId(t.form.col), due_days: t.form.due ?? null,
      priority: t.form.prio || 'medium', thank_you: t.form.thanks || null,
      questions: t.form.q.map(([label, type, required, options], i) => ({ id: 'q' + (i + 1), label, type, required, ...(options ? { options } : {}) })),
    });
  }
}

/** What a template brings, for the preview. */
export const templateSummary = (t: BoardTemplate) => ({ cards: t.cards.length, fields: t.fields?.length || 0, rules: t.rules?.length || 0, deps: t.cards.reduce((a, c) => a + (c.dep?.length || 0), 0), form: !!t.form, checklists: t.cards.reduce((a, c) => a + (c.ck?.length || 0), 0) });
