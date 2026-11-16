-- Setores: descrição e gestor responsável (opcionais). Nada existente muda.
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sectors_manager_id_idx ON public.sectors(manager_id);
-- O gestor precisa ser da mesma empresa do setor.
CREATE OR REPLACE FUNCTION public.sector_manager_same_company() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.manager_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.manager_id AND p.company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'GESTOR_OUTRA_EMPRESA: o gestor precisa ser da mesma empresa do setor';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sector_manager_same_company ON public.sectors;
CREATE TRIGGER sector_manager_same_company BEFORE INSERT OR UPDATE OF manager_id ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.sector_manager_same_company();
