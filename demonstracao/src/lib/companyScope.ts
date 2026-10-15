const KEY = 'nuvexa_active_company_id';

let active: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;

export function setActiveCompanyId(id: string | null) {
  active = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getActiveCompanyId(): string | null {
  if (active) return active;
  try {
    active = localStorage.getItem(KEY);
  } catch {
    active = null;
  }
  return active;
}

/**
 * Injects the current company id into an insert payload.
 * Falls back to the database trigger when the company is unknown.
 */
export function withCompany<T extends Record<string, unknown>>(payload: T): T & { company_id: string } {
  const id = getActiveCompanyId();
  return (id ? { ...payload, company_id: id } : payload) as T & { company_id: string };
}
