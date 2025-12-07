/*
  # Adicionar coluna de API Key do YouTube

  1. Alterações
    - Adiciona a coluna `youtube_api_key` (text) na tabela `shorts_settings`.
    - A coluna pode ser nula (nullable), pois nem todo canal pode ter uma chave configurada inicialmente.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shorts_settings' AND column_name = 'youtube_api_key'
  ) THEN
    ALTER TABLE shorts_settings ADD COLUMN youtube_api_key text;
  END IF;
END $$;
