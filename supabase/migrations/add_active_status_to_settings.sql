/*
      # Add Active Status to Settings

      This migration adds an `is_active` column to the `shorts_settings` table to manage which channel is currently active for posting. It also sets 'apostila' as the default active channel if it exists.

      1. Changes
        - Adds `is_active` (boolean, default false) to `shorts_settings`.
        - Creates a unique partial index to ensure only one channel can be active at a time.

      2. New Functions
        - `set_active_channel(channel_id uuid)`: A new RPC function to safely set a channel as active. It deactivates all other channels before activating the specified one, ensuring atomicity.
    */

    -- 1. Add the is_active column
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shorts_settings' AND column_name = 'is_active'
      ) THEN
        ALTER TABLE shorts_settings ADD COLUMN is_active BOOLEAN DEFAULT false;
      END IF;
    END $$;

    -- 2. Create a unique index to enforce only one active channel
    DROP INDEX IF EXISTS one_active_channel_idx;
    CREATE UNIQUE INDEX one_active_channel_idx ON shorts_settings (is_active) WHERE is_active = true;

    -- 3. Create the RPC function to set the active channel
    CREATE OR REPLACE FUNCTION set_active_channel(channel_id uuid)
    RETURNS void AS $$
    BEGIN
      -- Deactivate all other channels first
      UPDATE shorts_settings
      SET is_active = false
      WHERE is_active = true;

      -- Activate the selected channel
      UPDATE shorts_settings
      SET is_active = true
      WHERE id = channel_id;
    END;
    $$ LANGUAGE plpgsql;

    -- 4. Set 'apostila' as active if it exists and no other channel is active
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM shorts_settings WHERE channel = 'apostila') AND NOT EXISTS (SELECT 1 FROM shorts_settings WHERE is_active = true) THEN
        UPDATE shorts_settings SET is_active = true WHERE channel = 'apostila';
      END IF;
    END $$;
