import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { 
  Youtube, Calendar, Video, Trash2, AlertCircle, Loader2, 
  TrendingUp, Activity, Layers, Zap 
} from 'lucide-react';

// --- Utilitários e Configurações ---

// Paleta de cores moderna e vibrante para os canais
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

// Função para gerar cor consistente baseada no nome do canal
const getChannelColor = (channelName: string, index: number) => {
  if (!channelName) return '#9ca3af'; // Cinza para sem canal
  return COLORS[index % COLORS.length];
};

// --- Componentes de UI ---

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: string;
  colorClass: string;
  bgClass: string;
}> = ({ title, value, icon, trend, colorClass, bgClass }) => (
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
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-gray-100 shadow-xl rounded-xl">
        <p className="font-bold text-gray-800 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600 font-medium">{entry.name}:</span>
            <span className="text-gray-900 font-bold">{entry.value}</span>
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
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Buscamos todos os dados relevantes para processar no front
        // Em produção com milhares de registros, isso deveria ser uma View ou RPC no Supabase
        const { data, error } = await supabase
          .from('shorts_youtube')
          .select('id, status, channel, created_at, publish_at, failed');

        if (error) throw error;
        setRawData(data || []);
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError("Não foi possível carregar os dados do dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Processamento de Dados (Memoized) ---

  const stats = useMemo(() => {
    return {
      posted: rawData.filter(i => i.status === 'Posted' && !i.failed).length,
      scheduled: rawData.filter(i => i.publish_at && new Date(i.publish_at) > new Date() && !i.failed).length,
      inQueue: rawData.filter(i => i.status === 'Created' && !i.publish_at && !i.failed).length,
      reproved: rawData.filter(i => i.failed).length,
    };
  }, [rawData]);

  // Dados por Canal
  const channelData = useMemo(() => {
    const channels: Record<string, { name: string, total: number, posted: number, scheduled: number, queue: number }> = {};

    rawData.forEach(item => {
      const channelName = item.channel || 'Sem Canal';
      if (!channels[channelName]) {
        channels[channelName] = { name: channelName, total: 0, posted: 0, scheduled: 0, queue: 0 };
      }
      
      channels[channelName].total++;
      
      if (item.failed) return; // Não conta status específicos se falhou, mas conta no total de volume
      
      if (item.status === 'Posted') channels[channelName].posted++;
      else if (item.publish_at && new Date(item.publish_at) > new Date()) channels[channelName].scheduled++;
      else if (item.status === 'Created') channels[channelName].queue++;
    });

    return Object.values(channels).sort((a, b) => b.total - a.total);
  }, [rawData]);

  // Dados para o Gráfico de Timeline (Últimos 7 dias)
  const timelineData = useMemo(() => {
    const days = 7;
    const data: any[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
      
      const dayStats: any = { name: dateStr };
      
      // Inicializa contadores para cada canal top
      channelData.forEach(c => dayStats[c.name] = 0);

      // Preenche
      rawData.forEach(item => {
        if (!item.created_at) return;
        const itemDate = new Date(item.created_at);
        if (itemDate.getDate() === d.getDate() && itemDate.getMonth() === d.getMonth()) {
          const cName = item.channel || 'Sem Canal';
          if (dayStats[cName] !== undefined) {
            dayStats[cName]++;
          }
        }
      });

      data.push(dayStats);
    }
    return data;
  }, [rawData, channelData]);

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
          <p className="text-gray-500 mt-1">Acompanhe o desempenho dos seus canais em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          <span className="px-3 py-1 text-xs font-semibold text-brand-700 bg-brand-50 rounded-md">Últimos 7 dias</span>
        </div>
      </div>

      {/* KPI Cards - Bento Grid Top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Vídeos Postados" 
          value={stats.posted} 
          icon={<Youtube size={24} />} 
          colorClass="text-green-600"
          bgClass="bg-green-100"
        />
        <StatCard 
          title="Agendados" 
          value={stats.scheduled} 
          icon={<Calendar size={24} />} 
          colorClass="text-purple-600"
          bgClass="bg-purple-100"
        />
        <StatCard 
          title="Na Fila" 
          value={stats.inQueue} 
          icon={<Video size={24} />} 
          colorClass="text-blue-600"
          bgClass="bg-blue-100"
        />
        <StatCard 
          title="Reprovados" 
          value={stats.reproved} 
          icon={<Trash2 size={24} />} 
          colorClass="text-red-600"
          bgClass="bg-red-100"
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline Chart (Ocupa 2 colunas) */}
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
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {channelData.map((channel, index) => (
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
                
                {channelData.map((channel, index) => (
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

        {/* Distribution Chart (Ocupa 1 coluna) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layers size={20} className="text-brand-500" />
              Distribuição
            </h2>
            <p className="text-sm text-gray-500">Share of Voice por canal</p>
          </div>

          <div className="flex-grow flex items-center justify-center relative">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="total"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getChannelColor(entry.name, index)} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Central Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-gray-900">{rawData.length}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {channelData.slice(0, 4).map((channel, index) => (
              <div key={channel.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: getChannelColor(channel.name, index) }} 
                  />
                  <span className="text-gray-600 truncate max-w-[120px]">{channel.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{Math.round((channel.total / rawData.length) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Channel Breakdown Cards */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Zap size={24} className="text-yellow-500" />
          Performance por Canal
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {channelData.map((channel, index) => (
            <div 
              key={channel.name} 
              className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
            >
              {/* Color Stripe */}
              <div 
                className="absolute top-0 left-0 w-1 h-full" 
                style={{ backgroundColor: getChannelColor(channel.name, index) }}
              />
              
              <div className="flex justify-between items-start mb-4 pl-2">
                <h3 className="font-bold text-gray-800 text-lg truncate pr-2">{channel.name}</h3>
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                  {channel.total} vídeos
                </span>
              </div>

              <div className="space-y-4 pl-2">
                {/* Mini Bar Chart for Status */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Progresso</span>
                    <span>{Math.round(((channel.posted + channel.scheduled) / (channel.total || 1)) * 100)}% processado</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 flex overflow-hidden">
                    <div 
                      className="bg-green-500 h-full" 
                      style={{ width: `${(channel.posted / channel.total) * 100}%` }} 
                      title="Postados"
                    />
                    <div 
                      className="bg-purple-500 h-full" 
                      style={{ width: `${(channel.scheduled / channel.total) * 100}%` }} 
                      title="Agendados"
                    />
                    <div 
                      className="bg-blue-400 h-full" 
                      style={{ width: `${(channel.queue / channel.total) * 100}%` }} 
                      title="Fila"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-700">{channel.posted}</div>
                    <div className="text-[10px] uppercase tracking-wide text-green-600 font-semibold">Postados</div>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded-lg">
                    <div className="text-lg font-bold text-purple-700">{channel.scheduled}</div>
                    <div className="text-[10px] uppercase tracking-wide text-purple-600 font-semibold">Agendados</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-700">{channel.queue}</div>
                    <div className="text-[10px] uppercase tracking-wide text-blue-600 font-semibold">Fila</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
