-- Sticker packs (WhatsApp-like): a person groups stickers into named packs, shares a pack
-- in a chat ("✨ pack:<id>") and colleagues add a copy to their own packs. Sticker files stay
-- content-addressed in the company 'stickers' bucket, so packs only reference hashes.
CREATE TABLE IF NOT EXISTS public.chat_sticker_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  owner_profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_sticker_packs_owner_idx ON public.chat_sticker_packs (owner_profile_id);
ALTER TABLE public.chat_sticker_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company sees sticker packs" ON public.chat_sticker_packs;
CREATE POLICY "Company sees sticker packs" ON public.chat_sticker_packs FOR SELECT TO authenticated USING (public.same_company(company_id));
DROP POLICY IF EXISTS "Owner creates sticker packs" ON public.chat_sticker_packs;
CREATE POLICY "Owner creates sticker packs" ON public.chat_sticker_packs FOR INSERT TO authenticated
  WITH CHECK (owner_profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());
DROP POLICY IF EXISTS "Owner updates sticker packs" ON public.chat_sticker_packs;
CREATE POLICY "Owner updates sticker packs" ON public.chat_sticker_packs FOR UPDATE TO authenticated
  USING (owner_profile_id = public.get_current_profile_id()) WITH CHECK (owner_profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());
DROP POLICY IF EXISTS "Owner deletes sticker packs" ON public.chat_sticker_packs;
CREATE POLICY "Owner deletes sticker packs" ON public.chat_sticker_packs FOR DELETE TO authenticated USING (owner_profile_id = public.get_current_profile_id());

CREATE TABLE IF NOT EXISTS public.chat_sticker_pack_items (
  pack_id uuid NOT NULL REFERENCES public.chat_sticker_packs(id) ON DELETE CASCADE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  position int NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_id, sha256)
);
ALTER TABLE public.chat_sticker_pack_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company sees pack items" ON public.chat_sticker_pack_items;
CREATE POLICY "Company sees pack items" ON public.chat_sticker_pack_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_sticker_packs p WHERE p.id = pack_id AND public.same_company(p.company_id)));
DROP POLICY IF EXISTS "Owner adds pack items" ON public.chat_sticker_pack_items;
CREATE POLICY "Owner adds pack items" ON public.chat_sticker_pack_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_sticker_packs p WHERE p.id = pack_id AND p.owner_profile_id = public.get_current_profile_id()));
DROP POLICY IF EXISTS "Owner removes pack items" ON public.chat_sticker_pack_items;
CREATE POLICY "Owner removes pack items" ON public.chat_sticker_pack_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_sticker_packs p WHERE p.id = pack_id AND p.owner_profile_id = public.get_current_profile_id()));
