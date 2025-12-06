import React, { useState } from 'react';
import ReprovedVideos from './components/ReprovedVideos';
import PostedVideos from './components/PostedVideos';
import ScheduledVideos from './components/ScheduledVideos';
import RecentVideos from './components/RecentVideos';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { Clapperboard, Trash2, Youtube, Calendar, BarChart2, Settings as SettingsIcon, Sparkles } from 'lucide-react';

type View = 'dashboard' | 'recent' | 'reproved' | 'posted' | 'scheduled' | 'settings';

const NavButton = ({
  activeView,
  targetView,
  onClick,
  children,
}: {
  activeView: View;
  targetView: View;
  onClick: () => void;
  children: React.ReactNode;
}) => {
  const isActive = activeView === targetView;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
        isActive
          ? 'bg-brand-500 text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  );
};

function App() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-brand-500 p-2 rounded-lg">
                <Clapperboard size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">
                Gerenciador
              </h1>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
              <NavButton activeView={view} targetView="dashboard" onClick={() => setView('dashboard')}>
                <BarChart2 size={18} />
                <span className="hidden sm:inline">Dashboard</span>
              </NavButton>
              <NavButton activeView={view} targetView="recent" onClick={() => setView('recent')}>
                <Sparkles size={18} />
                <span className="hidden sm:inline">Recentes</span>
              </NavButton>
              <NavButton activeView={view} targetView="scheduled" onClick={() => setView('scheduled')}>
                <Calendar size={18} />
                <span className="hidden sm:inline">Agendados</span>
              </NavButton>
              <NavButton activeView={view} targetView="posted" onClick={() => setView('posted')}>
                <Youtube size={18} />
                <span className="hidden sm:inline">Postados</span>
              </NavButton>
              <NavButton activeView={view} targetView="reproved" onClick={() => setView('reproved')}>
                <Trash2 size={18} />
                <span className="hidden sm:inline">Reprovados</span>
              </NavButton>
              <NavButton activeView={view} targetView="settings" onClick={() => setView('settings')}>
                <SettingsIcon size={18} />
                <span className="hidden sm:inline">Configurações</span>
              </NavButton>
            </nav>
          </div>
        </div>
      </header>
      <main>
        {view === 'dashboard' && <Dashboard />}
        {view === 'recent' && <RecentVideos />}
        {view === 'scheduled' && <ScheduledVideos />}
        {view === 'posted' && <PostedVideos />}
        {view === 'reproved' && <ReprovedVideos />}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default App;
