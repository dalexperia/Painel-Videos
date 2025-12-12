/*
  # Create n8n Webhooks Table
  1. New Table: n8n_webhooks (id, name, url, created_at)
  2. Security: Enable RLS, allow authenticated users to read/write
*/

CREATE TABLE IF NOT EXISTS n8n_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE n8n_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage webhooks" 
ON n8n_webhooks 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);