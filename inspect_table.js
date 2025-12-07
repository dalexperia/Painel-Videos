import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ppypqfqgmlzicgblqnkz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBweXBxZnFnbWx6aWNnYmxxbmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDY4MzAsImV4cCI6MjA2ODEyMjgzMH0.f2VgOW0kZydkMuevZVMr0QnvheLvlL91CdB2m8P5TdA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Buscando estrutura da tabela shorts_youtube...');
  
  const { data, error } = await supabase
    .from('shorts_youtube')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro ao buscar:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Colunas encontradas:', Object.keys(data[0]));
    console.log('Exemplo de linha:', data[0]);
  } else {
    console.log('Tabela vazia ou sem acesso.');
  }
}

inspect();
