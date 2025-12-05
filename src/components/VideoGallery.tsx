import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, Download, PlayCircle, AlertCircle, RefreshCw, LayoutGrid, List, Send, Save, X, Calendar } from 'lucide-react';
import StatusIcon from './StatusIcon';
import PostModal from './PostModal';

export interface Video {
  id: string;
  baserow_id: number;
  link_s3: string;
  link_drive?: string;
  title?: string;
  description?: string;
  tags?: string[] | string;
  hashtags?: string[] | string;
  status?: 'Created' | 'Posted' | 'Scheduled' | string;
  publish_at?: string;
}

type ViewMode = 'grid' | 'list';

const VideoGallery: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [editedVideo, setEditedVideo] = useState<Partial<Video> & { tags_str?: string; hashtags_str?: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [postingId, setPostingId] = useState<string | null>(null);
  const [videoToPost, setVideoToPost] = useState<Video | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (selectedVideo) {
      const tags = selectedVideo.tags || '';
      const hashtags = selectedVideo.hashtags || '';

      setEditedVideo({
        ...selectedVideo,
        tags_str: Array.isArray(tags) ? tags.join(', ') : tags,
        hashtags_str: Array.isArray(hashtags)
          ? hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')
          : hashtags,
      });
    } else {
      setEditedVideo(null);
    }
  }, [selectedVideo]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!editedVideo) return;
    const { name, value } = e.target;
    setEditedVideo({ ...editedVideo, [name]: value });
  };

  const handleSaveChanges = async () => {
    if (!editedVideo || !selectedVideo) return;

    const tagsToSave = editedVideo.tags_str?.split(',').map(tag => tag.trim()).filter(Boolean) || [];
    const hashtagsToSave = editedVideo.hashtags_str?.split(' ').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean) || [];

    try {
      const { data, error } = await supabase
        .from('shorts_apostilas')
        .update({
          title: editedVideo.title,
          description: editedVideo.description,
          tags: tagsToSave,
          hashtags: hashtagsToSave,
        })
        .eq('id', selectedVideo.id)
        .select()
        .single();

      if (error) throw error;

      alert('Alterações salvas com sucesso!');
      setVideos(videos.map(v => v.id === data.id ? data : v));
      setSelectedVideo(null);
    } catch (err) {
      console.error("Erro ao salvar alterações:", err);
      alert('Erro ao salvar as alterações. Verifique o console para mais detalhes.');
    }
  };

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('shorts_apostilas')
        .select('id, baserow_id, link_s3, title, description, tags, hashtags, status, link_drive, publish_at')
        .eq('failed', false)
        .eq('status', 'Created')
        .is('publish_at', null);

      if (error) throw error;

      const validVideos = (data || []).filter((video): video is Video => 
        video && video.link_s3 && video.link_s3.trim() !== ''
      );
      
      setVideos(validVideos);

    } catch (err: any) {
      setError('Não foi possível carregar os vídeos. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (video: Video, options: { scheduleDate?: string } = {}) => {
    if (postingId) return;
    setPostingId(video.id);

    const payload: any = {
      id: video.id,
      baserow_id: video.baserow_id,
      title: video.title || '',
      description: video.description || '',
      tags: Array.isArray(video.tags) ? video.tags : (video.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      hashtags: Array.isArray(video.hashtags) ? video.hashtags : (typeof video.hashtags === 'string' ? video.hashtags.split(' ').map(t => t.trim()).filter(Boolean) : []),
      link_drive: video.link_drive || '',
      link_s3: video.link_s3
    };

    if (options.scheduleDate) {
      payload['Privacy Status'] = 'private';
      payload['Publish At'] = options.scheduleDate;
    } else {
      payload['Privacy Status'] = 'public';
    }

    try {
      const response = await fetch('https://n8n-main.oficinadamultape.com.br/webhook/postar-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook respondeu com status: ${response.status}`);
      }

      alert(`Vídeo enviado para ${options.scheduleDate ? 'agendamento' : 'postagem'} com sucesso! O status será atualizado em breve.`);
      // O vídeo não é mais removido da lista localmente.

    } catch (err) {
      console.error("Erro ao postar o vídeo:", err);
      alert('Erro ao postar o vídeo. O webhook pode estar offline ou ocorreu um erro. Verifique o console.');
    } finally {
      setPostingId(null);
      setVideoToPost(null);
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
          <h3 className="text-gray-800 text-xl font-semibold">Nenhum vídeo na fila</h3>
          <p className="text-gray-500 text-sm mt-2">Não há vídeos com o status "Created" no momento.</p>
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
                <p className="text-xs text-gray-500 mb-2 line-clamp-2 flex-grow" title={video.description}>
                  {video.description || 'Sem descrição disponível.'}
                </p>
                <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-gray-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); setVideoToPost(video); }}
                    disabled={!!postingId}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Postar ou Agendar"
                  >
                    {postingId === video.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div> : <Send size={16} />}
                    <span>{postingId === video.id ? 'Enviando...' : 'Postar'}</span>
                  </button>
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
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={(e) => { e.stopPropagation(); setVideoToPost(video); }}
                disabled={!!postingId}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Postar ou Agendar"
              >
                {postingId === video.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div> : <Send size={16} />}
                <span className="hidden lg:inline">{postingId === video.id ? 'Enviando...' : 'Postar'}</span>
              </button>
              <button
                onClick={(e) => handleDownload(video.link_s3, video.title || 'video', e)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                title="Baixar vídeo"
              >
                <Download size={16} />
                <span className="hidden lg:inline">Baixar</span>
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
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Fila de Postagem</h1>
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
            onClick={fetchVideos}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Recarregar lista"
          >
            <RefreshCw size={22} />
          </button>
          <div className="bg-blue-100 text-blue-800 text-center rounded-2xl px-5 py-2 shadow-sm">
            <div className="text-2xl font-bold leading-none">{videos.length}</div>
            <div className="text-xs leading-none tracking-tight mt-1">{videos.length === 1 ? 'Vídeo' : 'Vídeos'}</div>
          </div>
        </div>
      </div>

      {renderContent()}

      {selectedVideo && editedVideo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            className="relative w-full max-w-6xl mx-auto h-auto max-h-[95vh] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl animate-slide-up flex flex-col lg:flex-row"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-black flex items-center justify-center flex-shrink-0 lg:flex-1">
              <video 
                key={selectedVideo.id}
                src={selectedVideo.link_s3} 
                controls 
                autoPlay 
                className="w-full h-auto max-h-[50vh] lg:max-h-full object-contain"
              >
                Seu navegador não suporta a tag de vídeo.
              </video>
            </div>
            
            <div className="p-6 flex flex-col text-white overflow-y-auto flex-1 lg:w-[400px] lg:flex-shrink-0 lg:flex-initial">
              <h2 className="text-2xl font-bold mb-6">Editar Detalhes</h2>
              <div className="space-y-4 flex-grow">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-400 mb-1">Título</label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    value={editedVideo.title || ''}
                    onChange={handleInputChange}
                    className="w-full bg-gray-800 border-gray-700 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
                  <textarea
                    name="description"
                    id="description"
                    rows={4}
                    value={editedVideo.description || ''}
                    onChange={handleInputChange}
                    className="w-full bg-gray-800 border-gray-700 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label htmlFor="tags_str" className="block text-sm font-medium text-gray-400 mb-1">Tags</label>
                  <input
                    type="text"
                    name="tags_str"
                    id="tags_str"
                    value={editedVideo.tags_str || ''}
                    onChange={handleInputChange}
                    placeholder="Ex: concurso, direito, adm"
                    className="w-full bg-gray-800 border-gray-700 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                   <p className="text-xs text-gray-500 mt-1">Separadas por vírgula.</p>
                </div>
                <div>
                  <label htmlFor="hashtags_str" className="block text-sm font-medium text-gray-400 mb-1">Hashtags</label>
                  <input
                    type="text"
                    name="hashtags_str"
                    id="hashtags_str"
                    value={editedVideo.hashtags_str || ''}
                    onChange={handleInputChange}
                    placeholder="Ex: #concurso #estudos"
                    className="w-full bg-gray-800 border-gray-700 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separadas por espaço.</p>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-700 flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={handleSaveChanges}
                  className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                  title="Salvar Alterações"
                >
                  <Save size={20} />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVideoToPost(selectedVideo)}
                    disabled={!!postingId}
                    className="p-3 bg-green-600/20 hover:bg-green-600/40 text-green-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Postar ou Agendar"
                  >
                    {postingId === selectedVideo.id ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-300"></div> : <Send size={20} />}
                  </button>
                  <button
                    onClick={(e) => handleDownload(selectedVideo.link_s3, editedVideo.title || 'video', e)}
                    className="p-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-colors"
                    title="Baixar"
                  >
                    <Download size={20} />
                  </button>
                  <button
                    onClick={(e) => handleReprove(selectedVideo.id, e)}
                    className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Reprovar"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
             <button 
                onClick={() => setSelectedVideo(null)}
                className="absolute top-3 right-3 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-1.5 transition-colors z-20"
              >
                <X size={24} />
              </button>
          </div>
        </div>
      )}

      <PostModal 
        video={videoToPost}
        onClose={() => setVideoToPost(null)}
        onPost={handlePost}
        isPosting={!!postingId}
      />
    </div>
  );
};

export default VideoGallery;
