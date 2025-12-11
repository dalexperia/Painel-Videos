/*
  # Add YouTube Channel ID for Safety Check
  1. Changes: Adds `youtube_channel_id` column to `shorts_settings`.
  2. Purpose: Stores the specific YouTube Channel ID (e.g., UC123...) to validate uploads before sending.
*/

ALTER TABLE shorts_settings 
ADD COLUMN IF NOT EXISTS youtube_channel_id text;