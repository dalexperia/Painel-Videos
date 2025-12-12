import { supabase } from './supabaseClient';

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramProfile {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string;
  followers_count: number;
  media_count: number;
  is_partial?: boolean;
}

// --- FUNÇÕES DE LEITURA (JÁ EXISTENTES) ---

export const getInstagramCredentials = async (channelName: string) => {
  const { data, error } = await supabase
    .from('shorts_settings')
    .select('instagram_business_account_id, instagram_access_token')
    .eq('channel', channelName)
    .single();

  if (error || !data) return null;
  return data;
};

export const fetchInstagramProfile = async (businessId: string, accessToken: string): Promise<InstagramProfile | null> => {
  try {
    const url = `https://graph.facebook.com/v24.0/${businessId}?fields=name,username,profile_picture_url,followers_count,media_count&access_token=${accessToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn("Busca completa de perfil falhou. Tentando validação simples...");
      const simpleUrl = `https://graph.facebook.com/v24.0/${businessId}?fields=id&access_token=${accessToken}`;
      const simpleResponse = await fetch(simpleUrl);

      if (simpleResponse.ok) {
        return {
          id: businessId,
          name: "Conexão Validada",
          username: "instagram_user",
          profile_picture_url: "",
          followers_count: 0,
          media_count: 0,
          is_partial: true
        };
      }
      const err = await response.json();
      throw new Error(err.error?.message || 'Token inválido ou ID incorreto.');
    }
    return await response.json();
  } catch (error) {
    console.error('Erro Instagram Profile:', error);
    throw error;
  }
};

export const fetchInstagramMedia = async (businessId: string, accessToken: string, limit = 12): Promise<InstagramMedia[]> => {
  try {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
    const url = `https://graph.facebook.com/v24.0/${businessId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erro ao buscar mídia');
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Erro Instagram Media:', error);
    throw error;
  }
};

// --- NOVAS FUNÇÕES DE POSTAGEM ---

interface PublishOptions {
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  type: 'IMAGE' | 'REELS' | 'STORIES';
  coverUrl?: string; // Para capa de Reels (opcional)
}

/**
 * Publica mídia no Instagram em 2 passos:
 * 1. Cria o Container de Mídia
 * 2. Publica o Container
 */
export const publishToInstagram = async (
  businessId: string, 
  accessToken: string, 
  options: PublishOptions
) => {
  try {
    let containerId = '';

    // PASSO 1: Criar Container
    const params = new URLSearchParams();
    params.append('access_token', accessToken);
    
    if (options.caption && options.type !== 'STORIES') {
      params.append('caption', options.caption);
    }

    let endpoint = `https://graph.facebook.com/v24.0/${businessId}/media`;

    if (options.type === 'IMAGE') {
      if (!options.imageUrl) throw new Error('URL da imagem é obrigatória para posts de foto.');
      params.append('image_url', options.imageUrl);
    
    } else if (options.type === 'REELS') {
      if (!options.videoUrl) throw new Error('URL do vídeo é obrigatória para Reels.');
      params.append('media_type', 'REELS');
      params.append('video_url', options.videoUrl);
      if (options.coverUrl) params.append('cover_url', options.coverUrl);
    
    } else if (options.type === 'STORIES') {
      // Stories podem ser imagem ou vídeo
      params.append('media_type', 'STORIES');
      if (options.videoUrl) {
        params.append('video_url', options.videoUrl);
      } else if (options.imageUrl) {
        params.append('image_url', options.imageUrl);
      } else {
        throw new Error('URL de imagem ou vídeo é obrigatória para Stories.');
      }
    }

    console.log(`[Instagram] Criando container (${options.type})...`);
    const createRes = await fetch(`${endpoint}?${params.toString()}`, { method: 'POST' });
    const createData = await createRes.json();

    if (!createRes.ok) {
      throw new Error(`Erro ao criar container: ${createData.error?.message || 'Erro desconhecido'}`);
    }

    containerId = createData.id;
    console.log(`[Instagram] Container criado: ${containerId}`);

    // PASSO 1.5: Aguardar processamento (apenas para Vídeos/Reels)
    if (options.type === 'REELS' || (options.type === 'STORIES' && options.videoUrl)) {
      console.log('[Instagram] Aguardando processamento do vídeo...');
      await waitForMediaProcessing(containerId, accessToken);
    }

    // PASSO 2: Publicar Container
    console.log('[Instagram] Publicando container...');
    const publishParams = new URLSearchParams();
    publishParams.append('creation_id', containerId);
    publishParams.append('access_token', accessToken);

    const publishRes = await fetch(`https://graph.facebook.com/v24.0/${businessId}/media_publish?${publishParams.toString()}`, { method: 'POST' });
    const publishData = await publishRes.json();

    if (!publishRes.ok) {
      throw new Error(`Erro ao publicar: ${publishData.error?.message || 'Erro desconhecido'}`);
    }

    return publishData.id; // ID da publicação final

  } catch (error) {
    console.error('Erro na publicação Instagram:', error);
    throw error;
  }
};

// Função auxiliar para verificar status do processamento de vídeo
async function waitForMediaProcessing(containerId: string, accessToken: string, maxAttempts = 10) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const res = await fetch(
      `https://graph.facebook.com/v24.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    const data = await res.json();

    if (data.status_code === 'FINISHED') {
      return true;
    }
    
    if (data.status_code === 'ERROR') {
      throw new Error(`Erro no processamento do vídeo pelo Instagram: ${data.status}`);
    }

    // Espera 3 segundos antes de tentar de novo
    await new Promise(resolve => setTimeout(resolve, 3000));
    attempts++;
  }
  
  throw new Error('Tempo limite excedido aguardando processamento do vídeo.');
}
