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
  is_partial?: boolean; // Novo campo para indicar conexão simplificada
}

// Busca as credenciais salvas no Supabase para um canal específico
export const getInstagramCredentials = async (channelName: string) => {
  const { data, error } = await supabase
    .from('shorts_settings')
    .select('instagram_business_account_id, instagram_access_token')
    .eq('channel', channelName)
    .single();

  if (error || !data) return null;
  return data;
};

// Busca o perfil do Instagram (Business)
export const fetchInstagramProfile = async (businessId: string, accessToken: string): Promise<InstagramProfile | null> => {
  try {
    // TENTATIVA 1: Busca Completa (Ideal)
    // Requer permissões: instagram_basic, pages_read_engagement
    // ATUALIZADO PARA v24.0 conforme alerta do n8n
    const url = `https://graph.facebook.com/v24.0/${businessId}?fields=name,username,profile_picture_url,followers_count,media_count&access_token=${accessToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      // TENTATIVA 2: "Modo n8n" (Fallback Simplificado)
      // Se a busca completa falhar (por permissão), tentamos apenas verificar se o ID existe com esse Token.
      // Isso valida a conexão sem exigir permissões de leitura de perfil.
      console.warn("Busca completa de perfil falhou. Tentando validação simples (ping)...");
      
      const simpleUrl = `https://graph.facebook.com/v24.0/${businessId}?fields=id&access_token=${accessToken}`;
      const simpleResponse = await fetch(simpleUrl);

      if (simpleResponse.ok) {
        // SUCESSO! O Token é válido para este ID.
        // Retornamos um perfil "fictício" apenas para o app saber que conectou.
        return {
          id: businessId,
          name: "Conexão Validada",
          username: "instagram_user", // Placeholder
          profile_picture_url: "",
          followers_count: 0,
          media_count: 0,
          is_partial: true
        };
      }

      // Se falhar até o simples, analisamos o erro da primeira tentativa (que é mais descritivo)
      const err = await response.json();
      
      // Tratamento para erro (#200) Provide valid app ID
      if (err.error?.code === 200) {
        throw new Error('Erro de Permissão (#200): O Facebook não autorizou este Token para este ID. Verifique se o ID está correto.');
      }

      // Tratamento específico para erro de App ID no Perfil
      if (err.error?.code === 100 && err.error?.message?.includes('node type (Application)')) {
        throw new Error('ID incorreto: Você inseriu o "App ID". É necessário o "Instagram Business ID".');
      }
      
      throw new Error(err.error?.message || 'Token inválido ou ID incorreto.');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro Instagram Profile:', error);
    throw error; // Repassa o erro para ser tratado na UI
  }
};

// Busca as mídias (Reels/Posts)
export const fetchInstagramMedia = async (businessId: string, accessToken: string, limit = 12): Promise<InstagramMedia[]> => {
  try {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
    // ATUALIZADO PARA v24.0
    const url = `https://graph.facebook.com/v24.0/${businessId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json();
      
      if (err.error?.code === 200) {
        throw new Error('Erro de Permissão (#200): Verifique a conexão da Página com o Instagram no Facebook Business Suite.');
      }

      if (err.error?.code === 100 && err.error?.message?.includes('node type (Application)')) {
        throw new Error('ID incorreto: O ID salvo é um "App ID". Use o botão "Detectar IDs".');
      }
      
      throw new Error(err.error?.message || 'Erro ao buscar mídia');
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Erro Instagram Media:', error);
    throw error;
  }
};

// Detecta automaticamente os IDs usando o Token
export const detectInstagramConfig = async (accessToken: string) => {
  try {
    // 1. Tenta assumir que é um Page Token
    // ATUALIZADO PARA v24.0
    const response = await fetch(`https://graph.facebook.com/v24.0/me?fields=id,name,instagram_business_account`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const errBody = await response.json();
      
      // Fallback: Tenta listar contas do usuário
      const userResponse = await fetch(`https://graph.facebook.com/v24.0/me/accounts?fields=id,name,instagram_business_account`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (userResponse.ok) {
        const data = await userResponse.json();
        const connectedPage = data.data?.find((p: any) => p.instagram_business_account);
        
        if (connectedPage) {
          return {
            pageId: connectedPage.id,
            instagramId: connectedPage.instagram_business_account.id,
            name: connectedPage.name,
            username: ''
          };
        }
        throw new Error('Nenhuma página com Instagram Business conectado foi encontrada neste token.');
      }
      
      throw new Error(errBody.error?.message || 'Token inválido.');
    }

    const data = await response.json();

    if (data.instagram_business_account) {
      return {
        pageId: data.id,
        instagramId: data.instagram_business_account.id,
        name: data.name,
        username: ''
      };
    } else {
      throw new Error(`A página "${data.name}" foi encontrada, mas NÃO tem Instagram vinculado.`);
    }

  } catch (error: any) {
    console.error('Erro na detecção:', error);
    throw new Error(error.message || 'Falha ao detectar configurações.');
  }
};
