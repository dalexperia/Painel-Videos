/*
  # Adicionar suporte a API Key para Ollama
  1. Alterações na tabela `shorts_settings`:
     - `ollama_key`: Chave de API opcional para autenticação em servidores Ollama remotos.
*/

ALTER TABLE shorts_settings 
ADD COLUMN IF NOT EXISTS ollama_key text;
