/*
  # Corrigir Status de Vídeos Fantasmas (Correção v2)

  Este script corrige vídeos que possuem uma data de publicação definida (`publish_at`)
  mas ainda estão com status 'Created' ou 'Processing'.
  
  Correção: Removida a comparação inválida com string vazia para o campo timestamp.
*/

UPDATE shorts_youtube
SET status = 'Posted'
WHERE publish_at IS NOT NULL 
  AND status != 'Posted'
  AND failed = false;