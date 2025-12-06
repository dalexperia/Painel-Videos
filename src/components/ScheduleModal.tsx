import React, { useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ptBR } from 'date-fns/locale/pt-BR';
import { X, Calendar, Send, CheckCircle2, AlertCircle, Image as ImageIcon, PlayCircle } from 'lucide-react';
import { formatDuration } from '../utils/format';

registerLocale('pt-BR', ptBR);

interface Video {
  id: string;
  title: string;
  thumbnail_url?: string;
  link_s3?: string; // Adicionado para suportar preview de vídeo
  duration?: number;
  tags?: string[];
}

interface ScheduleModalProps {
  video: Video;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: Date, immediate: boolean) => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ video, isOpen, onClose, onConfirm }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mode, setMode] = useState<'schedule' | 'immediate'>('schedule');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedDate, mode === 'immediate');
    onClose();
  };

  // Fallback para imagem se não existir thumbnail
  const ThumbnailPlaceholder = () => (
    <div className="w-24 h-16 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
      <ImageIcon className="text-gray-400" size={24} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Publicar Vídeo</h3>
            <p className="text-xs text-gray-500">Configure os detalhes do envio</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Video Preview Card */}
          <div className="flex gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            {video.thumbnail_url ? (
              <img 
                src={video.thumbnail_url} 
                alt={video.title} 
                className="w-24 h-16 object-cover rounded-md bg-gray-200 flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('fallback-active');
                }}
              />
            ) : video.link_s3 ? (
              // Se não tem thumbnail mas tem link do vídeo, mostra o vídeo pequeno
              <div className="w-24 h-16 bg-black rounded-md overflow-hidden flex-shrink-0 relative">
                <video 
                  src={video.link_s3} 
                  className="w-full h-full object-cover opacity-80"
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <PlayCircle size={16} className="text-white/80" />
                </div>
              </div>
            ) : (
              <ThumbnailPlaceholder />
            )}
            
            {/* Fallback div that shows if image fails */}
            <div className="hidden fallback-active:block">
               {video.link_s3 ? (
                 <div className="w-24 h-16 bg-black rounded-md overflow-hidden flex-shrink-0 relative">
                   <video 
                     src={video.link_s3} 
                     className="w-full h-full object-cover opacity-80"
                     muted
                   />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <PlayCircle size={16} className="text-white/80" />
                   </div>
                 </div>
               ) : (
                 <ThumbnailPlaceholder />
               )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight" title={video.title}>
                {video.title}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                {video.tags && video.tags.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">
                    {video.tags[0]}
                  </span>
                )}
                {/* Só exibe a duração se ela existir e for maior que 0 */}
                {video.duration && video.duration > 0 ? (
                  <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Status Connection */}
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-md text-sm border border-green-100">
            <CheckCircle2 size={16} />
            <span className="font-medium">Conexão com canal estabelecida</span>
          </div>

          {/* Action Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('immediate')}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                mode === 'immediate'
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              <Send size={24} className={mode === 'immediate' ? 'text-brand-600' : 'text-gray-400'} />
              <span className="font-medium text-sm">Postar Agora</span>
            </button>

            <button
              onClick={() => setMode('schedule')}
              className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                mode === 'schedule'
                  ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
            >
              {mode === 'schedule' && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              )}
              <Calendar size={24} className={mode === 'schedule' ? 'text-purple-600' : 'text-gray-400'} />
              <span className="font-medium text-sm">Agendar</span>
            </button>
          </div>

          {/* Date Picker Section */}
          <div className={`transition-all duration-300 overflow-hidden ${
            mode === 'schedule' ? 'max-h-48 opacity-100' : 'max-h-0 opacity-50'
          }`}>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar size={14} />
                Data e Hora da Publicação
              </label>
              <div className="relative">
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => date && setSelectedDate(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="dd 'de' MMMM 'de' yyyy, HH:mm"
                  locale="pt-BR"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-700 text-sm shadow-sm"
                  calendarClassName="shadow-xl border-0 rounded-xl font-sans"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                O vídeo será enviado para a fila e processado na data escolhida.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`px-6 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2 ${
              mode === 'immediate'
                ? 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800'
                : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
            }`}
          >
            {mode === 'immediate' ? (
              <>
                <Send size={16} />
                Confirmar Envio
              </>
            ) : (
              <>
                <Calendar size={16} />
                Confirmar Agendamento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
