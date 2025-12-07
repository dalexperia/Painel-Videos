/**
 * Serviço para interação com a YouTube Data API v3
 */

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeStats {
  viewCount: string;
  likeCount: string;
  commentCount: string;
}

export interface YouTubeVideoDetails {
  id: string;
  publishedAt: string; // Data real de publicação
  privacyStatus: 'public' | 'private' | 'unlisted';
  uploadStatus: string;
}

/**
 * Busca estatísticas para uma lista de IDs usando uma API Key específica.
 */
export const fetchYouTubeStats = async (videoIds: string[], apiKey: string): Promise<Record<string, YouTubeStats>> => {
  if (!apiKey || videoIds.length === 0) {
    return {};
  }

  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const allStats: Record<string, YouTubeStats> = {};

  try {
    for (const chunk of chunks) {
      const idsParam = chunk.join(',');
      const url = `${BASE_URL}/videos?part=statistics&id=${idsParam}&key=${apiKey}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Erro na API do YouTube (${response.status}): ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      if (data.items) {
        data.items.forEach((item: any) => {
          allStats[item.id] = {
            viewCount: item.statistics.viewCount || '0',
            likeCount: item.statistics.likeCount || '0',
            commentCount: item.statistics.commentCount || '0',
          };
        });
      }
    }
  } catch (error) {
    console.error('Erro ao buscar estatísticas do YouTube:', error);
  }

  return allStats;
};

/**
 * Busca detalhes de publicação (Data e Status) para sincronização.
 * Nota: Com API Key pública, só retorna vídeos Públicos ou Não Listados.
 */
export const fetchVideoDetails = async (videoIds: string[], apiKey: string): Promise<Record<string, YouTubeVideoDetails>> => {
  if (!apiKey || videoIds.length === 0) {
    return {};
  }

  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const allDetails: Record<string, YouTubeVideoDetails> = {};

  try {
    for (const chunk of chunks) {
      const idsParam = chunk.join(',');
      // Buscamos 'snippet' para a data e 'status' para a privacidade
      const url = `${BASE_URL}/videos?part=snippet,status&id=${idsParam}&key=${apiKey}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Erro na API do YouTube (${response.status}): ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      if (data.items) {
        data.items.forEach((item: any) => {
          allDetails[item.id] = {
            id: item.id,
            publishedAt: item.snippet.publishedAt,
            privacyStatus: item.status.privacyStatus,
            uploadStatus: item.status.uploadStatus
          };
        });
      }
    }
  } catch (error) {
    console.error('Erro ao buscar detalhes do YouTube:', error);
  }

  return allDetails;
};

export const formatNumber = (numStr: string | undefined): string => {
  if (!numStr) return '0';
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return '0';

  return new Intl.NumberFormat('pt-BR', {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  }).format(num);
};
