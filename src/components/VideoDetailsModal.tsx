import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Wand2, Loader2, Download, Calendar as CalendarIcon, AlertCircle, ChevronDown, Check, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { generateContentAI } from '../lib/ai';

interface Video {
  id: number;
  title: string;
  description?: string;
  tags?: string[] | string;
  hashtags?: string[] | string;
  link_s3: string;
  thumbnail?: string;
  status: string;
  channel?: string;
}

interface VideoDetailsModalProps {
  video: Video;
  onClose: () => void;
  onSave: () => void;
  onSchedule: (video: Video) => void;
}

const VideoDetailsModal: React.FC<VideoDetailsModalProps> = ({ video, onClose, onSave, onSchedule }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    hashtags: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estado para sugestões
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [activeSuggestionField, setActiveSuggestionField] = useState<string | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (video) {
      const formatArray = (val: string[] | string | undefined) => {
        if (Array.isArray(val)) return val.join(', ');
        return val || '';
      };

      setFormData({
        title: video.title || '',
        description: video.description || '',
        tags: formatArray(video.tags),
        hashtags: formatArray(video.hashtags)
      });
    }
  }, [video]);

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setActiveSuggestionField(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerateAI = async (field: 'tags' | 'hashtags' | 'title' | 'description') => {
    setError(null);
    setGeneratingField(field);
    setActiveSuggestionField(null); 
    
    try {
      if (!video.channel) throw new Error("Canal não identificado.");

      const { data: settings, error: settingsError } = await supabase
        .from('shorts_settings')
        .select('ai_provider, gemini_key, groq_key, ollama_url, ai_model')
        .eq('channel', video.channel)
        .single();

      if (settingsError || !settings) throw new Error("Configurações de IA não encontradas para este canal.");

      const aiConfig = {
        provider: settings.ai_provider || 'gemini',
        apiKey: settings.ai_provider === 'groq' ? settings.groq_key : settings.gemini_key,
        url: settings.ollama_url,
        model: settings.ai_model
      };

      // Usa o título atual ou o original como contexto
      const basePrompt = formData.title || video.title || "Vídeo sem título";
      
      const results = await generateContentAI(aiConfig as any, basePrompt, field);

      if (results && results.length > 0) {
        setSuggestions(prev => ({ ...prev, [field]: results }));
        setActiveSuggestionField(field); // Abre o dropdown automaticamente
      } else {
        throw new Error("A IA não retornou sugestões válidas.");
      }

    } catch (err: any) {
      console.error("Erro ao gerar:", err);
      setError(err.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setGeneratingField(null);
    }
  };

  const handleSelectSuggestion = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setActiveSuggestionField(null);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = {
        title: formData.title,
        description: formData.description,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        hashtags: formData.hashtags.split(/[\s,]+/).map(t => t.trim()).filter(Boolean)
      };

      const { error } = await supabase
        .from('shorts_youtube')
        .update(updates)
        .eq('id', video.id);

      if (error) throw error;
      onSave();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setError("Erro ao salvar alterações.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(video.link_s3);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formData.title || 'video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Erro no download:", err);
      alert("Erro ao baixar o vídeo. Verifique as permissões CORS do bucket.");
    }
  };

  const renderFieldWithSuggestions = (
    field: 'title' | 'description' | 'tags' | 'hashtags',
    label: string,
    Component: 'input' | 'textarea',
    placeholder: string
  ) => {
    const hasSuggestions = suggestions[field] && suggestions[field].length > 0;
    const isOpen = activeSuggestionField === field;

    return (
      <div className="group relative">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
            {label}
            {field === 'tags' && <span className="text-xs font-normal text-gray-600">(separadas por vírgula)</span>}
          </label>
          <div className="flex gap-2">
            {hasSuggestions && !isOpen && (
              <button
                onClick={() => setActiveSuggestionField(field)}
                className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <ChevronDown size={12} /> Ver {suggestions[field].length} Sugestões
              </button>
            )}
            <button 
              onClick={() => handleGenerateAI(field)}
              disabled={!!generatingField}
              className={`text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 px-2 py-1 rounded-md ${
                generatingField === field 
                  ? 'bg-blue-500/10 text-blue-400' 
                  : 'text-blue-400 hover:bg-blue-500/10 hover:text-blue-300'
              }`}
            >
              {generatingField === field ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {hasSuggestions ? 'Gerar Novas' : 'Gerar IA'}
            </button>
          </div>
        </div>
        
        <div className="relative">
          {Component === 'textarea' ? (
            <textarea
              value={(formData as any)[field]}
              onChange={e => setFormData({...formData, [field]: e.target.value})}
              rows={field === 'description' ? 5 : 3}
              className="w-full bg-[#262626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder={placeholder}
            />
          ) : (
            <input
              type="text"
              value={(formData as any)[field]}
              onChange={e => setFormData({...formData, [field]: e.target.value})}
              className="w-full bg-[#262626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder={placeholder}
            />
          )}

          {/* Dropdown de Sugestões */}
          {isOpen && hasSuggestions && (
            <div 
              ref={suggestionsRef}
              className="absolute z-50 left-0 right-0 mt-2 bg-[#1f1f1f] border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in-down"
            >
              <div className="px-3 py-2 bg-[#2a2a2a] border-b border-gray-700 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={12} className="text-blue-400" />
                  Sugestões da IA
                </span>
                <button onClick={() => setActiveSuggestionField(null)} className="text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {suggestions[field].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSuggestion(field, suggestion)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-600/20 hover:text-blue-100 text-gray-300 text-sm border-b border-gray-800 last:border-0 transition-colors flex items-start gap-3 group/item"
                  >
                    <span className="mt-0.5 text-gray-600 group-hover/item:text-blue-400 font-mono text-xs">{idx + 1}.</span>
                    <span className="flex-1 leading-relaxed">{suggestion}</span>
                    <span className="opacity-0 group-hover/item:opacity-100 text-blue-400 self-center">
                      <Check size={16} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#1a1a1a] w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden border border-gray-800">
        
        {/* Lado Esquerdo - Preview */}
        <div className="w-1/3 bg-black relative hidden md:flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="relative w-full h-full max-h-full flex items-center justify-center">
            <video 
              src={video.link_s3} 
              controls 
              className="max-h-full max-w-full object-contain shadow-2xl"
            />
            <div className="absolute bottom-8 left-4 right-4 text-white pointer-events-none drop-shadow-md">
              <h3 className="font-bold text-lg line-clamp-2 mb-2">{formData.title || 'Seu Título Aqui'}</h3>
              <p className="text-sm opacity-90 line-clamp-2">{formData.description || 'Sua descrição aparecerá aqui...'}</p>
            </div>
          </div>
        </div>

        {/* Lado Direito - Formulário */}
        <div className="flex-1 flex flex-col bg-[#1a1a1a] text-white">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-100">DETALHES DO VÍDEO</h2>
            <div className="flex gap-3">
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
                <X size={18} /> Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="text-green-400 hover:text-green-300 transition-colors flex items-center gap-1 text-sm font-medium"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar
              </button>
            </div>
          </div>

          {/* Conteúdo Scrollável */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm animate-shake">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {renderFieldWithSuggestions('title', 'Título', 'input', 'Digite um título chamativo...')}
            {renderFieldWithSuggestions('description', 'Descrição', 'textarea', 'Sobre o que é este vídeo?')}
            {renderFieldWithSuggestions('tags', 'Tags', 'textarea', 'shorts, viral, youtube...')}
            {renderFieldWithSuggestions('hashtags', 'Hashtags', 'input', '#shorts #viral')}

          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-800 bg-[#1a1a1a] flex flex-col gap-3">
            <button
              onClick={() => onSchedule(video)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <CalendarIcon size={18} />
              Agendar Publicação
            </button>
            
            <button
              onClick={handleDownload}
              className="w-full py-3 bg-[#262626] hover:bg-[#333] text-gray-300 rounded-lg font-medium transition-all flex items-center justify-center gap-2 border border-gray-700"
            >
              <Download size={18} />
              Baixar Vídeo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDetailsModal;
