/*
      # Fix RLS Policies for Dashboard Access

      1. Changes
        - Ensures `shorts_youtube` and `shorts_settings` are readable by ALL authenticated users.
        - Drops potentially conflicting restrictive policies.
        - Re-applies permissive SELECT policies.
    */

    -- 1. Tabela: shorts_youtube
    ALTER TABLE public.shorts_youtube ENABLE ROW LEVEL SECURITY;

    -- Remove políticas antigas que podem estar bloqueando
    DROP POLICY IF EXISTS "Todos veem videos" ON public.shorts_youtube;
    DROP POLICY IF EXISTS "Users can see all videos" ON public.shorts_youtube;
    DROP POLICY IF EXISTS "Select videos" ON public.shorts_youtube;

    -- Cria política permissiva para LEITURA
    CREATE POLICY "Todos veem videos"
    ON public.shorts_youtube
    FOR SELECT
    TO authenticated
    USING (true);

    -- 2. Tabela: shorts_settings
    ALTER TABLE public.shorts_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Todos leem configurações" ON public.shorts_settings;
    DROP POLICY IF EXISTS "Select settings" ON public.shorts_settings;

    CREATE POLICY "Todos leem configurações"
    ON public.shorts_settings
    FOR SELECT
    TO authenticated
    USING (true);
