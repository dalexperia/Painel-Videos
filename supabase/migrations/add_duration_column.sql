/*
  # Add duration column to shorts_youtube

  1. Changes
    - Add `duration` column (text) to `shorts_youtube` table to store video duration (e.g., "PT1M").
    - Add `title` column (text) if it doesn't exist, ensuring metadata sync works correctly.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shorts_youtube' AND column_name = 'duration'
  ) THEN
    ALTER TABLE shorts_youtube ADD COLUMN duration text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shorts_youtube' AND column_name = 'title'
  ) THEN
    ALTER TABLE shorts_youtube ADD COLUMN title text;
  END IF;
END $$;