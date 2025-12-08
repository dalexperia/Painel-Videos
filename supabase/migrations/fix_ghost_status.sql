/*
  # Corrigir Status de Vídeos Fantasmas

  Este script corrige vídeos que possuem uma data de publicação definida (`publish_at`)
  mas ainda estão com status 'Created' ou 'Processing'.
  
  Isso resolve o problema de vídeos que foram agendados/postados mas permaneceram
  na aba "Recentes" devido a erros de timeout na resposta da API.
*/

UPDATE shorts_youtube
SET status = 'Posted'
WHERE publish_at IS NOT NULL 
  AND publish_at != ''
  AND status != 'Posted'
  AND failed = false;