/*
      # Create shorts_settings table

      This migration creates the `shorts_settings` table to store channel-specific webhooks.

      1. New Tables
        - `shorts_settings`
          - `id` (uuid, primary key): Unique identifier for each setting.
          - `channel` (text, unique, not null): The name of the channel (e.g., 'Default', 'Tech Channel').
          - `webhook` (text, not null): The webhook URL for the channel.
          - `created_at` (timestamptz): Timestamp of creation.

      2. Security
        - Enable RLS on `shorts_settings` table.
        - Add policies for authenticated users to perform CRUD operations.
    */

    CREATE TABLE IF NOT EXISTS shorts_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      channel TEXT UNIQUE NOT NULL,
      webhook TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE shorts_settings ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Allow authenticated users to read settings"
      ON shorts_settings
      FOR SELECT
      TO authenticated
      USING (true);

    CREATE POLICY "Allow authenticated users to insert settings"
      ON shorts_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (true);

    CREATE POLICY "Allow authenticated users to update settings"
      ON shorts_settings
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "Allow authenticated users to delete settings"
      ON shorts_settings
      FOR DELETE
      TO authenticated
      USING (true);
