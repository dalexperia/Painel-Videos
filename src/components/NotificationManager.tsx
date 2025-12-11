import React, { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';
import { Sparkles, Tv } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

// Som real (Short Ping) com tratamento de erro
const PLAY_SOUND = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const audioContext = new AudioContext();
    
    // Verifica se o contexto está suspenso (comum em navegadores modernos)
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {
        // Se falhar o resume, ignoramos silenciosamente
      });
    }

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
    // Ignora erros de áudio para não quebrar a aplicação
    console.warn("Audio play prevented by browser policy or error", e);
  }
};

const NotificationManager: React.FC = () => {
  // Armazena IDs que JÁ geraram alerta para evitar spam
  const alertedIds = useRef<Set<string>>(new Set());
  
  // Hook do contexto para incrementar o contador
  const { increment } = useNotifications();

  useEffect(() => {
    // Solicitar permissão para notificações do sistema ao montar
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    console.log('🔔 NotificationManager: Iniciando monitoramento...');

    // Configurar o canal do Realtime
    const channel = supabase
      .channel('shorts-alerts-v2')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta TUDO (INSERT e UPDATE)
          schema: 'public',
          table: 'shorts_youtube',
        },
        (payload) => {
          const newVideo = payload.new as any;
          
          if (!newVideo || !newVideo.id) return;

          // 1. Verifica se o vídeo está PRONTO (Created) e NÃO publicado
          // Isso pega tanto INSERT direto quanto UPDATE (ex: status mudou de 'Processing' para 'Created')
          const isReady = newVideo.status === 'Created' && !newVideo.publish_at;

          if (isReady) {
            // 2. Verifica se já alertamos sobre este ID específico
            if (alertedIds.current.has(newVideo.id)) {
              return;
            }

            // 3. Se passou pelos filtros, dispara o alerta e marca como alertado
            console.log('✨ Novo vídeo detectado (Alerta):', newVideo.title);
            triggerAlert(newVideo);
            alertedIds.current.add(newVideo.id);

            // Limpeza de memória
            if (alertedIds.current.size > 100) {
              const iterator = alertedIds.current.values();
              alertedIds.current.delete(iterator.next().value);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Status da conexão Realtime (Alertas):', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [increment]); // Adicionado increment como dependência

  const triggerAlert = (video: any) => {
    // 0. Incrementar contador global
    increment();

    // 1. Tocar Som (Tentativa segura)
    PLAY_SOUND();

    // 2. Mostrar Toast na UI (Sonner)
    toast.custom((t) => (
      <div 
        className="bg-white dark:bg-gray-800 border border-brand-200 dark:border-brand-800 rounded-xl shadow-2xl p-4 flex items-start gap-4 w-full max-w-md animate-slide-up pointer-events-auto cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => {
          toast.dismiss(t);
          window.focus();
        }}
      >
        <div className="bg-gradient-to-br from-brand-500 to-brand-600 p-2.5 rounded-lg shadow-lg shadow-brand-500/30 flex-shrink-0">
          <Sparkles className="text-white w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">
            Novo Vídeo Criado!
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 font-medium">
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
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(t);
          }}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <span className="sr-only">Fechar</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    ), {
      duration: 8000,
      position: 'top-right',
    });

    // 3. Notificação do Sistema
    if ('Notification' in window && Notification.permission === 'granted') {
      if (document.visibilityState === 'hidden') {
        try {
          new Notification('Novo Vídeo Recebido', {
            body: `${video.title || 'Sem título'} - ${video.channel || 'Canal desconhecido'}`,
            icon: '/vite.svg',
            tag: video.id
          });
        } catch (e) {
          console.error('Erro ao enviar notificação nativa:', e);
        }
      }
    }
  };

  return null;
};

export default NotificationManager;
