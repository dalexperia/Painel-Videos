/*
  # Add Instagram Settings to shorts_settings
  
  1. New Columns:
    - instagram_business_account_id: ID da conta Business do Instagram (ex: 17841400000000000)
    - facebook_page_id: ID da página do Facebook vinculada (ex: 100000000000000)
    - instagram_access_token: Token de longa duração da Graph API
    - instagram_token_expires_at: Data de expiração do token para avisar quando renovar
    - instagram_username: Nome de usuário (arroba) para exibição visual
*/

ALTER TABLE shorts_settings
ADD COLUMN IF NOT EXISTS instagram_business_account_id text,
ADD COLUMN IF NOT EXISTS facebook_page_id text,
ADD COLUMN IF NOT EXISTS instagram_access_token text,
ADD COLUMN IF NOT EXISTS instagram_token_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS instagram_username text;