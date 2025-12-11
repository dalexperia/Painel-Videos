import React, { useState, useRef, useEffect } from 'react';
import { Play, Loader2, Film } from 'lucide-react';

interface VideoSmartPreviewProps {
  src: string;
  title?: string;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'auto';
}

const VideoSmartPreview: React.FC<VideoSmartPreviewProps> = ({ 
  src, 
  title, 
  className = "", 
  aspectRatio = 'video' 
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Delay para evitar "flicker" se o usuário passar o mouse muito rápido
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
      setIsLoading(true);
    }, 150); // Só carrega se ficar 150ms em cima
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovering(false);
    setIsLoading(true);
  };

  const handleVideoLoad = () => {
    setIsLoading(false);
  };

  const aspectRatioClass = aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : '';

  return (
    <div 
      className={`relative w-full bg-gray-900 overflow-hidden cursor-pointer group ${aspectRatioClass} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Placeholder (Sempre visível quando não está tocando) */}
      {!isHovering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 transition-all duration-300">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Film className="text-gray-400" size={24} />
          </div>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Passe para visualizar</span>
        </div>
      )}

      {/* Vídeo Real (Só montado no DOM quando hover) */}
      {isHovering && (
        <div className="absolute inset-0 bg-black animate-fade-in">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900/50 backdrop-blur-sm">
              <Loader2 className="animate-spin text-white/50" size={24} />
            </div>
          )}
          <video
            ref={videoRef}
            src={src}
            className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            autoPlay
            muted
            loop
            playsInline
            onLoadedData={handleVideoLoad}
          />
        </div>
      )}

      {/* Overlay de Play (Decorativo) */}
      <div className={`absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none transition-opacity duration-300 ${isHovering ? 'opacity-0' : 'opacity-100'}`}>
        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full shadow-lg">
          <Play size={24} className="text-white fill-white/20" />
        </div>
      </div>
    </div>
  );
};

export default VideoSmartPreview;
