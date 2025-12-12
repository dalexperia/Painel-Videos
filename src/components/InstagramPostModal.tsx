import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Film, History, Send, Loader2, AlertCircle, CheckCircle2, Link as LinkIcon, Wand2, Sparkles, RefreshCw, RectangleVertical, Square, Lightbulb, Bot } from 'lucide-react';
import { publishToInstagram } from '../lib/instagram';
import { supabase } from '../lib/supabaseClient';
import { generateContentAI, AIProvider, AIConfig } from '../lib/ai';

interface InstagramPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelConfig: {
    id: string;
    token: string;
    name: string;
  } | null;
  onSuccess: () => void;
}

type PostType = 'IMAGE' | 'REELS' | 'STORIES';
type InputMode = 'UPLOAD' | 'GENERATE';
type GenerationStatus = 'idle' | 'pending' | 'completed' | 'failed';
type ImageFormat = 'SQUARE' | 'PORTRAIT' | 'STORY';

interface ChannelSettings {
  ai_provider: AIProvider;
  gemini_key?: string;
  groq_key?: string;
  ollama_url?: string;
  ollama_key?: string;
  ai_model?: string;
}

const WEBHOOK_URL = 'https://n8n-main.oficinadamultape.com.br/webhook/gerar-imagens-insta';

