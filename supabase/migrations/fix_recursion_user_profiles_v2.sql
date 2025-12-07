/*
      # Fix Infinite Recursion in user_profiles (Corrected)

      1. Changes
        - Creates a SECURITY DEFINER function `is_admin()` to safely check roles without triggering RLS loops.
        - Explicitly DROPS ALL existing policies on `user_profiles` to avoid "policy already exists" errors.
        - Recreates safe policies using the new function.
    */

    -- 1. Criar função segura para verificar se é admin (quebra a recursão)
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER -- Roda com permissões do criador, ignorando RLS
    SET search_path = public
    AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1
        FROM user_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      );
    END;
    $$;

    -- 2. Limpar TODAS as políticas antigas para evitar conflitos
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.user_profiles;
    DROP POLICY IF EXISTS "Select users" ON public.user_profiles;
    DROP POLICY IF EXISTS "Read access" ON public.user_profiles;
    -- A política que causou o erro anterior:
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

    -- 3. Criar Novas Políticas Seguras

    -- Política A: O usuário sempre pode ler seu próprio perfil
    CREATE POLICY "Users can read own profile"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

    -- Política B: Admins podem ler todos os perfis (Usa a função segura is_admin)
    CREATE POLICY "Admins can read all profiles"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (is_admin());

    -- Política C: Admins podem editar perfis (Usa a função segura is_admin)
    CREATE POLICY "Admins can update all profiles"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (is_admin());

    -- Política D: Permitir INSERT
    CREATE POLICY "Users can insert own profile"
    ON public.user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
