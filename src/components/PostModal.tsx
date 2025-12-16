import React, { useState, useEffect } from 'react';
import { X, Server, Loader2, Lock, Eye, Globe, Zap, Youtube, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { CustomDatePicker, CustomTimePicker } from './ui/DateTimeInputs';

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
  onPost: (video: Video, options: { 
    scheduleDate?: string; 
    webhookUrl?: string; 
    apiKey?: string;
    method: 'webhook' | 'api'; 
    privacyStatus?: string 
  }) => void;
  isPosting: boolean;
  uploadProgress?: number;
  notice?: { type: 'success' | 'error' | 'info'; text: string } | null;
}

const PostModal: React.FC<PostModalProps> = ({ video, onClose, onPost, isPosting, uploadProgress = 0, notice = null }) => {
  const [activeTab, setActiveTab] = useState<'webhook' | 'api'>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Estado estilo YouTube Studio
  const [publishMode, setPublishMode] = useState<'save' | 'schedule'>('save');
  const [visibility, setVisibility] = useState<'private' | 'unlisted' | 'public'>('private');
  
  // Data e Hora
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');

  // Inicializa data/hora com o dia seguinte às 10:00
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDateInput(tomorrow.toISOString().split('T')[0]);
    setTimeInput('10:00');
  }, []);

  // Busca apenas o Webhook da configuração do canal
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
    // Validações
    if (activeTab === 'webhook' && !webhookUrl) {
      alert("Por favor, configure a URL do Webhook.");
      return;
    }
    
    // Para API Direta, não validamos API Key pois usa OAuth (Client ID do .env)
    
    let finalScheduleDate: string | undefined = undefined;

    if (publishMode === 'schedule') {
      // Combina data e hora
      const combined = new Date(`${dateInput}T${timeInput}`);
      finalScheduleDate = combined.toISOString();
    }

    // Define uma URL de webhook "dummy" se for API, para passar pela validação do pai
    // Isso resolve o erro "URL do Webhook não está definida"
    const effectiveWebhookUrl = activeTab === 'webhook' ? webhookUrl : 'https://oauth.google/placeholder';

    onPost(video, {
      scheduleDate: finalScheduleDate,
      webhookUrl: effectiveWebhookUrl,
      apiKey: undefined, // Não usamos API Key para upload
      method: activeTab,
      privacyStatus: publishMode === 'save' ? visibility : 'private'
    });
  };

  const isFormValid = () => {
    if (activeTab === 'webhook' && !webhookUrl) return false;
    // API Direta é sempre válida aqui, pois a auth é feita no clique
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
      {/* Container Principal */}
      <div className="bg-[#1a1a1a] w-full max-w-xl rounded-xl shadow-2xl flex flex-col border border-gray-800 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-100">Publicar Vídeo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo Scrollável */}
        <div className="overflow-y-auto p-6 custom-scrollbar space-y-5">
          
          {/* Seletor de Método */}
          <div className="bg-[#262626] p-3 rounded-lg border border-gray-700 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-300 uppercase tracking-wide">
              <Server size={14} className="text-blue-400" />
              Método de Envio
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('webhook')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'webhook' 
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                    : 'bg-[#1f1f1f] border-gray-700 text-gray-400 hover:bg-[#333]'
                }`}
              >
                <Zap size={14} /> Webhook (n8n)
              </button>
              <button
                onClick={() => setActiveTab('api')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'api' 
                    ? 'bg-red-500/10 border-red-500/50 text-red-400' 
                    : 'bg-[#1f1f1f] border-gray-700 text-gray-400 hover:bg-[#333]'
                }`}
              >
                <Youtube size={14} /> API Direta
              </button>
            </div>
            
            {activeTab === 'webhook' && (
              <div className="mt-2 animate-fade-in">
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="URL do Webhook (https://...)"
                  className="w-full bg-[#1f1f1f] border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:border-blue-500 outline-none placeholder-gray-600"
                />
              </div>
            )}

            {activeTab === 'api' && (
              <div className="mt-2 animate-fade-in">
                 <div className="text-xs flex items-center gap-2 p-2 rounded border bg-red-500/10 border-red-500/30 text-red-400">
                    <ShieldCheck size={14} />
                    <span>Usa autenticação segura do Google (OAuth). Você fará login na próxima etapa.</span>
                 </div>
              </div>
            )}
          </div>

          {/* Seção Principal - Estilo YouTube Studio */}
          <div className="space-y-3">
            
            {/* Opção 1: Salvar ou Publicar */}
            <div className={`border rounded-lg overflow-hidden transition-all ${publishMode === 'save' ? 'border-gray-600 bg-[#1f1f1f]' : 'border-gray-800 bg-[#1a1a1a]'}`}>
              <button 
                onClick={() => setPublishMode('save')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#262626] transition-colors"
              >
                <span className="font-medium text-sm text-gray-200">Salvar ou publicar</span>
                {publishMode === 'save' ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>
              
              {publishMode === 'save' && (
                <div className="px-4 pb-4 pt-1 space-y-1 animate-fade-in">
                  <RadioOption 
                    id="private" 
                    label="Privado" 
                    sublabel="Visível apenas para você"
                    checked={visibility === 'private'} 
                    onChange={() => setVisibility('private')}
                    icon={Lock}
                  />
                  <RadioOption 
                    id="unlisted" 
                    label="Não listado" 
                    sublabel="Visível com o link"
                    checked={visibility === 'unlisted'} 
                    onChange={() => setVisibility('unlisted')}
                    icon={Eye}
                  />
                  <RadioOption 
                    id="public" 
                    label="Público" 
                    sublabel="Visível para todos"
                    checked={visibility === 'public'} 
                    onChange={() => setVisibility('public')}
                    icon={Globe}
                  />
                </div>
              )}
            </div>

            {/* Opção 2: Programar */}
            <div className={`border rounded-lg transition-all ${publishMode === 'schedule' ? 'border-gray-600 bg-[#1f1f1f] overflow-visible' : 'border-gray-800 bg-[#1a1a1a] overflow-hidden'}`}>
              <button 
                onClick={() => setPublishMode('schedule')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#262626] transition-colors rounded-t-lg"
              >
                <span className="font-medium text-sm text-gray-200">Programar</span>
                {publishMode === 'schedule' ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>

              {publishMode === 'schedule' && (
                <div className="px-4 pb-5 pt-2 animate-fade-in">
                  <p className="text-xs text-gray-400 mb-4">
                    Selecione uma data para tornar seu vídeo público.
                  </p>
                  
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Data</label>
                      <CustomDatePicker 
                        value={dateInput} 
                        onChange={setDateInput} 
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Hora</label>
                      <CustomTimePicker 
                        value={timeInput} 
                        onChange={setTimeInput} 
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3 text-xs text-gray-500">
                    Fuso horário: Horário Padrão de Brasília
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-800 bg-[#1a1a1a] flex justify-end items-center gap-3 shrink-0 rounded-b-xl">
          {notice && (
            <div className={`flex-1 mr-4 p-2 rounded border text-[12px] ${
              notice.type === 'success' 
                ? 'bg-green-500/10 border-green-500/30 text-green-300' 
                : notice.type === 'error' 
                  ? 'bg-red-500/10 border-red-500/30 text-red-300' 
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}>
              {notice.message}
            </div>
          )}
          {activeTab === 'api' && isPosting && (
            <div className="flex-1 mr-4">
              <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                <span>Enviando para o YouTube...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-[#2a2a2a] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-red-600 h-2 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${Math.min(100, Math.max(0, uploadProgress))}%` }}
                ></div>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-md uppercase tracking-wide"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPosting || !isFormValid()}
            className={`px-6 py-2 text-white rounded-md font-medium text-sm transition-all uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
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
  );
};

export default PostModal;
