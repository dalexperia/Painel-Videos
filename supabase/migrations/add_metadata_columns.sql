/*
  # Adicionar colunas de metadados do YouTube

  1. Novas Colunas
    - `duration` (text): Para armazenar a duração do vídeo (ex: "PT1M").
    - `title` (text): Para garantir que o título esteja sincronizado.
  
  2. Segurança
    - Usa IF NOT EXISTS para evitar erros se já tiverem sido criadas manualmente.
*/

DO $$
BEGIN
  -- Adiciona coluna duration se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shorts_youtube' AND column_name = 'duration'
  ) THEN
    ALTER TABLE shorts_youtube ADD COLUMN duration text;
  END IF;

  -- Adiciona coluna title se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shorts_youtube' AND column_name = 'title'
  ) THEN
    ALTER TABLE shorts_youtube ADD COLUMN title text;
  END IF;
END $$;