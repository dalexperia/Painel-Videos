import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Trash2, AlertCircle, RefreshCw, LayoutGrid, List, Download, X, Calendar, Sparkles, Tv, Edit2, Save, XCircle, Hash, Tag, Search, Loader2 } from 'lucide-react';
import PostModal, { Video as PostModalVideo } from './PostModal';
import { generateContentAI } from '../lib/ai';
import VideoSmartPreview from './VideoSmartPreview';

// Reutiliza a interface do PostModal para consistência
type Video = PostModalVideo;

type ViewMode = 'grid' | 'list';

const RecentVideos: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  // Estado para o PostModal
  const [videoToPost, setVideoToPost] = useState<Video | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Estados para Edição no Modal de Preview
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ 
    title: '', 
    description: '',
    tags: '',
    hashtags: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para IA e Autocomplete
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [activeSuggestionField, setActiveSuggestionField] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- EFEITO DE CARREGAMENTO E REALTIME ---
  useEffect(() => {
    // 1. Busca inicial
    fetchRecentVideos();

    // 2. Configura o Listener (Ouvido) do Supabase
    const channel = supabase
      .channel('recent-videos-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta TUDO: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'shorts_youtube',
        },
        (payload) => {
          console.log('🔄 Alteração detectada na tabela, atualizando lista...', payload.eventType);
          // Ao detectar qualquer mudança, recarrega a lista para garantir consistência
          // (Poderíamos atualizar o estado localmente, mas refetch é mais seguro para garantir filtros)
          fetchRecentVideos();
        }
      )
      .subscribe();

    // Limpeza ao desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Resetar formulário de edição quando um vídeo é selecionado
  useEffect(() => {
    if (selectedVideo) {
      setEditForm({
        title: selectedVideo.title || '',
        description: selectedVideo.description || '',
        tags: Array.isArray(selectedVideo.tags) ? selectedVideo.tags.join(', ') : '',
        hashtags: Array.isArray(selectedVideo.hashtags) ? selectedVideo.hashtags.join(', ') : ''
      });
      setIsEditing(false);
      setSuggestions({});
      setActiveSuggestionField(null);
    }
  }, [selectedVideo]);

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

  const fetchRecentVideos = async () => {
    // Não ativamos setLoading(true) aqui para evitar "piscar" a tela em atualizações automáticas
    // Apenas na primeira carga ou erro
    if (videos.length === 0) setLoading(true);
    
    setError(null);
    try {
      const { data, error } = await supabase
        .from('shorts_youtube')
        .select('*')
        .eq('status', 'Created')
        .is('publish_at', null)
        .eq('failed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const validVideos = (data || []).filter((item): item is any => 
        item && item.link_s3 && item.link_s3.trim() !== ''
      ).map((item: any) => ({
        id: item.id,
        baserow_id: item.baserow_id || 0,
        title: item.title || '',
        description: item.description || '',
        link_s3: item.link_s3,
        link_drive: item.link_drive || '',
        channel: item.channel || '',
        hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
        duration: item.duration || 0,
        status: item.status || 'Created',
        created_at: item.created_at,
        failed: item.failed || false,
        url: item.link_s3
      }));
      
      setVideos(validVideos);

    } catch (err: any) {
      console.error('Erro ao buscar vídeos:', err);
      setError('Não foi possível carregar os vídeos recentes.');
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica de Autocomplete Inteligente ---

  const getAIConfig = async () => {
    if (!selectedVideo?.channel) throw new Error("Canal não identificado.");
    const { data: settings, error } = await supabase
      .from('shorts_settings')
      .select('ai_provider, gemini_key, groq_key, ollama_url, ai_model')
      .eq('channel', selectedVideo.channel)
      .single();
    
    if (error || !settings) throw new Error("Configurações de IA não encontradas.");
    
    // TRIM KEYS HERE
    return {
      provider: settings.ai_provider || 'gemini',
      apiKey: (settings.ai_provider === 'groq' ? settings.groq_key : settings.gemini_key)?.trim(),
      url: settings.ollama_url,
      model: settings.ai_model
    };
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    
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
    if (currentTerm.length < 2) {
      setActiveSuggestionField(null);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    setActiveSuggestionField(field); // Mantém o campo ativo para mostrar o loader se quiser

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
          editForm.title || selectedVideo?.title // Contexto
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
      const parts = editForm.tags.split(',');
      parts.pop(); // Remove o termo incompleto
      parts.push(suggestion); // Adiciona a sugestão
      newValue = parts.join(', ') + ', '; // Adiciona vírgula para a próxima
    } else if (field === 'hashtags') {
      const parts = editForm.hashtags.split(' ');
      parts.pop();
      parts.push(suggestion.startsWith('#') ? suggestion : `#${suggestion}`);
      newValue = parts.join(' ') + ' ';
    }

    setEditForm(prev => ({ ...prev, [field]: newValue }));
    setActiveSuggestionField(null);
    
    // Foca de volta no input
    const input = document.getElementById(`edit-input-${field}`);
    if (input) input.focus();
  };

  // --- Fim Lógica Autocomplete ---

  const handleReprove = async (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja reprovar este vídeo? Ele será movido para a lista de reprovados e marcado para recriação.')) return;

    try {
      const { error } = await supabase
        .from('shorts_youtube')
        .update({ 
          failed: true,
          status: null // Define status como NULL para trigger de recriação no backend
        })
        .eq('id', id);

      if (error) throw error;
      
      // A atualização via Realtime vai cuidar de remover da lista, 
      // mas removemos localmente para feedback instantâneo
      setVideos(videos.filter((video) => video.id !== id));
      if (selectedVideo?.id === id) setSelectedVideo(null);
      
    } catch (err) {
      console.error("Erro ao reprovar o vídeo:", err);
      alert('Erro ao reprovar o vídeo.');
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedVideo) return;
    setIsSaving(true);

    try {
      const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const hashtagsArray = editForm.hashtags.split(',').map(t => t.trim()).filter(t => t.length > 0);

      const updates = {
        title: editForm.title,
        description: editForm.description,
        tags: tagsArray,
        hashtags: hashtagsArray
      };

      const { error } = await supabase
        .from('shorts_youtube')
        .update(updates)
        .eq('id', selectedVideo.id);

      if (error) throw error;

      const updatedVideo = { 
        ...selectedVideo, 
        ...updates 
      };
      
      setSelectedVideo(updatedVideo);
      // Atualização local otimista (o realtime confirmará depois)
      setVideos(videos.map(v => v.id === selectedVideo.id ? updatedVideo : v));
      setIsEditing(false);
      
    } catch (err) {
      console.error('Erro ao salvar alterações:', err);
      alert('Erro ao salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAI = async (field: 'title' | 'description' | 'tags' | 'hashtags') => {
    if (!selectedVideo || !selectedVideo.channel) {
      alert("Canal não identificado para este vídeo.");
      return;
    }

    setGeneratingField(field);
    setActiveSuggestionField(null); // Fecha autocomplete se estiver aberto

    try {
      const aiConfig = await getAIConfig();
      const basePrompt = editForm.title || selectedVideo.title || "Vídeo sem título";
      const content = await generateContentAI(aiConfig as any, basePrompt, field);

      // Se for tags ou hashtags, a IA retorna array, precisamos converter para string
      let finalValue = '';
      if (Array.isArray(content)) {
        if (field === 'tags') finalValue = content.join(', ');
        else if (field === 'hashtags') finalValue = content.join(' ');
        else finalValue = content[0]; // Fallback
      } else {
        // Caso a IA retorne string direta (não deveria com o novo parser, mas por segurança)
        finalValue = String(content);
      }
      
      // Se a IA retornou múltiplas opções para título/descrição, pegamos a primeira ou abrimos modal (simplificado aqui para pegar primeira)
      if (field === 'title' || field === 'description') {
         if (Array.isArray(content) && content.length > 0) {
             setEditForm(prev => ({ ...prev, [field]: content[0] }));
         }
      } else {
         // Para tags/hashtags, substituímos tudo
         setEditForm(prev => ({ ...prev, [field]: finalValue }));
      }

    } catch (err: any) {
      console.error("Erro ao gerar AI:", err);
      alert(err.message || "Erro ao gerar conteúdo com IA.");
    } finally {
      setGeneratingField(null);
    }
  };

  const handleDownload = async (url: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) { alert('URL inválida'); return; }
    try {
      document.body.style.cursor = 'wait';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha no download');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const safeTitle = (title || 'video').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute('download', `${safeTitle}.mp4`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Erro no download:', error);
      window.open(url, '_blank');
    } finally {
      document.body.style.cursor = 'default';
    }
  };

  const openPostModal = (video: Video, e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoToPost(video);
    setIsPostModalOpen(true);
  };

  const handlePost = async (video: PostModalVideo, options: { scheduleDate?: string; webhookUrl: string }) => {
    setIsPosting(true);
    try {
      if (!options.webhookUrl) throw new Error('URL do Webhook não está definida.');
      const isScheduled = !!options.scheduleDate;
      let privacy_status = isScheduled ? 'private' : 'public';
      let posting_date = isScheduled ? options.scheduleDate! : new Date().toISOString();

      const payload = {
        link_drive: video.link_drive || "",
        link_s3: video.link_s3,
        title: video.title,
        description: video.description || "",
        hashtags: Array.isArray(video.hashtags) ? video.hashtags : [],
        tags: Array.isArray(video.tags) ? video.tags : [],
        channel: video.channel || "",
        baserow_id: video.baserow_id || 0,
        id: video.id,
        privacy_status: privacy_status,
        posting_date: posting_date
      };

      const response = await fetch(options.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Erro no Webhook: ${response.status}`);
      
      if (isScheduled) {
        await supabase.from('shorts_youtube').update({ publish_at: posting_date }).eq('id', video.id);
        // O Realtime vai atualizar a lista, mas removemos localmente para feedback imediato
        setVideos(prev => prev.filter(v => v.id !== video.id));
        alert('Vídeo agendado com sucesso!');
      } else {
        alert('Solicitação de publicação enviada!');
      }
      
      setIsPostModalOpen(false);
      setVideoToPost(null);
      if (selectedVideo?.id === video.id) setSelectedVideo(null);
      
    } catch (error: any) {
      console.error('ERRO FATAL:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  // Renderizador de Input com Autocomplete
  const renderInputWithAutocomplete = (field: 'tags' | 'hashtags', label: string, icon: React.ReactNode, placeholder: string) => {
    const hasSuggestions = suggestions[field] && suggestions[field].length > 0;
    const isOpen = activeSuggestionField === field;
    const showLoader = isTyping && activeSuggestionField === field;

    return (
      <div className="relative group">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-xs text-gray-400 flex items-center gap-1">
            {icon} {label}
          </label>
          <div className="flex gap-2">
            {showLoader && (
               <span className="text-xs text-blue-400 flex items-center gap-1 animate-pulse">
                 <Loader2 size={10} className="animate-spin" /> Buscando...
               </span>
            )}
            <button 
              onClick={() => handleGenerateAI(field)}
              disabled={!!generatingField}
              className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
            >
              {generatingField === field ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Gerar Lista
            </button>
          </div>
        </div>
        
        <div className="relative">
          <input
            id={`edit-input-${field}`}
            type="text"
            value={(editForm as any)[field]}
            onChange={(e) => handleInputChange(field, e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
          />

          {/* Dropdown de Sugestões */}
          {isOpen && hasSuggestions && (
            <div 
              ref={suggestionsRef}
              className="absolute z-50 left-0 right-0 mt-1 bg-[#1f1f1f] border border-gray-600 rounded-lg shadow-xl overflow-hidden animate-fade-in-down max-h-48 overflow-y-auto custom-scrollbar"
            >
              <div className="px-3 py-1.5 bg-[#2a2a2a] border-b border-gray-700 flex justify-between items-center">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={10} className="text-blue-400" />
                  Sugestões Inteligentes
                </span>
              </div>
              {suggestions[field].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSuggestion(field, suggestion)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-600/20 hover:text-blue-100 text-gray-300 text-sm border-b border-gray-700/50 last:border-0 transition-colors flex items-center gap-2 group/item"
                >
                  <Search size={12} className="text-gray-500 group-hover/item:text-blue-400" />
                  <span className="flex-1 truncate">{suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>;
    if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-center"><AlertCircle className="mr-2" /><span>{error}</span></div>;
    if (videos.length === 0) return <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-100"><Sparkles size={48} className="mx-auto text-gray-300 mb-4" /><h3 className="text-gray-800 text-xl font-semibold">Nenhum vídeo recente</h3></div>;

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="group bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col hover:-translate-y-1">
              
              {/* Substituído pelo VideoSmartPreview */}
              <div onClick={() => setSelectedVideo(video)}>
                <VideoSmartPreview src={video.link_s3} />
                {video.channel && (
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md flex items-center gap-1 pointer-events-none z-10">
                    <Tv size={10} />
                    <span className="truncate max-w-[100px]">{video.channel}</span>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 min-h-[3rem]" title={video.title}>{video.title || 'Vídeo sem título'}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4"><Sparkles size={14} className="text-brand-500" /><span>Criado em {new Date(video.created_at).toLocaleDateString('pt-BR')}</span></div>
                <div className="mt-auto pt-4 flex items-center gap-2 border-t border-gray-100">
                  <button onClick={(e) => openPostModal(video, e)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"><Calendar size={16} /><span>Agendar</span></button>
                  <button onClick={(e) => handleReprove(video.id, e)} className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Reprovar e Recriar"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {videos.map((video) => (
          <div key={video.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center p-3 gap-4">
            <div className="relative w-full sm:w-32 h-20 rounded-md overflow-hidden cursor-pointer flex-shrink-0 group" onClick={() => setSelectedVideo(video)}>
              <VideoSmartPreview src={video.link_s3} className="h-full" />
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="font-semibold text-gray-800 truncate" title={video.title}>{video.title || 'Vídeo sem título'}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <div className="flex items-center gap-2 text-sm text-gray-500"><Sparkles size={14} className="text-brand-500" /><span>Criado em {new Date(video.created_at).toLocaleDateString('pt-BR')}</span></div>
                {video.channel && <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"><Tv size={12} /><span>{video.channel}</span></div>}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button onClick={(e) => openPostModal(video, e)} className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"><Calendar size={16} /><span className="hidden md:inline">Agendar</span></button>
              <button onClick={(e) => handleDownload(video.link_s3, video.title || 'video', e)} className="flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Download size={18} /></button>
              <button onClick={(e) => handleReprove(video.id, e)} className="flex items-center justify-center p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Reprovar e Recriar"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b pb-4 border-gray-200">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Recentes</h1>
          <p className="text-gray-500 mt-1">Vídeos criados aguardando agendamento</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}><LayoutGrid size={20} /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}><List size={20} /></button>
          </div>
          <button onClick={fetchRecentVideos} className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"><RefreshCw size={22} /></button>
          <div className="bg-brand-100 text-brand-800 text-center rounded-2xl px-5 py-2 shadow-sm">
            <div className="text-2xl font-bold leading-none">{videos.length}</div>
            <div className="text-xs leading-none tracking-tight mt-1">{videos.length === 1 ? 'Vídeo' : 'Vídeos'}</div>
          </div>
        </div>
      </div>

      {renderContent()}

      {/* Modal de Preview e Edição */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedVideo(null)}>
          <div className="relative w-full max-w-4xl mx-auto bg-gray-900 rounded-2xl overflow-hidden shadow-2xl animate-slide-up flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="w-full md:w-1/2 bg-black flex items-center justify-center">
              <video src={selectedVideo.link_s3} controls autoPlay className="w-full h-auto max-h-[50vh] md:max-h-full object-contain">Seu navegador não suporta a tag de vídeo.</video>
            </div>
            
            <div className="w-full md:w-1/2 p-6 text-white overflow-y-auto bg-gray-800 flex flex-col custom-scrollbar">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider">Detalhes do Vídeo</h2>
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors"><Edit2 size={16} /> Editar</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300 transition-colors" disabled={isSaving}><XCircle size={16} /> Cancelar</button>
                    <button onClick={handleSaveEdit} className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300 transition-colors font-medium" disabled={isSaving}>{isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} Salvar</button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4 flex-grow">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs text-gray-400">Título</label>
                      <button onClick={() => handleGenerateAI('title')} disabled={!!generatingField} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">{generatingField === 'title' ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Gerar IA</button>
                    </div>
                    <input type="text" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs text-gray-400">Descrição</label>
                      <button onClick={() => handleGenerateAI('description')} disabled={!!generatingField} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">{generatingField === 'description' ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Gerar IA</button>
                    </div>
                    <textarea value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} rows={4} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none" />
                  </div>
                  
                  {/* Inputs com Autocomplete */}
                  {renderInputWithAutocomplete('tags', 'Tags (separadas por vírgula)', <Tag size={12} />, 'ex: tecnologia, inovação, shorts')}
                  {renderInputWithAutocomplete('hashtags', 'Hashtags (separadas por espaço)', <Hash size={12} />, 'ex: #tech #viral')}

                </div>
              ) : (
                <div className="space-y-4 flex-grow">
                  <div><h3 className="font-bold text-xl leading-tight">{selectedVideo.title || 'Sem título'}</h3></div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-sm text-brand-300 bg-brand-500/20 rounded-md px-3 py-1.5"><Sparkles size={16} /><span className="font-medium">Criado em {new Date(selectedVideo.created_at).toLocaleDateString('pt-BR')}</span></div>
                    {selectedVideo.channel && <div className="flex items-center gap-2 text-sm text-blue-300 bg-blue-500/20 rounded-md px-3 py-1.5"><Tv size={16} /><span className="font-medium">{selectedVideo.channel}</span></div>}
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar"><p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedVideo.description || 'Sem descrição.'}</p></div>
                  {(selectedVideo.tags?.length > 0 || selectedVideo.hashtags?.length > 0) && (
                    <div className="space-y-2">
                      {selectedVideo.tags?.length > 0 && <div className="flex flex-wrap gap-1">{selectedVideo.tags.map((tag, i) => <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full flex items-center gap-1"><Tag size={10} /> {tag}</span>)}</div>}
                      {selectedVideo.hashtags?.length > 0 && <div className="flex flex-wrap gap-1">{selectedVideo.hashtags.map((hash, i) => <span key={i} className="text-xs bg-brand-900/50 text-brand-300 px-2 py-1 rounded-full flex items-center gap-1"><Hash size={10} /> {hash.replace('#', '')}</span>)}</div>}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex flex-col gap-3 w-full mt-6 pt-4 border-t border-gray-700">
                <button onClick={(e) => { setSelectedVideo(null); openPostModal(selectedVideo, e); }} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors font-semibold shadow-lg shadow-brand-900/20"><Calendar size={18} /><span>Agendar Publicação</span></button>
                <button onClick={(e) => handleDownload(selectedVideo.link_s3, selectedVideo.title || 'video', e)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium text-sm"><Download size={18} /><span>Baixar Vídeo</span></button>
              </div>
            </div>
            <button onClick={() => setSelectedVideo(null)} className="absolute top-3 right-3 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-1.5 transition-colors z-10"><X size={24} /></button>
          </div>
        </div>
      )}

      {videoToPost && <PostModal video={videoToPost} onClose={() => { setIsPostModalOpen(false); setVideoToPost(null); }} onPost={handlePost} isPosting={isPosting} />}
    </div>
  );
};

export default RecentVideos;
