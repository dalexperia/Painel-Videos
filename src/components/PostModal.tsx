import React, { useState, useEffect } from 'react';
import { Send, Calendar as CalendarIcon, X, Clock, CheckCircle2, AlertTriangle, Zap, Wifi, WifiOff, RefreshCw, Globe, Server, Info } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ptBR } from 'date-fns/locale';
import { initializeGoogleApi, requestGoogleAuth, uploadVideoToYouTube } from '../lib/googleUpload';

// Tenta registrar o locale com segurança
try {
  registerLocale('pt-BR', ptBR);
} catch (e) {
  console.error("Erro ao registrar locale pt-BR:", e);
}

export interface Video {
  id: number | string;
  baserow_id?: number;
  title: string;
  description?: string;
  link_s3: string;
  link_drive?: string;
  channel?: string;
  hashtags?: string[] | string;
  tags?: string[] | string;
  duration: number;
  thumbnail?: string;
  status: string;
  created_at: string;
  failed?: boolean;
  publish_at?: string;
  url?: string;
}

interface PostModalProps {
  video: Video | null;
  onClose: () => void;
  onPost: (video: Video, options: { scheduleDate?: string; webhookUrl: string }) => void;
  isPosting: boolean;
}

type PostMode = 'now' | 'schedule';
type UploadMethod = 'webhook' | 'direct';

