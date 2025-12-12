import React, { useState, useEffect } from 'react';
import { X, Calendar, Send, Globe, Server, Loader2, Clock, CheckCircle2, Lock, Eye, Zap, Youtube, AlertCircle, ChevronRight } from 'lucide-react';
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
    // Validação estrita baseada na aba ativa
    if (activeTab === 'webhook' && !webhookUrl) {
      // Feedback visual é tratado no botão desabilitado, mas garantimos aqui
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
    
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
    setScheduleDate(localISOTime);
    setIsScheduled(true);
  };

  const minDate = new Date().toISOString().slice(0, 16);

  // Validação do formulário para habilitar o botão
  const isFormValid = () => {
    if (isScheduled && !scheduleDate) return false;
    if (activeTab === 'webhook') return !!webhookUrl;
    if (activeTab === 'api') return true; // API direta não requer URL de webhook
    return false;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-scale-in border border-gray-100">
        
        {/* COLUNA DA ESQUERDA: Preview e Detalhes */}
        <div className="w-full md:w-2/5 bg-gray-50 border-r border-gray-100 flex flex-col">
          <div className="p-6 flex-grow overflow-y-auto custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Preview do Conteúdo</h3>
            
            {/* Video Card */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-4 group">
              <div className="aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden relative shadow-inner mb-3">
                 <VideoSmartPreview src={video.link_s3} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
                 <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-xs font-medium line-clamp-2 text-shadow-sm">{video.title}</p>
                 </div>
              </div>
              
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">Título</label>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{video.title}</p>
                </div>
                
                {video.channel && (
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase">Canal</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <p className="text-sm text-gray-700">{video.channel}</p>
                    </div>
                  </div>
                )}

                {video.hashtags && video.hashtags.length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase">Hashtags</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {video.hashtags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                          {tag}
                        </span>
                      ))}
                      {video.hashtags.length > 3 && (
                        <span className="text-[10px] text-gray-400 px-1">+ {video.hashtags.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA DA DIREITA: Controles e Ações */}
        <div className="w-full md:w-3/5 flex flex-col bg-white">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Publicar Vídeo</h2>
              <p className="text-sm text-gray-500">Configure o envio para o YouTube</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-8">
            
            {/* Método de Envio (Segmented Control) */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Server size={16} className="text-blue-600" />
                Método de Envio
              </label>
              <div className="bg-gray-100 p-1 rounded-xl flex relative">
                <button
                  onClick={() => setActiveTab('webhook')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all relative z-10 ${
                    activeTab === 'webhook' 
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Zap size={16} className={activeTab === 'webhook' ? 'text-yellow-500' : ''} />
                  Webhook (n8n)
                </button>
                <button
                  onClick={() => setActiveTab('api')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all relative z-10 ${
                    activeTab === 'api' 
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Youtube size={16} className={activeTab === 'api' ? 'text-red-600' : ''} />
                  API Direta
                </button>
              </div>
            </div>

            {/* Configurações Específicas da Aba */}
            <div className="animate-fade-in">
              {activeTab === 'webhook' ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">URL do Webhook</label>
                    {loadingConfig && <span className="text-xs text-blue-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Buscando...</span>}
                  </div>
                  <div className="relative group">
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://seu-n8n.com/webhook/..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pl-10 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                    <Globe size={16} className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    O n8n processará o upload e retornará o status.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="text-sm font-medium text-gray-700 block">Visibilidade</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'public', icon: Globe, label: 'Público', color: 'green' },
                      { id: 'unlisted', icon: Eye, label: 'Não Listado', color: 'blue' },
                      { id: 'private', icon: Lock, label: 'Privado', color: 'red' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setPrivacyStatus(option.id as any)}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          privacyStatus === option.id 
                            ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700` 
                            : 'border-gray-100 hover:border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <option.icon size={20} />
                        <span className="text-xs font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-xs flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <p>A API Direta atualizará o status no banco. Certifique-se de que o upload real foi feito ou use o token OAuth se configurado.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Agendamento */}
            <div className="pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${isScheduled ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Agendar Publicação</h4>
                    <p className="text-xs text-gray-500">Publicar automaticamente no futuro</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {isScheduled && (
                <div className="space-y-4 animate-slide-up bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button onClick={() => setQuickDate('tomorrow_morning')} className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm">
                      Amanhã 10:00
                    </button>
                    <button onClick={() => setQuickDate('tomorrow_night')} className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm">
                      Amanhã 18:00
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={scheduleDate}
                      min={minDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none shadow-sm"
                    />
                    <Clock size={18} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPosting || !isFormValid()}
              className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${
                activeTab === 'api' 
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-red-200' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-200'
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
                    ? 'Agendar' 
                    : (activeTab === 'api' ? 'Publicar Direto' : 'Enviar Webhook')
                  }
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PostModal;
