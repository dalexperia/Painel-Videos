/*
      # Update RLS Policies for shorts_settings

      This migration updates the Row Level Security (RLS) policies for the `shorts_settings` table to allow public read access. This change enables the application to display settings data to all users, including those who are not authenticated.

      1. Security Changes
        - The existing policy for `SELECT` operations, which was restricted to authenticated users, is removed.
        - A new policy is created to allow `SELECT` operations for the `public` role.
        - Policies for `INSERT`, `UPDATE`, and `DELETE` remain restricted to authenticated users, ensuring that only logged-in users can modify the settings.
    */

    DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON shorts_settings;

    CREATE POLICY "Allow public read access to settings"
      ON shorts_settings
      FOR SELECT
      TO public
      USING (true);
