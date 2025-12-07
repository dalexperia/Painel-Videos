/*
  # Sistema de Permissões e Perfis de Usuário

  1. Novas Tabelas
    - `user_profiles`
      - `id` (uuid, PK, ref auth.users)
      - `email` (text)
      - `role` (text: 'admin', 'editor', 'viewer')
      - `created_at`

  2. Security (RLS)
    - Habilitar RLS em `user_profiles`
    - Atualizar RLS em `shorts_settings` e `shorts_youtube`

  3. Automação
    - Trigger para criar perfil automaticamente ao criar usuário
    - Regra para definir Admins baseada em lista de e-mails hardcoded
*/

-- 1. Criar tabela de perfis
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (
    new.id,
    new.email,
    CASE
      -- Lista de Super Admins
      WHEN new.email IN ('dalexperia@gmail.com', 'machobigalfa@gmail.com', 'dalex2307@gmail.com') THEN 'admin'
      ELSE 'viewer'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Políticas de Segurança (RLS)

-- Tabela: user_profiles
-- Todos podem ler perfis (necessário para listar usuários na admin)
CREATE POLICY "Todos podem ver perfis básicos"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Apenas Admins podem atualizar roles
CREATE POLICY "Apenas admins alteram roles"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tabela: shorts_settings (Canais)
ALTER TABLE public.shorts_settings ENABLE ROW LEVEL SECURITY;

-- Leitura: Todos autenticados
CREATE POLICY "Todos leem configurações"
  ON public.shorts_settings FOR SELECT
  TO authenticated
  USING (true);

-- Escrita (Insert/Update/Delete): Apenas Admins
CREATE POLICY "Apenas admins gerenciam canais"
  ON public.shorts_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tabela: shorts_youtube (Vídeos)
ALTER TABLE public.shorts_youtube ENABLE ROW LEVEL SECURITY;

-- Leitura: Todos autenticados
CREATE POLICY "Todos veem videos"
  ON public.shorts_youtube FOR SELECT
  TO authenticated
  USING (true);

-- Update: Admins e Editores
CREATE POLICY "Admins e Editores atualizam videos"
  ON public.shorts_youtube FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- Insert/Delete: Apenas Admins (para evitar exclusão acidental de histórico)
CREATE POLICY "Apenas admins criam ou deletam videos"
  ON public.shorts_youtube FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Backfill (Garantir que usuários existentes tenham perfil)
INSERT INTO public.user_profiles (id, email, role)
SELECT 
  id, 
  email,
  CASE
    WHEN email IN ('dalexperia@gmail.com', 'machobigalfa@gmail.com', 'dalex2307@gmail.com') THEN 'admin'
    ELSE 'viewer'
  END
FROM auth.users
ON CONFLICT (id) DO NOTHING;
