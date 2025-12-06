/**
 * Serviço para interação com a YouTube Data API v3
 */

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeStats {
  viewCount: string;
  likeCount: string;
  commentCount: string;
}

/**
 * Busca estatísticas para uma lista de IDs usando uma API Key específica.
 * @param videoIds Array de IDs de vídeo do YouTube
 * @param apiKey Chave de API do YouTube (específica do canal)
 */
export const fetchYouTubeStats = async (videoIds: string[], apiKey: string): Promise<Record<string, YouTubeStats>> => {
  // Se não houver chave ou IDs, retorna vazio
  if (!apiKey || videoIds.length === 0) {
    return {};
  }

  // A API do YouTube aceita até 50 IDs por requisição
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
