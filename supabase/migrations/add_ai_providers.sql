/*
  # Adicionar suporte a múltiplos provedores de IA
  1. Alterações na tabela `shorts_settings`:
     - `ai_provider`: Define qual IA usar ('gemini', 'groq', 'ollama'). Padrão: 'gemini'.
     - `groq_key`: Chave de API para Groq.
     - `ollama_url`: URL para instância local do Ollama (ex: http://localhost:11434).
     - `ai_model`: Modelo específico (opcional, ex: 'llama3-70b-8192').
*/

ALTER TABLE shorts_settings 
ADD COLUMN IF NOT EXISTS ai_provider text DEFAULT 'gemini',
ADD COLUMN IF NOT EXISTS groq_key text,
ADD COLUMN IF NOT EXISTS ollama_url text DEFAULT 'http://localhost:11434',
ADD COLUMN IF NOT EXISTS ai_model text;