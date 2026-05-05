-- Tabela de anotações
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova anotação',
  content TEXT NOT NULL DEFAULT '',
  background_color TEXT NOT NULL DEFAULT '#FFF9C4',
  background_texture TEXT,
  background_image TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_owner ON public.notes(owner_id);

-- Tabela de compartilhamentos
CREATE TABLE public.note_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read','edit')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (note_id, shared_with_user_id)
);

CREATE INDEX idx_note_shares_user ON public.note_shares(shared_with_user_id);

-- Helper function: pode editar?
CREATE OR REPLACE FUNCTION public.can_edit_note(_note_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notes WHERE id = _note_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.note_shares 
    WHERE note_id = _note_id 
      AND shared_with_user_id = auth.uid()
      AND permission = 'edit'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_note(_note_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notes WHERE id = _note_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.note_shares 
    WHERE note_id = _note_id AND shared_with_user_id = auth.uid()
  );
$$;

-- RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and shared users can view notes"
ON public.notes FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.note_shares 
  WHERE note_id = notes.id AND shared_with_user_id = auth.uid()
));

CREATE POLICY "Authenticated users can create notes"
ON public.notes FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and editors can update notes"
ON public.notes FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.can_edit_note(id));

CREATE POLICY "Only owners can delete notes"
ON public.notes FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- note_shares policies
CREATE POLICY "Users can view shares related to them"
ON public.note_shares FOR SELECT TO authenticated
USING (
  shared_with_user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.notes WHERE id = note_shares.note_id AND owner_id = auth.uid())
);

CREATE POLICY "Owners can manage shares"
ON public.note_shares FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE id = note_shares.note_id AND owner_id = auth.uid()));

CREATE POLICY "Owners can update shares"
ON public.note_shares FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.notes WHERE id = note_shares.note_id AND owner_id = auth.uid()));

CREATE POLICY "Owners can delete shares"
ON public.note_shares FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.notes WHERE id = note_shares.note_id AND owner_id = auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_shares;