import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Film, History, Send, Loader2, AlertCircle, CheckCircle2, Link as LinkIcon, Wand2, Sparkles, RefreshCw, RectangleVertical, Square, Lightbulb, Bot, LayoutGrid, Calendar, Search } from 'lucide-react';
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
type InputMode = 'UPLOAD' | 'GENERATE' | 'GALLERY';
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

interface GeneratedImage {
  id: string;
  created_at: string;
  prompt: string;
  image_url: string;
  status: string;
  description?: string;
  format?: string;
  channel?: string;
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

  // Gallery State
  const [galleryImages, setGalleryImages] = useState<GeneratedImage[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

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
      setGalleryImages([]);
    } else if (channelConfig) {
      fetchChannelSettings();
    }
  }, [isOpen, channelConfig]);

  // Fetch Gallery when switching to Gallery tab
  useEffect(() => {
    if (isOpen && inputMode === 'GALLERY' && channelConfig) {
      fetchGalleryImages();
    }
  }, [inputMode, isOpen, channelConfig]);

  // Poll for generation status
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (generationId && generationStatus === 'pending') {
      interval = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('generated_images')
            .select('*')
            .eq('id', generationId)
            .single();

          if (error) throw error;

          if (data.status === 'completed') {
            setGenerationStatus('completed');
            setMediaUrl(data.image_url);
            if (data.description) setCaption(data.description);
            setInputMode('UPLOAD'); // Switch to upload/preview mode
            clearInterval(interval);
          } else if (data.status === 'failed') {
            setGenerationStatus('failed');
            setErrorMessage('Falha na geração da imagem.');
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Erro ao verificar status:', err);
        }
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [generationId, generationStatus]);

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

  const fetchGalleryImages = async () => {
    if (!channelConfig) return;
    setLoadingGallery(true);
    try {
      const { data, error } = await supabase
        .from('generated_images')
        .select('*')
        .eq('channel', channelConfig.name)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setGalleryImages(data || []);
    } catch (err) {
      console.error("Erro ao carregar galeria:", err);
    } finally {
      setLoadingGallery(false);
    }
  };

  const handleSelectFromGallery = (image: GeneratedImage) => {
    setMediaUrl(image.image_url);
    if (image.description) {
      setCaption(image.description);
    }
    // Tenta inferir o formato se disponível, senão mantém o atual
    if (image.format === 'STORY') setPostType('STORIES');
    
    setInputMode('UPLOAD'); // Vai para a tela de preview/post
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || !channelSettings) return;
    
    setIsEnhancing(true);
    try {
      const config: AIConfig = {
        provider: channelSettings.ai_provider,
        apiKey: channelSettings.ai_provider === 'gemini' ? channelSettings.gemini_key : 
                channelSettings.ai_provider === 'groq' ? channelSettings.groq_key : undefined,
        baseUrl: channelSettings.ollama_url,
        model: channelSettings.ai_model
      };

      const systemPrompt = `Você é um especialista em criar prompts detalhados para geradores de imagem IA (como Midjourney/DALL-E). 
      Melhore o prompt do usuário para criar uma imagem de alta qualidade, fotorealista e impressionante.
      Retorne APENAS 3 variações do prompt melhorado, separadas por '|||'. Não inclua introduções.`;

      const enhanced = await generateContentAI(prompt, config, systemPrompt);
      const suggestions = enhanced.split('|||').map(s => s.trim()).filter(s => s.length > 0);
      setEnhancedPrompts(suggestions);
    } catch (error) {
      console.error('Erro ao melhorar prompt:', error);
      setErrorMessage('Não foi possível melhorar o prompt. Verifique as configurações de IA.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim() || !channelConfig) return;

    setLoading(true);
    setGenerationStatus('pending');
    setErrorMessage(null);

    try {
      // 1. Criar registro no Supabase
      const { data: record, error: dbError } = await supabase
        .from('generated_images')
        .insert({
          channel: channelConfig.name,
          prompt: prompt,
          status: 'pending',
          format: imageFormat
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setGenerationId(record.id);

      // 2. Chamar Webhook n8n
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          prompt: prompt,
          channel: channelConfig.name,
          format: imageFormat
        })
      });

      if (!response.ok) throw new Error('Erro ao iniciar geração no n8n');

    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Erro ao iniciar geração.');
      setGenerationStatus('failed');
      setLoading(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
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

          {/* Input Mode Selector */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => setInputMode('UPLOAD')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'UPLOAD' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LinkIcon size={16} /> Link / Upload
            </button>
            <button
              onClick={() => setInputMode('GENERATE')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'GENERATE' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Wand2 size={16} /> Gerar com IA
            </button>
            <button
              onClick={() => setInputMode('GALLERY')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'GALLERY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutGrid size={16} /> Galeria
            </button>
          </div>

          {/* --- MODE: GALLERY --- */}
          {inputMode === 'GALLERY' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <ImageIcon size={16} className="text-blue-500" />
                  Imagens Geradas para {channelConfig?.name}
                </h3>
                <button 
                  onClick={fetchGalleryImages} 
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <RefreshCw size={12} className={loadingGallery ? "animate-spin" : ""} /> Atualizar
                </button>
              </div>

              {loadingGallery ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : galleryImages.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Nenhuma imagem encontrada</p>
                  <p className="text-xs text-gray-400 mt-1">Gere novas imagens na aba "Gerar com IA"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {galleryImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => handleSelectFromGallery(img)}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-blue-500 transition-all text-left"
                    >
                      <img 
                        src={img.image_url} 
                        alt={img.prompt} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-white text-[10px] line-clamp-2 font-medium">{img.prompt}</p>
                        <span className="text-[9px] text-gray-300 mt-1 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(img.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- MODE: GENERATE --- */}
          {inputMode === 'GENERATE' && (
            <div className="space-y-4 animate-fade-in">
              {/* Format Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formato da Imagem</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setImageFormat('SQUARE')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                      imageFormat === 'SQUARE' 
                        ? 'border-purple-500 bg-purple-50 text-purple-700' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Square size={18} />
                    <div className="text-left">
                      <div className="text-sm font-bold">Quadrado</div>
                      <div className="text-[10px] opacity-70">1:1 (1080x1080)</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageFormat('PORTRAIT')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                      imageFormat === 'PORTRAIT' 
                        ? 'border-purple-500 bg-purple-50 text-purple-700' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <RectangleVertical size={18} />
                    <div className="text-left">
                      <div className="text-sm font-bold">Vertical</div>
                      <div className="text-[10px] opacity-70">4:5 (1080x1350)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Prompt Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Prompt da Imagem</label>
                  {channelSettings?.ai_provider && (
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 flex items-center gap-1">
                      <Bot size={10} /> IA: {channelSettings.ai_provider.toUpperCase()}
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Descreva a imagem que você quer criar... Ex: Uma paisagem futurista cyberpunk com neon rosa e azul."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm resize-none"
                />
                
                {/* Magic Enhance Button */}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleEnhancePrompt}
                    disabled={isEnhancing || !prompt.trim()}
                    className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-800 disabled:opacity-50 transition-colors font-medium px-2 py-1 rounded hover:bg-purple-50"
                  >
                    {isEnhancing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {isEnhancing ? 'Melhorando...' : 'Mágica'}
                  </button>
                </div>

                {/* Enhanced Suggestions */}
                {enhancedPrompts.length > 0 && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <Lightbulb size={12} /> Sugestões:
                    </p>
                    {enhancedPrompts.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPrompt(suggestion)}
                        className="w-full text-left text-xs p-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded border border-purple-100 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={loading || !prompt.trim() || generationStatus === 'pending'}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {generationStatus === 'pending' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Gerando Imagem...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    Gerar Imagem
                  </>
                )}
              </button>
            </div>
          )}

          {/* --- MODE: UPLOAD (DEFAULT) --- */}
          {inputMode === 'UPLOAD' && (
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
                  A URL deve ser pública (ex: S3, Supabase Storage, Link direto). O Instagram precisa baixar o arquivo.
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
                  
                  <button
                    type="button"
                    onClick={() => setMediaUrl('')}
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white text-red-500 p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
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
