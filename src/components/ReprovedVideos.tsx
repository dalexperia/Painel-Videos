import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, PlayCircle, AlertCircle, RefreshCw, Undo2, LayoutGrid, List, Download } from 'lucide-react';
import StatusIcon from './StatusIcon';

interface Video {
  id: string;
  link_s3: string;
  title?: string;
  description?: string;
  tags?: string[] | string;
  hashtags?: string[] | string;
  status?: 'Created' | 'Posted' | string;
}

type ViewMode = 'grid' | 'list';

const ReprovedVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    fetchReprovedVideos();
  }, []);

  const fetchReprovedVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('shorts_apostilas')
        .select('id, link_s3, title, description, tags, hashtags, status')
        .eq('failed', true);

      if (error) throw error;

      const validVideos = (data || []).filter((video): video is Video => 
        video && video.link_s3 && video.link_s3.trim() !== ''
      );
      
      setVideos(validVideos);

    } catch (err: any) {
      setError('Não foi possível carregar os vídeos reprovados.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja restaurar este vídeo para a galeria principal?')) return;

    try {
      const { error } = await supabase
        .from('shorts_apostilas')
        .update({ failed: false })
        .eq('id', id);

      if (error) throw error;
      setVideos(videos.filter((video) => video.id !== id));
    } catch (err) {
      console.error("Erro ao restaurar o vídeo:", err);
      alert('Erro ao restaurar o vídeo. Verifique o console para mais detalhes.');
    }
  };

  const handlePermanentDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Esta ação é irreversível. Tem certeza que deseja excluir este vídeo permanentemente?')) return;

    try {
      const { error } = await supabase.from('shorts_apostilas').delete().eq('id', id);
      if (error) throw error;
      setVideos(videos.filter((video) => video.id !== id));
      if (selectedVideo?.id === id) setSelectedVideo(null);
    } catch (err) {
      console.error("Erro ao excluir o vídeo:", err);
      alert('Erro ao excluir o vídeo permanentemente. Verifique o console para mais detalhes.');
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
          <Trash2 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-gray-800 text-xl font-semibold">Nenhum vídeo reprovado</h3>
          <p className="text-gray-500 text-sm mt-2">A lista de vídeos reprovados está vazia.</p>
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
                <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-sm p-1 rounded-full">
                  <StatusIcon status={video.status} />
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
                <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-gray-100">
                  <button
                    onClick={(e) => handleRestore(video.id, e)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                    title="Restaurar vídeo"
                  >
                    <Undo2 size={16} />
                    <span>Restaurar</span>
                  </button>
                  <button
                    onClick={(e) => handlePermanentDelete(video.id, e)}
                    className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir permanentemente"
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
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 flex items-center p-3 gap-4"
          >
            <div
              className="relative w-32 h-20 bg-gray-900 rounded-md overflow-hidden cursor-pointer flex-shrink-0 group"
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
              <div className="flex items-center gap-2 mb-1">
                <StatusIcon status={video.status} />
                <h3 className="font-semibold text-gray-800 truncate" title={video.title}>
                  {video.title || 'Vídeo sem título'}
                </h3>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2" title={video.description}>
                {video.description || 'Sem descrição disponível.'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={(e) => handleRestore(video.id, e)}
                className="hidden sm:flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                title="Restaurar vídeo"
              >
                <Undo2 size={16} />
                <span className="hidden lg:inline">Restaurar</span>
              </button>
              <button
                onClick={(e) => handlePermanentDelete(video.id, e)}
                className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Excluir permanentemente"
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
      <div className="flex justify-between items-center mb-8 border-b pb-4 border-gray-200">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Vídeos Reprovados</h1>
        <div className="flex items-center gap-4">
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
            onClick={fetchReprovedVideos}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Recarregar lista"
          >
            <RefreshCw size={22} />
          </button>
          <div className="bg-red-100 text-red-800 text-center rounded-2xl px-5 py-2 shadow-sm">
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
            className="relative w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl animate-slide-up grid grid-rows-[1fr_auto]"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-black min-h-0 flex items-center justify-center">
              <video 
                src={selectedVideo.link_s3} 
                controls 
                autoPlay 
                className="max-w-full max-h-full object-contain"
              >
                Seu navegador não suporta a tag de vídeo.
              </video>
            </div>
            <div className="p-5 bg-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-grow min-w-0">
                <h2 className="text-white font-bold text-lg truncate" title={selectedVideo.title || ''}>
                  {selectedVideo.title || 'Visualização'}
                </h2>
                <p className="text-gray-400 text-sm mt-1 line-clamp-2" title={selectedVideo.description || ''}>
                  {selectedVideo.description || 'Sem descrição.'}
                </p>
              </div>
              <button
                onClick={(e) => handleDownload(selectedVideo.link_s3, selectedVideo.title || 'video', e)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold flex-shrink-0"
              >
                <Download size={18} />
                <span>Baixar</span>
              </button>
            </div>
             <button 
                onClick={() => setSelectedVideo(null)}
                className="absolute top-3 right-3 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-1.5 transition-colors z-20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReprovedVideos;
