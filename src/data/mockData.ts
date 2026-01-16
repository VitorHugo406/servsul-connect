import { User, Sector, Message, Announcement, BirthdayPerson, ChartData } from '@/types';

export const sectors: Sector[] = [
  { id: '1', name: 'Administrativo', color: '#3B82F6', icon: 'building' },
  { id: '2', name: 'Comercial', color: '#10B981', icon: 'trending-up' },
  { id: '3', name: 'Financeiro', color: '#F59E0B', icon: 'dollar-sign' },
  { id: '4', name: 'RH', color: '#EC4899', icon: 'users' },
  { id: '5', name: 'TI', color: '#8B5CF6', icon: 'monitor' },
  { id: '6', name: 'Operacional', color: '#EF4444', icon: 'settings' },
];

export const currentUser: User = {
  id: '1',
  name: 'Carlos Eduardo Silva',
  displayName: 'Carlos Silva',
  email: 'carlos.silva@servsul.com.br',
  avatar: '',
  sector: sectors[4],
  autonomyLevel: 'gerente',
  birthDate: '1990-03-15',
  isOnline: true,
};

export const users: User[] = [
  currentUser,
  {
    id: '2',
    name: 'Ana Paula Santos',
    displayName: 'Ana Santos',
    email: 'ana.santos@servsul.com.br',
    avatar: '',
    sector: sectors[3],
    autonomyLevel: 'supervisor',
    birthDate: '1988-01-16',
    isOnline: true,
  },
  {
    id: '3',
    name: 'Roberto Oliveira',
    displayName: 'Roberto Oliveira',
    email: 'roberto.oliveira@servsul.com.br',
    avatar: '',
    sector: sectors[1],
    autonomyLevel: 'colaborador',
    birthDate: '1995-01-18',
    isOnline: false,
  },
  {
    id: '4',
    name: 'Mariana Costa',
    displayName: 'Mari Costa',
    email: 'mariana.costa@servsul.com.br',
    avatar: '',
    sector: sectors[0],
    autonomyLevel: 'admin',
    birthDate: '1985-07-22',
    isOnline: true,
  },
  {
    id: '5',
    name: 'Felipe Mendes',
    displayName: 'Felipe Mendes',
    email: 'felipe.mendes@servsul.com.br',
    avatar: '',
    sector: sectors[2],
    autonomyLevel: 'gerente',
    birthDate: '1992-01-16',
    isOnline: true,
  },
];

export const messages: Message[] = [
  {
    id: '1',
    content: 'Bom dia equipe! 🌟 Quem já viu o novo projeto que começamos ontem?',
    sender: users[0],
    sectorId: '5',
    timestamp: new Date('2025-01-16T08:30:00'),
  },
  {
    id: '2',
    content: 'Bom dia! Vi sim, está ficando incrível! 🚀 Precisamos alinhar os próximos passos.',
    sender: users[1],
    sectorId: '5',
    timestamp: new Date('2025-01-16T08:32:00'),
  },
  {
    id: '3',
    content: 'Vou preparar o cronograma para a reunião de amanhã 📅',
    sender: users[0],
    sectorId: '5',
    timestamp: new Date('2025-01-16T08:35:00'),
  },
  {
    id: '4',
    content: 'Perfeito! Qualquer dúvida, estou por aqui 💪',
    sender: users[3],
    sectorId: '5',
    timestamp: new Date('2025-01-16T08:40:00'),
  },
];

export const announcements: Announcement[] = [
  {
    id: '1',
    title: '🎉 Confraternização de Início de Ano',
    content: 'Convidamos todos os colaboradores para nossa confraternização de início de ano, que será realizada no dia 25/01 às 18h no auditório principal. Contamos com a presença de todos!',
    author: users[3],
    timestamp: new Date('2025-01-15T10:00:00'),
    isPinned: true,
    priority: 'important',
  },
  {
    id: '2',
    title: '📋 Novos Procedimentos Operacionais',
    content: 'A partir de 01/02, entram em vigor os novos procedimentos operacionais. Todos os gestores devem acessar o portal para conferir as atualizações.',
    author: users[3],
    timestamp: new Date('2025-01-14T14:30:00'),
    isPinned: false,
    priority: 'normal',
  },
  {
    id: '3',
    title: '⚠️ Manutenção Programada',
    content: 'No domingo, 19/01, haverá manutenção nos sistemas entre 06h e 12h. Durante este período, alguns serviços podem ficar indisponíveis.',
    author: users[0],
    timestamp: new Date('2025-01-13T09:00:00'),
    isPinned: false,
    priority: 'urgent',
  },
];

export const birthdayPeople: BirthdayPerson[] = [
  {
    id: '2',
    name: 'Ana Paula Santos',
    avatar: '',
    sector: 'RH',
    birthDate: '1988-01-16',
    isToday: true,
  },
  {
    id: '5',
    name: 'Felipe Mendes',
    avatar: '',
    sector: 'Financeiro',
    birthDate: '1992-01-16',
    isToday: true,
  },
  {
    id: '3',
    name: 'Roberto Oliveira',
    avatar: '',
    sector: 'Comercial',
    birthDate: '1995-01-18',
    isToday: false,
  },
];

export const chartData: ChartData[] = [
  {
    id: '1',
    name: 'Vendas por Mês',
    type: 'bar',
    data: [
      { label: 'Jan', value: 450000 },
      { label: 'Fev', value: 380000 },
      { label: 'Mar', value: 520000 },
      { label: 'Abr', value: 490000 },
      { label: 'Mai', value: 610000 },
      { label: 'Jun', value: 580000 },
    ],
  },
  {
    id: '2',
    name: 'Produtividade Semanal',
    type: 'line',
    data: [
      { label: 'Seg', value: 85 },
      { label: 'Ter', value: 92 },
      { label: 'Qua', value: 88 },
      { label: 'Qui', value: 95 },
      { label: 'Sex', value: 78 },
    ],
  },
];

export const autonomyLevelLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  colaborador: 'Colaborador',
};
