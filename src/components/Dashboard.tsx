import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Youtube, Calendar, Video, Trash2, AlertCircle, Loader2 } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex items-center gap-6 transition-transform hover:-translate-y-1">
    <div className={`p-4 rounded-full ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

// Mock data for the chart
const mockChartData = [
  { name: 'Seg', Postados: 4 },
  { name: 'Ter', Postados: 3 },
  { name: 'Qua', Postados: 5 },
  { name: 'Qui', Postados: 2 },
  { name: 'Sex', Postados: 6 },
  { name: 'Sáb', Postados: 1 },
  { name: 'Dom', Postados: 4 },
];

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    posted: 0,
    scheduled: 0,
    inQueue: 0,
    reproved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const [postedRes, scheduledRes, inQueueRes, reprovedRes] = await Promise.all([
          supabase.from('shorts_apostilas').select('*', { count: 'exact', head: true }).eq('status', 'Posted'),
          supabase.from('shorts_apostilas').select('*', { count: 'exact', head: true }).not('publish_at', 'is', null).gt('publish_at', new Date().toISOString()),
          supabase.from('shorts_apostilas').select('*', { count: 'exact', head: true }).eq('failed', false).eq('status', 'Created').is('publish_at', null),
          supabase.from('shorts_apostilas').select('*', { count: 'exact', head: true }).eq('failed', true),
        ]);

        if (postedRes.error) throw postedRes.error;
        if (scheduledRes.error) throw scheduledRes.error;
        if (inQueueRes.error) throw inQueueRes.error;
        if (reprovedRes.error) throw reprovedRes.error;

        setStats({
          posted: postedRes.count ?? 0,
          scheduled: scheduledRes.count ?? 0,
          inQueue: inQueueRes.count ?? 0,
          reproved: reprovedRes.count ?? 0,
        });
      } catch (err: any) {
        console.error("Error fetching stats:", err);
        setError("Não foi possível carregar as estatísticas.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-center" role="alert">
          <AlertCircle className="mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Postados" value={stats.posted} icon={<Youtube size={24} className="text-white" />} color="bg-green-500" />
        <StatCard title="Agendados" value={stats.scheduled} icon={<Calendar size={24} className="text-white" />} color="bg-purple-500" />
        <StatCard title="Na Fila" value={stats.inQueue} icon={<Video size={24} className="text-white" />} color="bg-blue-500" />
        <StatCard title="Reprovados" value={stats.reproved} icon={<Trash2 size={24} className="text-white" />} color="bg-red-500" />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Atividade da Semana</h2>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={mockChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '0.5rem',
                }}
              />
              <Legend />
              <Bar dataKey="Postados" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