const InstagramPostModal: React.FC<InstagramPostModalProps> = ({ isOpen, onClose, channelConfig, onSuccess }) => {
  
  // UI State
  const [postType, setPostType] = useState<PostType>('IMAGE');
  const [inputMode, setInputMode] = useState<InputMode>('UPLOAD');
  const [imageFormat, setImageFormat] = useState<ImageFormat>('SQUARE');
  
  // Form Data
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [prompt, setPrompt] = useState('');
  
  // Status State
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'publishing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Generation State
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  
  // Prompt Enhancement State
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedPrompts, setEnhancedPrompts] = useState<string[]>([]);
  const [channelSettings, setChannelSettings] = useState<ChannelSettings | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMediaUrl('');
      setCaption('');
      setPrompt('');
      setStatus('idle');
      setGenerationStatus('idle');
      setGenerationId(null);
      setInputMode('UPLOAD');
      setImageFormat('SQUARE');
      setEnhancedPrompts([]);
      setChannelSettings(null);
    } else if (channelConfig) {
      // Fetch Channel Specific Settings for AI
      fetchChannelSettings();
    }
  }, [isOpen, channelConfig]);

  const fetchChannelSettings = async () => {
    if (!channelConfig) return;
    try {
      const { data, error } = await supabase
        .from('shorts_settings')
        .select('ai_provider, gemini_key, groq_key, ollama_url, ollama_key, ai_model')
        .eq('channel', channelConfig.name)
        .single();
      
      if (data) {
        setChannelSettings(data as ChannelSettings);
      }
    } catch (err) {
      console.error("Erro ao carregar configurações do canal:", err);
    }
  };

  // Update format automatically when switching Post Type
  useEffect(() => {
    if (postType === 'STORIES') {
      setImageFormat('STORY');
    } else if (postType === 'IMAGE' && imageFormat === 'STORY') {
      setImageFormat('SQUARE'); // Reset to square if coming back from stories
    }
  }, [postType]);

  // Realtime Subscription for Image Generation
  useEffect(() => {
    if (!generationId || generationStatus === 'completed' || generationStatus === 'failed') return;

    console.log(`[Realtime] Subscribing to generated_images changes for ID: ${generationId}`);

    const channel = supabase
      .channel(`generation-${generationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generated_images',
          filter: `id=eq.${generationId}`,
        },
        (payload) => {
          console.log('[Realtime] Update received:', payload);
          const newRecord = payload.new;
          
          if (newRecord.status === 'completed' && newRecord.image_url) {
            setMediaUrl(newRecord.image_url);
            if (newRecord.description) {
              setCaption(newRecord.description);
            }
            setGenerationStatus('completed');
            setInputMode('UPLOAD'); // Switch back to preview/post mode
          } else if (newRecord.status === 'failed') {
            setGenerationStatus('failed');
            setErrorMessage('Falha na geração da imagem. Tente novamente.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [generationId, generationStatus]);

  if (!isOpen) return null;

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    
    setIsEnhancing(true);
    setEnhancedPrompts([]);
    
    try {
      // Construct Config from Channel Settings
      const config: AIConfig = {
        provider: channelSettings?.ai_provider || 'gemini',
        apiKey: channelSettings?.ai_provider === 'groq' ? channelSettings.groq_key : 
                channelSettings?.ai_provider === 'ollama' ? channelSettings.ollama_key :
                channelSettings?.gemini_key,
        url: channelSettings?.ollama_url,
        model: channelSettings?.ai_model
      };

      const suggestions = await generateContentAI(
        config,
        prompt,
        'image_prompt'
      );
      setEnhancedPrompts(suggestions);
    } catch (error) {
      console.error("Erro ao melhorar prompt:", error);
      setEnhancedPrompts([
        `Cinematic shot of ${prompt}, highly detailed, 8k resolution, dramatic lighting`,
        `Oil painting of ${prompt}, vivid colors, textured brushstrokes`,
        `Futuristic cyberpunk version of ${prompt}, neon lights, high tech atmosphere`
      ]);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !channelConfig) return;

    setGenerationStatus('pending');
    setErrorMessage(null);

    try {
      const finalFormat = postType === 'STORIES' ? 'STORY' : imageFormat;

      // 1. Create pending record
      const { data, error } = await supabase
        .from('generated_images')
        .insert({
          prompt: prompt,
          channel: channelConfig.name,
          status: 'pending',
          format: finalFormat
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Falha ao criar registro de geração.');

      setGenerationId(data.id);

      // 2. Call Webhook
      fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.id,
          prompt: prompt,
          channel: channelConfig.name,
          format: finalFormat
        })
      }).catch(err => {
        console.error("Webhook trigger error:", err);
      });

    } catch (err: any) {
      console.error(err);
      setGenerationStatus('failed');
      setErrorMessage(err.message || 'Erro ao iniciar geração.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelConfig) return;

    setLoading(true);
    setStatus('processing');
    setErrorMessage(null);

    try {
      if (!mediaUrl) throw new Error('A URL da mídia é obrigatória.');
      
      const isVideo = postType === 'REELS' || (postType === 'STORIES' && mediaUrl.match(/\.(mp4|mov)$/i));
      
      await publishToInstagram(channelConfig.id, channelConfig.token, {
        type: postType,
        imageUrl: !isVideo ? mediaUrl : undefined,
        videoUrl: isVideo ? mediaUrl : undefined,
        caption: postType !== 'STORIES' ? caption : undefined
      });

      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Erro ao publicar no Instagram.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-pink-50 to-purple-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 text-transparent bg-clip-text">
                Nova Publicação
              </span>
            </h2>
            <p className="text-xs text-gray-500">Postando em: <span className="font-semibold">{channelConfig?.name}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {/* Type Selector */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setPostType('IMAGE')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                postType === 'IMAGE'
                  ? 'bg-pink-50 border-pink-200 text-pink-700 ring-1 ring-pink-500'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <ImageIcon size={24} className="mb-1" />
              <span className="text-xs font-bold">Feed (Foto)</span>
            </button>

            <button
              type="button"
              onClick={() => setPostType('REELS')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                postType === 'REELS'
                  ? 'bg-purple-50 border-purple-200 text-purple-700 ring-1 ring-purple-500'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Film size={24} className="mb-1" />
              <span className="text-xs font-bold">Reels (Vídeo)</span>
            </button>

            <button
              type="button"
              onClick={() => setPostType('STORIES')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                postType === 'STORIES'
                  ? 'bg-orange-50 border-orange-200 text-orange-700 ring-1 ring-orange-500'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <History size={24} className="mb-1" />
              <span className="text-xs font-bold">Story</span>
            </button>
          </div>

          {/* Input Mode Tabs */}
          {postType !== 'REELS' && (
            <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => setInputMode('UPLOAD')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  inputMode === 'UPLOAD' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LinkIcon size={16} />
                Link / Upload
              </button>
              <button
                type="button"
                onClick={() => setInputMode('GENERATE')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  inputMode === 'GENERATE' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Sparkles size={16} />
                Gerar com IA
              </button>
            </div>
          )}

          {/* GENERATION MODE */}
          {inputMode === 'GENERATE' && postType !== 'REELS' ? (
            <div className="space-y-4 animate-fade-in">
              
              {/* Format Selector */}
              {postType === 'IMAGE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formato da Imagem
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setImageFormat('SQUARE')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                        imageFormat === 'SQUARE'
                          ? 'bg-purple-50 border-purple-200 text-purple-700 ring-1 ring-purple-500'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Square size={18} />
                      <div className="text-left">
                        <span className="block text-xs font-bold">Quadrado</span>
                        <span className="block text-[10px] opacity-70">1:1 (1080x1080)</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImageFormat('PORTRAIT')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                        imageFormat === 'PORTRAIT'
                          ? 'bg-purple-50 border-purple-200 text-purple-700 ring-1 ring-purple-500'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <RectangleVertical size={18} />
                      <div className="text-left">
                        <span className="block text-xs font-bold">Vertical</span>
                        <span className="block text-[10px] opacity-70">4:5 (1080x1350)</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Prompt da Imagem
                  </label>
                  {channelSettings && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                      <Bot size={10} />
                      IA: {channelSettings.ai_provider.toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div className="relative group">
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Descreva a imagem que você quer criar... Ex: Uma paisagem futurista cyberpunk com neon rosa e azul."
                    className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm resize-none shadow-sm"
                    disabled={generationStatus === 'pending'}
                  />
                  
                  {/* Magic Wand Button - Floating inside textarea */}
                  <button
                    type="button"
                    onClick={handleEnhancePrompt}
                    disabled={!prompt.trim() || isEnhancing || generationStatus === 'pending'}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 hover:bg-purple-50 text-purple-600 border border-purple-100 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                    title="Melhorar prompt com IA do Canal"
                  >
                    {isEnhancing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    {isEnhancing ? 'Melhorando...' : 'Mágica'}
                  </button>
                </div>

                {/* AI Suggestions */}
                {enhancedPrompts.length > 0 && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <Lightbulb size={12} className="text-yellow-500" />
                      Sugestões da IA:
                    </p>
                    <div className="space-y-2">
                      {enhancedPrompts.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setPrompt(suggestion);
                            setEnhancedPrompts([]);
                          }}
                          className="w-full text-left text-xs p-3 bg-gradient-to-r from-purple-50 to-white hover:from-purple-100 hover:to-purple-50 text-purple-900 rounded-lg border border-purple-100 transition-all shadow-sm hover:shadow-md group"
                        >
                          <span className="font-medium">{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {generationStatus === 'pending' && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 flex flex-col items-center justify-center text-center animate-pulse">
                  <Loader2 size={32} className="text-purple-600 animate-spin mb-3" />
                  <h3 className="text-purple-900 font-bold">Criando sua arte...</h3>
                  <p className="text-purple-600 text-sm mt-1">Isso pode levar alguns segundos.</p>
                </div>
              )}

              {generationStatus !== 'pending' && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Wand2 size={18} />
                  Gerar Imagem
                </button>
              )}
            </div>
          ) : (
            /* UPLOAD / PREVIEW MODE */
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              
              {/* Media URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL da Mídia (Pública)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    required
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder={postType === 'IMAGE' ? "https://exemplo.com/foto.jpg" : "https://exemplo.com/video.mp4"}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-sm"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  A URL deve ser pública. {generationStatus === 'completed' && <span className="text-green-600 font-bold">Imagem gerada por IA carregada!</span>}
                </p>
              </div>

              {/* Preview Area */}
              {mediaUrl && (
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-200 flex justify-center relative group">
                  {postType === 'IMAGE' || postType === 'STORIES' ? (
                    <img src={mediaUrl} alt="Preview" className="max-h-64 rounded object-contain shadow-sm" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <video src={mediaUrl} className="max-h-64 rounded shadow-sm" controls onError={(e) => (e.currentTarget.style.display = 'none')} />
                  )}
                  
                  {/* Quick Action to Regenerate if it came from AI */}
                  {generationStatus === 'completed' && (
                    <button
                      type="button"
                      onClick={() => setInputMode('GENERATE')}
                      className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100"
                      title="Gerar Novamente"
                    >
                      <RefreshCw size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* Caption Input (Hidden for Stories) */}
              {postType !== 'STORIES' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Legenda
                  </label>
                  <textarea
                    rows={4}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Escreva sua legenda aqui... #hashtags"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-sm resize-none"
                  />
                </div>
              )}

              {postType === 'STORIES' && (
                <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg flex gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <p>Stories não suportam legenda via API. Adicione textos ou stickers na edição do vídeo/imagem antes de fazer upload.</p>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700 animate-shake">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {status === 'success' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center gap-2 text-green-700">
                  <CheckCircle2 size={20} />
                  <span className="font-medium">Publicado com sucesso!</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || status === 'success'}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-pink-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {status === 'processing' ? 'Processando Mídia...' : 'Publicando...'}
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Publicar Agora
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramPostModal;
