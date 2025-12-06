import React, { useState, useEffect } from 'react';
import { Video } from './VideoGallery';
import { Send, Calendar, X, Clock, Link, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// Extend the Video interface locally to ensure we handle the channel property
// even if the imported interface doesn't have it yet.
interface ExtendedVideo extends Video {
  channel?: string;
}

interface PostModalProps {
  video: ExtendedVideo | null;
  onClose: () => void;
  onPost: (video: Video, options: { scheduleDate?: string; webhookUrl: string }) => void;
  isPosting: boolean;
}

const PostModal: React.FC<PostModalProps> = ({ video, onClose, onPost, isPosting }) => {
  const [scheduleDate, setScheduleDate] = useState('');
  const [minDateTime, setMinDateTime] = useState('');
  const [activeWebhook, setActiveWebhook] = useState<string | null>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(true);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [videoChannel, setVideoChannel] = useState<string | null>(null);

  useEffect(() => {
    if (video) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5); // Set minimum time to 5 minutes in the future
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for local timezone
      const minDateTimeValue = now.toISOString().slice(0, 16);
      setMinDateTime(minDateTimeValue);
      setScheduleDate('');
      
      // Fetch active webhook specific to the video's channel
      fetchChannelAndWebhook();
    }
  }, [video]);

  const fetchChannelAndWebhook = async () => {
    if (!video) return;

    setLoadingWebhook(true);
    setWebhookError(null);
    setVideoChannel(null);

    try {
      let channel = video.channel;

      // 1. If channel is not passed in the prop, fetch it from the database
      if (!channel) {
        const { data: videoData, error: videoError } = await supabase
          .from('shorts_youtube')
          .select('channel')
          .eq('id', video.id)
          .single();

        if (videoError) {
          console.error("Error fetching video channel:", videoError);
        } else if (videoData) {
          channel = videoData.channel;
        }
      }

      setVideoChannel(channel || null);

      if (!channel) {
        setWebhookError('Este vídeo não possui um canal associado. Verifique o cadastro do vídeo.');
        return;
      }

      // Clean the channel string just in case
      const cleanChannel = channel.trim();

      // 2. Fetch the webhook specifically for this channel
      // Removed .eq('is_active', true) as it might not exist in the table
      const { data, error } = await supabase
        .from('shorts_settings')
        .select('webhook')
        .eq('channel', cleanChannel)
        .maybeSingle(); // Use maybeSingle instead of single to handle 0 rows gracefully

      if (error) {
        console.error("Supabase error fetching webhook:", error);
        throw error;
      } 
      
      if (data && data.webhook) {
        setActiveWebhook(data.webhook);
      } else {
        // If no data found, it means no row matched the channel name
        setWebhookError(`Nenhum webhook encontrado para o canal "${cleanChannel}". Verifique se o nome do canal na tabela 'shorts_settings' é exatamente igual.`);
      }
    } catch (err: any) {
      console.error("Error fetching webhook:", err);
      setWebhookError('Erro ao carregar as configurações do canal.');
    } finally {
      setLoadingWebhook(false);
    }
  };

  if (!video) return null;

  const handlePost = (options: { scheduleDate?: string }) => {
    if (!activeWebhook) {
      alert(webhookError || 'Não foi possível determinar o webhook do canal. Verifique as configurações.');
      return;
    }
    onPost(video, { ...options, webhookUrl: activeWebhook });
  };

  const handlePublishNow = () => {
    handlePost({});
  };

  const handleSchedule = () => {
    if (!scheduleDate) {
      alert('Por favor, selecione uma data e hora para agendar.');
      return;
    }
    // Format date to include seconds for the payload, as required format YYYY-MM-DDTHH:mm:ss
    const formattedDate = `${scheduleDate}:00`;
    handlePost({ scheduleDate: formattedDate });
  };

  const isPostButtonDisabled = isPosting || loadingWebhook || !!webhookError;
  const isScheduleButtonDisabled = isPostButtonDisabled || !scheduleDate;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Opções de Postagem</h2>
            <p className="text-sm text-gray-500 mt-2 line-clamp-2" title={video.title}>
              Você está postando: <strong>{video.title || 'Vídeo sem título'}</strong>
            </p>
            {videoChannel && (
              <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md font-medium">
                Canal: {videoChannel}
              </span>
            )}
          </div>

          <div className={`mt-6 mb-8 p-4 rounded-lg text-sm flex items-start gap-3 border ${webhookError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
            {webhookError ? (
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-600" />
            ) : (
              <Link size={18} className="flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-grow">
              <p className="font-semibold">
                {webhookError ? 'Erro de Configuração:' : 'Webhook Ativo:'}
              </p>
              {loadingWebhook ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Carregando configurações do canal...</span>
                </div>
              ) : webhookError ? (
                <p className="mt-1">{webhookError}</p>
              ) : (
                <p className="break-all mt-1 font-mono text-xs opacity-90">{activeWebhook}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handlePublishNow}
              disabled={isPostButtonDisabled}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed disabled:scale-100"
            >
              {isPosting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Postando...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Publicar Agora
                </>
              )}
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-xs font-medium text-gray-400 uppercase">Ou</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label htmlFor="schedule" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Clock size={16} />
                Agendar para uma data futura:
              </label>
              <input
                type="datetime-local"
                id="schedule"
                name="schedule"
                value={scheduleDate}
                min={minDateTime}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2 text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={handleSchedule}
                disabled={isScheduleButtonDisabled}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 text-base font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isPosting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Agendando...
                  </>
                ) : (
                  <>
                    <Calendar size={20} />
                    Confirmar Agendamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default PostModal;
