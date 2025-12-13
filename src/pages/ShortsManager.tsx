import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import PostModal, { Video } from '../components/PostModal';
import { initializeGoogleApi, requestGoogleAuth, uploadVideoToYouTube } from '../lib/googleUpload';
import { Play, Calendar, CheckCircle, AlertCircle, MoreVertical, Filter, RefreshCw, UploadCloud, ExternalLink, Search } from 'lucide-react';

const ShortsManager: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Carregar vídeos do Supabase
  const fetchVideos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('shorts_videos') // Ajuste se o nome da tabela for diferente
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        // Exemplo de filtro simples, ajuste conforme suas colunas de status
        // query = query.eq('status', filter);
      }

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
    
    // Inicializa o Google API com o Client ID do .env
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId) {
      initializeGoogleApi(clientId);
    } else {
      console.error("VITE_GOOGLE_CLIENT_ID não definido no .env");
    }
  }, [filter]);

  const handleOpenModal = (video: Video) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handlePostVideo = async (video: Video, options: { 
    scheduleDate?: string; 
    webhookUrl?: string; 
    apiKey?: string;
    method: 'webhook' | 'api'; 
    privacyStatus?: string 
  }) => {
    setIsPosting(true);
    try {
      if (options.method === 'webhook') {
        // --- Lógica Webhook (Existente) ---
        if (!options.webhookUrl) throw new Error("URL do Webhook não fornecida.");
        
        const response = await fetch(options.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...video,
            publish_at: options.scheduleDate,
            privacy_status: options.privacyStatus
          })
        });

        if (!response.ok) throw new Error(`Erro no Webhook: ${response.statusText}`);
        alert("Enviado para o Webhook com sucesso!");

      } else {
        // --- Lógica API Direta (OAuth) ---
        
        // 1. Autenticação (Login com Google)
        console.log("Iniciando fluxo OAuth...");
        const accessToken = await requestGoogleAuth();
        
        // 2. Download do Vídeo (Onde ocorre o erro Failed to fetch)
        console.log(`Baixando vídeo de: ${video.link_s3}`);
        let videoBlob: Blob;
        try {
          const vidResponse = await fetch(video.link_s3);
          if (!vidResponse.ok) throw new Error(`Erro ao baixar vídeo: ${vidResponse.status} ${vidResponse.statusText}`);
          videoBlob = await vidResponse.blob();
        } catch (fetchError: any) {
          console.error("Erro de Download:", fetchError);
          if (fetchError.message === 'Failed to fetch') {
            throw new Error(
              "Bloqueio de CORS detectado! O navegador não conseguiu baixar o vídeo do servidor de origem.\n\n" +
              "Solução: Configure o CORS no seu bucket S3/R2 para permitir a origem deste site."
            );
          }
          throw fetchError;
        }

        // 3. Upload para o YouTube
        const result = await uploadVideoToYouTube(videoBlob, accessToken, {
          title: video.title,
          description: video.description || '',
          privacyStatus: (options.privacyStatus as 'private' | 'public' | 'unlisted') || 'private',
          publishAt: options.scheduleDate,
          tags: video.tags
        });

        console.log("Upload concluído:", result);

        // 4. Atualizar Status no Banco
        await supabase
          .from('shorts_videos')
          .update({ 
            status: 'published', 
            youtube_id: result.id,
            published_at: new Date().toISOString()
          })
          .eq('id', video.id);

        alert(`Vídeo publicado com sucesso! ID: ${result.id}`);
      }

      setIsModalOpen(false);
      fetchVideos(); // Recarrega a lista

    } catch (error: any) {
      console.error('Erro no processo de envio:', error);
      alert(`Erro: ${error.message || 'Falha desconhecida'}`);
    } finally {
      setIsPosting(false);
    }
  };

  // Filtragem local
  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.channel && v.channel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6 md:p-10 font-sans">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Gerenciador de Shorts</h1>
          <p className="text-gray-400 text-sm">Gerencie, agende e publique seus vídeos curtos.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchVideos} 
            className="p-2 bg-[#262626] hover:bg-[#333] rounded-lg text-gray-300 transition-colors border border-[#333]"
            title="Atualizar lista"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
          {/* Botão de Novo Vídeo (Placeholder) */}
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20">
            <UploadCloud size={18} />
            <span>Novo Upload</span>
          </button>
        </div>
      </header>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por título ou canal..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {['all', 'pending', 'published', 'scheduled'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-all whitespace-nowrap capitalize ${
                filter === f 
                  ? 'bg-white text-black border-white' 
                  : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:border-gray-500'
              }`}
            >
              {f === 'all' ? 'Todos' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Vídeos */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500 gap-3">
            <RefreshCw size={32} className="animate-spin text-blue-500" />
            <span className="text-sm">Carregando vídeos...</span>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500 gap-3">
            <div className="w-16 h-16 bg-[#262626] rounded-full flex items-center justify-center mb-2">
              <Play size={24} className="text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-300">Nenhum vídeo encontrado</h3>
            <p className="text-sm max-w-xs text-center">Tente ajustar os filtros ou adicione novos vídeos ao banco de dados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#262626] bg-[#202020]">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-[40%]">Vídeo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Canal</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {filteredVideos.map((video) => (
                  <tr key={video.id} className="group hover:bg-[#222] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-4">
                        {/* Thumbnail Placeholder ou Real */}
                        <div className="w-24 h-14 bg-[#333] rounded-md flex-shrink-0 overflow-hidden relative group-hover:ring-1 ring-gray-600 transition-all">
                          <video src={video.link_s3} className="w-full h-full object-cover opacity-60" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play size={16} className="text-white drop-shadow-md" fill="currentColor" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-200 line-clamp-2 group-hover:text-blue-400 transition-colors cursor-pointer" onClick={() => handleOpenModal(video)}>
                            {video.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-gray-500 bg-[#262626] px-1.5 py-0.5 rounded border border-[#333]">
                              ID: {video.id}
                            </span>
                            {video.publish_at && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(video.publish_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {video.channel?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="text-sm text-gray-300">{video.channel || 'Sem canal'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {/* Badge de Status */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        video.privacy_status === 'public' || video.privacy_status === 'published' // Ajuste conforme seu DB
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : video.publish_at
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {video.privacy_status === 'public' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                        {video.privacy_status === 'public' ? 'Publicado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a 
                          href={video.link_s3} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
                          title="Ver vídeo original"
                        >
                          <ExternalLink size={16} />
                        </a>
                        <button 
                          onClick={() => handleOpenModal(video)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white text-black text-xs font-bold rounded hover:bg-gray-200 transition-colors"
                        >
                          <UploadCloud size={14} />
                          PUBLICAR
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Publicação */}
      {isModalOpen && selectedVideo && (
        <PostModal
          video={selectedVideo}
          onClose={() => setIsModalOpen(false)}
          onPost={handlePostVideo}
          isPosting={isPosting}
        />
      )}
    </div>
  );
};

export default ShortsManager;
