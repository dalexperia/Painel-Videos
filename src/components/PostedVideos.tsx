import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, PlayCircle, AlertCircle, RefreshCw, LayoutGrid, List, Download, Youtube, X } from 'lucide-react';

interface Video {
  id: string;
  link_s3: string;
  title?: string;
  description?: string;
  youtube_id?: string;
}

type ViewMode = 'grid' | 'list';

const PostedVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    fetchPostedVideos();
  }, []);

  const fetchPostedVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('shorts_apostilas')
        .select('id, link_s3, title, description, youtube_id')
        .eq('failed', false)
        .eq('status', 'Posted');

      if (error) throw error;

      const validVideos = (data || []).filter((video): video is Video => 
        video && video.link_s3 && video.link_s3.trim() !== ''
      );
      
      setVideos(validVideos);

    } catch (err: any)
    {
      setError('Não foi possível carregar os vídeos postados.');
    } finally {
      setLoading(false);
    }
  };

  const handleReprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja reprovar este vídeo? Ele será movido para a lista de reprovados.')) return;

    try {
      const { error } = await supabase
        .from('shorts_apostilas')
        .update({ failed: true })
        .eq('id', id);

      if (error) throw error;
      setVideos(videos.filter((video) => video.id !== id));
      if (selectedVideo?.id === id) setSelectedVideo(null);
    } catch (err) {
      console.error("Erro ao reprovar o vídeo:", err);
      alert('Erro ao reprovar o vídeo. Verifique o console para mais detalhes.');
    }
  };

  const handleDownload = (url: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (title || 'video').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileExtension = url.split('.').pop()?.split('?')[0] || 'mp4';
      link.setAttribute('download', `${safeTitle}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Não foi possível iniciar o download.');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
          <PlayCircle size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-gray-800 text-xl font-semibold">Nenhum vídeo postado</h3>
          <p className="text-gray-500 text-sm mt-2">Ainda não há vídeos com o status "Posted".</p>
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
              </div>

              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 min-h-[3rem]" title={video.title}>
                  {video.title || 'Vídeo sem título'}
                </h3>
                <p className="text-xs text-gray-500 mb-4 line-clamp-2 flex-grow" title={video.description}>
                  {video.description || 'Sem descrição disponível.'}
                </p>
                <div className="mt-auto pt-4 flex items-center gap-2 border-t border-gray-100">
                  {video.youtube_id ? (
                    <a
                      href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      title="Ver no YouTube"
                    >
                      <Youtube size={16} />
                      <span>YouTube</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                      title="Link do YouTube não disponível"
                    >
                      <Youtube size={16} />
                      <span>YouTube</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDownload(video.link_s3, video.title || 'video', e)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Baixar vídeo"
                  >
                    <Download size={16} />
                    <span>Baixar</span>
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
              <p className="text-sm text-gray-500 line-clamp-2" title={video.description}>
                {video.description || 'Sem descrição disponível.'}
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              {video.youtube_id ? (
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  title="Ver no YouTube"
                >
                  <Youtube size={16} />
                  <span className="hidden md:inline">YouTube</span>
                </a>
              ) : (
                 <button
                  disabled
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                  title="Link do YouTube não disponível"
                >
                  <Youtube size={16} />
                  <span className="hidden md:inline">YouTube</span>
                </button>
              )}
              <button
                onClick={(e) => handleDownload(video.link_s3, video.title || 'video', e)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                title="Baixar vídeo"
              >
                <Download size={16} />
                <span className="hidden md:inline">Baixar</span>
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
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Vídeos Postados</h1>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Visualização em Grade"
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Visualização em Lista"
            >
              <List size={20} />
            </button>
          </div>
          <button 
            onClick={fetchPostedVideos}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Recarregar lista"
          >
            <RefreshCw size={22} />
          </button>
          <div className="bg-green-100 text-green-800 text-center rounded-2xl px-5 py-2 shadow-sm">
            <div className="text-2xl font-bold leading-none">{videos.length}</div>
            <div className="text-xs leading-none tracking-tight mt-1">{videos.length === 1 ? 'Vídeo' : 'Vídeos'}</div>
          </div>
        </div>
      </div>

      {renderContent()}

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
              <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                {selectedVideo.description || 'Sem descrição.'}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                {selectedVideo.youtube_id ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${selectedVideo.youtube_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-semibold"
                  >
                    <Youtube size={18} />
                    <span>Ver no YouTube</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 text-gray-400 rounded-lg font-semibold cursor-not-allowed"
                  >
                    <Youtube size={18} />
                    <span>YouTube</span>
                  </button>
                )}
                <button
                  onClick={(e) => handleDownload(selectedVideo.link_s3, selectedVideo.title || 'video', e)}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-semibold"
                >
                  <Download size={18} />
                  <span>Baixar</span>
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
    </div>
  );
};

export default PostedVideos;
