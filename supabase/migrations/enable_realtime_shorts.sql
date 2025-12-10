/*
  # Enable Realtime for shorts_youtube
  1. Publication: Add shorts_youtube table to supabase_realtime publication
     This allows the frontend to subscribe to INSERT/UPDATE/DELETE events.
*/

-- Verifica se a publicação existe e adiciona a tabela, caso contrário cria
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'shorts_youtube') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shorts_youtube;
  END IF;
END
$$;