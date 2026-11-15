// Standard criteria of the two evaluation forms (same wording as the printed models).
export type EvalKind = 'experience' | 'development';
export interface PresetGroup { group: string; items: { name: string; description: string }[] }

export const EXPERIENCE_PRESET: PresetGroup[] = [
  { group: 'COMPETÊNCIAS TÉCNICAS', items: [
    { name: 'Conhecimento da função', description: 'Domínio das atividades, sistemas e processos do cargo.' },
    { name: 'Qualidade do trabalho', description: 'Precisão, organização e atenção aos detalhes.' },
    { name: 'Produtividade e prazos', description: 'Cumprimento das tarefas, metas e prazos combinados.' },
    { name: 'Aprendizado e adaptação', description: 'Rapidez para aprender e aplicar orientações recebidas.' },
  ] },
  { group: 'COMPETÊNCIAS COMPORTAMENTAIS', items: [
    { name: 'Assiduidade e pontualidade', description: 'Cumprimento da jornada e dos horários estabelecidos.' },
    { name: 'Responsabilidade e comprometimento', description: 'Zelo com tarefas, materiais e informações.' },
    { name: 'Trabalho em equipe', description: 'Colaboração e bom relacionamento com colegas.' },
    { name: 'Comunicação', description: 'Clareza, cordialidade e capacidade de escuta.' },
    { name: 'Atendimento e postura profissional', description: 'Cuidado com clientes internos e externos.' },
    { name: 'Normas internas e segurança', description: 'Cumprimento de regras, políticas e sigilo.' },
  ] },
];

export const DEVELOPMENT_PRESET: PresetGroup[] = [
  { group: 'RESULTADOS E ENTREGAS', items: [
    { name: 'Qualidade das entregas', description: 'Precisão, organização e atenção aos detalhes.' },
    { name: 'Produtividade e prazos', description: 'Cumprimento de metas, tarefas e prazos combinados.' },
    { name: 'Conhecimento técnico', description: 'Domínio das atividades, sistemas e processos da função.' },
  ] },
  { group: 'COMPETÊNCIAS E ATITUDES', items: [
    { name: 'Iniciativa e proatividade', description: 'Antecipa problemas e propõe melhorias.' },
    { name: 'Comunicação', description: 'Clareza, cordialidade e capacidade de escuta.' },
    { name: 'Trabalho em equipe', description: 'Colaboração e bom relacionamento com colegas.' },
    { name: 'Foco no cliente', description: 'Cuidado com clientes internos e externos.' },
    { name: 'Aprendizado e evolução', description: 'Busca aprender, aplicar feedbacks e se desenvolver.' },
  ] },
  { group: 'CONDUTA E COMPROMISSO', items: [
    { name: 'Assiduidade e pontualidade', description: 'Cumprimento da jornada e dos horários estabelecidos.' },
    { name: 'Ética, normas e segurança', description: 'Cumprimento de regras, políticas e sigilo.' },
  ] },
];

export const PRESETS: Record<EvalKind, PresetGroup[]> = { experience: EXPERIENCE_PRESET, development: DEVELOPMENT_PRESET };

/** Form type chosen when the evaluation is created. */
export type FormType = 'exp45' | 'exp90' | 'expExtra' | 'devSemestral' | 'devAnual' | 'devPos' | 'devExtra';
export const FORM_TYPES: { id: FormType; kind: EvalKind; phase: 45 | 90 | null; label: string }[] = [
  { id: 'exp45', kind: 'experience', phase: 45, label: '1ª avaliação (45 dias)' },
  { id: 'exp90', kind: 'experience', phase: 90, label: '2ª avaliação final (90 dias)' },
  { id: 'expExtra', kind: 'experience', phase: null, label: 'Extraordinária' },
  { id: 'devSemestral', kind: 'development', phase: null, label: 'Semestral' },
  { id: 'devAnual', kind: 'development', phase: null, label: 'Anual' },
  { id: 'devPos', kind: 'development', phase: null, label: 'Pós-experiência' },
  { id: 'devExtra', kind: 'development', phase: null, label: 'Extraordinária' },
];
export const formTypeLabel = (t: FormType | string | null | undefined) => FORM_TYPES.find((f) => f.id === t)?.label ?? '';

export const classify = (avg: number | null | undefined) => (avg == null ? '' : avg >= 4.5 ? 'Excepcional' : avg >= 3.5 ? 'Supera as expectativas' : avg >= 2.5 ? 'Atende às expectativas' : avg >= 1.5 ? 'Abaixo do esperado' : 'Insuficiente');
