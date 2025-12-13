import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, Wand2, Loader2, Download, Calendar as CalendarIcon, AlertCircle, ChevronDown, Check, Sparkles, Search } from 'lucide-react';
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
  const [isTyping, setIsTyping] = useState(false);
  
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Sincroniza hashtags no final da descrição automaticamente
  useEffect(() => {
    const hashtagsArray = formData.hashtags.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
    const normalizedHashtags = hashtagsArray.map(h => (h.startsWith('#') ? h : `#${h}`)).map(h => h.replace(/\s+/g, ''));
    const joined = normalizedHashtags.join(' ');
    setFormData(prev => {
      const base = prev.description.replace(/(?:\n\n#\S+(?:\s#\S+)*)$/, '');
      const nextDesc = joined.length ? `${base}\n\n${joined}` : base;
      if (nextDesc === prev.description) return prev;
      return { ...prev, description: nextDesc };
    });
  }, [formData.hashtags]);

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

  // Função para obter configurações de IA
  const getAIConfig = async () => {
    if (!video.channel) throw new Error("Canal não identificado.");
    const { data: settings, error } = await supabase
      .from('shorts_settings')
      .select('ai_provider, gemini_key, groq_key, ollama_url, ai_model')
      .eq('channel', video.channel)
      .single();
    
    if (error || !settings) throw new Error("Configurações de IA não encontradas.");
    
    return {
      provider: settings.ai_provider || 'gemini',
      apiKey: settings.ai_provider === 'groq' ? settings.groq_key : settings.gemini_key,
      url: settings.ollama_url,
      model: settings.ai_model
    };
  };

  // Geração Manual (Botão "Gerar IA")
  const handleGenerateAI = async (field: 'tags' | 'hashtags' | 'title' | 'description') => {
    setError(null);
    setGeneratingField(field);
    setActiveSuggestionField(null); 
    
    try {
      const aiConfig = await getAIConfig();
      const basePrompt = formData.title || video.title || "Vídeo sem título";
      const results = await generateContentAI(aiConfig as any, basePrompt, field);

      if (!results || results.length === 0) throw new Error("A IA não retornou sugestões válidas.");

      // Ajusta quantidade e aplica sanitização leve para preview
      let finalList = results.map(s => String(s).trim()).filter(Boolean);
      if (field === 'tags') {
        // 12–18 tags, sem espaços (usa hífen)
        finalList = finalList
          .map(t => t.replace(/[<>]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30));
        if (finalList.length < 12) finalList = finalList.slice(0, 12);
        else finalList = finalList.slice(0, 18);
      } else if (field === 'hashtags') {
        // Exatamente 10
        finalList = finalList.map(h => h.startsWith('#') ? h : `#${h}`).slice(0, 10);
      }

      setSuggestions(prev => ({ ...prev, [field]: finalList }));
      setActiveSuggestionField(field);
      
      // Atualiza os campos diretamente para refletir no preview
      if (field === 'tags') {
        const joined = finalList.join(', ');
        setFormData(prev => ({ ...prev, tags: joined }));
      } else if (field === 'hashtags') {
        const normalized = finalList.map(h => (h.startsWith('#') ? h : `#${h}`)).map(h => h.replace(/\s+/g, ''));
        const joined = normalized.join(' ');
        setFormData(prev => {
          const base = prev.description.replace(/(?:\n\n#\S+(?:\s#\S+)*)$/, '');
          const desc = joined.length ? `${base}\n\n${joined}` : base;
          return { ...prev, hashtags: joined, description: desc };
        });
      } else if (field === 'title' || field === 'description') {
        if (finalList.length > 0) {
          setFormData(prev => ({ ...prev, [field]: finalList[0] }));
        }
      }
    } catch (err: any) {
      console.error("Erro ao gerar:", err);
      setError(err.message);
    } finally {
      setGeneratingField(null);
    }
  };

  // Autocomplete (Enquanto digita)
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Apenas para tags e hashtags
    if (field !== 'tags' && field !== 'hashtags') return;

    // Limpa timer anterior
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    // Identifica o termo atual (após a última vírgula ou espaço)
    let currentTerm = '';
    if (field === 'tags') {
      const parts = value.split(',');
      currentTerm = parts[parts.length - 1].trim();
    } else {
      const parts = value.split(' ');
      currentTerm = parts[parts.length - 1].trim();
    }

    // Se o termo for muito curto, esconde sugestões
    if (currentTerm.length < 3) {
      setActiveSuggestionField(null);
      return;
    }

    setIsTyping(true);

    // Debounce de 800ms para chamar a IA
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const aiConfig = await getAIConfig();
        const type = field === 'tags' ? 'autocomplete_tags' : 'autocomplete_hashtags';
        
        // Passa o termo atual + título do vídeo para contexto
        const results = await generateContentAI(
          aiConfig as any, 
          currentTerm, 
          type, 
          formData.title || video.title
        );

        if (results && results.length > 0) {
          setSuggestions(prev => ({ ...prev, [field]: results }));
          setActiveSuggestionField(field);
        }
      } catch (err) {
        console.error("Erro silencioso no autocomplete:", err);
      } finally {
        setIsTyping(false);
      }
    }, 800);
  };

  const handleSelectSuggestion = (field: string, suggestion: string) => {
    let newValue = '';
    
    if (field === 'tags') {
      // Substitui o último termo parcial pela sugestão completa
      const parts = formData.tags.split(',');
      parts.pop(); // Remove o termo incompleto
      parts.push(suggestion); // Adiciona a sugestão
      newValue = parts.join(', ') + ', '; // Adiciona vírgula para a próxima
    } else if (field === 'hashtags') {
      const parts = formData.hashtags.split(' ');
      parts.pop();
      parts.push(suggestion.startsWith('#') ? suggestion : `#${suggestion}`);
      newValue = parts.join(' ') + ' ';
    } else {
      newValue = suggestion;
    }

    setFormData(prev => ({ ...prev, [field]: newValue }));
    setActiveSuggestionField(null);
    
    // Foca de volta no input (opcional, mas bom para UX)
    const input = document.getElementById(`input-${field}`);
    if (input) input.focus();
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Sanitização conforme requisitos da YouTube API
      const rawTags = formData.tags.split(',').map(t => t.trim());
      const cleanedTags = rawTags
        .filter(Boolean)
        .map(t => t.replace(/[<>]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
        .map(t => t.slice(0, 30));
      let sum = 0;
      const limitedTags: string[] = [];
      for (const tag of cleanedTags) {
        if (sum + tag.length > 500) break;
        limitedTags.push(tag);
        sum += tag.length;
      }

      const hashtagsInline = limitedTags.length > 0 ? [] : []; // placeholder to keep diff tidy
      const hashtagsArray = formData.hashtags.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
      const normalizedHashtags = hashtagsArray.map(h => (h.startsWith('#') ? h : `#${h}`)).map(h => h.replace(/\s+/g, ''));

      const descriptionWithHashtags = `${formData.description}${normalizedHashtags.length ? `\n\n${normalizedHashtags.join(' ')}` : ''}`;

      const updates = {
        title: formData.title,
        description: descriptionWithHashtags,
        tags: limitedTags,
        hashtags: normalizedHashtags
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
            {isTyping && field === activeSuggestionField && (
               <span className="text-xs text-blue-400 flex items-center gap-1 animate-pulse">
                 <Loader2 size={10} className="animate-spin" /> Buscando sugestões...
               </span>
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
              {hasSuggestions && !isOpen ? 'Ver Sugestões' : 'Gerar Ideias'}
            </button>
          </div>
        </div>
        
        <div className="relative">
          {Component === 'textarea' ? (
            <textarea
              id={`input-${field}`}
              value={(formData as any)[field]}
              onChange={e => handleInputChange(field, e.target.value)}
              rows={field === 'description' ? 5 : 3}
              className="w-full bg-[#262626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder={placeholder}
            />
          ) : (
            <input
              id={`input-${field}`}
              type="text"
              value={(formData as any)[field]}
              onChange={e => handleInputChange(field, e.target.value)}
              className="w-full bg-[#262626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder={placeholder}
              autoComplete="off"
            />
          )}
          {field === 'tags' && (
            <div className="mt-1 text-[11px] text-gray-500">
              {(formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean).length : 0)} tags
            </div>
          )}
          {field === 'hashtags' && (
            <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-2">
              <span>{(formData.hashtags ? formData.hashtags.split(/\s+/).filter(Boolean).length : 0)} hashtags</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
                Inseridas na descrição
              </span>
            </div>
          )}

          {/* Dropdown de Sugestões */}
          {isOpen && hasSuggestions && (
            <div 
              ref={suggestionsRef}
              className="absolute z-50 left-0 right-0 mt-2 bg-[#1f1f1f] border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in-down"
            >
              <div className="px-3 py-2 bg-[#2a2a2a] border-b border-gray-700 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Search size={12} className="text-blue-400" />
                  Sugestões para completar
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
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-600/20 hover:text-blue-100 text-gray-300 text-sm border-b border-gray-800 last:border-0 transition-colors flex items-center gap-3 group/item"
                  >
                    <Search size={14} className="text-gray-600 group-hover/item:text-blue-400" />
                    <span className="flex-1 font-medium">{suggestion}</span>
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

            {(() => {
              const hashtagsArray = formData.hashtags.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
              const normalizedHashtags = hashtagsArray.map(h => (h.startsWith('#') ? h : `#${h}`)).map(h => h.replace(/\s+/g, ''));
              const descriptionPreview = `${formData.description}${normalizedHashtags.length ? `\n\n${normalizedHashtags.join(' ')}` : ''}`;
              return (
                <>
                  {renderFieldWithSuggestions('title', 'Título', 'input', 'Digite um título chamativo...')}
                  {renderFieldWithSuggestions('description', 'Descrição', 'textarea', 'Sobre o que é este vídeo?')}
                  <div className="bg-[#191919] border border-gray-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Pré-visualização da descrição</div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-200">{descriptionPreview}</pre>
                  </div>
                </>
              );
            })()}
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
