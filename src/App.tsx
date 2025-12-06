import React, { useState } from 'react';
import ReprovedVideos from './components/ReprovedVideos';
import PostedVideos from './components/PostedVideos';
import ScheduledVideos from './components/ScheduledVideos';
import RecentVideos from './components/RecentVideos';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { 
  Clapperboard, 
  Trash2, 
  Youtube, 
  Calendar, 
  BarChart2, 
  Settings as SettingsIcon, 
  Sparkles,
  Menu,
  X
} from 'lucide-react';

type View = 'dashboard' | 'recent' | 'reproved' | 'posted' | 'scheduled' | 'settings';

interface NavItemProps {
  view: View;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItemProps[] = [
  { view: 'dashboard', label: 'Dashboard', icon: BarChart2 },
  { view: 'recent', label: 'Recentes', icon: Sparkles },
  { view: 'scheduled', label: 'Agendados', icon: Calendar },
  { view: 'posted', label: 'Postados', icon: Youtube },
  { view: 'reproved', label: 'Reprovados', icon: Trash2 },
  { view: 'settings', label: 'Configurações', icon: SettingsIcon },
];

const NavButton = ({
  activeView,
  targetView,
  onClick,
  children,
  className = ''
}: {
  activeView: View;
  targetView: View;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) => {
  const isActive = activeView === targetView;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
        isActive
          ? 'bg-brand-600 text-white shadow-md'
          : 'bg-gray-50 text-gray-600 hover:bg-gray-200 hover:text-gray-900 border border-transparent'
      } ${className}`}
    >
      {children}
    </button>
  );
};

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (targetView: View) => {
    setView(targetView);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header Responsivo */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16 md:h-20">
            
            {/* Logo e Título */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-brand-500 to-brand-600 p-2 rounded-lg md:p-2.5 md:rounded-xl shadow-sm">
                <Clapperboard className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight leading-none">
                  Gerenciador
                </h1>
                <p className="text-[10px] md:text-xs text-gray-500 font-medium mt-0.5">Painel de Controle</p>
              </div>
            </div>

            {/* Navegação Desktop */}
            <nav className="hidden md:flex items-center gap-2">
              {NAV_ITEMS.map((item) => (
                <NavButton
                  key={item.view}
                  activeView={view}
                  targetView={item.view}
                  onClick={() => handleNavClick(item.view)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavButton>
              ))}
            </nav>

            {/* Botão Menu Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Menu Mobile Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white absolute w-full left-0 shadow-lg animate-slide-up">
            <div className="p-4 space-y-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.view}
                  onClick={() => handleNavClick(item.view)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    view === item.view
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon size={20} className={view === item.view ? 'text-brand-600' : 'text-gray-500'} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-grow">
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
