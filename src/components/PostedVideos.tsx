import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchYouTubeStats, formatNumber, YouTubeStats } from '../lib/youtube';
import { Trash2, PlayCircle, AlertCircle, RefreshCw, LayoutGrid, List, Download, Youtube, X, Eye, ThumbsUp, Calendar, Edit2, Save, Search, Filter, Tv } from 'lucide-react';

interface Video {
  id: string;
  link_s3: string;
  title?: string;
  description?: string;
  youtube_id?: string;
  publish_at?: string;
  channel?: string;
}

type ViewMode = 'grid' | 'list';

const PostedVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoStats, setVideoStats] = useState<Record<string, YouTubeStats>>({});
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Estados para edição de data
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [newDateValue, setNewDateValue] = useState<string>('');

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    fetchPostedVideos();
  }, []);

  const fetchPostedVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      
      // Busca vídeos postados (data passada ou nula)
      const { data: videosData, error: videosError } = await supabase
        .from('shorts_youtube')
        .select('id, link_s3, title, description, youtube_id, publish_at, channel')
        .eq('failed', false)
        .eq('status', 'Posted')
        .or(`publish_at.lte.${now},publish_at.is.null`)
        .order('publish_at', { ascending: false });

      if (videosError) throw videosError;

      const validVideos = (videosData || []).filter((video): video is Video => 
        video && video.link_s3 && video.link_s3.trim() !== ''
      );
      
      setVideos(validVideos);

      // Busca stats do YouTube
      const { data: settingsData } = await supabase
        .from('shorts_settings')
        .select('channel, youtube_api_key');
      
      const channelKeys: Record<string, string> = {};
      if (settingsData) {
        settingsData.forEach(s => {
          if (s.channel && s.youtube_api_key) {
            channelKeys[s.channel.trim().toLowerCase()] = s.youtube_api_key;
          }
        });
      }

      const videosByChannel: Record<string, string[]> = {};
      validVideos.forEach(v => {
        const normalizedChannelName = v.channel ? v.channel.trim().toLowerCase() : '';
        if (v.youtube_id && normalizedChannelName && channelKeys[normalizedChannelName]) {
          const apiKey = channelKeys[normalizedChannelName];
          if (!videosByChannel[apiKey]) videosByChannel[apiKey] = [];
          videosByChannel[apiKey].push(v.youtube_id);
        }
      });

      const allStats: Record<string, YouTubeStats> = {};
      const promises = Object.entries(videosByChannel).map(async ([apiKey, ids]) => {
        if (apiKey) {
          const channelStats = await fetchYouTubeStats(ids, apiKey);
          Object.assign(allStats, channelStats);
        }
      });

      await Promise.all(promises);
      setVideoStats(allStats);

    } catch (err: any) {
      setError('Não foi possível carregar os vídeos postados.');
      console.error(err);
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

      // Filtro de Data (Publish At)
      let matchesDate = true;
      if (dateStart || dateEnd) {
        if (!video.publish_at) return false;
        const videoDate = new Date(video.publish_at).setHours(0,0,0,0);
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

  const handleReprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja reprovar este vídeo?')) return;

    try {
      const { error } = await supabase
        .from('shorts_youtube')
        .update({ failed: true })
        .eq('id', id);

      if (error) throw error;
      setVideos(videos.filter((video) => video.id !== id));
      if (selectedVideo?.id === id) setSelectedVideo(null);
    } catch (err) {
      console.error("Erro ao reprovar:", err);
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
      // Fallback: tenta abrir em nova aba se o download direto falhar
      window.open(url, '_blank');
    } finally {
      document.body.style.cursor = 'default';
    }
  };

  const startEditingDate = (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDateId(video.id);
    // Formata a data para o input datetime-local (YYYY-MM-DDThh:mm)
    if (video.publish_at) {
      const date = new Date(video.publish_at);
      // Ajuste simples para fuso horário local no input
      const offset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
      setNewDateValue(localISOTime);
    } else {
      setNewDateValue('');
    }
  };

  const saveDate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newDateValue) return;

    try {
      const isoDate = new Date(newDateValue).toISOString();
      
      const { error } = await supabase
        .from('shorts_youtube')
        .update({ publish_at: isoDate })
        .eq('id', id);

      if (error) throw error;

      // Atualiza localmente
      setVideos(videos.map(v => v.id === id ? { ...v, publish_at: isoDate } : v));
      setEditingDateId(null);
      
      // Se a data for futura, talvez devêssemos remover da lista de "Postados" e mover para "Agendados"?
      // Por enquanto, apenas atualizamos a visualização. Se o usuário der refresh, o vídeo sumirá daqui se a query filtrar.
      if (new Date(isoDate) > new Date()) {
        alert("Data atualizada para o futuro. Este vídeo aparecerá na aba 'Agendados' após recarregar.");
      }

    } catch (err) {
      console.error("Erro ao atualizar data:", err);
      alert("Erro ao salvar a nova data.");
    }
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDateId(null);
    setNewDateValue('');
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

    if (filteredVideos.length === 0) {
      return (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-100">
          <PlayCircle size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-gray-800 text-xl font-semibold">Nenhum vídeo encontrado</h3>
          <p className="text-gray-500 text-sm mt-2">
            {videos.length > 0 ? 'Tente ajustar os filtros de busca.' : 'Ainda não há vídeos publicados (com data passada).'}
          </p>
          {videos.length > 0 && (
            <button onClick={clearFilters} className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm">
              Limpar filtros
            </button>
          )}
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => {
            const stats = video.youtube_id ? videoStats[video.youtube_id] : null;
            const isEditing = editingDateId === video.id;
            
            return (
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
                  
                  {/* Data de Publicação Badge */}
                  <div 
                    className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer hover:bg-black/80 transition-colors z-20"
                    onClick={(e) => startEditingDate(video, e)}
                    title="Clique para corrigir a data"
                  >
                    <Calendar size={10} />
                    {video.publish_at 
                      ? <span>{new Date(video.publish_at).toLocaleDateString('pt-BR')}</span>
                      : <span>Sem data</span>
                    }
                    <Edit2 size={8} className="ml-1 opacity-70" />
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-grow">
                  {/* Edição de Data Inline */}
                  {isEditing && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100 animate-fade-in">
                      <label className="text-xs font-bold text-blue-800 block mb-1">Corrigir Data:</label>
                      <div className="flex gap-1">
                        <input 
                          type="datetime-local" 
                          value={newDateValue}
                          onChange={(e) => setNewDateValue(e.target.value)}
                          className="w-full text-xs p-1 border border-blue-200 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button 
                          onClick={(e) => saveDate(video.id, e)}
                          className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700"
                          title="Salvar"
                        >
                          <Save size={14} />
                        </button>
                        <button 
                          onClick={cancelEditing}
                          className="bg-gray-200 text-gray-600 p-1 rounded hover:bg-gray-300"
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-gray-800 line-clamp-2 min-h-[2.5rem] text-sm" title={video.title}>
                      {video.title || 'Vídeo sem título'}
                    </h3>
                  </div>
                  
                  {/* YouTube Stats Row */}
                  <div className="flex items-center gap-2 mb-3 mt-1">
                    {stats ? (
                      <>
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100" title="Visualizações">
                          <Eye size={12} className="text-blue-500" />
                          <span>{formatNumber(stats.viewCount)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100" title="Curtidas">
                          <ThumbsUp size={12} className="text-green-500" />
                          <span>{formatNumber(stats.likeCount)}</span>
                        </div>
                      </>
                    ) : video.youtube_id ? (
                      <div className="text-[10px] text-gray-400 italic">
                        {video.channel ? 'Sem dados' : 'Canal não config.'}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-300 italic">Não publicado</div>
                    )}
                  </div>

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
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredVideos.map((video) => {
          const stats = video.youtube_id ? videoStats[video.youtube_id] : null;
          const isEditing = editingDateId === video.id;

          return (
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
                
                {/* Stats na Lista */}
                <div className="flex items-center gap-4 mt-1 mb-1">
                  {stats ? (
                    <>
                      <div className="flex items-center gap-1 text-xs text-gray-500" title="Visualizações">
                        <Eye size={12} className="text-blue-500" />
                        <span>{formatNumber(stats.viewCount)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500" title="Curtidas">
                        <ThumbsUp size={12} className="text-green-500" />
                        <span>{formatNumber(stats.likeCount)}</span>
                      </div>
                    </>
                  ) : video.youtube_id ? (
                    <span className="text-[10px] text-gray-400">
                       {video.channel ? 'Sem dados' : 'Canal não config.'}
                    </span>
                  ) : null}
                  
                  {/* Data com Edição */}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1 animate-fade-in">
                        <input 
                          type="datetime-local" 
                          value={newDateValue}
                          onChange={(e) => setNewDateValue(e.target.value)}
                          className="text-xs p-1 border border-blue-300 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button onClick={(e) => saveDate(video.id, e)} className="text-blue-600 hover:text-blue-800"><Save size={14}/></button>
                        <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700"><X size={14}/></button>
                      </div>
                    ) : (
                      <span 
                        className="text-[10px] text-gray-400 flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={(e) => startEditingDate(video, e)}
                        title="Clique para editar a data"
                      >
                        <Calendar size={10} />
                        {video.publish_at ? new Date(video.publish_at).toLocaleDateString('pt-BR') : 'Sem data'}
                        <Edit2 size={8} />
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-500 line-clamp-1" title={video.description}>
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
          );
        })}
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Canal */}
          <div className="relative">
            <Tv size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-600"
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-600"
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
              
              {/* Stats no Modal */}
              {selectedVideo.youtube_id && videoStats[selectedVideo.youtube_id] && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                    <Eye size={16} className="text-blue-400" />
                    <span className="font-bold">{formatNumber(videoStats[selectedVideo.youtube_id].viewCount)}</span>
                    <span className="text-xs text-gray-400">visualizações</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                    <ThumbsUp size={16} className="text-green-400" />
                    <span className="font-bold">{formatNumber(videoStats[selectedVideo.youtube_id].likeCount)}</span>
                    <span className="text-xs text-gray-400">curtidas</span>
                  </div>
                </div>
              )}

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
