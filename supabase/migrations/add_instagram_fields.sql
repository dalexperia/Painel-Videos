/*
  # Add Instagram Fields to Settings
  1. New Columns in shorts_settings:
     - instagram_business_account_id (text)
     - facebook_page_id (text)
     - instagram_access_token (text)
     - instagram_username (text)
*/

ALTER TABLE shorts_settings 
ADD COLUMN IF NOT EXISTS instagram_business_account_id text,
ADD COLUMN IF NOT EXISTS facebook_page_id text,
ADD COLUMN IF NOT EXISTS instagram_access_token text,
ADD COLUMN IF NOT EXISTS instagram_username text;