import React, { useState, useRef } from 'react';
import { X, Calendar, Send, CheckCircle2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';

interface Video {
  id: string;
  title?: string;
  link_s3: string;
  channel?: string;
  description?: string;
}

interface ScheduleModalProps {
  video: Video;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: Date, immediate: boolean) => Promise<void>;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ video, isOpen, onClose, onConfirm }) => {
  const [mode, setMode] = useState<'now' | 'schedule'>('schedule');
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const selectedDate = new Date(date);
      await onConfirm(selectedDate, mode === 'now');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Publicar Vídeo</h2>
            <p className="text-sm text-gray-500">Configure os detalhes do envio</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Video Preview */}
          <div className="flex gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="w-24 h-16 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 relative">
               <video src={video.link_s3} className="w-full h-full object-cover opacity-80" />
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-white/20 p-1 rounded-full">
                   <Clock size={12} className="text-white" />
                 </div>
               </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h3 className="font-medium text-gray-900 truncate text-sm" title={video.title}>
                {video.title || 'Sem título'}
              </h3>
              {video.channel && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1 w-fit">
                  {video.channel}
                </span>
              )}
            </div>
          </div>

          {/* Channel Status - Dynamic Message */}
          {video.channel ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg border border-green-100">
              <CheckCircle2 size={18} className="flex-shrink-0" />
              <span className="text-sm font-medium">
                Conectado ao canal <span className="font-bold">"{video.channel}"</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-4 py-3 rounded-lg border border-amber-100">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <span className="text-sm font-medium">
                Atenção: Canal de destino não identificado
              </span>
            </div>
          )}

          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('now')}
              className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                mode === 'now'
                  ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Send size={24} className={mode === 'now' ? 'text-purple-600' : 'text-gray-400'} />
              <span className="font-medium">Postar Agora</span>
              {mode === 'now' && (
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-purple-600 rounded-full animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setMode('schedule')}
              className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                mode === 'schedule'
                  ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar size={24} className={mode === 'schedule' ? 'text-purple-600' : 'text-gray-400'} />
              <span className="font-medium">Agendar</span>
              {mode === 'schedule' && (
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-purple-600 rounded-full animate-pulse" />
              )}
            </button>
          </div>

          {/* Date Picker Section */}
          {mode === 'schedule' && (
            <div className="space-y-2 animate-fade-in">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar size={16} />
                Data e Hora da Publicação
              </label>
              
              <div 
                className="relative group cursor-pointer"
                onClick={() => dateInputRef.current?.showPicker()}
              >
                <div className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl group-hover:border-purple-400 transition-colors flex items-center justify-between min-h-[3.5rem]">
                  <span className="text-gray-800 font-medium text-base break-words pr-2 leading-snug">
                    {formatDateDisplay(date)}
                  </span>
                  <Calendar size={20} className="text-gray-400 group-hover:text-purple-500 transition-colors flex-shrink-0" />
                </div>
                
                <input
                  ref={dateInputRef}
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
              </div>
              
              <p className="text-xs text-gray-500 flex items-start gap-1.5 mt-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>O vídeo será enviado para a fila e processado na data escolhida.</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'now' ? <Send size={18} /> : <Calendar size={18} />}
                <span>{mode === 'now' ? 'Postar Agora' : 'Confirmar Agendamento'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
