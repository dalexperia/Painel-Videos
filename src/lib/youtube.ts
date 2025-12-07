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
  title: string;
  duration: string; // Formatada ou ISO
  publishedAt: string; // Data real de publicação
  privacyStatus: 'public' | 'private' | 'unlisted';
  uploadStatus: string;
}

/**
 * Converte duração ISO 8601 (PT1M30S) para formato legível (01:30)
 */
const parseISODuration = (isoDuration: string): string => {
  if (!isoDuration) return '00:00';
  
  const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return '00:00';

  const hours = parseInt((match[1] || '').replace('H', '')) || 0;
  const minutes = parseInt((match[2] || '').replace('M', '')) || 0;
  const seconds = parseInt((match[3] || '').replace('S', '')) || 0;

  let result = '';
  
  if (hours > 0) {
    result += `${hours}:`;
    result += `${minutes.toString().padStart(2, '0')}:`;
  } else {
    result += `${minutes}:`; // Sem zero à esquerda se for só minutos, ex: 1:30
  }
  
  result += seconds.toString().padStart(2, '0');
  
  // Garante pelo menos formato M:SS (ex: 0:15)
  if (!hours && !minutes) {
    return `0:${seconds.toString().padStart(2, '0')}`;
  }

  return result;
};

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
 * Busca detalhes completos (Título, Duração, Status) para sincronização.
 */
export const fetchVideoDetails = async (videoIds: string[], apiKey: string): Promise<Record<string, YouTubeVideoDetails>> => {
  if (!apiKey || videoIds.length === 0) {
    return {};
  }

  // Garante que videoIds é um array
  const idsArray = Array.isArray(videoIds) ? videoIds : [videoIds];

  const chunks = [];
  for (let i = 0; i < idsArray.length; i += 50) {
    chunks.push(idsArray.slice(i, i + 50));
  }

  const allDetails: Record<string, YouTubeVideoDetails> = {};

  try {
    for (const chunk of chunks) {
      const idsParam = chunk.join(',');
      // Adicionado 'snippet' para título e 'contentDetails' para duração
      const url = `${BASE_URL}/videos?part=snippet,contentDetails,status&id=${idsParam}&key=${apiKey}`;

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
            title: item.snippet.title,
            duration: parseISODuration(item.contentDetails.duration),
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
