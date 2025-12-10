import React, { useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import ReprovedVideos from './components/ReprovedVideos';
import PostedVideos from './components/PostedVideos';
import ScheduledVideos from './components/ScheduledVideos';
import RecentVideos from './components/RecentVideos';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import NotificationManager from './components/NotificationManager'; // Importar o Manager
import { Toaster } from 'sonner'; // Importar o Toaster UI
import { 
  Clapperboard, 
  Trash2, 
  Youtube, 
  Calendar, 
  BarChart2, 
  Settings as SettingsIcon, 
  Sparkles,
  Menu,
  X,
  LogOut,
  User,
  Shield
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

// Componente interno para usar o hook useAuth
const AppContent = () => {
  const { session, loading, profile, isAdmin } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (targetView: View) => {
    setView(targetView);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Sistema de Notificações */}
      <NotificationManager />
      <Toaster position="top-right" expand={true} richColors closeButton />

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
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[10px] md:text-xs text-gray-500 font-medium">Painel de Controle</p>
                  {profile?.role && (
                    <span className={`text-[9px] px-1.5 py-0 rounded-full uppercase font-bold tracking-wider ${
                      profile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      profile.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {profile.role}
                    </span>
                  )}
                </div>
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

            {/* Perfil e Logout (Desktop) */}
            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200 ml-2">
              <div className="flex items-center gap-2">
                {session.user.user_metadata.avatar_url ? (
                  <img 
                    src={session.user.user_metadata.avatar_url} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                    <User size={16} />
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>

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
          <div className="md:hidden border-t border-gray-100 bg-white absolute w-full left-0 shadow-lg animate-slide-up z-50">
            <div className="p-4 space-y-2">
              {/* User Info Mobile */}
              <div className="flex items-center gap-3 px-4 py-3 mb-2 border-b border-gray-100">
                {session.user.user_metadata.avatar_url ? (
                  <img 
                    src={session.user.user_metadata.avatar_url} 
                    alt="Avatar" 
                    className="w-10 h-10 rounded-full border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                    <User size={20} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.user.user_metadata.full_name || session.user.email}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                    {isAdmin && <Shield size={12} className="text-purple-600" />}
                  </div>
                </div>
              </div>

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
              
              <div className="pt-2 mt-2 border-t border-gray-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={20} />
                  Sair da conta
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-grow">
        <ErrorBoundary>
          {view === 'dashboard' && <Dashboard />}
          {view === 'recent' && <RecentVideos />}
          {view === 'scheduled' && <ScheduledVideos />}
          {view === 'posted' && <PostedVideos />}
          {view === 'reproved' && <ReprovedVideos />}
          {view === 'settings' && <Settings />}
        </ErrorBoundary>
      </main>
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
