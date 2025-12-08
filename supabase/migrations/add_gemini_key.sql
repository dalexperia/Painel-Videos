/*
  # Add Gemini API Key to Settings
  1. Changes: Add `gemini_key` column to `shorts_settings` table.
*/
ALTER TABLE shorts_settings ADD COLUMN IF NOT EXISTS gemini_key text;