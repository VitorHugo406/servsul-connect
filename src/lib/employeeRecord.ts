// Sensitive employee data (salary, admission date, documents...). Stored encrypted in the database;
// only the RPCs below read or write it (admin: everything; the team manager and the person: non-financial fields).
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface EmployeeRecord {
  admission_date?: string; job_title?: string; salary?: string; rg?: string; cpf?: string; pis?: string; ctps?: string;
  contract_start?: string; contract_end_1?: string; contract_end_2?: string; registration?: string; manager_name?: string; notes?: string;
}

export async function getEmployeeRecord(profileId: string): Promise<EmployeeRecord> {
  const { data, error } = await sb.rpc('get_employee_record', { _profile: profileId });
  if (error || !data || typeof data !== 'object') return {};
  return data as EmployeeRecord;
}
export async function saveEmployeeRecord(profileId: string, data: EmployeeRecord) {
  const { error } = await sb.rpc('set_employee_record', { _profile: profileId, _data: data });
  if (error) throw new Error(error.message?.replace(/^.*?:\s*/, '') || 'Não foi possível salvar os dados do funcionário.');
}

const addDays = (iso: string, days: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
/** Contract dates derived from the admission date (45 + 45 days) unless they were filled in. */
export function contractDates(r: EmployeeRecord) {
  const start = r.contract_start || r.admission_date || '';
  return { start, end1: r.contract_end_1 || (start ? addDays(start, 44) : ''), end2: r.contract_end_2 || (start ? addDays(start, 89) : '') };
}
/** Days since admission (null if unknown): decides experience vs. development. */
export function daysSinceAdmission(r: EmployeeRecord): number | null {
  if (!r.admission_date) return null;
  return Math.floor((Date.now() - new Date(r.admission_date + 'T12:00:00').getTime()) / 864e5);
}
export const brDate = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : iso || '');
