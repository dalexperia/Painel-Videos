import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente do Supabase ausentes.');
  process.exit(1);
}

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
