import React, { useState, useEffect } from 'react';
import { Send, Calendar as CalendarIcon, X, Clock, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ptBR } from 'date-fns/locale';

// Tenta registrar o locale com segurança
try {
  registerLocale('pt-BR', ptBR);
} catch (e) {
  console.error("Erro ao registrar locale pt-BR:", e);
}

// Definindo a interface localmente para evitar dependência circular com VideoGallery
export interface Video {
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  status: string;
  created_at: string;
  channel?: string;
  failed?: boolean;
  publish_at?: string;
}

interface PostModalProps {
  video: Video | null;
  onClose: () => void;
  onPost: (video: Video, options: { scheduleDate?: string; webhookUrl: string }) => void;
  isPosting: boolean;
}

type PostMode = 'now' | 'schedule';

const PostModal: React.FC<PostModalProps> = ({ video, onClose, onPost, isPosting }) => {
  const [postMode, setPostMode] = useState<PostMode>('now');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeWebhook, setActiveWebhook] = useState<string | null>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(true);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [videoChannel, setVideoChannel] = useState<string | null>(null);

  useEffect(() => {
    if (video) {
      const now = new Date();
      
      // Default schedule time to 1 hour from now if not set
      if (!selectedDate) {
        const defaultTime = new Date(now.getTime() + 60 * 60000);
        setSelectedDate(defaultTime);
      }

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

      if (!channel) {
        const { data: videoData, error: videoError } = await supabase
          .from('shorts_youtube')
          .select('channel')
          .eq('id', video.id)
          .single();

        if (videoData) {
          channel = videoData.channel;
        }
      }

      setVideoChannel(channel || null);

      if (!channel) {
        setWebhookError('Vídeo sem canal associado.');
        return;
      }

      const cleanChannel = channel.trim();
      const { data, error } = await supabase
        .from('shorts_settings')
        .select('webhook')
        .eq('channel', cleanChannel)
        .maybeSingle();

      if (error) throw error;
      
      if (data && data.webhook) {
        setActiveWebhook(data.webhook);
      } else {
        setWebhookError(`Webhook não encontrado para "${cleanChannel}".`);
      }
    } catch (err: any) {
      console.error("Error:", err);
      setWebhookError('Erro ao carregar configurações.');
    } finally {
      setLoadingWebhook(false);
    }
  };

  const handleConfirm = () => {
    if (!video || !activeWebhook) return;

    if (postMode === 'schedule') {
      if (!selectedDate) {
        alert('Selecione uma data e hora.');
        return;
      }
      // Format: YYYY-MM-DDTHH:mm:ss
      const offset = selectedDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(selectedDate.getTime() - offset).toISOString().slice(0, 19);
      
      onPost(video, { scheduleDate: localISOTime, webhookUrl: activeWebhook });
    } else {
      onPost(video, { webhookUrl: activeWebhook });
    }
  };

  if (!video) return null;

  const isReady = !loadingWebhook && !webhookError && activeWebhook;
  const canSubmit = isReady && !isPosting && (postMode === 'now' || (postMode === 'schedule' && selectedDate));

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Publicar Vídeo</h2>
            <p className="text-xs text-gray-500 mt-0.5">Configure os detalhes do envio</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {/* Video Info Card */}
          <div className="flex gap-4 mb-6 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <div className="w-16 h-24 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden relative">
               <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                 <Zap size={24} />
               </div>
            </div>
            <div className="flex-1 min-w-0 py-1">
              <h3 className="font-semibold text-gray-800 line-clamp-2 text-sm mb-2" title={video.title}>
                {video.title || 'Vídeo sem título'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {videoChannel && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    {videoChannel}
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          {/* Webhook Status */}
          <div className={`mb-6 p-3 rounded-lg border text-sm flex items-center gap-3 ${
            webhookError 
              ? 'bg-red-50 border-red-100 text-red-700' 
              : loadingWebhook 
                ? 'bg-gray-50 border-gray-200 text-gray-600'
                : 'bg-green-50 border-green-100 text-green-700'
          }`}>
            {loadingWebhook ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : webhookError ? (
              <AlertTriangle size={18} className="flex-shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="flex-shrink-0" />
            )}
            
            <div className="flex-1">
              {loadingWebhook ? 'Verificando conexão...' : 
               webhookError ? webhookError : 
               <span className="font-medium">Conexão com canal estabelecida</span>}
            </div>
          </div>

          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setPostMode('now')}
              className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                postMode === 'now'
                  ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                  : 'border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Send size={24} className="mb-2" />
              <span className="font-semibold text-sm">Postar Agora</span>
              {postMode === 'now' && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setPostMode('schedule')}
              className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                postMode === 'schedule'
                  ? 'border-purple-500 bg-purple-50/50 text-purple-700'
                  : 'border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CalendarIcon size={24} className="mb-2" />
              <span className="font-semibold text-sm">Agendar</span>
              {postMode === 'schedule' && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Calendar Section */}
          {postMode === 'schedule' && (
            <div className="animate-slide-up">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={16} className="text-purple-500" />
                Data e Hora da Publicação
              </label>
              <div className="custom-datepicker-wrapper">
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => setSelectedDate(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="dd 'de' MMMM 'de' yyyy, HH:mm"
                  locale="pt-BR"
                  minDate={new Date()}
                  placeholderText="Selecione a data e hora"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-gray-700 font-medium shadow-sm"
                  calendarClassName="shadow-xl border-0 rounded-xl font-sans"
                  dayClassName={() => "rounded-full hover:bg-purple-100"}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 ml-1">
                O vídeo será enviado para a fila e processado na data escolhida.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={`flex-[2] flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl transition-all shadow-sm ${
              !canSubmit 
                ? 'bg-gray-300 cursor-not-allowed' 
                : postMode === 'now'
                  ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5'
                  : 'bg-purple-600 hover:bg-purple-700 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            {isPosting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/80"></div>
                Processando...
              </>
            ) : (
              <>
                {postMode === 'now' ? <Send size={18} /> : <CalendarIcon size={18} />}
                {postMode === 'now' ? 'Publicar Imediatamente' : 'Confirmar Agendamento'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom Styles for DatePicker integration with Tailwind */}
      <style>{`
        .react-datepicker-wrapper {
          width: 100%;
        }
        .react-datepicker__header {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          border-top-left-radius: 0.75rem !important;
          border-top-right-radius: 0.75rem !important;
          padding-top: 1rem;
        }
        .react-datepicker {
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem !important;
          font-family: inherit;
        }
        .react-datepicker__day--selected, 
        .react-datepicker__day--keyboard-selected,
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item--selected {
          background-color: #9333ea !important; /* purple-600 */
          color: white !important;
        }
        .react-datepicker__day:hover {
          background-color: #f3e8ff !important; /* purple-100 */
        }
        .react-datepicker__current-month {
          color: #374151;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .react-datepicker__day-name {
          color: #6b7280;
        }
        .react-datepicker__time-container {
          border-left: 1px solid #e5e7eb;
        }
        .react-datepicker__time-container .react-datepicker__time {
          border-top-right-radius: 0.75rem;
        }
      `}</style>
    </div>
  );
};

export default PostModal;