const PostModal: React.FC<PostModalProps> = ({ video, onClose, onPost, isPosting }) => {
  const [postMode, setPostMode] = useState<PostMode>('now');
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('webhook');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Webhook States
  const [activeWebhook, setActiveWebhook] = useState<string | null>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(true);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  
  // Direct Upload States
  const [googleClientId, setGoogleClientId] = useState<string | null>(import.meta.env.VITE_GOOGLE_CLIENT_ID || null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [directUploadStatus, setDirectUploadStatus] = useState<string>('');

  const [videoChannel, setVideoChannel] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (video) {
      console.log("Modal montado para vídeo:", video.title); // Debug
      const now = new Date();
      if (!selectedDate) {
        const defaultTime = new Date(now.getTime() + 60 * 60000);
        setSelectedDate(defaultTime);
      }
      fetchChannelAndWebhook();
      
      // Inicializa Google API se tiver Client ID
      if (googleClientId) {
        initializeGoogleApi(googleClientId).catch(console.error);
      }
    }
  }, [video]);

  const checkWebhookConnection = async (url: string): Promise<void> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          health_check: true,
          timestamp: new Date().toISOString() 
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status >= 500) {
         throw new Error(`Erro do Servidor: ${response.status}`);
      }
    } catch (error: any) {
      console.error("Webhook connection failed:", error);
      if (error.name === 'AbortError') {
        throw new Error("Timeout: O servidor demorou para responder.");
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error("Falha na conexão (Network Error).");
      }
    }
  };

  const fetchChannelAndWebhook = async () => {
    if (!video) return;

    setLoadingWebhook(true);
    setWebhookError(null);
    setVideoChannel(null);

    try {
      let channel = video.channel;

      if (!channel) {
        const { data: videoData } = await supabase
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
        try {
          await checkWebhookConnection(data.webhook);
        } catch (connError: any) {
          setWebhookError(connError.message);
        }
      } else {
        setWebhookError(`Webhook não configurado para "${cleanChannel}".`);
      }
    } catch (err: any) {
      console.error("Error:", err);
      setWebhookError('Erro ao carregar configurações.');
    } finally {
      setLoadingWebhook(false);
      setIsRetrying(false);
    }
  };

  const handleRetryConnection = () => {
    setIsRetrying(true);
    fetchChannelAndWebhook();
  };

  const handleDirectUpload = async () => {
    if (!video || !googleClientId) return;
    
    setIsDirectUploading(true);
    setDirectUploadStatus('Iniciando autenticação...');
    
    try {
      // 1. Autenticação
      const accessToken = await requestGoogleAuth();
      
      // 2. Download do Vídeo (Blob)
      setDirectUploadStatus('Baixando vídeo do servidor...');
      
      let videoBlob: Blob;
      try {
        // Verifica se é HTTPS misturado com HTTP
        if (window.location.protocol === 'https:' && video.link_s3.startsWith('http:')) {
          throw new Error('Conteúdo Misto: Não é possível baixar vídeo HTTP em site HTTPS.');
        }

        const videoResponse = await fetch(video.link_s3);
        
        if (!videoResponse.ok) {
          throw new Error(`Erro HTTP ${videoResponse.status} ao baixar vídeo.`);
        }
        
        videoBlob = await videoResponse.blob();
      } catch (downloadError: any) {
        console.error("Erro de download:", downloadError);
        if (downloadError.message === 'Failed to fetch' || downloadError.message.includes('NetworkError')) {
          throw new Error(
            'Bloqueio de CORS detectado. O servidor onde o vídeo está hospedado (S3/Supabase) não permitiu o download por este domínio. Configure o CORS no seu bucket para permitir GET.'
          );
        }
        throw downloadError;
      }

      // 3. Preparar Tags
      let tags: string[] = [];
      if (Array.isArray(video.tags)) tags = video.tags;
      else if (typeof video.tags === 'string') tags = (video.tags as string).split(',').map(t => t.trim());

      // 4. Upload para YouTube
      setDirectUploadStatus('Enviando para o YouTube...');
      
      // Ajuste de fuso horário para agendamento
      let publishAtISO = undefined;
      let privacyStatus: 'private' | 'public' | 'unlisted' = 'public';

      if (postMode === 'schedule' && selectedDate) {
        privacyStatus = 'private';
        publishAtISO = selectedDate.toISOString();
      }

      const result = await uploadVideoToYouTube(videoBlob, accessToken, {
        title: video.title,
        description: video.description || '',
        privacyStatus: privacyStatus,
        publishAt: publishAtISO,
        tags: tags,
        onProgress: (progress) => setUploadProgress(progress)
      });

      setDirectUploadStatus('Finalizando...');

      // 5. Atualizar Banco de Dados (Supabase)
      const { error } = await supabase
        .from('shorts_youtube')
        .update({
          status: 'Posted', 
          youtube_id: result.id,
          publish_at: publishAtISO || new Date().toISOString(),
          failed: false
        })
        .eq('id', video.id);

      if (error) throw error;

      alert('Upload realizado com sucesso!');
      onClose();
      window.location.reload(); 

    } catch (error: any) {
      console.error('Erro no upload direto:', error);
      alert(`Erro: ${error.message || 'Falha no upload.'}`);
    } finally {
      setIsDirectUploading(false);
      setDirectUploadStatus('');
      setUploadProgress(0);
    }
  };

  const handleConfirm = () => {
    if (!video) return;

    if (uploadMethod === 'direct') {
      handleDirectUpload();
      return;
    }

    // Webhook Logic
    if (!activeWebhook) return;

    if (postMode === 'schedule') {
      if (!selectedDate) {
        alert('Selecione uma data e hora.');
        return;
      }
      const isoDate = selectedDate.toISOString();
      onPost(video, { scheduleDate: isoDate, webhookUrl: activeWebhook });
    } else {
      onPost(video, { webhookUrl: activeWebhook });
    }
  };

  if (!video) return null;

  const isWebhookReady = !loadingWebhook && !webhookError && activeWebhook;
  const isDirectReady = !!googleClientId;
  
  const canSubmit = uploadMethod === 'direct' 
    ? isDirectReady && !isDirectUploading && (postMode === 'now' || (postMode === 'schedule' && selectedDate))
    : isWebhookReady && !isPosting && (postMode === 'now' || (postMode === 'schedule' && selectedDate));

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
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
            <div className="w-16 h-24 bg-gray-900 rounded-lg flex-shrink-0 overflow-hidden relative">
               {video.thumbnail ? (
                 <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
               ) : video.link_s3 || video.url ? (
                 <video 
                   src={video.link_s3 || video.url} 
                   className="w-full h-full object-cover opacity-80"
                   muted
                   preload="metadata"
                 />
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                   <Zap size={24} />
                 </div>
               )}
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
                {video.duration > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Método de Upload Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
            <button
              onClick={() => setUploadMethod('webhook')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                uploadMethod === 'webhook' 
                  ? 'bg-white text-gray-800 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Server size={16} />
              <span>Via Webhook</span>
            </button>
            <button
              onClick={() => setUploadMethod('direct')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                uploadMethod === 'direct' 
                  ? 'bg-white text-red-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe size={16} />
              <span>API Direta</span>
            </button>
          </div>

          {/* Status da Conexão (Depende do Método) */}
          {uploadMethod === 'webhook' ? (
            <div className={`mb-6 p-3 rounded-lg border text-sm flex items-center gap-3 transition-colors duration-300 ${
              webhookError 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : loadingWebhook 
                  ? 'bg-gray-50 border-gray-200 text-gray-600'
                  : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              {loadingWebhook ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : webhookError ? (
                <WifiOff size={18} className="flex-shrink-0 text-red-600" />
              ) : (
                <CheckCircle2 size={18} className="flex-shrink-0 text-green-600" />
              )}
              
              <div className="flex-1 flex justify-between items-center">
                <span className="font-medium">
                  {loadingWebhook ? 'Testando conexão com o servidor...' : 
                   webhookError ? webhookError : 
                   'Conexão estabelecida com sucesso'}
                </span>
                
                {webhookError && !loadingWebhook && (
                  <button 
                    onClick={handleRetryConnection}
                    disabled={isRetrying}
                    className="ml-2 p-1.5 hover:bg-red-100 rounded-full transition-colors text-red-600"
                    title="Tentar conectar novamente"
                  >
                    <RefreshCw size={16} className={isRetrying ? "animate-spin" : ""} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className={`mb-6 p-3 rounded-lg border text-sm flex flex-col gap-2 transition-colors duration-300 ${
              !googleClientId 
                ? 'bg-amber-50 border-amber-200 text-amber-700' 
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <div className="flex items-center gap-3">
                {!googleClientId ? (
                  <AlertTriangle size={18} className="flex-shrink-0 text-amber-600" />
                ) : (
                  <Globe size={18} className="flex-shrink-0 text-blue-600" />
                )}
                
                <div className="flex-1">
                  <span className="font-medium">
                    {!googleClientId 
                      ? 'Client ID do Google não configurado (.env)' 
                      : 'Upload direto via navegador habilitado'}
                  </span>
                </div>
              </div>
              
              {/* Aviso sobre CORS */}
              {googleClientId && (
                <div className="flex items-start gap-2 mt-1 text-xs opacity-90 bg-white/50 p-2 rounded">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <p>
                    Nota: O upload direto exige que o servidor do vídeo (S3) permita <strong>CORS</strong> para este domínio. Se falhar, verifique as configurações do seu bucket.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setPostMode('now')}
              disabled={uploadMethod === 'webhook' ? !!webhookError : !googleClientId}
              className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                (uploadMethod === 'webhook' ? !!webhookError : !googleClientId)
                  ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                  : postMode === 'now'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                    : 'border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Send size={24} className="mb-2" />
              <span className="font-semibold text-sm">Postar Agora</span>
              {postMode === 'now' && !(uploadMethod === 'webhook' ? !!webhookError : !googleClientId) && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setPostMode('schedule')}
              disabled={uploadMethod === 'webhook' ? !!webhookError : !googleClientId}
              className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                (uploadMethod === 'webhook' ? !!webhookError : !googleClientId)
                  ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                  : postMode === 'schedule'
                    ? 'border-purple-500 bg-purple-50/50 text-purple-700'
                    : 'border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CalendarIcon size={24} className="mb-2" />
              <span className="font-semibold text-sm">Agendar</span>
              {postMode === 'schedule' && !(uploadMethod === 'webhook' ? !!webhookError : !googleClientId) && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Calendar Section */}
          {postMode === 'schedule' && !(uploadMethod === 'webhook' ? !!webhookError : !googleClientId) && (
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
                {uploadMethod === 'direct' 
                  ? 'O vídeo será enviado como "Privado" e agendado no YouTube.' 
                  : 'O vídeo será enviado para a fila e processado na data escolhida.'}
              </p>
            </div>
          )}

          {/* Barra de Progresso (Apenas Upload Direto) */}
          {isDirectUploading && (
            <div className="mt-4 animate-fade-in">
              <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
                <span>{directUploadStatus}</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
          <button
            onClick={onClose}
            disabled={isPosting || isDirectUploading}
            className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
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
            {isPosting || isDirectUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/80"></div>
                {isDirectUploading ? 'Enviando...' : 'Processando...'}
              </>
            ) : (
              <>
                {postMode === 'now' ? <Send size={18} /> : <CalendarIcon size={18} />}
                {postMode === 'now' ? 'Publicar Imediatamente' : 'Confirmar Agendamento'}
              </>
            )}
          </button>
        </div>

        <style>{`
          .react-datepicker-wrapper { width: 100%; }
          .react-datepicker__header { background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; border-top-left-radius: 0.75rem !important; border-top-right-radius: 0.75rem !important; padding-top: 1rem; }
          .react-datepicker { border: 1px solid #e5e7eb; border-radius: 0.75rem !important; font-family: inherit; }
          .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected, .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item--selected { background-color: #9333ea !important; color: white !important; }
          .react-datepicker__day:hover { background-color: #f3e8ff !important; }
          .react-datepicker__current-month { color: #374151; font-weight: 600; margin-bottom: 0.5rem; }
          .react-datepicker__day-name { color: #6b7280; }
          .react-datepicker__time-container { border-left: 1px solid #e5e7eb; }
          .react-datepicker__time-container .react-datepicker__time { border-top-right-radius: 0.75rem; }
        `}</style>
      </div>
    </div>
  );
};

export default PostModal;
