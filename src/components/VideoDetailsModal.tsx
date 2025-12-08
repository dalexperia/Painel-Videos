import React, { useState, useEffect } from 'react';
import { X, Save, Wand2, Loader2, Download, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { generateMetadata } from '../lib/gemini';

interface Video {
  id: number;
  title: string;
  description?: string;
  tags?: string[] | string;
  hashtags?: string[] | string;
  link_s3: string;
  thumbnail?: string;
  status: string;
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

  useEffect(() => {
    if (video) {
      // Formata tags e hashtags para string se vierem como array
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

  const handleGenerateAI = async (field: 'tags' | 'hashtags' | 'title' | 'description') => {
    setError(null);
    setGeneratingField(field);
    
    try {
      const result = await generateMetadata(field, {
        title: formData.title,
        description: formData.description
      });

      setFormData(prev => ({
        ...prev,
        [field]: result
      }));
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setGeneratingField(null);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Converte strings de volta para array/formato correto
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#1a1a1a] w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden border border-gray-800">
        
        {/* Lado Esquerdo - Preview do Vídeo (Estilo Mobile/Shorts) */}
        <div className="w-1/3 bg-black relative hidden md:flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <div className="relative w-full h-full max-h-full flex items-center justify-center">
            <video 
              src={video.link_s3} 
              controls 
              className="max-h-full max-w-full object-contain shadow-2xl"
            />
            {/* Overlay simulando interface do Shorts */}
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

            {/* Título */}
            <div className="group">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-400">Título</label>
                <button 
                  onClick={() => handleGenerateAI('title')}
                  disabled={!!generatingField}
                  className="text-xs flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                >
                  {generatingField === 'title' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Melhorar com IA
                </button>
              </div>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-[#262626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Digite um título chamativo..."
              />
            </div>

            {/* Descrição */}
            <div className="group">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-400">Descrição</label>
                <button 
                  onClick={() => handleGenerateAI('description')}
                  disabled={!!generatingField}
                  className="text-xs flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                >
                  {generatingField === 'description' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Gerar IA
                </button>
              </div>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                rows={5}
                className="w-full bg-[#262626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                placeholder="Sobre o que é este vídeo?"
              />
            </div>

            {/* Tags */}
            <div className="group">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  Tags <span className="text-xs font-normal text-gray-600">(separadas por vírgula)</span>
                </label>
                <button 
                  onClick={() => handleGenerateAI('tags')}
                  disabled={!!generatingField || (!formData.title && !formData.description)}
                  className="text-xs flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                  title={(!formData.title && !formData.description) ? "Preencha título ou descrição primeiro" : "Gerar tags baseadas no título e descrição"}
                >
                  {generatingField === 'tags' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Gerar IA
                </button>
              </div>
              <textarea
                value={formData.tags}
                onChange={e => setFormData({...formData, tags: e.target.value})}
                rows={3}
                className="w-full bg-[#262626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                placeholder="shorts, viral, youtube..."
              />
            </div>

            {/* Hashtags */}
            <div className="group">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-400">Hashtags</label>
                <button 
                  onClick={() => handleGenerateAI('hashtags')}
                  disabled={!!generatingField || (!formData.title && !formData.description)}
                  className="text-xs flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                >
                  {generatingField === 'hashtags' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Gerar IA
                </button>
              </div>
              <input
                type="text"
                value={formData.hashtags}
                onChange={e => setFormData({...formData, hashtags: e.target.value})}
                className="w-full bg-[#262626] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                placeholder="#shorts #viral"
              />
            </div>

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
