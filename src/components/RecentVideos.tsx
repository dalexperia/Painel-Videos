import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, PlayCircle, AlertCircle, RefreshCw, LayoutGrid, List, Download, X, Calendar, Sparkles, Tv, Search, Filter } from 'lucide-react';
import PostModal, { Video as PostModalVideo } from './PostModal';

// Reutiliza a interface do PostModal para consistência
type Video = PostModalVideo;

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

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

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
        id: item.id,
        baserow_id: item.baserow_id || 0,
        title: item.title || '',
        description: item.description || '',
        link_s3: item.link_s3,
        link_drive: item.link_drive || '',
        channel: item.channel || '',
        hashtags: item.hashtags || [],
        tags: item.tags || [],
        duration: item.duration || 0,
        status: item.status || 'Created',
        created_at: item.created_at,
        failed: item.failed || false,
        url: item.link_s3
      }));
      
      setVideos(validVideos);

    } catch (err: any) {
      console.error('Erro ao buscar vídeos:', err);
      setError('Não foi possível carregar os vídeos recentes.');
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Filtragem
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      // Filtro de Texto (Título)
      const matchesSearch = video.title?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro de Canal
      const matchesChannel = selectedChannel ? video.channel === selectedChannel : true;

      // Filtro de Data (Created At)
      let matchesDate = true;
      if (dateStart || dateEnd) {
        const videoDate = new Date(video.created_at).setHours(0,0,0,0);
        const start = dateStart ? new Date(dateStart).setHours(0,0,0,0) : null;
        const end = dateEnd ? new Date(dateEnd).setHours(0,0,0,0) : null;

        if (start && videoDate < start) matchesDate = false;
        if (end && videoDate > end) matchesDate = false;
      }

      return matchesSearch && matchesChannel && matchesDate;
    });
  }, [videos, searchTerm, selectedChannel, dateStart, dateEnd]);

  // Lista única de canais para o dropdown
  const uniqueChannels = useMemo(() => {
    const channels = videos.map(v => v.channel).filter(Boolean);
    return Array.from(new Set(channels)).sort();
  }, [videos]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedChannel('');
    setDateStart('');
    setDateEnd('');
  };

  const handleReprove = async (id: string | number, e: React.MouseEvent) => {
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

  const getRecifeTime = (dateInput?: string | Date): string => {
    const date = dateInput ? new Date(dateInput) : new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Recife',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat('pt-BR', options);
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}-03:00`;
  };

  const handlePost = async (video: PostModalVideo, options: { scheduleDate?: string; webhookUrl: string }) => {
    setIsPosting(true);
    try {
      if (!options.webhookUrl) throw new Error('URL do Webhook não está definida.');

      const isScheduled = !!options.scheduleDate;
      let privacy_status: string;
      let publish_at: string;

      if (isScheduled) {
        privacy_status = 'private';
        publish_at = getRecifeTime(options.scheduleDate);
      } else {
        privacy_status = 'public';
        publish_at = getRecifeTime();
      }

      const payload = {
        link_drive: video.link_drive || "",
        link_s3: video.link_s3,
        title: video.title,
        description: video.description || "",
        hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],
        tags: Array.isArray(video.tags) ? video.tags : [],
        channel: video.channel || "",
        baserow_id: video.baserow_id || 0,
        id: video.id,
        "Privacy Status": privacy_status,
        "Publish At": publish_at,
        privacy_status: privacy_status,
        publish_at: publish_at
      };

      const response = await fetch(options.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Sem detalhes');
        throw new Error(`Erro no Webhook (${response.status}): ${errorText}`);
      }
      
      if (isScheduled) {
        alert(`Agendamento enviado com sucesso para ${new Date(publish_at).toLocaleString('pt-BR')}!`);
      } else {
        alert('Solicitação de publicação imediata enviada!');
      }
      
      setIsPostModalOpen(false);
      setVideoToPost(null);
      if (selectedVideo?.id === video.id) setSelectedVideo(null);
      
    } catch (error: any) {
      console.error('ERRO FATAL:', error);
      alert(`Erro: ${error.message || 'Falha ao processar.'}`);
    } finally {
      setIsPosting(false);
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

    if (filteredVideos.length === 0) {
      return (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-100">
          <Sparkles size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-gray-800 text-xl font-semibold">Nenhum vídeo encontrado</h3>
          <p className="text-gray-500 text-sm mt-2">
            {videos.length > 0 ? 'Tente ajustar os filtros de busca.' : 'Não há novos vídeos aguardando agendamento.'}
          </p>
          {videos.length > 0 && (
            <button onClick={clearFilters} className="mt-4 text-brand-600 hover:text-brand-700 font-medium text-sm">
              Limpar filtros
            </button>
          )}
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
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
                  <span>
                    Criado em {new Date(video.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
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
        {filteredVideos.map((video) => (
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
                  <span>
                    Criado em {new Date(video.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
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
            <div className="text-2xl font-bold leading-none">{filteredVideos.length}</div>
            <div className="text-xs leading-none tracking-tight mt-1">{filteredVideos.length === 1 ? 'Vídeo' : 'Vídeos'}</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-500 w-full md:w-auto">
          <Filter size={18} />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Busca */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Canal */}
          <div className="relative">
            <Tv size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Todos os Canais</option>
              {uniqueChannels.map(channel => (
                <option key={channel} value={channel}>{channel}</option>
              ))}
            </select>
          </div>

          {/* Data Início */}
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-600"
              placeholder="De"
            />
          </div>

          {/* Data Fim */}
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-600"
              placeholder="Até"
            />
          </div>
        </div>

        {(searchTerm || selectedChannel || dateStart || dateEnd) && (
          <button
            onClick={clearFilters}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Limpar Filtros"
          >
            <X size={20} />
          </button>
        )}
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
                  <span className="font-medium">
                    Criado em {new Date(selectedVideo.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
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
