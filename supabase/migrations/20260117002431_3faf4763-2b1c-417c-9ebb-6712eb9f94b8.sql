-- =============================================
-- SERVCHAT - SISTEMA CORPORATIVO GRUPO SERVSUL
-- =============================================

-- 1. TABELA DE SETORES
CREATE TABLE public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'building',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA DE PERFIS
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  autonomy_level TEXT NOT NULL DEFAULT 'colaborador' CHECK (autonomy_level IN ('admin', 'gerente', 'supervisor', 'colaborador')),
  birth_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- 3. TABELA DE MENSAGENS DO CHAT
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABELA DE AVISOS GERAIS
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABELA DE COMENTÁRIOS NOS AVISOS
CREATE TABLE public.announcement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- FUNÇÕES AUXILIARES (SECURITY DEFINER)
-- =============================================

-- Função para obter o perfil do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Função para obter o setor do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_sector_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sector_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Função para obter o nível de autonomia do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_autonomy_level()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT autonomy_level FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Função para verificar se o usuário tem o nível de permissão necessário
CREATE OR REPLACE FUNCTION public.has_autonomy_level(required_level TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN required_level = 'colaborador' THEN true
    WHEN required_level = 'supervisor' THEN 
      public.get_current_autonomy_level() IN ('admin', 'gerente', 'supervisor')
    WHEN required_level = 'gerente' THEN 
      public.get_current_autonomy_level() IN ('admin', 'gerente')
    WHEN required_level = 'admin' THEN 
      public.get_current_autonomy_level() = 'admin'
    ELSE false
  END;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- HABILITAR RLS
-- =============================================

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - SECTORS
-- =============================================

CREATE POLICY "Todos podem ver setores"
  ON public.sectors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem criar setores"
  ON public.sectors FOR INSERT
  TO authenticated
  WITH CHECK (public.has_autonomy_level('admin'));

CREATE POLICY "Admins podem atualizar setores"
  ON public.sectors FOR UPDATE
  TO authenticated
  USING (public.has_autonomy_level('admin'));

CREATE POLICY "Admins podem deletar setores"
  ON public.sectors FOR DELETE
  TO authenticated
  USING (public.has_autonomy_level('admin'));

-- =============================================
-- RLS POLICIES - PROFILES
-- =============================================

CREATE POLICY "Usuários autenticados podem ver todos os perfis"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- RLS POLICIES - MESSAGES
-- =============================================

CREATE POLICY "Usuários podem ver mensagens do seu setor"
  ON public.messages FOR SELECT
  TO authenticated
  USING (sector_id = public.get_current_sector_id() OR public.has_autonomy_level('admin'));

CREATE POLICY "Usuários podem criar mensagens no seu setor"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = public.get_current_profile_id() AND
    sector_id = public.get_current_sector_id()
  );

CREATE POLICY "Usuários podem deletar próprias mensagens"
  ON public.messages FOR DELETE
  TO authenticated
  USING (author_id = public.get_current_profile_id() OR public.has_autonomy_level('admin'));

-- =============================================
-- RLS POLICIES - ANNOUNCEMENTS
-- =============================================

CREATE POLICY "Todos podem ver avisos"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gerentes e admins podem criar avisos"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = public.get_current_profile_id() AND
    public.has_autonomy_level('gerente')
  );

CREATE POLICY "Autores e admins podem atualizar avisos"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (author_id = public.get_current_profile_id() OR public.has_autonomy_level('admin'));

CREATE POLICY "Autores e admins podem deletar avisos"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (author_id = public.get_current_profile_id() OR public.has_autonomy_level('admin'));

-- =============================================
-- RLS POLICIES - ANNOUNCEMENT COMMENTS
-- =============================================

CREATE POLICY "Todos podem ver comentários"
  ON public.announcement_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem criar comentários"
  ON public.announcement_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = public.get_current_profile_id());

CREATE POLICY "Autores podem deletar próprios comentários"
  ON public.announcement_comments FOR DELETE
  TO authenticated
  USING (author_id = public.get_current_profile_id() OR public.has_autonomy_level('admin'));

-- =============================================
-- DADOS INICIAIS - SETORES
-- =============================================

INSERT INTO public.sectors (name, color, icon) VALUES
  ('Administrativo', '#3B82F6', 'building'),
  ('Comercial', '#10B981', 'trending-up'),
  ('Financeiro', '#F59E0B', 'dollar-sign'),
  ('RH', '#EC4899', 'users'),
  ('TI', '#8B5CF6', 'monitor'),
  ('Operacional', '#EF4444', 'settings');

-- =============================================
-- HABILITAR REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;