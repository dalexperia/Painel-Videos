/*
  # Link shorts_youtube to shorts_settings

  1. Changes
    - Add unique constraint to `shorts_settings.channel` to allow it to be a foreign key target.
    - Add `channel` column to `shorts_youtube` if it doesn't exist.
    - Create Foreign Key relationship: `shorts_youtube.channel` -> `shorts_settings.channel`.
  
  2. Security
    - Maintains existing RLS.
    - Adds `ON UPDATE CASCADE` so renaming a channel in settings updates all videos.
    - Adds `ON DELETE SET NULL` so deleting a setting doesn't delete the video history, just unlinks it.
*/

DO $$
BEGIN
  -- 1. Ensure channel in settings is unique (if not already)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shorts_settings_channel_key'
  ) THEN
    ALTER TABLE shorts_settings ADD CONSTRAINT shorts_settings_channel_key UNIQUE (channel);
  END IF;

  -- 2. Ensure shorts_youtube has the channel column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shorts_youtube' AND column_name = 'channel'
  ) THEN
    ALTER TABLE shorts_youtube ADD COLUMN channel text;
  END IF;

  -- 3. Add the Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_shorts_youtube_channel'
  ) THEN
    ALTER TABLE shorts_youtube
    ADD CONSTRAINT fk_shorts_youtube_channel
    FOREIGN KEY (channel)
    REFERENCES shorts_settings (channel)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
  END IF;
END $$;