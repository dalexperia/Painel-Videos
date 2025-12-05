/*
  # Grant Full Table Access for shorts_apostilas

  This migration configures the security policies for the `shorts_apostilas` table to allow the application to manage video content.

  1. Security Changes
    - **Enable Row Level Security (RLS)**: Ensures that all data access must be explicitly granted by a policy. This is a security best practice.
    - **Create Access Policy**: A new policy named "Enable all actions for anonymous users on shorts_apostilas" is created. This policy grants full permissions (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) to the `anon` role, which is used by the application's frontend client. This is necessary for the gallery, reprove, restore, and delete functionalities to work correctly.
*/

-- Enable Row Level Security on the table. This is a prerequisite for policies to take effect.
-- It's safe to run this command even if RLS is already enabled.
ALTER TABLE public.shorts_apostilas ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations for the anonymous role.
-- The `IF NOT EXISTS` block prevents errors if the policy has already been created.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE
      polname = 'Enable all actions for anonymous users on shorts_apostilas' AND
      polrelid = 'public.shorts_apostilas'::regclass
  ) THEN
    CREATE POLICY "Enable all actions for anonymous users on shorts_apostilas"
    ON public.shorts_apostilas
    FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
    TO anon  -- The role used by the Supabase JS client with the anon key
    USING (true) -- The policy applies to all rows for existing row access checks (SELECT, UPDATE, DELETE)
    WITH CHECK (true); -- The policy applies to all rows for new row creation/modification checks (INSERT, UPDATE)
  END IF;
END $$;