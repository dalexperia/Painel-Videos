import React, { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { Sparkles, Tv } from 'lucide-react';

// Som de notificação sutil (Glass Ping) em Base64 para evitar requisições de rede
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'; // Placeholder curto, usaremos um real abaixo

// Som real (Short Ping)
const PLAY_SOUND = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

const NotificationManager: React.FC = () => {
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Solicitar permissão para notificações do sistema ao montar
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Configurar o canal do Realtime
    const channel = supabase
      .channel('shorts-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shorts_youtube',
        },
        (payload) => {
          const newVideo = payload.new;

          // Evitar duplicatas (caso o realtime dispare duas vezes)
          if (processedIds.current.has(newVideo.id)) return;
          processedIds.current.add(newVideo.id);

          // Limpar cache de IDs antigos para não estourar memória
          if (processedIds.current.size > 100) {
            const iterator = processedIds.current.values();
            processedIds.current.delete(iterator.next().value);
          }

          // Verificar se é um vídeo "Recente" (Status Created e sem data de publicação)
          if (newVideo.status === 'Created' && !newVideo.publish_at) {
            triggerAlert(newVideo);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const triggerAlert = (video: any) => {
    // 1. Tocar Som
    PLAY_SOUND();

    // 2. Mostrar Toast na UI (Sonner)
    toast.custom((t) => (
      <div className="bg-white dark:bg-gray-800 border border-brand-200 dark:border-brand-800 rounded-xl shadow-2xl p-4 flex items-start gap-4 w-full max-w-md animate-slide-up pointer-events-auto">
        <div className="bg-gradient-to-br from-brand-500 to-brand-600 p-2.5 rounded-lg shadow-lg shadow-brand-500/30 flex-shrink-0">
          <Sparkles className="text-white w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">
            Novo Vídeo Detectado!
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1 font-medium">
            {video.title || 'Vídeo sem título'}
          </p>
          {video.channel && (
            <div className="flex items-center gap-1 mt-2 text-xs text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-md w-fit">
              <Tv size={10} />
              {video.channel}
            </div>
          )}
        </div>
        <button 
          onClick={() => toast.dismiss(t)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <span className="sr-only">Fechar</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    ), {
      duration: 8000, // Fica na tela por 8 segundos
      position: 'top-right',
    });

    // 3. Notificação do Sistema (Nativa do OS)
    if ('Notification' in window && Notification.permission === 'granted') {
      // Verifica se a página está visível. Se estiver oculta, manda notificação do sistema.
      if (document.visibilityState === 'hidden') {
        new Notification('Novo Vídeo Recebido', {
          body: `${video.title || 'Sem título'} - ${video.channel || 'Canal desconhecido'}`,
          icon: '/vite.svg', // Fallback icon
          tag: video.id // Evita spam de notificações iguais
        });
      }
    }
  };

  return null; // Componente lógico, sem renderização direta
};

export default NotificationManager;
