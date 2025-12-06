import React, { useState, useEffect } from 'react';
import { Video } from './VideoGallery';
import { Send, Calendar, X, Clock, Link } from 'lucide-react'; // Added Link icon
import { supabase } from '../lib/supabaseClient'; // Import supabase client

interface PostModalProps {
  video: Video | null;
  onClose: () => void;
  onPost: (video: Video, options: { scheduleDate?: string; webhookUrl: string }) => void; // Updated onPost signature
  isPosting: boolean;
}

const PostModal: React.FC<PostModalProps> = ({ video, onClose, onPost, isPosting }) => {
  const [scheduleDate, setScheduleDate] = useState('');
  const [minDateTime, setMinDateTime] = useState('');
  const [activeWebhook, setActiveWebhook] = useState<string | null>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(true);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  useEffect(() => {
    if (video) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5); // Set minimum time to 5 minutes in the future
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for local timezone
      const minDateTimeValue = now.toISOString().slice(0, 16);
      setMinDateTime(minDateTimeValue);
      setScheduleDate('');
      
      // Fetch active webhook when modal opens
      fetchActiveWebhook();
    }
  }, [video]);

  const fetchActiveWebhook = async () => {
    setLoadingWebhook(true);
    setWebhookError(null);
    try {
      const { data, error } = await supabase
        .from('shorts_settings')
        .select('webhook')
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          setWebhookError('Nenhum canal ativo encontrado. Por favor, configure um canal nas configurações.');
        } else {
          throw error;
        }
      } else if (data) {
        setActiveWebhook(data.webhook);
      } else {
        setWebhookError('Nenhum canal ativo encontrado. Por favor, configure um canal nas configurações.');
      }
    } catch (err: any) {
      console.error("Error fetching active webhook:", err);
      setWebhookError('Erro ao carregar o webhook ativo.');
    } finally {
      setLoadingWebhook(false);
    }
  };

  if (!video) return null;

  const handlePost = (options: { scheduleDate?: string }) => {
    if (!activeWebhook) {
      alert(webhookError || 'Não foi possível determinar o webhook ativo. Verifique as configurações.');
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
          </div>

          <div className="mt-6 mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-3">
            <Link size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Webhook Ativo:</p>
              {loadingWebhook ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Carregando...</span>
                </div>
              ) : webhookError ? (
                <p className="text-red-600 mt-1">{webhookError}</p>
              ) : (
                <p className="break-all mt-1">{activeWebhook}</p>
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
