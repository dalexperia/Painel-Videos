import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, PlayCircle, AlertCircle, RefreshCw, LayoutGrid, List, Download, X, Calendar, Sparkles, Tv } from 'lucide-react';
import PostModal, { Video as PostModalVideo } from './PostModal';

// Interface compatível com PostModal
interface Video {
  id: string;
  link_s3: string;
  title?: string;
  description?: string;
  publish_at?: string | null;
  created_at: string;
  channel?: string;
  duration?: number;
  // Campos adicionais para compatibilidade
  url: string;
  status: string;
  failed?: boolean;
}

type ViewMode = 'grid' | 'list';

const RecentVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  // Estado para o PostModal
  const [videoToPost, setVideoToPost] = useState<Video | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    fetchRecentVideos();
  }, []);

  const fetchRecentVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('shorts_youtube')
        .select('*')
        .eq('status', 'Created')
        .is('publish_at', null)
        .eq('failed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const validVideos = (data || []).filter((item): item is any => 
        item && item.link_s3 && item.link_s3.trim() !== ''
      ).map((item: any) => ({
        ...item,
        url: item.link_s3, // Mapeia link_s3 para url
        status: item.status || 'Created',
        duration: item.duration || 0
      }));
      
      setVideos(validVideos);

    } catch (err: any) {
      console.error('Erro ao buscar vídeos:', err);
      setError('Não foi possível carregar os vídeos recentes.');
    } finally {
      setLoading(false);
    }
  };

  const handleReprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja reprovar este vídeo? Ele será movido para a lista de reprovados.')) return;

    try {
      const { error } = await supabase
        .from('shorts_youtube')
        .update({ failed: true })
        .eq('id', id);

      if (error) throw error;
      setVideos(videos.filter((video) => video.id !== id));
      if (selectedVideo?.id === id) setSelectedVideo(null);
    } catch (err) {
      console.error("Erro ao reprovar o vídeo:", err);
      alert('Erro ao reprovar o vídeo.');
    }
  };

  const handleDownload = async (url: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!url) {
      alert('URL inválida para download');
      return;
    }

    try {
      document.body.style.cursor = 'wait';
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha no download');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      const safeTitle = (title || 'video').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('download', `${safeTitle}.mp4`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Erro no download:', error);
      window.open(url, '_blank');
    } finally {
      document.body.style.cursor = 'default';
    }
  };

  const openPostModal = (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoToPost(video);
    setIsPostModalOpen(true);
  };

  // Lógica unificada de Postagem (Idêntica ao VideoGallery)
  const handlePost = async (video: PostModalVideo, options: { scheduleDate?: string; webhookUrl: string }) => {
    setIsPosting(true);
    console.log('--- RECENTES: INÍCIO DO PROCESSO DE POSTAGEM ---');
    console.log('Vídeo ID:', video.id);
    console.log('Opções:', options);

    try {
      // SE scheduleDate EXISTE = AGENDAMENTO (Update no Banco)
      if (options.scheduleDate) {
        console.log('MODO: AGENDAMENTO (Atualizando banco de dados...)');
        
        const { error } = await supabase
          .from('shorts_youtube')
          .update({
            publish_at: options.scheduleDate,
          })
          .eq('id', video.id);

        if (error) throw error;
        
        console.log('Banco atualizado. Removendo da lista de recentes.');
        alert('Vídeo agendado com sucesso!');
        
        // Remove da lista local pois agora tem data de publicação
        setVideos(prev => prev.filter(v => v.id !== video.id));
        
        if (selectedVideo?.id === video.id) {
          setSelectedVideo(null);
        }

      } else {
        // SE scheduleDate NÃO EXISTE = POSTAR AGORA (Webhook APENAS)
        console.log('MODO: POSTAR AGORA (Disparando Webhook APENAS)');
        console.log('NENHUMA alteração será feita no banco de dados.');

        if (!options.webhookUrl) {
          throw new Error('URL do Webhook não está definida.');
        }

        const payload = {
          id: video.id,
          title: video.title,
          url: video.url,
          duration: video.duration,
          channel: video.channel,
          created_at: video.created_at,
          action: 'post_now'
        };

        console.log('Enviando payload:', payload);

        try {
          const response = await fetch(options.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Sem detalhes');
            throw new Error(`Erro no Webhook (${response.status}): ${errorText}`);
          }
          
          console.log('Webhook disparado com sucesso!');
          alert('Solicitação enviada! O backend processará o vídeo em breve.');
          
        } catch (fetchError: any) {
          console.error('Erro ao chamar webhook:', fetchError);
          throw new Error(`Falha na conexão com Webhook: ${fetchError.message}`);
        }
      }
      
      setIsPostModalOpen(false);
      setVideoToPost(null);
      
    } catch (error: any) {
      console.error('ERRO FATAL:', error);
      alert(`Erro: ${error.message || 'Falha ao processar.'}`);
    } finally {
      setIsPosting(false);
      console.log('--- FIM DO PROCESSO ---');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative flex items-center justify-center" role="alert">
          <AlertCircle className="mr-2" />
          <span>{error}</span>
        </div>
      );
    }

    if (videos.length === 0) {
      return (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-100">
          <Sparkles size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-gray-800 text-xl font-semibold">Nenhum vídeo recente</h3>
          <p className="text-gray-500 text-sm mt-2">Não há novos vídeos aguardando agendamento.</p>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <div 
              key={video.id} 
              className="group bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col hover:-translate-y-1"
            >
              <div 
                className="relative aspect-video bg-gray-900 cursor-pointer overflow-hidden"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <video 
                    src={video.link_s3}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                    muted
                    preload="metadata"
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors duration-300">
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                    <PlayCircle size={32} className="text-white fill-white/20" />
                  </div>
                </div>
                {/* Channel Badge */}
                {video.channel && (
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                    <Tv size={10} />
                    <span className="truncate max-w-[100px]">{video.channel}</span>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 min-h-[3rem]" title={video.title}>
                  {video.title || 'Vídeo sem título'}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <Sparkles size={14} className="text-brand-500" />
                  <span>Criado em {new Date(video.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                
                <div className="mt-auto pt-4 flex items-center gap-2 border-t border-gray-100">
                  <button
                    onClick={(e) => openPostModal(video, e)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
                    title="Agendar publicação"
                  >
                    <Calendar size={16} />
                    <span>Agendar</span>
                  </button>
                  <button
                    onClick={(e) => handleReprove(video.id, e)}
                    className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Reprovar vídeo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center p-3 gap-4"
          >
            <div
              className="relative w-full sm:w-32 h-20 bg-gray-900 rounded-md overflow-hidden cursor-pointer flex-shrink-0 group"
              onClick={() => setSelectedVideo(video)}
            >
              <video
                src={video.link_s3}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <PlayCircle size={24} className="text-white" />
              </div>
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="font-semibold text-gray-800 truncate" title={video.title}>
                {video.title || 'Vídeo sem título'}
              </h3>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Sparkles size={14} className="text-brand-500" />
                  <span>Criado em {new Date(video.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {video.channel && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    <Tv size={12} />
                    <span>{video.channel}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={(e) => openPostModal(video, e)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
                title="Agendar publicação"
              >
                <Calendar size={16} />
                <span className="hidden md:inline">Agendar</span>
              </button>
              <button
                onClick={(e) => handleDownload(video.link_s3, video.title || 'video', e)}
                className="flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Baixar vídeo"
              >
                <Download size={18} />
              </button>
              <button
                onClick={(e) => handleReprove(video.id, e)}
                className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Reprovar vídeo"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b pb-4 border-gray-200">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Recentes</h1>
          <p className="text-gray-500 mt-1">Vídeos criados aguardando agendamento</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Visualização em Grade"
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Visualização em Lista"
            >
              <List size={20} />
            </button>
          </div>
          <button 
            onClick={fetchRecentVideos}
            className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
            title="Recarregar lista"
          >
            <RefreshCw size={22} />
          </button>
          <div className="bg-brand-100 text-brand-800 text-center rounded-2xl px-5 py-2 shadow-sm">
            <div className="text-2xl font-bold leading-none">{videos.length}</div>
            <div className="text-xs leading-none tracking-tight mt-1">{videos.length === 1 ? 'Vídeo' : 'Vídeos'}</div>
          </div>
        </div>
      </div>

      {renderContent()}

      {/* Modal de Preview */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            className="relative w-full max-w-md mx-auto bg-gray-900 rounded-2xl overflow-hidden shadow-2xl animate-slide-up flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-black flex-shrink-0">
              <video 
                src={selectedVideo.link_s3} 
                controls 
                autoPlay 
                className="w-full h-auto max-h-[60vh] object-contain"
              >
                Seu navegador não suporta a tag de vídeo.
              </video>
            </div>
            
            <div className="p-5 text-white overflow-y-auto">
              <h2 className="font-bold text-xl mb-2 truncate" title={selectedVideo.title || ''}>
                {selectedVideo.title || 'Visualização'}
              </h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-brand-300 bg-brand-500/20 rounded-md px-3 py-1.5">
                  <Sparkles size={16} />
                  <span className="font-medium">Criado em {new Date(selectedVideo.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {selectedVideo.channel && (
                  <div className="flex items-center gap-2 text-sm text-blue-300 bg-blue-500/20 rounded-md px-3 py-1.5">
                    <Tv size={16} />
                    <span className="font-medium">{selectedVideo.channel}</span>
                  </div>
                )}
              </div>

              <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                {selectedVideo.description || 'Sem descrição.'}
              </p>
              
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={(e) => {
                    setSelectedVideo(null); // Fecha preview
                    openPostModal(selectedVideo, e); // Abre modal de agendamento
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors font-semibold"
                >
                  <Calendar size={18} />
                  <span>Agendar Publicação</span>
                </button>
                <button
                  onClick={(e) => handleDownload(selectedVideo.link_s3, selectedVideo.title || 'video', e)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium text-sm"
                >
                  <Download size={18} />
                  <span>Baixar Vídeo</span>
                </button>
              </div>
            </div>

            <button 
              onClick={() => setSelectedVideo(null)}
              className="absolute top-3 right-3 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-1.5 transition-colors z-10"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Modal de Agendamento UNIFICADO */}
      {videoToPost && (
        <PostModal 
          video={videoToPost}
          onClose={() => {
            setIsPostModalOpen(false);
            setVideoToPost(null);
          }}
          onPost={handlePost}
          isPosting={isPosting}
        />
      )}
    </div>
  );
};

export default RecentVideos;
