import React, { useState, useEffect } from 'react';
import { X, Upload, Calendar, Globe, Lock, Eye, AlertCircle, CheckCircle2, Loader2, Youtube } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../lib/supabaseClient';

export interface Video {
  id: string | number;
  title: string;
  description?: string;
  link_s3: string;
  link_drive?: string;
  channel?: string;
  hashtags?: string[];
  tags?: string[];
  baserow_id?: number;
  duration?: number;
}

interface PostModalProps {
  video: Video;
  onClose: () => void;
  onPost: (video: Video, options: { scheduleDate?: string; webhookUrl: string }) => void;
  isPosting: boolean;
}

const PostModal: React.FC<PostModalProps> = ({ video, onClose, onPost, isPosting }) => {
  const [activeTab, setActiveTab] = useState<'webhook' | 'direct'>('direct');
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'unlisted'>('private');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);

  // Monitorar carregamento da API do Google
  useEffect(() => {
    const savedUrl = localStorage.getItem('n8n_webhook_url');
    if (savedUrl) setWebhookUrl(savedUrl);
    
    // Função para verificar se a API carregou
    const checkGapi = () => {
      if (window.google && window.google.accounts) {
        setIsGapiLoaded(true);
        return true;
      }
      return false;
    };

    // Verifica imediatamente
    if (checkGapi()) return;

    // Se não carregou, verifica a cada 500ms por 5 segundos
    const intervalId = setInterval(() => {
      if (checkGapi()) {
        clearInterval(intervalId);
      }
    }, 500);

    // Limpa o intervalo após 5 segundos para não ficar rodando para sempre
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
    }, 5000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  const handleWebhookSubmit = () => {
    if (!webhookUrl) {
      alert('Por favor, configure a URL do Webhook.');
      return;
    }
    localStorage.setItem('n8n_webhook_url', webhookUrl);
    onPost(video, {
      scheduleDate: scheduleDate ? scheduleDate.toISOString() : undefined,
      webhookUrl
    });
  };

  // --- LÓGICA DE UPLOAD DIRETO ---

  const getAccessToken = async () => {
    return new Promise<string>((resolve, reject) => {
      if (!window.google || !window.google.accounts) {
        reject(new Error('API do Google não carregada. Recarregue a página.'));
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '441621535337-k4fcqj90ovvfp1d9sj6hugj4bqavhhlv.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
        callback: (response: any) => {
          if (response.error) {
            reject(response);
          } else {
            resolve(response.access_token);
          }
        },
      });
      
      // Força o prompt de seleção de conta para evitar login automático na conta errada
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  };

  const handleDirectUpload = async () => {
    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      // 1. Buscar configurações do canal para validação
      const { data: settingsData, error: settingsError } = await supabase
        .from('shorts_settings')
        .select('youtube_channel_id')
        .eq('channel', video.channel)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("Erro ao buscar config:", settingsError);
      }

      const requiredChannelId = settingsData?.youtube_channel_id;

      console.log('Solicitando token de acesso...');
      const accessToken = await getAccessToken();
      console.log('Token obtido.');

      // 2. VALIDAÇÃO DE SEGURANÇA: Verificar se o usuário logado é o dono do canal correto
      console.log('Verificando identidade do canal...');
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!channelResponse.ok) {
        throw new Error('Falha ao verificar identidade do canal no YouTube.');
      }

      const channelData = await channelResponse.json();
      if (!channelData.items || channelData.items.length === 0) {
        throw new Error('A conta Google logada não possui um canal no YouTube.');
      }

      const loggedChannel = channelData.items[0];
      console.log(`Logado como: ${loggedChannel.snippet.title} (${loggedChannel.id})`);

      if (requiredChannelId) {
        if (loggedChannel.id !== requiredChannelId) {
          throw new Error(`SEGURANÇA: Você logou na conta errada!\n\nConta Logada: ${loggedChannel.snippet.title}\nConta Esperada: ${video.channel}\n\nPor favor, troque de conta.`);
        }
      } else {
        // Se não tiver ID configurado, avisa mas permite (ou pede confirmação)
        const confirmMsg = `ATENÇÃO: O sistema não tem um ID de canal salvo para "${video.channel}".\n\nVocê está prestes a postar no canal: "${loggedChannel.snippet.title}".\n\nIsso está correto?`;
        if (!window.confirm(confirmMsg)) {
          setUploadStatus('idle');
          return;
        }
      }

      // 3. Download do Vídeo
      console.log('Baixando vídeo do servidor...', video.link_s3);
      const videoResponse = await fetch(video.link_s3);
      if (!videoResponse.ok) throw new Error('Falha ao baixar o arquivo de vídeo original.');
      const videoBlob = await videoResponse.blob();
      const videoSize = videoBlob.size;
      console.log(`Vídeo baixado. Tamanho: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);

      const metadata = {
        snippet: {
          title: video.title.substring(0, 100),
          description: `${video.description || ''}\n\n${(video.hashtags || []).join(' ')}`,
          tags: video.tags || [],
          categoryId: '22',
        },
        status: {
          privacyStatus: privacy,
          selfDeclaredMadeForKids: false,
          publishAt: scheduleDate ? scheduleDate.toISOString() : undefined
        }
      };

      console.log('Iniciando sessão de upload...');
      
      const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,contentDetails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoSize.toString(),
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify(metadata)
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error('Erro na inicialização do upload:', initResponse.status, errorText);
        throw new Error(`Google recusou a inicialização: ${initResponse.status} - Verifique se a URL do Vercel está autorizada no Google Cloud Console.`);
      }

      const uploadUrl = initResponse.headers.get('Location');
      if (!uploadUrl) {
        throw new Error('Google não retornou a URL de upload (Header Location ausente). Problema de CORS ou permissão.');
      }

      console.log('Sessão criada. Enviando bytes para:', uploadUrl);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', 'video/mp4');
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
          }
        };

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            console.log('Upload concluído com sucesso!', response);
            
            await supabase.from('shorts_youtube').update({
              status: 'Posted',
              publish_at: scheduleDate ? scheduleDate.toISOString() : new Date().toISOString()
            }).eq('id', video.id);

            resolve();
          } else {
            reject(new Error(`Falha no envio dos bytes: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Erro de rede durante o upload.'));
        xhr.send(videoBlob);
      });

      setUploadStatus('success');
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error('Erro fatal no upload:', error);
      setErrorMessage(error.message || 'Erro desconhecido no upload.');
      setUploadStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-brand-600" />
              Publicar Vídeo
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure os detalhes do envio</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {/* Video Preview Mini */}
          <div className="flex gap-4 mb-6 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
               <video src={video.link_s3} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm">{video.title}</h3>
              <div className="flex flex-wrap gap-1 mt-1">
                {video.channel && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">{video.channel}</span>}
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                  {(video.hashtags || []).length} hashtags
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('webhook')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === 'webhook' 
                  ? 'bg-white dark:bg-gray-700 text-brand-600 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Globe size={16} />
                Via Webhook (n8n)
              </div>
            </button>
            <button
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === 'direct' 
                  ? 'bg-white dark:bg-gray-700 text-red-600 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Youtube size={16} />
                API Direta (Browser)
              </div>
            </button>
          </div>

          {/* Content based on Tab */}
          {activeTab === 'webhook' ? (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL do Webhook (n8n/Make)</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://seu-n8n.com/webhook/..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">O vídeo será enviado para esta URL para processamento externo.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {!isGapiLoaded ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg flex gap-2 text-sm text-yellow-800 dark:text-yellow-200 items-center">
                  <Loader2 size={16} className="animate-spin shrink-0" />
                  <p>Carregando API do Google...</p>
                </div>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Upload direto via navegador habilitado
                  </h4>
                  <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
                    Nota: O upload direto exige que a URL atual ({window.location.origin}) esteja autorizada no Google Cloud Console.
                  </p>
                </div>
              )}

              {/* Privacy Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Visibilidade</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'public', label: 'Público', icon: Globe },
                    { id: 'unlisted', label: 'Não Listado', icon: Eye },
                    { id: 'private', label: 'Privado', icon: Lock }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setPrivacy(opt.id as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                        privacy === opt.id
                          ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-700 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <opt.icon size={20} className="mb-1" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Common Fields */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.checked ? new Date() : null)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Agendar Publicação
              </label>
            </div>

            {scheduleDate && (
              <div className="mb-4 animate-slide-down">
                <label className="block text-xs text-gray-500 mb-1">Data e Hora da Publicação</label>
                <DatePicker
                  selected={scheduleDate}
                  onChange={(date) => setScheduleDate(date)}
                  showTimeSelect
                  dateFormat="Pp"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-white"
                  minDate={new Date()}
                />
                <p className="text-xs text-gray-500 mt-1">
                  O vídeo será enviado como "Privado" e agendado no YouTube.
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-sm text-red-700 dark:text-red-200 animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{errorMessage}</span>
            </div>
          )}

          {/* Progress Bar */}
          {uploadStatus === 'uploading' && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Enviando para o YouTube...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-brand-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-center gap-2 text-green-700 dark:text-green-200">
              <CheckCircle2 size={20} />
              <span className="font-medium">Upload concluído com sucesso!</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={uploadStatus === 'uploading'}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          
          {activeTab === 'webhook' ? (
            <button
              onClick={handleWebhookSubmit}
              disabled={isPosting}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-lg shadow-brand-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPosting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Enviar Webhook
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDirectUpload}
              disabled={!isGapiLoaded || uploadStatus === 'uploading' || uploadStatus === 'success'}
              className={`flex items-center gap-2 px-6 py-2 text-sm font-medium text-white rounded-lg shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed ${
                uploadStatus === 'success' ? 'bg-green-600' : 'bg-red-600 hover:bg-red-700 shadow-red-500/30'
              }`}
            >
              {uploadStatus === 'uploading' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enviando...
                </>
              ) : uploadStatus === 'success' ? (
                <>
                  <CheckCircle2 size={16} />
                  Enviado
                </>
              ) : (
                <>
                  <Youtube size={16} />
                  Postar Agora
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostModal;
