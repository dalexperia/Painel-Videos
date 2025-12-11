import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchYouTubeStats, fetchChannelStats, formatNumber, YouTubeStats, ChannelStats } from '../lib/youtube';
import { AutomationMonitor } from './AutomationMonitor';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { 
  Youtube, Calendar, Sparkles, Trash2, AlertCircle, Loader2, 
  TrendingUp, Activity, Layers, Zap, Eye, ThumbsUp, Trophy, Users, Video
} from 'lucide-react';

// --- Utilitários e Configurações ---

const COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
];

const getChannelColor = (channelName: string, index: number) => {
  if (!channelName) return '#9ca3af';
  return COLORS[index % COLORS.length];
};

// --- Componentes de UI ---

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  colorClass: string;
  bgClass: string;
  subValue?: string;
}> = ({ title, value, icon, trend, colorClass, bgClass, subValue }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-full transition-all hover:shadow-md hover:-translate-y-1">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${bgClass} ${colorClass}`}>
        {icon}
      </div>
      {trend && (
        <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <TrendingUp size={12} className="mr-1" />
          {trend}
        </span>
      )}
    </div>
    <div>
      <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </div>
  </div>
);

const ChannelCard: React.FC<{ stats: ChannelStats }> = ({ stats }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all">
    <div className="relative">
      {stats.avatarUrl ? (
        <img src={stats.avatarUrl} alt={stats.title} className="w-14 h-14 rounded-full border-2 border-gray-100" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
          <Youtube size={24} />
        </div>
      )}
      <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
        YT
      </div>
    </div>
    <div className="flex-grow min-w-0">
      <h4 className="font-bold text-gray-900 truncate" title={stats.title}>{stats.title}</h4>
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-1 text-xs text-gray-500" title="Inscritos">
          <Users size={12} />
          <span className="font-semibold text-gray-700">{formatNumber(stats.subscriberCount)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500" title="Total de Views">
          <Eye size={12} />
          <span className="font-semibold text-gray-700">{formatNumber(stats.viewCount)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500" title="Total de Vídeos">
          <Video size={12} />
          <span className="font-semibold text-gray-700">{formatNumber(stats.videoCount)}</span>
        </div>
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-gray-100 shadow-xl rounded-xl z-50">
        <p className="font-bold text-gray-800 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-gray-600 font-medium">{entry.name}:</span>
            <span className="text-gray-900 font-bold">
              {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Componente Principal ---

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [youtubeStats, setYoutubeStats] = useState<Record<string, YouTubeStats>>({});
  const [channelRealStats, setChannelRealStats] = useState<ChannelStats[]>([]);

  // Carregamento Inicial (Banco de Dados)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('shorts_youtube')
          .select('id, status, channel, created_at, publish_at, failed, link_s3, youtube_id, title');

        if (error) throw error;
        setRawData(data || []);
        
        // Inicia busca de stats do YouTube em segundo plano após carregar dados locais
        fetchStatsFromYouTube(data || []);

      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError(err.message || "Não foi possível carregar os dados do dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Busca de Stats do YouTube (Vídeos e Canais)
  const fetchStatsFromYouTube = async (videos: any[]) => {
    setLoadingStats(true);
    try {
      // 1. Pegar configurações (API Keys e Channel IDs)
      const { data: settingsData } = await supabase
        .from('shorts_settings')
        .select('channel, youtube_api_key, youtube_channel_id');
      
      const channelKeys: Record<string, string> = {};
      const channelIds: Record<string, string> = {}; // Mapeia API Key -> Channel ID para busca

      if (settingsData) {
        settingsData.forEach(s => {
          const normalizedName = s.channel.trim().toLowerCase();
          if (s.youtube_api_key) {
            channelKeys[normalizedName] = s.youtube_api_key;
            
            // Se tiver ID do canal configurado, vamos buscar stats dele
            if (s.youtube_channel_id) {
              // Armazena tupla [ID, Key]
              channelIds[s.youtube_channel_id] = s.youtube_api_key;
            }
          }
        });
      }

      // --- Busca Stats dos VÍDEOS ---
      const videosByChannel: Record<string, string[]> = {};
      videos.forEach(v => {
        if (v.youtube_id && v.channel) {
          const normalizedChannel = v.channel.trim().toLowerCase();
          const apiKey = channelKeys[normalizedChannel];
          
          if (apiKey) {
            if (!videosByChannel[apiKey]) videosByChannel[apiKey] = [];
            videosByChannel[apiKey].push(v.youtube_id);
          }
        }
      });

      const allVideoStats: Record<string, YouTubeStats> = {};
      const videoPromises = Object.entries(videosByChannel).map(async ([apiKey, ids]) => {
        const stats = await fetchYouTubeStats(ids, apiKey);
        Object.assign(allVideoStats, stats);
      });

      // --- Busca Stats dos CANAIS ---
      const channelStatsList: ChannelStats[] = [];
      const channelPromises = Object.entries(channelIds).map(async ([cId, apiKey]) => {
        const cStats = await fetchChannelStats(cId, apiKey);
        if (cStats) channelStatsList.push(cStats);
      });

      await Promise.all([...videoPromises, ...channelPromises]);
      
      setYoutubeStats(allVideoStats);
      setChannelRealStats(channelStatsList.sort((a, b) => parseInt(b.subscriberCount) - parseInt(a.subscriberCount)));

    } catch (err) {
      console.error("Erro ao buscar stats do YouTube:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  // --- Processamento de Dados ---

  const channelStats = useMemo(() => {
    const channels: Record<string, { 
      name: string, 
      total: number, 
      posted: number, 
      scheduled: number, 
      recent: number, 
      reproved: number,
      totalViews: number,
      totalLikes: number
    }> = {};

    const now = new Date();

    rawData.forEach(item => {
      if (!item.link_s3 || item.link_s3.trim() === '') return;

      const channelName = item.channel || 'Sem Canal';
      
      if (!channels[channelName]) {
        channels[channelName] = { 
          name: channelName, 
          total: 0, posted: 0, scheduled: 0, recent: 0, reproved: 0,
          totalViews: 0, totalLikes: 0
        };
      }

      // Stats do YouTube (Vídeos)
      if (item.youtube_id && youtubeStats[item.youtube_id]) {
        const stats = youtubeStats[item.youtube_id];
        channels[channelName].totalViews += parseInt(stats.viewCount || '0', 10);
        channels[channelName].totalLikes += parseInt(stats.likeCount || '0', 10);
      }

      let categorized = false;

      if (item.failed) {
        channels[channelName].reproved++;
        categorized = true;
      } else if (item.status === 'Posted' && item.publish_at && item.publish_at.trim() !== '' && new Date(item.publish_at) > now) {
        channels[channelName].scheduled++;
        categorized = true;
      } else if (item.status === 'Posted') {
        channels[channelName].posted++;
        categorized = true;
      } else if (item.status === 'Created') {
        const hasNoPublishDate = !item.publish_at || item.publish_at.trim() === '';
        const hasNoYoutubeId = !item.youtube_id || item.youtube_id.trim() === '';

        if (hasNoPublishDate && hasNoYoutubeId) {
          channels[channelName].recent++;
          categorized = true;
        }
      }

      if (categorized) channels[channelName].total++;
    });

    return Object.values(channels).sort((a, b) => b.total - a.total);
  }, [rawData, youtubeStats]);

  // Totais Globais
  const globalStats = useMemo(() => {
    return channelStats.reduce((acc, curr) => ({
      posted: acc.posted + curr.posted,
      scheduled: acc.scheduled + curr.scheduled,
      recent: acc.recent + curr.recent,
      reproved: acc.reproved + curr.reproved,
      views: acc.views + curr.totalViews,
      likes: acc.likes + curr.totalLikes
    }), { posted: 0, scheduled: 0, recent: 0, reproved: 0, views: 0, likes: 0 });
  }, [channelStats]);

  // Top Vídeos (Ranking)
  const topVideos = useMemo(() => {
    const videosWithStats = rawData
      .filter(v => v.youtube_id && youtubeStats[v.youtube_id])
      .map(v => ({
        ...v,
        views: parseInt(youtubeStats[v.youtube_id].viewCount || '0', 10),
        likes: parseInt(youtubeStats[v.youtube_id].likeCount || '0', 10)
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
    
    return videosWithStats;
  }, [rawData, youtubeStats]);

  // Dados para o Gráfico de Timeline (Produção)
  const timelineData = useMemo(() => {
    const days = 7;
    const data: any[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
      
      const dayStats: any = { name: dateStr };
      channelStats.forEach(c => dayStats[c.name] = 0);

      rawData.forEach(item => {
        if (!item.created_at || !item.link_s3) return;
        const itemDate = new Date(item.created_at);
        if (itemDate.getDate() === d.getDate() && itemDate.getMonth() === d.getMonth()) {
          const cName = item.channel || 'Sem Canal';
          if (dayStats[cName] !== undefined) dayStats[cName]++;
        }
      });
      data.push(dayStats);
    }
    return data;
  }, [rawData, channelStats]);

  // Dados para Gráfico de Views por Canal
  const viewsByChannelData = useMemo(() => {
    return channelStats
      .filter(c => c.totalViews > 0)
      .map(c => ({
        name: c.name,
        views: c.totalViews
      }))
      .sort((a, b) => b.views - a.views);
  }, [channelStats]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-center">
          <AlertCircle className="mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Visão Geral</h1>
          <p className="text-gray-500 mt-1">Acompanhe a produção e a performance dos seus canais.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Monitor de Automação */}
          <AutomationMonitor />

          {loadingStats && (
            <span className="flex items-center text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full animate-pulse">
              <Loader2 size={12} className="mr-1 animate-spin" />
              Atualizando métricas...
            </span>
          )}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            <span className="px-3 py-1 text-xs font-semibold text-brand-700 bg-brand-50 rounded-md">Últimos 7 dias</span>
          </div>
        </div>
      </div>

      {/* KPI Cards - Produção */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Postados" 
          value={globalStats.posted} 
          icon={<Youtube size={24} />} 
          colorClass="text-green-600"
          bgClass="bg-green-100"
        />
        <StatCard 
          title="Agendados" 
          value={globalStats.scheduled} 
          icon={<Calendar size={24} />} 
          colorClass="text-purple-600"
          bgClass="bg-purple-100"
        />
        <StatCard 
          title="Recentes" 
          value={globalStats.recent} 
          icon={<Sparkles size={24} />} 
          colorClass="text-blue-600"
          bgClass="bg-blue-100"
        />
        <StatCard 
          title="Reprovados" 
          value={globalStats.reproved} 
          icon={<Trash2 size={24} />} 
          colorClass="text-red-600"
          bgClass="bg-red-100"
        />
      </div>

      {/* Seção de Métricas Oficiais dos Canais (NOVO) */}
      {channelRealStats.length > 0 && (
        <div className="animate-fade-in">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Users size={20} className="text-brand-500" />
            Métricas Oficiais dos Canais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {channelRealStats.map((stats) => (
              <ChannelCard key={stats.id} stats={stats} />
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards - Performance (Vídeos) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Eye size={100} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <Eye size={20} />
              <span className="font-medium">Views em Vídeos Rastreados</span>
            </div>
            <div className="text-4xl font-bold mb-1">
              {loadingStats ? '...' : formatNumber(globalStats.views.toString())}
            </div>
            <p className="text-sm opacity-75">Soma dos vídeos no banco de dados</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-pink-100 text-pink-600 rounded-lg">
              <ThumbsUp size={20} />
            </div>
            <span className="text-gray-500 font-medium">Total de Curtidas</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {loadingStats ? '...' : formatNumber(globalStats.likes.toString())}
          </div>
          <p className="text-xs text-gray-400 mt-1">Engajamento positivo</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
              <Trophy size={20} />
            </div>
            <span className="text-gray-500 font-medium">Melhor Canal (Views)</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 truncate">
            {viewsByChannelData.length > 0 ? viewsByChannelData[0].name : '-'}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {viewsByChannelData.length > 0 
              ? `${formatNumber(viewsByChannelData[0].views.toString())} visualizações` 
              : 'Sem dados'}
          </p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline Chart (Produção) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Activity size={20} className="text-brand-500" />
                Produção por Canal
              </h2>
              <p className="text-sm text-gray-500">Volume de vídeos criados nos últimos 7 dias</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {channelStats.map((channel, index) => (
                    <linearGradient key={channel.name} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={getChannelColor(channel.name, index)} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={getChannelColor(channel.name, index)} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12 }} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                
                {channelStats.map((channel, index) => (
                  <Area
                    key={channel.name}
                    type="monotone"
                    dataKey={channel.name}
                    stackId="1"
                    stroke={getChannelColor(channel.name, index)}
                    fill={`url(#color${index})`}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Videos List (Ranking) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Trophy size={20} className="text-yellow-500" />
              Top 5 Vídeos
            </h2>
            <p className="text-sm text-gray-500">Melhor performance</p>
          </div>

          <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {topVideos.length > 0 ? (
              topVideos.map((video, index) => (
                <div key={video.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100">
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded-full font-bold text-gray-400 shadow-sm text-sm">
                    #{index + 1}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-semibold text-gray-900 truncate" title={video.title}>
                      {video.title || 'Sem título'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-500 truncate max-w-[80px]">
                        {video.channel}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
                        <Eye size={10} />
                        {formatNumber(video.views.toString())}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                <Activity size={32} className="mb-2 opacity-20" />
                <p>Sem dados de visualização ainda.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Views per Channel (Bar Chart) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Zap size={20} className="text-brand-500" />
              Audiência por Canal
            </h2>
            <p className="text-sm text-gray-500">Comparativo de visualizações totais</p>
          </div>
          
          <div className="h-[250px] w-full">
            {viewsByChannelData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={viewsByChannelData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 11, fill: '#4b5563' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 border border-gray-100 shadow-lg rounded-lg text-xs">
                            <span className="font-bold">{payload[0].payload.name}:</span> {formatNumber(payload[0].value as string)} views
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="views" radius={[0, 4, 4, 0]} barSize={20}>
                    {viewsByChannelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getChannelColor(entry.name, index)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Sem dados de audiência.
              </div>
            )}
          </div>
        </div>

        {/* Distribution Chart (Pie) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layers size={20} className="text-brand-500" />
              Volume de Produção
            </h2>
            <p className="text-sm text-gray-500">Share of Voice (Quantidade de vídeos)</p>
          </div>

          <div className="flex-grow flex items-center justify-center relative">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="total"
                  >
                    {channelStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getChannelColor(entry.name, index)} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Central Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-900">
                {channelStats.reduce((acc, curr) => acc + curr.total, 0)}
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Vídeos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
