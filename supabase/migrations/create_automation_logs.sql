/*
  # Create Automation Logs System
  
  1. New Table: `automation_logs`
     - `id`: UUID (Primary Key)
     - `source`: Origem do erro (ex: 'n8n - Workflow X')
     - `level`: Nível ('info', 'warning', 'error', 'critical')
     - `message`: Mensagem descritiva do erro
     - `execution_id`: ID da execução no n8n (para link direto)
     - `payload`: JSONB com dados de contexto
     - `resolved`: Boolean (para controle de leitura)
     - `created_at`: Timestamp

  2. Security (RLS):
     - Enable RLS
     - Policies for Select, Insert, and Update for authenticated users

  3. Realtime:
     - Add table to `supabase_realtime` publication
*/

CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  level text NOT NULL DEFAULT 'error',
  message text,
  execution_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
-- 1. Leitura: Permitir que usuários autenticados vejam os logs
CREATE POLICY "Authenticated users can view logs"
  ON automation_logs FOR SELECT
  TO authenticated
  USING (true);

-- 2. Inserção: Permitir que usuários autenticados (ou Service Role do n8n) criem logs
CREATE POLICY "Authenticated users can insert logs"
  ON automation_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Atualização: Permitir marcar como resolvido
CREATE POLICY "Authenticated users can update logs"
  ON automation_logs FOR UPDATE
  TO authenticated
  USING (true);

-- Habilitar Realtime para esta tabela
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'automation_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE automation_logs;
  END IF;
END
$$;
