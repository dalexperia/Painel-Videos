import React, { useState, useEffect } from 'react';
import { X, Calendar, Send, Globe, Server, Loader2, Clock, CheckCircle2, Lock, Eye, EyeOff, Zap } from 'lucide-react';
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
  privacy_status?: 'public' | 'private' | 'unlisted';
  publish_at?: string;
}

interface PostModalProps {
  video: Video;
  onClose: () => void;
  onPost: (video: Video, options: { scheduleDate?: string; webhookUrl?: string; method: 'webhook' | 'api'; privacyStatus?: string }) => void;
  isPosting: boolean;
}

const PostModal: React.FC<PostModalProps> = ({ video, onClose, onPost, isPosting }) => {
  const [activeTab, setActiveTab] = useState<'webhook' | 'api'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'private' | 'unlisted'>('private');

  // Busca a configuração do canal ao abrir o modal
  useEffect(() => {
    const fetchChannelConfig = async () => {
      if (!video.channel) return;
      
      setLoadingConfig(true);
      try {
        const { data } = await supabase
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
    if (activeTab === 'webhook' && !webhookUrl) {
      alert("Por favor, insira a URL do Webhook.");
      return;
    }
    
    onPost(video, {
      scheduleDate: isScheduled ? scheduleDate : undefined,
      webhookUrl: activeTab === 'webhook' ? webhookUrl : undefined,
      method: activeTab,
      privacyStatus: activeTab === 'api' ? privacyStatus : undefined
    });
  };

  // Helpers de Data
  const setQuickDate = (type: 'tomorrow_morning' | 'tomorrow_night' | 'next_monday') => {
    const d = new Date();
    if (type === 'tomorrow_morning') {
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
    } else if (type === 'tomorrow_night') {
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
    } else if (type === 'next_monday') {
      d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7));
      d.setHours(10, 0, 0, 0);
    }
    
    // Ajuste para fuso horário local no input datetime-local
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
    setScheduleDate(localISOTime);
    setIsScheduled(true);
  };

  const minDate = new Date().toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Publicar Vídeo
            </h2>
            <p className="text-sm text-gray-500">Escolha o método de envio e agendamento</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Video Summary Card */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex gap-4 items-start shadow-sm">
            <div className="w-28 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 relative shadow-inner">
               <VideoSmartPreview src={video.link_s3} className="w-full h-full object-cover" />
            </div>
            <div className="flex-grow min-w-0 py-1">
              <h3 className="text-sm font-bold text-gray-900 truncate mb-1.5" title={video.title}>
                {video.title || 'Sem título'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {video.channel && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    {video.channel}
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  {video.hashtags?.length || 0} hashtags
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setActiveTab('webhook')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'webhook' 
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
              }`}
            >
              <Globe size={16} /> Via Webhook (n8n)
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'api' 
                  ? 'bg-white text-red-600 shadow-sm ring-1 ring-black/5' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
              }`}
            >
              <Server size={16} /> API Direta (YouTube)
            </button>
          </div>

          {/* Content Area */}
          <div className="space-y-6 animate-fade-in">
            
            {/* Webhook Specific */}
            {activeTab === 'webhook' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>URL do Webhook</span>
                  {loadingConfig && <span className="text-blue-500 text-xs flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Carregando...</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://seu-n8n.com/webhook/..."
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                  />
                  <div className="absolute right-3 top-3 text-gray-400 pointer-events-none">
                    <Zap size={16} />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  O vídeo será enviado para esta URL para processamento externo (Make/n8n).
                </p>
              </div>
            )}

            {/* API Specific */}
            {activeTab === 'api' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Visibilidade no YouTube</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPrivacyStatus('public')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      privacyStatus === 'public' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <Globe size={20} />
                    <span className="text-xs font-medium">Público</span>
                  </button>
                  <button
                    onClick={() => setPrivacyStatus('unlisted')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      privacyStatus === 'unlisted' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <Eye size={20} />
                    <span className="text-xs font-medium">Não Listado</span>
                  </button>
                  <button
                    onClick={() => setPrivacyStatus('private')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      privacyStatus === 'private' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 hover:border-gray-200 text-gray-600'
                    }`}
                  >
                    <Lock size={20} />
                    <span className="text-xs font-medium">Privado</span>
                  </button>
                </div>
              </div>
            )}

            {/* Scheduling Section (Common) */}
            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isScheduled ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Agendamento</h4>
                    <p className="text-xs text-gray-500">Programar para o futuro</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {isScheduled && (
                <div className="space-y-4 animate-slide-up bg-gray-50 p-4 rounded-xl border border-gray-200">
                  {/* Quick Picks */}
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button onClick={() => setQuickDate('tomorrow_morning')} className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm">
                      Amanhã 10:00
                    </button>
                    <button onClick={() => setQuickDate('tomorrow_night')} className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm">
                      Amanhã 18:00
                    </button>
                    <button onClick={() => setQuickDate('next_monday')} className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm">
                      Segunda 10:00
                    </button>
                  </div>

                  {/* Date Input */}
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      min={minDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none shadow-sm"
                    />
                    <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
                      <Clock size={18} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPosting || (activeTab === 'webhook' && !webhookUrl) || (isScheduled && !scheduleDate)}
            className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${
              activeTab === 'api' 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            {isPosting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Processando...
              </>
            ) : (
              <>
                {isScheduled ? <Clock size={18} /> : <Send size={18} />}
                {isScheduled 
                  ? 'Agendar Publicação' 
                  : (activeTab === 'api' ? 'Publicar no YouTube' : 'Enviar Webhook')
                }
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default PostModal;
