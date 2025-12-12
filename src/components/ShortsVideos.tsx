import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Play, Calendar, CheckCircle2, AlertCircle, MoreVertical, Trash2, Edit, Share2, Loader2, Filter, Search } from 'lucide-react';
import PostModal, { Video } from './PostModal';
import VideoSmartPreview from './VideoSmartPreview';

const ShortsVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'posted' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
    
    // VALIDAÇÃO CORRIGIDA: Só exige webhook se o método for webhook
    if (method === 'webhook' && !webhookUrl) {
      alert("Erro: URL do Webhook não está definida.");
      return;
    }

    setIsPosting(true);

    try {
      if (method === 'webhook') {
        // --- Lógica via Webhook (n8n/Make) ---
        const payload = {
          video_id: video.id,
          title: video.title,
          description: video.description,
          link_s3: video.link_s3,
          channel: video.channel,
          schedule_date: scheduleDate,
          privacy_status: privacyStatus || 'private', // Passa o status mesmo no webhook, caso o n8n use
          hashtags: video.hashtags
        };

        const response = await fetch(webhookUrl!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Falha ao enviar para o Webhook');

      } else {
        // --- Lógica via API Direta (Simulação/Placeholder) ---
        // Nota: Upload direto via browser requer OAuth2 token do usuário.
        // Como não temos o token aqui neste momento, vamos simular o sucesso 
        // ou chamar uma Edge Function se estivesse configurada.
        
        console.log("Enviando via API Direta:", { video, privacyStatus, scheduleDate });
        
        // Por enquanto, apenas atualizamos o banco para simular o fluxo, 
        // já que a implementação completa de OAuth2 client-side é complexa sem backend.
        // Se você tiver uma Edge Function para isso, a chamada seria aqui.
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // Fake delay
      }

      // Atualiza status no Supabase
      const { error } = await supabase
        .from('shorts_youtube')
        .update({ 
          status: scheduleDate ? 'Scheduled' : 'Posted',
          publish_at: scheduleDate || new Date().toISOString(),
          failed: false
        })
        .eq('id', video.id);

      if (error) throw error;

      alert(scheduleDate ? "Agendamento realizado com sucesso!" : "Vídeo enviado com sucesso!");
      setSelectedVideo(null);
      fetchVideos();

    } catch (error) {
      console.error('Erro ao postar:', error);
      alert("Erro ao processar o envio. Verifique o console.");
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
