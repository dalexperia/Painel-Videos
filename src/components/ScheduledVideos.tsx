import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Trash2, PlayCircle, AlertCircle, RefreshCw, LayoutGrid, List, 
  Download, X, Calendar as CalendarIcon, Tv, Edit2, Save, Search, 
  Filter, CheckCircle2, Clock, ChevronLeft, ChevronRight, RotateCcw
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, 
  isToday, parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Video {
  id: string;
  link_s3: string;
  title?: string;
  description?: string;
  publish_at?: string;
  channel?: string;
  youtube_id?: string;
}

type ViewMode = 'grid' | 'list' | 'calendar';

// Paleta de cores idêntica ao Dashboard
const DASHBOARD_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
];

const ScheduledVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // Estados para o Calendário
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Estados para edição de data
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [newDateValue, setNewDateValue] = useState<string>('');

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    fetchScheduledVideos();
  }, []);

  const fetchScheduledVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('shorts_youtube')
        .select('id, link_s3, title, description, publish_at, channel, youtube_id')
        .eq('failed', false)
        .eq('status', 'Posted')
        .not('publish_at', 'is', null)
        .gt('publish_at', new Date().toISOString())
        .order('publish_at', { ascending: true });

      if (error) throw error;

      const validVideos = (data || []).filter((video): video is Video => 
        video && video.link_s3 && video.link_s3.trim() !== ''
      );
      
      setVideos(validVideos);

    } catch (err: any) {
      setError('Não foi possível carregar os vídeos agendados.');
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Filtragem
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      const matchesSearch = video.title?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesChannel = selectedChannel ? video.channel === selectedChannel : true;

      let matchesDate = true;
      if (viewMode !== 'calendar') {
        if (dateStart || dateEnd) {
          if (!video.publish_at) return false;
          const videoDate = new Date(video.publish_at).setHours(0,0,0,0);
          const start = dateStart ? new Date(dateStart).setHours(0,0,0,0) : null;
          const end = dateEnd ? new Date(dateEnd).setHours(0,0,0,0) : null;

          if (start && videoDate < start) matchesDate = false;
          if (end && videoDate > end) matchesDate = false;
        }
      }

      return matchesSearch && matchesChannel && matchesDate;
    });
  }, [videos, searchTerm, selectedChannel, dateStart, dateEnd, viewMode]);

  // Lista única de canais ordenada alfabeticamente para consistência de cores
  const uniqueChannels = useMemo(() => {
    const channels = videos.map(v => v.channel).filter(Boolean) as string[];
    return Array.from(new Set(channels)).sort();
  }, [videos]);

  // Função para pegar a cor baseada no índice do canal na lista ordenada
  const getChannelColorHex = (channel?: string) => {
    if (!channel) return '#9ca3af'; // Gray default
    const index = uniqueChannels.indexOf(channel);
    if (index === -1) return '#9ca3af';
    return DASHBOARD_COLORS[index % DASHBOARD_COLORS.length];
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedChannel('');
    setDateStart('');
    setDateEnd('');
  };

  // --- Ações de Vídeo ---
  
  const handleReprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja reprovar este vídeo?')) return;

    try {
      const { error } = await supabase.from('shorts_youtube').update({ failed: true }).eq('id', id);
      if (error) throw error;
      setVideos(videos.filter((video) => video.id !== id));
      if (selectedVideo?.id === id) setSelectedVideo(null);
      toast.success('Vídeo reprovado.');
    } catch (err) {
      toast.error('Erro ao reprovar o vídeo.');
    }
  };

  const handleRevertToRecent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Deseja cancelar o agendamento e mover para "Recentes"?')) return;

    try {
      const { error } = await supabase
        .from('shorts_youtube')
        .update({ 
          publish_at: null,
          status: 'Created',
          youtube_id: null 
        })
        .eq('id', id);

      if (error) throw error;

      setVideos(videos.filter((video) => video.id !== id));
      if (selectedVideo?.id === id) setSelectedVideo(null);
      toast.success('Vídeo movido para Recentes com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao reverter vídeo.');
    }
  };

  const handleDownload = async (url: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return toast.error('URL inválida');
    try {
      document.body.style.cursor = 'wait';
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${(title || 'video').replace(/[^a-z0-9]/gi, '_')}.mp4`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      window.open(url, '_blank');
    } finally {
      document.body.style.cursor = 'default';
    }
  };

  const startEditingDate = (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDateId(video.id);
    if (video.publish_at) {
      const date = new Date(video.publish_at);
      const iso = date.toISOString().slice(0, 16); 
      setNewDateValue(iso);
    } else {
      setNewDateValue('');
    }
  };

  const saveDate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newDateValue) return;
    try {
      const isoDateWithOffset = new Date(newDateValue).toISOString();
      const { error } = await supabase.from('shorts_youtube').update({ publish_at: isoDateWithOffset }).eq('id', id);
      if (error) throw error;
      setVideos(videos.map(v => v.id === id ? { ...v, publish_at: isoDateWithOffset } : v));
      setEditingDateId(null);
      toast.success('Data atualizada!');
    } catch (err) {
      toast.error("Erro ao salvar a nova data.");
    }
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDateId(null);
    setNewDateValue('');
  };

  const formatPublishDate = (dateString?: string) => {
    if (!dateString) return 'Data não definida';
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm");
    } catch (e) {
      return 'Data inválida';
    }
  };

  // --- Lógica do Calendário ---

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-900 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center bg-white rounded-md border border-gray-300 shadow-sm">
              <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-l-md border-r border-gray-200">
                <ChevronLeft size={18} />
              </button>
              <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium hover:bg-gray-100 text-gray-700">
                Hoje
              </button>
              <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-r-md border-l border-gray-200">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          {weekDays.map(day => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid - Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-7 bg-gray-200 gap-px border-b border-gray-200 min-h-full">
            {calendarDays.map((day, dayIdx) => {
              const isSelectedMonth = isSameMonth(day, monthStart);
              const isTodayDate = isToday(day);
              
              const dayVideos = filteredVideos.filter(video => 
                video.publish_at && isSameDay(parseISO(video.publish_at), day)
              ).sort((a, b) => {
                if (!a.publish_at || !b.publish_at) return 0;
                return new Date(a.publish_at).getTime() - new Date(b.publish_at).getTime();
              });

              return (
                <div 
                  key={day.toString()} 
                  className={`
                    min-h-[140px] p-2 flex flex-col gap-1 transition-all relative
                    ${!isSelectedMonth ? 'bg-gray-50/50 text-gray-400' : 'bg-white'}
                    hover:bg-gray-50
                  `}
                >
                  {/* Header do Dia */}
                  <div className="flex justify-center mb-1">
                    <span className={`
                      text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                      ${isTodayDate ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500'}
                    `}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Lista de Vídeos (Estilo Linha Única) */}
                  <div className="flex flex-col gap-0.5">
                    {dayVideos.map((video) => (
                      <div 
                        key={video.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVideo(video);
                        }}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-gray-100 cursor-pointer transition-colors group"
                        title={`${video.title || 'Sem título'} - ${video.channel}`}
                      >
                        {/* Bolinha Colorida */}
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: getChannelColorHex(video.channel) }}
                        />
                        
                        {/* Hora */}
                        <span className="text-[11px] font-medium text-gray-500 flex-shrink-0">
                          {video.publish_at ? format(parseISO(video.publish_at), 'HH:mm') : '--:--'}
                        </span>

                        {/* Nome do Canal */}
                        <span className="text-[11px] font-semibold text-gray-700 truncate">
                          {video.channel || 'Sem canal'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // --- Renderização Principal ---

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative flex items-center justify-center">
          <AlertCircle className="mr-2" />
          <span>{error}</span>
        </div>
      );
    }

    if (filteredVideos.length === 0 && viewMode !== 'calendar') {
      return (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-100">
          <CalendarIcon size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-gray-800 text-xl font-semibold">Nenhum vídeo encontrado</h3>
          <p className="text-gray-500 text-sm mt-2">Tente ajustar os filtros de busca.</p>
          <button onClick={clearFilters} className="mt-4 text-purple-600 hover:text-purple-700 font-medium text-sm">
            Limpar filtros
          </button>
        </div>
      );
    }

    if (viewMode === 'calendar') {
      return renderCalendar();
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => {
            const isEditing = editingDateId === video.id;
            const hasYoutubeId = !!video.youtube_id;
            
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
                  {video.channel && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      <Tv size={10} />
                      <span className="truncate max-w-[100px]">{video.channel}</span>
                    </div>
                  )}
                  <div className={`absolute top-2 left-2 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1 ${hasYoutubeId ? 'bg-green-600/80' : 'bg-yellow-600/80'}`}>
                    {hasYoutubeId ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                    <span>{hasYoutubeId ? 'Sincronizado' : 'Aguardando ID'}</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 min-h-[3rem]" title={video.title}>
                    {video.title || 'Vídeo sem título'}
                  </h3>
                  
                  <div className="mb-4">
                    {isEditing ? (
                      <div className="p-2 bg-purple-50 rounded-lg border border-purple-100 animate-fade-in">
                        <label className="text-xs font-bold text-purple-800 block mb-1">Nova Data:</label>
                        <div className="flex gap-1">
                          <input 
                            type="datetime-local" 
                            value={newDateValue}
                            onChange={(e) => setNewDateValue(e.target.value)}
                            className="w-full text-xs p-1 border border-purple-200 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button onClick={(e) => saveDate(video.id, e)} className="bg-purple-600 text-white p-1 rounded hover:bg-purple-700"><Save size={14} /></button>
                          <button onClick={cancelEditing} className="bg-gray-200 text-gray-600 p-1 rounded hover:bg-gray-300"><X size={14} /></button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 rounded-md px-2 py-1 cursor-pointer hover:bg-purple-100 transition-colors w-fit"
                        onClick={(e) => startEditingDate(video, e)}
                        title="Clique para editar a data"
                      >
                        <CalendarIcon size={14} />
                        <span className="font-medium">{formatPublishDate(video.publish_at)}</span>
                        <Edit2 size={12} className="opacity-50" />
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-4 flex items-center gap-2 border-t border-gray-100">
                    <button
                      onClick={(e) => handleDownload(video.link_s3, video.title || 'video', e)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Baixar Vídeo"
                    >
                      <Download size={16} />
                      <span className="hidden xl:inline">Baixar</span>
                    </button>
                    <button
                      onClick={(e) => handleRevertToRecent(video.id, e)}
                      className="flex items-center justify-center p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Reverter para Recentes"
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      onClick={(e) => handleReprove(video.id, e)}
                      className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Reprovar Vídeo"
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

    // List View
    return (
      <div className="space-y-3">
        {filteredVideos.map((video) => {
          const isEditing = editingDateId === video.id;
          const hasYoutubeId = !!video.youtube_id;

          return (
            <div
              key={video.id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center p-3 gap-4"
            >
              <div
                className="relative w-full sm:w-32 h-20 bg-gray-900 rounded-md overflow-hidden cursor-pointer flex-shrink-0 group"
                onClick={() => setSelectedVideo(video)}
              >
                <video src={video.link_s3} className="w-full h-full object-cover" muted preload="metadata" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayCircle size={24} className="text-white" />
                </div>
                <div className={`absolute top-1 left-1 text-white text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 ${hasYoutubeId ? 'bg-green-600/80' : 'bg-yellow-600/80'}`}>
                  {hasYoutubeId ? <CheckCircle2 size={8} /> : <Clock size={8} />}
                </div>
              </div>
              <div className="flex-grow min-w-0">
                <h3 className="font-semibold text-gray-800 truncate" title={video.title}>
                  {video.title || 'Vídeo sem título'}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <input 
                        type="datetime-local" 
                        value={newDateValue}
                        onChange={(e) => setNewDateValue(e.target.value)}
                        className="text-xs p-1 border border-purple-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button onClick={(e) => saveDate(video.id, e)} className="text-purple-600 hover:text-purple-800"><Save size={14}/></button>
                      <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700"><X size={14}/></button>
                    </div>
                  ) : (
                    <div 
                      className="flex items-center gap-2 text-sm text-purple-600 cursor-pointer hover:text-purple-800 transition-colors"
                      onClick={(e) => startEditingDate(video, e)}
                      title="Clique para editar"
                    >
                      <CalendarIcon size={14} />
                      <span className="font-medium">{formatPublishDate(video.publish_at)}</span>
                      <Edit2 size={12} className="opacity-50" />
                    </div>
                  )}
                  
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
                  onClick={(e) => handleDownload(video.link_s3, video.title || 'video', e)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Download size={16} />
                  <span className="hidden md:inline">Baixar</span>
                </button>
                <button
                  onClick={(e) => handleRevertToRecent(video.id, e)}
                  className="flex items-center justify-center p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Reverter para Recentes"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={(e) => handleReprove(video.id, e)}
                  className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Reprovar"
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
    <div className="container mx-auto px-4 py-8 max-w-7xl h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4 border-gray-200 flex-shrink-0">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Vídeos Agendados</h1>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Visualização em Calendário"
            >
              <CalendarIcon size={20} />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Visualização em Grade"
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Visualização em Lista"
            >
              <List size={20} />
            </button>
          </div>
          <button 
            onClick={fetchScheduledVideos}
            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
            title="Recarregar lista"
          >
            <RefreshCw size={22} />
          </button>
          <div className="bg-purple-100 text-purple-800 text-center rounded-2xl px-5 py-2 shadow-sm">
            <div className="text-2xl font-bold leading-none">{filteredVideos.length}</div>
            <div className="text-xs leading-none tracking-tight mt-1">{filteredVideos.length === 1 ? 'Vídeo' : 'Vídeos'}</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center flex-shrink-0">
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Canal */}
          <div className="relative">
            <Tv size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Todos os Canais</option>
              {uniqueChannels.map(channel => (
                <option key={channel} value={channel}>{channel}</option>
              ))}
            </select>
          </div>

          {/* Data Início */}
          <div className={`relative ${viewMode === 'calendar' ? 'opacity-50 pointer-events-none' : ''}`}>
            <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-600"
              placeholder="De"
              disabled={viewMode === 'calendar'}
            />
          </div>

          {/* Data Fim */}
          <div className={`relative ${viewMode === 'calendar' ? 'opacity-50 pointer-events-none' : ''}`}>
            <CalendarIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-600"
              placeholder="Até"
              disabled={viewMode === 'calendar'}
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

      <div className="flex-1 min-h-0 overflow-y-auto">
        {renderContent()}
      </div>

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
                <div className="flex items-center gap-2 text-sm text-purple-300 bg-purple-500/20 rounded-md px-3 py-1.5">
                  <CalendarIcon size={16} />
                  <span className="font-medium">{formatPublishDate(selectedVideo.publish_at)}</span>
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
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <button
                  onClick={(e) => handleDownload(selectedVideo.link_s3, selectedVideo.title || 'video', e)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-semibold"
                >
                  <Download size={18} />
                  <span>Baixar</span>
                </button>
                <button
                  onClick={(e) => handleRevertToRecent(selectedVideo.id, e)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors font-semibold"
                >
                  <RotateCcw size={18} />
                  <span>Reverter</span>
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

export default ScheduledVideos;
