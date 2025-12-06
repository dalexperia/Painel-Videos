import React, { useState, useEffect } from 'react';
import { Play, Clock, MoreVertical, Calendar as CalendarIcon, CheckCircle2, XCircle, AlertCircle, ListFilter, LayoutGrid } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatDuration } from '../utils/format';
import ScheduleModal from './ScheduleModal';

interface Video {
  id: string;
  title: string;
  link_s3?: string;
  thumbnail_url?: string;
  duration?: number;
  created_at: string;
  publish_at?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'scheduled';
  tags?: string[];
  failed?: boolean;
  dbStatus?: string; // Status original do banco (Created, Posted, etc)
}

// Removido 'queue' do tipo
type TabType = 'all' | 'scheduled' | 'posted' | 'failed';

const VideoGallery = () => {
  // Determina o contexto atual baseado na URL
  const getCurrentContext = () => {
    const path = window.location.href.toLowerCase();
    
    // REMOVIDO O BLOCO DE FILA/AGUARDANDO
    
    if (path.includes('agendados') || path.includes('scheduled')) {
      return { 
        isSpecializedView: true, 
        forcedTab: 'scheduled' as TabType, 
        title: 'Vídeos Agendados', 
        subtitle: 'Conteúdo programado para publicação' 
      };
    }
    if (path.includes('postados') || path.includes('posted')) {
      return { 
        isSpecializedView: true, 
        forcedTab: 'posted' as TabType, 
        title: 'Vídeos Postados', 
        subtitle: 'Histórico de publicações realizadas' 
      };
    }
    if (path.includes('reprovados') || path.includes('failed')) {
      return { 
        isSpecializedView: true, 
        forcedTab: 'failed' as TabType, 
        title: 'Vídeos Reprovados', 
        subtitle: 'Conteúdo que precisa de atenção' 
      };
    }
    
    // Visão Geral (Dashboard/Galeria completa)
    return { 
      isSpecializedView: false, 
      forcedTab: 'all' as TabType, 
      title: 'Galeria de Vídeos', 
      subtitle: 'Gerencie e publique seus conteúdos' 
    };
  };

  const context = getCurrentContext();
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado para navegação interna (quando não é uma rota específica)
  const [galleryTab, setGalleryTab] = useState<TabType>('all');

  // Define qual aba está ativa: a forçada pela URL ou a selecionada manualmente
  const activeTab = context.isSpecializedView ? context.forcedTab : galleryTab;

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('shorts_youtube')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        const mappedVideos: Video[] = data.map((item: any) => {
          let status: Video['status'] = 'processing';
          
          if (item.failed) {
            status = 'failed';
          } else if (item.status === 'Posted') {
            status = 'completed';
          } else if (item.publish_at && new Date(item.publish_at) > new Date()) {
            status = 'scheduled';
          } else if (item.status === 'Created') {
            status = 'completed'; // Pronto para agendar
          }

          return {
            id: item.id,
            title: item.title || 'Sem título',
            link_s3: item.link_s3,
            duration: item.duration || 0,
            created_at: item.created_at,
            publish_at: item.publish_at,
            status: status,
            tags: [],
            failed: item.failed,
            dbStatus: item.status
          };
        });
        setVideos(mappedVideos);
      }
    } catch (error) {
      console.error('Erro ao buscar vídeos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleClick = (video: Video) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleConfirmSchedule = async (date: Date, immediate: boolean) => {
    if (!selectedVideo) return;

    try {
      const { error } = await supabase
        .from('shorts_youtube')
        .update({
          publish_at: immediate ? new Date().toISOString() : date.toISOString(),
        })
        .eq('id', selectedVideo.id);

      if (error) throw error;
      fetchVideos();
    } catch (error) {
      console.error('Erro ao agendar:', error);
      alert('Erro ao agendar o vídeo.');
    }
  };

  // Lógica de Filtragem
  const filteredVideos = videos.filter(video => {
    switch (activeTab) {
      // REMOVIDO CASE QUEUE
      
      case 'scheduled':
        return !video.failed && video.publish_at && new Date(video.publish_at) > new Date();
      
      case 'posted':
        return !video.failed && video.dbStatus === 'Posted';
      
      case 'failed':
        return video.failed;
        
      case 'all':
      default:
        return true;
    }
  });

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Todos', icon: <LayoutGrid size={18} /> },
    // REMOVIDO ABA AGUARDANDO/FILA
    { id: 'scheduled', label: 'Agendados', icon: <CalendarIcon size={18} /> },
    { id: 'posted', label: 'Postados', icon: <CheckCircle2 size={18} /> },
    { id: 'failed', label: 'Erros', icon: <AlertCircle size={18} /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {context.title}
          </h2>
          <p className="text-gray-500 mt-1">
            {context.subtitle}
          </p>
        </div>
        <button className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors shadow-sm font-medium self-start md:self-auto">
          Novo Upload
        </button>
      </div>

      {/* Navegação por abas (apenas se não estiver em uma rota específica) */}
      {!context.isSpecializedView && (
        <div className="flex overflow-x-auto pb-2 mb-6 gap-2 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setGalleryTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className={`ml-1 text-xs py-0.5 px-1.5 rounded-full ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {videos.filter(v => {
                  if (tab.id === 'all') return true;
                  // REMOVIDO FILTRO QUEUE
                  if (tab.id === 'scheduled') return !v.failed && v.publish_at && new Date(v.publish_at) > new Date();
                  if (tab.id === 'posted') return !v.failed && v.dbStatus === 'Posted';
                  if (tab.id === 'failed') return v.failed;
                  return false;
                }).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {filteredVideos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
          <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
            <ListFilter className="text-gray-400" size={24} />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Nenhum vídeo encontrado</h3>
          <p className="text-gray-500 mt-1">
            Não há vídeos nesta categoria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <div key={video.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200 group flex flex-col">
              {/* Thumbnail / Video Preview */}
              <div className="relative aspect-video bg-gray-900 group-hover:bg-gray-800 transition-colors">
                {video.link_s3 ? (
                  <video 
                    src={video.link_s3}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
                    muted
                    preload="metadata"
                    onMouseOver={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseOut={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="text-gray-600" size={48} />
                  </div>
                )}

                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-mono backdrop-blur-sm z-10">
                  {formatDuration(video.duration)}
                </div>
                
                {/* Ações Rápidas (Overlay) */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[1px] z-20">
                  {!video.failed && video.dbStatus !== 'Posted' && (
                    <button 
                      onClick={() => handleScheduleClick(video)}
                      className="bg-white text-gray-900 p-2 rounded-full hover:bg-brand-50 transition-colors transform hover:scale-105 shadow-lg"
                      title="Agendar Publicação"
                    >
                      <CalendarIcon size={20} />
                    </button>
                  )}
                  {video.link_s3 && (
                    <a 
                      href={video.link_s3} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-white text-gray-900 p-2 rounded-full hover:bg-brand-50 transition-colors transform hover:scale-105 shadow-lg"
                    >
                      <Play size={20} fill="currentColor" />
                    </a>
                  )}
                </div>
              </div>

              {/* Informações do Vídeo */}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug" title={video.title}>
                    {video.title}
                  </h3>
                  <button className="text-gray-400 hover:text-gray-600 p-1 -mr-2 -mt-2">
                    <MoreVertical size={16} />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 mb-auto">
                  {video.tags?.map(tag => (
                    <span key={tag} className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full uppercase tracking-wide">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-50 mt-3">
                  <span className="flex items-center gap-1" title={`Criado em: ${new Date(video.created_at).toLocaleString()}`}>
                    <Clock size={12} />
                    {new Date(video.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  
                  {/* Badge de Status */}
                  <span className={`flex items-center gap-1 font-medium ${
                    video.failed ? 'text-red-600' :
                    video.dbStatus === 'Posted' ? 'text-green-600' :
                    video.publish_at ? 'text-purple-600' :
                    'text-blue-600'
                  }`}>
                    {video.failed ? (
                      <><XCircle size={12} /> Erro</>
                    ) : video.dbStatus === 'Posted' ? (
                      <><CheckCircle2 size={12} /> Postado</>
                    ) : video.publish_at ? (
                      <><CalendarIcon size={12} /> Agendado</>
                    ) : (
                      <><CheckCircle2 size={12} /> Aguardando</>
                    )}
                  </span>
                </div>
                
                {/* Data de Agendamento (se houver) */}
                {video.publish_at && !video.failed && video.dbStatus !== 'Posted' && (
                  <div className="mt-2 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 flex items-center gap-1">
                    <CalendarIcon size={10} />
                    Agendado: {new Date(video.publish_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVideo && (
        <ScheduleModal 
          video={selectedVideo}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmSchedule}
        />
      )}
    </div>
  );
};

export default VideoGallery;
