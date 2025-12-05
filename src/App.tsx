import React, { useState } from 'react';
import VideoGallery from './components/VideoGallery';
import ReprovedVideos from './components/ReprovedVideos';
import PostedVideos from './components/PostedVideos';
import { Video, Clapperboard, Trash2, Youtube } from 'lucide-react';

type View = 'gallery' | 'reproved' | 'posted';

function App() {
  const [view, setView] = useState<View>('gallery');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clapperboard size={28} className="text-blue-600" />
              <h1 className="text-lg sm:text-xl font-bold text-gray-800">Gerenciador</h1>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setView('gallery')}
                className={`py-4 px-2 sm:px-3 font-medium transition-all duration-200 flex items-center gap-2 border-b-2 ${
                  view === 'gallery'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 hover:text-blue-600 border-transparent hover:border-blue-200'
                }`}
              >
                <Video size={18} />
                <span className="hidden sm:inline">Fila</span>
              </button>
              <button
                onClick={() => setView('posted')}
                className={`py-4 px-2 sm:px-3 font-medium transition-all duration-200 flex items-center gap-2 border-b-2 ${
                  view === 'posted'
                    ? 'text-green-600 border-green-600'
                    : 'text-gray-500 hover:text-green-600 border-transparent hover:border-green-200'
                }`}
              >
                <Youtube size={18} />
                <span className="hidden sm:inline">Postados</span>
              </button>
              <button
                onClick={() => setView('reproved')}
                className={`py-4 px-2 sm:px-3 font-medium transition-all duration-200 flex items-center gap-2 border-b-2 ${
                  view === 'reproved'
                    ? 'text-red-600 border-red-600'
                    : 'text-gray-500 hover:text-red-600 border-transparent hover:border-red-200'
                }`}
              >
                 <Trash2 size={18} />
                <span className="hidden sm:inline">Reprovados</span>
              </button>
            </nav>
          </div>
        </div>
      </header>
      <main>
        {view === 'gallery' && <VideoGallery />}
        {view === 'posted' && <PostedVideos />}
        {view === 'reproved' && <ReprovedVideos />}
      </main>
    </div>
  );
}

export default App;
