import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, CheckCircle2, Share2, Loader2, Search, AlertTriangle } from 'lucide-react';
import PostModal, { Video } from './PostModal';
import VideoSmartPreview from './VideoSmartPreview';
import { initializeGoogleApi, requestGoogleAuth, uploadVideoToYouTube } from '../lib/googleUpload';

const ShortsVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'posted' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Inicializa a API do Google ao carregar a página
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId) {
      initializeGoogleApi(clientId).catch(err => console.error("Falha ao iniciar Google API:", err));
    } else {
      console.warn("VITE_GOOGLE_CLIENT_ID não encontrado no .env");
    }
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('shorts_youtube')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'pending') query = query.eq('status', 'Created');
      if (filter === 'posted') query = query.eq('status', 'Posted');
      if (filter === 'failed') query = query.eq('failed', true);

      const { data, error } = await query;

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Erro ao buscar vídeos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [filter]);

  const handlePostVideo = async (video: Video, options: { scheduleDate?: string; webhookUrl?: string; method: 'webhook' | 'api'; privacyStatus?: string }) => {
    const { scheduleDate, webhookUrl, method, privacyStatus } = options;
    
    setIsPosting(true);

    try {
      // =================================================================================
      // FLUXO 1: WEBHOOK (n8n/Make)
      // =================================================================================
      if (method === 'webhook') {
        if (!webhookUrl) {
          throw new Error("URL do Webhook não foi fornecida. Verifique a configuração do canal.");
        }

        const payload = {
          video_id: video.id,
          title: video.title,
          description: video.description,
          link_s3: video.link_s3,
          channel: video.channel,
          schedule_date: scheduleDate,
          privacy_status: privacyStatus || 'private',
          hashtags: video.hashtags
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Erro no Webhook: ${response.statusText}`);
      
      // =================================================================================
      // FLUXO 2: API DIRETA (YouTube Data API v3 + OAuth)
      // =================================================================================
      } else if (method === 'api') {
        
        // 1. Verifica Client ID no .env
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
          throw new Error("VITE_GOOGLE_CLIENT_ID não configurado no arquivo .env");
        }

        // 2. Autenticação (Popup do Google)
        console.log("Solicitando autenticação Google...");
        const accessToken = await requestGoogleAuth();
        
        // 3. Download do Vídeo (Blob)
        console.log("Baixando vídeo do S3 para upload...");
        const videoResponse = await fetch(video.link_s3);
        if (!videoResponse.ok) throw new Error("Não foi possível baixar o vídeo original para upload.");
        const videoBlob = await videoResponse.blob();

        // 4. Upload Resumable para o YouTube
        console.log("Iniciando upload para o YouTube...");
        await uploadVideoToYouTube(videoBlob, accessToken, {
          title: video.title,
          description: video.description || '',
          privacyStatus: (privacyStatus as 'private' | 'public' | 'unlisted') || 'private',
          publishAt: scheduleDate,
          tags: video.hashtags
        });

        console.log("Upload via API concluído com sucesso!");
      }

      // =================================================================================
      // ATUALIZAÇÃO DO BANCO (Comum a ambos)
      // =================================================================================
      const { error } = await supabase
        .from('shorts_youtube')
        .update({ 
          status: scheduleDate ? 'Scheduled' : 'Posted',
          publish_at: scheduleDate || new Date().toISOString(),
          failed: false
        })
        .eq('id', video.id);

      if (error) throw error;
      
      setSelectedVideo(null);
      fetchVideos();
      // Sucesso silencioso (sem alert intrusivo), o modal fecha e a lista atualiza

    } catch (error: any) {
      console.error('Erro ao postar:', error);
      alert(`Erro: ${error.message || "Falha desconhecida no processo."}`);
    } finally {
      setIsPosting(false);
    }
  };

  const filteredVideos = videos.filter(video => 
    video.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    video.channel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
      
      {/* Header e Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biblioteca de Vídeos</h1>
          <p className="text-gray-500 text-sm">Gerencie e publique seus conteúdos gerados</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar vídeos..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Pendentes
            </button>
            <button 
              onClick={() => setFilter('posted')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filter === 'posted' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Postados
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Vídeos */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <div key={video.id} className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
              
              {/* Thumbnail Area */}
              <div className="relative aspect-video bg-gray-100 overflow-hidden">
                <VideoSmartPreview src={video.link_s3} className="w-full h-full object-cover" />
                
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button 
                    onClick={() => setSelectedVideo(video)}
                    className="bg-white/90 text-gray-900 p-3 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-all hover:bg-blue-600 hover:text-white"
                  >
                    <Share2 size={20} />
                  </button>
                </div>

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  {video.publish_at ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 border border-green-200 shadow-sm">
                      <CheckCircle2 size={12} className="mr-1" /> Postado
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 shadow-sm">
                      <Calendar size={12} className="mr-1" /> Pendente
                    </span>
                  )}
                </div>
              </div>

              {/* Content Area */}
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug" title={video.title}>
                    {video.title || 'Sem título'}
                  </h3>
                </div>

                <div className="mt-auto space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {video.channel && (
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded border border-blue-100">
                        {video.channel}
                      </span>
                    )}
                    <span className="inline-block px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-medium rounded border border-gray-100">
                      {video.hashtags?.length || 0} tags
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedVideo(video)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <Share2 size={16} />
                    Publicar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedVideo && (
        <PostModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onPost={handlePostVideo}
          isPosting={isPosting}
        />
      )}
    </div>
  );
};

export default ShortsVideos;
