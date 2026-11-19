// Ready-made mural templates (Tarefas › Modelos). Each one is an ImpBoard, so it is created by the same importBoard()
// used for Trello/CSV: columns (the last "Concluído" one becomes the conclusion column), labels, example cards with
// checklists. Due dates are relative ("+N days") and resolved when the mural is created. Nothing is shared between
// companies: the template only exists in this file.
import type { ImpBoard, ImpCard } from '@/lib/boardImport';

type C = { t: string; d?: string; col: number; due?: number; p?: ImpCard['priority']; l?: number[]; ck?: [string, string[]][] };
export type BoardTemplate = { id: string; name: string; desc: string; emoji: string; color: string; cover: string; columns: [string, string][]; labels: [string, string][]; cards: C[] };

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(18, 0, 0, 0); return d.toISOString(); };

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'onboarding', name: 'Onboarding de colaborador', emoji: '👋', color: '#2f6fed', cover: 'cover-navy',
    desc: 'Tudo o que precisa acontecer antes e depois da chegada de uma pessoa nova: documentos, acessos, equipamentos e acompanhamento.',
    columns: [['Antes da chegada', '#6b7280'], ['Primeira semana', '#3b82f6'], ['Primeiros 30 dias', '#8b5cf6'], ['Concluído', '#22c55e']],
    labels: [['RH', '#ec4899'], ['TI', '#0ea5e9'], ['Gestor', '#f97316']],
    cards: [
      { t: 'Receber documentos de admissão', col: 0, due: 2, p: 'high', l: [0], ck: [['Documentos', ['RG e CPF', 'Comprovante de residência', 'Carteira de trabalho', 'Dados bancários', 'Exame admissional']]] },
      { t: 'Criar acessos (e-mail e sistemas)', col: 0, due: 3, l: [1], ck: [['Acessos', ['E-mail corporativo', 'Usuário no ewvon', 'Sistemas da área']]] },
      { t: 'Preparar equipamento e estação de trabalho', col: 0, due: 3, l: [1], ck: [['Itens', ['Notebook', 'Fone/headset', 'Crachá']]] },
      { t: 'Apresentação da empresa e da equipe', col: 1, due: 5, l: [2] },
      { t: 'Definir metas dos primeiros 30 dias', col: 1, due: 6, p: 'high', l: [2] },
      { t: 'Conversa de acompanhamento (30 dias)', col: 2, due: 30, l: [0, 2] },
      { t: 'Avaliação de experiência (45 dias)', col: 2, due: 45, p: 'high', l: [0, 2] },
    ],
  },
  {
    id: 'vendas', name: 'Funil de vendas', emoji: '💼', color: '#16a34a', cover: 'cover-green',
    desc: 'Acompanhe cada oportunidade do primeiro contato até o fechamento. Um card por cliente ou negócio.',
    columns: [['Novos contatos', '#6b7280'], ['Qualificação', '#3b82f6'], ['Proposta enviada', '#eab308'], ['Negociação', '#f97316'], ['Ganho', '#22c55e'], ['Perdido', '#ef4444']],
    labels: [['Quente', '#ef4444'], ['Morno', '#f97316'], ['Frio', '#0ea5e9'], ['Indicação', '#8b5cf6']],
    cards: [
      { t: 'Empresa Exemplo — primeiro contato', d: 'Origem: site. Interesse no plano completo.', col: 0, due: 1, l: [1], ck: [['Próximos passos', ['Ligar', 'Enviar apresentação']]] },
      { t: 'Cliente Modelo — reunião de diagnóstico', col: 1, due: 3, p: 'high', l: [0, 3] },
      { t: 'Loja Demonstração — proposta comercial', col: 2, due: 5, l: [1], ck: [['Proposta', ['Montar proposta', 'Revisar valores', 'Enviar e confirmar recebimento']]] },
      { t: 'Indústria Fictícia — ajuste de contrato', col: 3, due: 2, p: 'urgent', l: [0] },
    ],
  },
  {
    id: 'marketing', name: 'Calendário de marketing', emoji: '📣', color: '#db2777', cover: 'cover-orange',
    desc: 'Planeje posts, campanhas e materiais: da ideia à publicação, com prazos e responsáveis.',
    columns: [['Ideias', '#6b7280'], ['Em produção', '#3b82f6'], ['Revisão', '#eab308'], ['Agendado', '#8b5cf6'], ['Publicado', '#22c55e']],
    labels: [['Instagram', '#ec4899'], ['LinkedIn', '#0ea5e9'], ['Blog', '#f97316'], ['E-mail', '#84cc16']],
    cards: [
      { t: 'Post: dica da semana', col: 0, l: [0] },
      { t: 'Artigo: como organizar a rotina da equipe', col: 1, due: 4, l: [2], ck: [['Etapas', ['Pauta', 'Rascunho', 'Imagens', 'SEO']]] },
      { t: 'Newsletter do mês', col: 2, due: 3, p: 'high', l: [3] },
      { t: 'Campanha de lançamento', col: 3, due: 7, p: 'high', l: [0, 1] },
    ],
  },
  {
    id: 'suporte', name: 'Suporte ao cliente', emoji: '🎧', color: '#0891b2', cover: 'cover-navy',
    desc: 'Chamados de clientes organizados por situação. Use junto com o formulário do mural para receber pedidos automaticamente.',
    columns: [['Novo', '#6b7280'], ['Em atendimento', '#3b82f6'], ['Aguardando cliente', '#eab308'], ['Resolvido', '#22c55e']],
    labels: [['Dúvida', '#0ea5e9'], ['Problema', '#ef4444'], ['Sugestão', '#8b5cf6'], ['Financeiro', '#f97316']],
    cards: [
      { t: 'Cliente não consegue acessar a conta', col: 0, due: 1, p: 'urgent', l: [1], ck: [['Atendimento', ['Confirmar e-mail', 'Redefinir senha', 'Testar acesso com o cliente']]] },
      { t: 'Dúvida sobre relatório mensal', col: 1, due: 2, l: [0] },
      { t: 'Pedido de nova funcionalidade', col: 2, l: [2] },
    ],
  },
  {
    id: 'recrutamento', name: 'Recrutamento e seleção', emoji: '🧑‍💼', color: '#7c3aed', cover: 'cover-purple',
    desc: 'Um card por candidato, do currículo à contratação. Comentários guardam o histórico das entrevistas.',
    columns: [['Currículos', '#6b7280'], ['Triagem', '#3b82f6'], ['Entrevista', '#eab308'], ['Proposta', '#f97316'], ['Contratado', '#22c55e'], ['Não seguiu', '#ef4444']],
    labels: [['Vaga: Vendas', '#16a34a'], ['Vaga: Administrativo', '#0ea5e9'], ['Destaque', '#eab308']],
    cards: [
      { t: 'Candidato A — Vendas', col: 1, l: [0], ck: [['Triagem', ['Ler currículo', 'Ligação rápida', 'Agendar entrevista']]] },
      { t: 'Candidata B — Administrativo', col: 2, due: 2, p: 'high', l: [1, 2], ck: [['Entrevista', ['Entrevista com RH', 'Entrevista com gestor', 'Teste prático']]] },
      { t: 'Candidato C — Vendas', col: 0, l: [0] },
    ],
  },
  {
    id: 'projeto', name: 'Projeto com etapas', emoji: '🚀', color: '#ea580c', cover: 'cover-orange',
    desc: 'Planejamento, execução e entrega de um projeto. Combine com a Linha do tempo para ver as datas e dependências.',
    columns: [['A fazer', '#6b7280'], ['Em andamento', '#3b82f6'], ['Em revisão', '#eab308'], ['Concluído', '#22c55e']],
    labels: [['Planejamento', '#8b5cf6'], ['Execução', '#3b82f6'], ['Entrega', '#22c55e'], ['Risco', '#ef4444']],
    cards: [
      { t: 'Reunião de início (kick-off)', col: 0, due: 1, p: 'high', l: [0], ck: [['Pauta', ['Objetivo', 'Escopo', 'Responsáveis', 'Datas']]] },
      { t: 'Levantamento de requisitos', col: 0, due: 4, l: [0] },
      { t: 'Execução — fase 1', col: 0, due: 10, l: [1] },
      { t: 'Revisão com o cliente', col: 0, due: 14, l: [1, 3] },
      { t: 'Entrega e encerramento', col: 0, due: 18, p: 'high', l: [2] },
    ],
  },
];

export function templateToBoard(t: BoardTemplate): ImpBoard {
  return {
    source: 'modelo', name: t.name, desc: t.desc,
    columns: t.columns.map(([title, color]) => ({ title, color })),
    labels: t.labels.map(([name, color]) => ({ name, color })),
    cards: t.cards.map((c) => ({ title: c.t, desc: c.d || '', col: c.col, due: c.due != null ? day(c.due) : null, done: false, priority: c.p || 'medium', labels: c.l || [], checklists: (c.ck || []).map(([title, items]) => ({ title, items: items.map((x) => ({ t: x, done: false })) })), comments: [], people: [] })),
  };
}
