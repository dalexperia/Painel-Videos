import React, { useState, useEffect } from 'react';
import { X, Send, Globe, Server, Loader2, Clock, Lock, Eye, Zap, Youtube, ChevronDown, ChevronUp, Calendar as CalendarIcon } from 'lucide-react';
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
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Estado estilo YouTube Studio
  const [publishMode, setPublishMode] = useState<'save' | 'schedule'>('save');
  const [visibility, setVisibility] = useState<'private' | 'unlisted' | 'public'>('private');
  
  // Data e Hora separados para inputs nativos
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');

  // Inicializa data/hora com o dia seguinte às 10:00
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDateInput(tomorrow.toISOString().split('T')[0]);
    setTimeInput('10:00');
  }, []);

  // Busca a configuração do canal
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
    if (activeTab === 'webhook' && !webhookUrl) return;
    
    let finalScheduleDate: string | undefined = undefined;

    if (publishMode === 'schedule') {
      // Combina data e hora
      const combined = new Date(`${dateInput}T${timeInput}`);
      finalScheduleDate = combined.toISOString();
    }

    onPost(video, {
      scheduleDate: finalScheduleDate,
      webhookUrl: activeTab === 'webhook' ? webhookUrl : undefined,
      method: activeTab,
      privacyStatus: publishMode === 'save' ? visibility : 'private' // Se agendado, o vídeo sobe como privado inicialmente
    });
  };

  const isFormValid = () => {
    if (activeTab === 'webhook' && !webhookUrl) return false;
    if (publishMode === 'schedule' && (!dateInput || !timeInput)) return false;
    return true;
  };

  // Componente de Radio Button Customizado
  const RadioOption = ({ 
    id, 
    label, 
    sublabel, 
    checked, 
    onChange,
    icon: Icon 
  }: { 
    id: string, 
    label: string, 
    sublabel?: string, 
    checked: boolean, 
    onChange: () => void,
    icon?: any
  }) => (
    <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-[#262626]' : 'hover:bg-[#262626]'}`}>
      <div className="relative flex items-center mt-0.5">
        <input 
          type="radio" 
          name="visibility" 
          className="peer sr-only" 
          checked={checked} 
          onChange={onChange} 
        />
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${checked ? 'border-white' : 'border-gray-500'}`}>
          {checked && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
        </div>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-200 flex items-center gap-2">
          {label}
          {Icon && <Icon size={14} className="text-gray-400" />}
        </div>
        {sublabel && <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>}
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#1a1a1a] w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden border border-gray-800">
        
        {/* Lado Esquerdo - Preview Imersivo */}
        <div className="w-1/3 bg-black relative hidden md:flex items-center justify-center bg-gradient-to-b from-gray-900 to-black border-r border-gray-800">
          <div className="relative w-full h-full max-h-full flex items-center justify-center">
            <video 
              src={video.link_s3} 
              controls 
              className="max-h-full max-w-full object-contain shadow-2xl"
            />
            <div className="absolute bottom-8 left-4 right-4 text-white pointer-events-none drop-shadow-md bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 rounded-xl">
              <h3 className="font-bold text-lg line-clamp-2 mb-1">{video.title || 'Sem Título'}</h3>
              {video.channel && (
                <div className="flex items-center gap-2 text-sm opacity-90">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  {video.channel}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lado Direito - Formulário Estilo YouTube */}
        <div className="flex-1 flex flex-col bg-[#1a1a1a] text-white">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-100">Publicar Vídeo</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-full">
              <X size={20} />
            </button>
          </div>

          {/* Conteúdo Scrollável */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
            
            {/* Seletor de Método (Técnico) */}
            <div className="bg-[#262626] p-4 rounded-xl border border-gray-700 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Server size={16} className="text-blue-400" />
                Método de Envio
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('webhook')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'webhook' 
                      ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                      : 'bg-[#1f1f1f] border-gray-700 text-gray-400 hover:bg-[#333]'
                  }`}
                >
                  <Zap size={14} /> Webhook (n8n)
                </button>
                <button
                  onClick={() => setActiveTab('api')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'api' 
                      ? 'bg-red-500/10 border-red-500/50 text-red-400' 
                      : 'bg-[#1f1f1f] border-gray-700 text-gray-400 hover:bg-[#333]'
                  }`}
                >
                  <Youtube size={14} /> API Direta
                </button>
              </div>
              
              {activeTab === 'webhook' && (
                <div className="mt-2">
                  <label className="text-xs text-gray-500 mb-1 block">URL do Webhook</label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#1f1f1f] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Seção Principal - Estilo YouTube Studio */}
            <div className="space-y-4">
              
              {/* Opção 1: Salvar ou Publicar */}
              <div className={`border rounded-xl overflow-hidden transition-all ${publishMode === 'save' ? 'border-gray-600 bg-[#1f1f1f]' : 'border-gray-800 bg-[#1a1a1a]'}`}>
                <button 
                  onClick={() => setPublishMode('save')}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#262626] transition-colors"
                >
                  <span className="font-medium text-sm text-gray-200">Salvar ou publicar</span>
                  {publishMode === 'save' ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>
                
                {publishMode === 'save' && (
                  <div className="px-4 pb-4 pt-2 space-y-1 animate-fade-in">
                    <RadioOption 
                      id="private" 
                      label="Privado" 
                      sublabel="Seu vídeo ficará visível apenas para você"
                      checked={visibility === 'private'} 
                      onChange={() => setVisibility('private')}
                      icon={Lock}
                    />
                    <RadioOption 
                      id="unlisted" 
                      label="Não listado" 
                      sublabel="Qualquer pessoa com o link do vídeo poderá vê-lo"
                      checked={visibility === 'unlisted'} 
                      onChange={() => setVisibility('unlisted')}
                      icon={Eye}
                    />
                    <RadioOption 
                      id="public" 
                      label="Público" 
                      sublabel="Todos podem ver seu vídeo"
                      checked={visibility === 'public'} 
                      onChange={() => setVisibility('public')}
                      icon={Globe}
                    />
                  </div>
                )}
              </div>

              {/* Opção 2: Programar */}
              <div className={`border rounded-xl overflow-hidden transition-all ${publishMode === 'schedule' ? 'border-gray-600 bg-[#1f1f1f]' : 'border-gray-800 bg-[#1a1a1a]'}`}>
                <button 
                  onClick={() => setPublishMode('schedule')}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#262626] transition-colors"
                >
                  <span className="font-medium text-sm text-gray-200">Programar</span>
                  {publishMode === 'schedule' ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>

                {publishMode === 'schedule' && (
                  <div className="px-4 pb-6 pt-2 animate-fade-in">
                    <p className="text-xs text-gray-400 mb-4">
                      Selecione uma data para tornar seu vídeo público.
                    </p>
                    
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Data</label>
                        <input 
                          type="date" 
                          value={dateInput}
                          onChange={(e) => setDateInput(e.target.value)}
                          className="w-full bg-[#1a1a1a] border border-gray-600 rounded-sm px-3 py-2 text-sm text-white focus:border-blue-500 outline-none color-scheme-dark"
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Hora</label>
                        <input 
                          type="time" 
                          value={timeInput}
                          onChange={(e) => setTimeInput(e.target.value)}
                          className="w-full bg-[#1a1a1a] border border-gray-600 rounded-sm px-3 py-2 text-sm text-white focus:border-blue-500 outline-none color-scheme-dark"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4 text-xs text-gray-500">
                      Fuso horário: Horário Padrão de Brasília
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Footer Actions - Alinhados à Direita */}
          <div className="p-4 border-t border-gray-800 bg-[#1a1a1a] flex justify-end items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-sm uppercase tracking-wide"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPosting || !isFormValid()}
              className={`px-6 py-2 text-white rounded-sm font-medium text-sm transition-all uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === 'api' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isPosting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processando...
                </>
              ) : (
                publishMode === 'schedule' ? 'Programar' : (visibility === 'public' ? 'Publicar' : 'Salvar')
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PostModal;
