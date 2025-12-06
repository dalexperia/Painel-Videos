/*
  # Rename Table to shorts_youtube

  This migration renames the `shorts_apostilas` table to `shorts_youtube` to better align with its purpose of managing YouTube shorts. It also updates the associated Row Level Security (RLS) policy.

  1. Table Rename
    - The table `public.shorts_apostilas` is renamed to `public.shorts_youtube`.

  2. Security Changes
    - The RLS policy "Enable all actions for anonymous users on shorts_apostilas" is renamed to "Enable all actions for anonymous users on shorts_youtube" to maintain consistency.
*/

-- Rename the table from shorts_apostilas to shorts_youtube.
ALTER TABLE IF EXISTS public.shorts_apostilas RENAME TO shorts_youtube;

-- Rename the existing policy to match the new table name.
-- The policy is carried over with the table rename, so we just need to rename it.
-- The DO block ensures this runs safely and only if the old policy name exists on the new table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE
      polname = 'Enable all actions for anonymous users on shorts_apostilas' AND
      polrelid = 'public.shorts_youtube'::regclass
  ) THEN
    ALTER POLICY "Enable all actions for anonymous users on shorts_apostilas" ON public.shorts_youtube
    RENAME TO "Enable all actions for anonymous users on shorts_youtube";
  END IF;
END $$;
