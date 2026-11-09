// Which desktop sections a company may open, by plan (company_subscriptions + subscription_plans).
// System sections (whole platform) are only for the Admin company; plan features gate the rest.
export type CompanyPlan = {
  company_id: string; is_system: boolean; status: string; plan_id: string | null; plan_name: string | null;
  billing_cycle: 'monthly' | 'annual' | 'once'; current_period_end: string | null; has_auto_renewal: boolean;
  features: string[]; price_cents: number | null; annual_price_cents: number | null;
  extra_users: number; extra_storage_gb: number; free_seats: number;
  limits: { users: number | null; sectors: number | null; storage_bytes: number | null };
  usage: { users: number; sectors: number; storage_bytes: number };
  prices: { extra_user_cents: number; storage_pack_gb: number; storage_pack_cents: number } | null;
};

/** Sections only the platform owner (Admin company) may see. */
export const SYSTEM_SECTIONS = new Set(['companies', 'system-broadcasts', 'storage', 'documentation', 'system-logs', 'data-management', 'api-management']);

/** Plan feature that unlocks each section; sections not listed are part of every plan. */
export const SECTION_FEATURE: Record<string, string> = {
  chat: 'chat',
  announcements: 'announcements',
  tasks: 'tasks',
  notes: 'notes',
  birthdays: 'birthdays',
  calendar: 'calendar',
  'meeting-rooms': 'meeting_rooms',
  shortcuts: 'shortcuts',
  'my-dashboard': 'metrics_dashboard',
  evaluations: 'evaluations',
  'people-management': 'people_management',
  'war-room': 'war_room',
  'event-history': 'themes',
  'dashboard-3d': 'dashboard_3d',
};

export const FEATURE_LABEL: Record<string, string> = {
  chat: 'Chat', announcements: 'Avisos', important_notices: 'Comunicados importantes', tasks: 'Quadros de tarefas', notes: 'Anotações',
  birthdays: 'Aniversariantes', calendar: 'Calendário e reuniões', meeting_rooms: 'Salas de reunião', shortcuts: 'Atalhos do sistema',
  metrics_dashboard: 'Painel de métricas', evaluations: 'Avaliações', people_management: 'Gestão de pessoas', war_room: 'War Room',
  dashboard_3d: 'Dash', themes: 'Eventos e temas',
};

export function planHasFeature(plan: CompanyPlan | null | undefined, feature: string): boolean {
  if (!plan) return true; // not loaded yet: the database still enforces
  if (plan.is_system || plan.features.includes('*')) return true;
  return plan.features.includes(feature);
}

/** null = allowed; otherwise the reason it is locked. */
export function sectionLock(section: string, plan: CompanyPlan | null | undefined, isSuperAdmin: boolean): null | 'system' | 'plan' {
  if (SYSTEM_SECTIONS.has(section)) return isSuperAdmin || plan?.is_system ? null : 'system';
  const feature = SECTION_FEATURE[section];
  if (feature && !planHasFeature(plan, feature)) return 'plan';
  return null;
}

/** Friendly text for database limit errors (users, sectors, storage). */
export function limitErrorMessage(raw: unknown): string | null {
  const msg = typeof raw === 'string' ? raw : (raw as any)?.message || '';
  if (/LIMITE_USUARIOS/.test(msg)) return msg.replace(/^.*LIMITE_USUARIOS:\s*/, '');
  if (/LIMITE_SETORES/.test(msg)) return msg.replace(/^.*LIMITE_SETORES:\s*/, '');
  return null;
}
