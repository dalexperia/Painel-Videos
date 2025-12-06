/*
      # Update RLS Write Policies for shorts_settings

      This migration updates the Row Level Security (RLS) policies for the `shorts_settings` table to allow public write access (INSERT, UPDATE, DELETE). This change allows the application to function without requiring user authentication for these operations.

      1. Security Changes
        - The existing policies for `INSERT`, `UPDATE`, and `DELETE` operations, which were restricted to authenticated users, are removed.
        - New policies are created to allow these operations for the `public` role, enabling anonymous users to manage settings.
    */

    -- Drop existing policies for authenticated users
    DROP POLICY IF EXISTS "Allow authenticated users to insert settings" ON shorts_settings;
    DROP POLICY IF EXISTS "Allow authenticated users to update settings" ON shorts_settings;
    DROP POLICY IF EXISTS "Allow authenticated users to delete settings" ON shorts_settings;

    -- Create new policies for public access
    CREATE POLICY "Allow public insert access to settings"
      ON shorts_settings
      FOR INSERT
      TO public
      WITH CHECK (true);

    CREATE POLICY "Allow public update access to settings"
      ON shorts_settings
      FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "Allow public delete access to settings"
      ON shorts_settings
      FOR DELETE
      TO public
      USING (true);
