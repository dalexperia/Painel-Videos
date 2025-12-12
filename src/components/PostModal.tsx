import React, { useState, useEffect } from 'react';
import { X, Calendar, Send, Globe, Server, Loader2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import VideoSmartPreview from './VideoSmartPreview';

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
  privacy_status?: string;
  publish_at?: string;
}

interface PostModalProps {
  video: Video;
  onClose: () => void;
  onPost: (video: Video, options: { scheduleDate?: string; webhookUrl: string }) => void;
  isPosting: boolean;
}

const PostModal: React.FC<PostModalProps> = ({ video, onClose, onPost, isPosting }) => {
  const [activeTab, setActiveTab] = useState<'webhook' | 'api'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Busca a configuração do canal ao abrir o modal
  useEffect(() => {
    const fetchChannelConfig = async () => {
      if (!video.channel) return;
      
      setLoadingConfig(true);
      try {
        const { data, error } = await supabase
          .from('shorts_settings')
          .select('webhook')
          .eq('channel', video.channel)
          .single();

        if (data && data.webhook) {
          setWebhookUrl(data.webhook);
        }
      } catch (err) {
        console.error('Erro ao carregar config do canal:', err);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchChannelConfig();
  }, [video.channel]);

  const handleSubmit = () => {
    if (!webhookUrl) {
      alert("Por favor, insira a URL do Webhook.");
      return;
    }
    onPost(video, {
      scheduleDate: isScheduled ? scheduleDate : undefined,
      webhookUrl
    });
  };

  // Calcula data mínima para agendamento (agora)
  const minDate = new Date().toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#1a1d21] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-800 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1d21]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Send size={18} className="text-blue-500" /> Publicar Vídeo
            </h2>
            <p className="text-xs text-gray-400">Configure os detalhes do envio</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Video Summary Card */}
          <div className="bg-[#222529] p-3 rounded-lg border border-gray-700 flex gap-4 items-start">
            <div className="w-24 h-16 bg-black rounded overflow-hidden flex-shrink-0 relative">
               <VideoSmartPreview src={video.link_s3} className="w-full h-full object-cover opacity-80" />
               <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">0:00</div>
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="text-sm font-bold text-white truncate mb-1">{video.title || 'Sem título'}</h3>
              <div className="flex flex-wrap gap-2">
                {video.channel && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">{video.channel}</span>}
                <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{video.hashtags?.length || 0} hashtags</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 bg-[#0d1117] p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => setActiveTab('webhook')}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'webhook' 
                  ? 'bg-[#222529] text-blue-400 shadow-sm border border-gray-700' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Globe size={16} /> Via Webhook (n8n)
            </button>
            <button
              onClick={() => setActiveTab('api')}
              disabled
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all opacity-50 cursor-not-allowed ${
                activeTab === 'api' 
                  ? 'bg-[#222529] text-white shadow-sm' 
                  : 'text-gray-500'
              }`}
            >
              <Server size={16} /> API Direta (Browser)
            </button>
          </div>

          {/* Webhook Input */}
          {activeTab === 'webhook' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 flex justify-between">
                  <span>URL do Webhook (n8n/Make)</span>
                  {loadingConfig && <span className="text-blue-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Buscando config...</span>}
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://seu-n8n.com/webhook/..."
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-600"
                />
                <p className="text-[10px] text-gray-500 mt-1.5">
                  O vídeo será enviado para esta URL para processamento externo.
                </p>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="schedule"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-[#0d1117] text-blue-500 focus:ring-offset-[#1a1d21]"
                  />
                  <label htmlFor="schedule" className="text-sm font-medium text-white cursor-pointer select-none">
                    Agendar Publicação
                  </label>
                </div>

                {isScheduled && (
                  <div className="animate-slide-up bg-[#222529] p-3 rounded-lg border border-gray-700">
                    <label className="block text-xs text-gray-400 mb-1">Data e Hora</label>
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      min={minDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full bg-[#0d1117] border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#222529] border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPosting || (activeTab === 'webhook' && !webhookUrl) || (isScheduled && !scheduleDate)}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPosting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Enviando...
              </>
            ) : (
              <>
                {isScheduled ? <Clock size={16} /> : <Send size={16} />}
                {isScheduled ? 'Agendar Envio' : 'Enviar Webhook'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default PostModal;
