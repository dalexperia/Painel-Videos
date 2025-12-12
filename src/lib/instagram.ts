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

// Versão estável da API do Graph
const API_VERSION = 'v21.0';

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
    const url = `https://graph.facebook.com/${API_VERSION}/${businessId}?fields=name,username,profile_picture_url,followers_count,media_count&access_token=${accessToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn("Busca completa de perfil falhou. Tentando validação simples (ping)...");
      
      const simpleUrl = `https://graph.facebook.com/${API_VERSION}/${businessId}?fields=id&access_token=${accessToken}`;
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
      if (err.error?.code === 200) throw new Error('Erro de Permissão (#200): Token não autorizado para este ID.');
      if (err.error?.code === 100 && err.error?.message?.includes('node type (Application)')) throw new Error('ID incorreto: Use o "Instagram Business ID", não o App ID.');
      
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
    const url = `https://graph.facebook.com/${API_VERSION}/${businessId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json();
      if (err.error?.code === 200) throw new Error('Erro de Permissão (#200): Verifique a conexão da Página com o Instagram.');
      throw new Error(err.error?.message || 'Erro ao buscar mídia');
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Erro Instagram Media:', error);
    throw error;
  }
};

// Detecta automaticamente os IDs usando o Token (Suporta User Token e Page Token)
export const detectInstagramConfig = async (accessToken: string) => {
  try {
    // 1. Teste básico de validade do token
    const meResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/me?fields=id,name`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!meResponse.ok) {
      const err = await meResponse.json();
      throw new Error(err.error?.message || 'Token inválido ou expirado.');
    }

    // 2. Tenta fluxo de USUÁRIO (listar páginas/contas vinculadas)
    const accountsResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/me/accounts?fields=id,name,instagram_business_account`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (accountsResponse.ok) {
      // É um Token de Usuário
      const data = await accountsResponse.json();
      const connectedPage = data.data?.find((p: any) => p.instagram_business_account);
      
      if (connectedPage) {
        return {
          pageId: connectedPage.id,
          instagramId: connectedPage.instagram_business_account.id,
          name: connectedPage.name,
          username: ''
        };
      }
      throw new Error('Nenhuma página com Instagram Business conectado foi encontrada neste perfil.');
    } else {
      // 3. Se falhou, verificamos se é porque é um Token de PÁGINA
      const err = await accountsResponse.json();
      
      // Erro (#100) ... node type (Page) confirma que é uma página
      if (err.error?.message?.includes('Page') || err.error?.type === 'OAuthException') {
        
        // Tenta fluxo de PÁGINA (ler o próprio instagram_business_account)
        const pageResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/me?fields=id,name,instagram_business_account`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          if (pageData.instagram_business_account) {
            return {
              pageId: pageData.id,
              instagramId: pageData.instagram_business_account.id,
              name: pageData.name,
              username: ''
            };
          }
          throw new Error(`A página "${pageData.name}" foi detectada, mas NÃO tem conta do Instagram vinculada.`);
        }
      }
      
      throw new Error(err.error?.message || 'Falha ao detectar configurações.');
    }

  } catch (error: any) {
    console.error('Erro na detecção:', error);
    throw new Error(error.message || 'Falha ao detectar configurações.');
  }
};

// Função de Publicação (Restaurada)
export const publishToInstagram = async (
  businessId: string, 
  accessToken: string, 
  media: { 
    type: 'IMAGE' | 'REELS' | 'STORIES', 
    imageUrl?: string, 
    videoUrl?: string, 
    caption?: string 
  }
) => {
  try {
    // 1. Criar Container de Mídia
    const containerUrl = `https://graph.facebook.com/${API_VERSION}/${businessId}/media`;
    
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    if (media.type === 'IMAGE') {
      if (!media.imageUrl) throw new Error('URL da imagem é obrigatória');
      params.append('image_url', media.imageUrl);
      if (media.caption) params.append('caption', media.caption);
    } else if (media.type === 'REELS') {
      if (!media.videoUrl) throw new Error('URL do vídeo é obrigatória');
      params.append('media_type', 'REELS');
      params.append('video_url', media.videoUrl);
      if (media.caption) params.append('caption', media.caption);
    } else if (media.type === 'STORIES') {
      if (media.imageUrl) {
        params.append('image_url', media.imageUrl);
        params.append('media_type', 'STORIES');
      } else if (media.videoUrl) {
        params.append('video_url', media.videoUrl);
        params.append('media_type', 'STORIES');
      } else {
        throw new Error('URL da mídia é obrigatória para Stories');
      }
    }

    const containerResponse = await fetch(`${containerUrl}?${params.toString()}`, {
      method: 'POST'
    });

    if (!containerResponse.ok) {
      const errorData = await containerResponse.json();
      throw new Error(errorData.error?.message || 'Erro ao criar container de mídia');
    }

    const containerData = await containerResponse.json();
    const creationId = containerData.id;

    // 2. Aguardar processamento (apenas para vídeos)
    if (media.type === 'REELS' || (media.type === 'STORIES' && media.videoUrl)) {
      let status = 'IN_PROGRESS';
      let attempts = 0;
      while (status !== 'FINISHED' && attempts < 10) {
        await new Promise(r => setTimeout(r, 3000)); // Espera 3s
        const statusUrl = `https://graph.facebook.com/${API_VERSION}/${creationId}?fields=status_code&access_token=${accessToken}`;
        const statusRes = await fetch(statusUrl);
        const statusData = await statusRes.json();
        status = statusData.status_code;
        
        if (status === 'ERROR') throw new Error('Erro no processamento do vídeo pelo Instagram');
        attempts++;
      }
    }

    // 3. Publicar Container
    const publishUrl = `https://graph.facebook.com/${API_VERSION}/${businessId}/media_publish`;
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken
    });

    const publishResponse = await fetch(`${publishUrl}?${publishParams.toString()}`, {
      method: 'POST'
    });

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json();
      throw new Error(errorData.error?.message || 'Erro ao publicar mídia');
    }

    return await publishResponse.json();

  } catch (error) {
    console.error('Erro ao publicar no Instagram:', error);
    throw error;
  }
};
