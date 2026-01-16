// ServChat Types - Grupo Servsul

export type AutonomyLevel = 'admin' | 'gerente' | 'supervisor' | 'colaborador';

export interface User {
  id: string;
  name: string;
  displayName: string;
  email: string;
  avatar: string;
  sector: Sector;
  autonomyLevel: AutonomyLevel;
  birthDate: string;
  isOnline: boolean;
}

export interface Sector {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Message {
  id: string;
  content: string;
  sender: User;
  sectorId: string;
  timestamp: Date;
  reactions?: Reaction[];
}

export interface Reaction {
  emoji: string;
  users: string[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: User;
  timestamp: Date;
  isPinned: boolean;
  priority: 'normal' | 'important' | 'urgent';
}

export interface BirthdayPerson {
  id: string;
  name: string;
  avatar: string;
  sector: string;
  birthDate: string;
  isToday: boolean;
}

export interface ChartData {
  id: string;
  name: string;
  data: Array<{
    label: string;
    value: number;
  }>;
  type: 'bar' | 'line' | 'pie';
}
