import React, { useState } from 'react';
import { X, Image as ImageIcon, Film, History, Send, Loader2, AlertCircle, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { publishToInstagram } from '../lib/instagram';

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

const InstagramPostModal: React.FC<InstagramPostModalProps> = ({ isOpen, onClose, channelConfig, onSuccess }) => {
  const [postType, setPostType] = useState<PostType>('IMAGE');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'publishing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelConfig) return;

    setLoading(true);
    setStatus('processing');
    setErrorMessage(null);

    try {
      // Validação básica
      if (!mediaUrl) throw new Error('A URL da mídia é obrigatória.');
      
      // Determinar parâmetros baseado no tipo
      const isVideo = postType === 'REELS' || (postType === 'STORIES' && mediaUrl.match(/\.(mp4|mov)$/i));
      
      await publishToInstagram(channelConfig.id, channelConfig.token, {
        type: postType,
        imageUrl: !isVideo ? mediaUrl : undefined,
        videoUrl: isVideo ? mediaUrl : undefined,
        caption: postType !== 'STORIES' ? caption : undefined // Stories não suportam legenda via API
      });

      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
        // Reset form
        setMediaUrl('');
        setCaption('');
        setStatus('idle');
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

          <form onSubmit={handleSubmit} className="space-y-4">
            
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

            {/* Preview Area (Simple) */}
            {mediaUrl && (
              <div className="bg-gray-50 rounded-lg p-2 border border-gray-200 flex justify-center">
                {postType === 'IMAGE' ? (
                  <img src={mediaUrl} alt="Preview" className="max-h-48 rounded object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <video src={mediaUrl} className="max-h-48 rounded" controls onError={(e) => (e.currentTarget.style.display = 'none')} />
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
        </div>
      </div>
    </div>
  );
};

export default InstagramPostModal;
