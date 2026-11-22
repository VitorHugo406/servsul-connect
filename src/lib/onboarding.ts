// Onboarding automático (RH › switch of the company admin, companies.auto_onboarding from migration 20261121010000):
// when an admin registers a person on the PC, a mural "Onboarding — <Nome>" is created from the "Onboarding de
// colaborador" model with every card assigned to the new person (who also becomes a member of the mural).
import { supabase } from '@/integrations/supabase/client';
import { BOARD_TEMPLATES, applyTemplateExtras, templateToBoard } from '@/lib/boardTemplates';
import { importBoard } from '@/lib/boardImport';

const db = supabase as any;

export async function companyAutoOnboarding(companyId: string): Promise<boolean> {
  const { data, error } = await db.from('companies').select('auto_onboarding').eq('id', companyId).maybeSingle();
  return !error && !!data?.auto_onboarding;
}

export async function setCompanyAutoOnboarding(on: boolean) {
  const { error } = await db.rpc('set_auto_onboarding', { _on: on });
  if (error) throw error;
}

/** Creates the onboarding mural for a person just registered; returns the mural id (or null when it could not). */
export async function createOnboardingBoard(person: { email: string; name: string }, me: { userId: string; profileId: string; companyId: string }): Promise<string | null> {
  const t = BOARD_TEMPLATES.find((x) => x.id === 'onboarding');
  if (!t) return null;
  const b = templateToBoard(t);
  b.cards = b.cards.map((c) => ({ ...c, people: [person.email] }));
  const { boardId } = await importBoard(b, me, `Onboarding — ${person.name}`.slice(0, 120), () => undefined);
  try { await applyTemplateExtras(boardId, t, me.profileId); } catch { /* the mural itself is ready */ }
  return boardId;
}
