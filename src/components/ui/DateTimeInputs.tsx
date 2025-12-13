import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, Clock } from 'lucide-react';

// --- Utilitários de Data ---
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const formatDateDisplay = (date: Date) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

// --- Componente CustomDatePicker ---
interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Data selecionada (ou hoje se vazio)
  const selectedDate = value ? new Date(value + 'T12:00:00') : new Date();
  
  // Estado para navegação do calendário (mês/ano visível)
  const [viewDate, setViewDate] = useState(selectedDate);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    // Ajuste para fuso horário local ao converter para string YYYY-MM-DD
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${year}-${month}-${d}`);
    setIsOpen(false);
  };

  // Lógica de renderização do grid
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 = Domingo

  const days = [];
  // Preenchimento vazio antes do primeiro dia
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="h-8" />);
  }
  // Dias do mês
  for (let i = 1; i <= daysInMonth; i++) {
    const isSelected = 
      selectedDate.getDate() === i && 
      selectedDate.getMonth() === viewDate.getMonth() && 
      selectedDate.getFullYear() === viewDate.getFullYear();
    
    const isToday = 
      new Date().getDate() === i && 
      new Date().getMonth() === viewDate.getMonth() && 
      new Date().getFullYear() === viewDate.getFullYear();

    days.push(
      <button
        key={i}
        onClick={() => handleSelectDay(i)}
        className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition-colors
          ${isSelected ? 'bg-blue-600 text-white font-bold' : 'text-gray-300 hover:bg-gray-700'}
          ${!isSelected && isToday ? 'bg-gray-700 text-blue-400' : ''}
        `}
      >
        {i}
      </button>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-[#1a1a1a] border ${isOpen ? 'border-blue-500' : 'border-gray-600'} rounded-md px-3 py-2 text-sm text-white cursor-pointer flex items-center justify-between hover:border-gray-500 transition-colors`}
      >
        <span>{value ? formatDateDisplay(selectedDate) : 'Selecione a data'}</span>
        <ChevronDown size={16} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-[#1f1f1f] border border-gray-700 rounded-lg shadow-xl z-50 p-4 animate-fade-in">
          {/* Header do Calendário */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-200 uppercase">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                <ChevronLeft size={16} />
              </button>
              <button onClick={handleNextMonth} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Dias da Semana */}
          <div className="grid grid-cols-7 mb-2 text-center">
            {DAYS_SHORT.map(day => (
              <div key={day} className="text-xs text-gray-500 font-medium h-8 flex items-center justify-center">
                {day}
              </div>
            ))}
          </div>

          {/* Grid de Dias */}
          <div className="grid grid-cols-7 gap-y-1 justify-items-center">
            {days}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Componente CustomTimePicker ---
interface CustomTimePickerProps {
  value: string; // HH:MM
  onChange: (value: string) => void;
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Gera lista de horários (15 em 15 min)
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = String(h).padStart(2, '0');
      const minute = String(m).padStart(2, '0');
      times.push(`${hour}:${minute}`);
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll para o horário selecionado quando abrir
  useEffect(() => {
    if (isOpen && listRef.current && value) {
      const selectedEl = document.getElementById(`time-option-${value}`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center' });
      }
    }
  }, [isOpen, value]);

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-[#1a1a1a] border ${isOpen ? 'border-blue-500' : 'border-gray-600'} rounded-md px-3 py-2 text-sm text-white cursor-pointer flex items-center justify-between hover:border-gray-500 transition-colors`}
      >
        <span>{value || '00:00'}</span>
        <ChevronDown size={16} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-full bg-[#1f1f1f] border border-gray-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar" ref={listRef}>
          {times.map((time) => (
            <button
              key={time}
              id={`time-option-${time}`}
              onClick={() => {
                onChange(time);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between
                ${value === time ? 'bg-[#262626] text-white font-medium' : 'text-gray-300 hover:bg-[#262626] hover:text-white'}
              `}
            >
              {time}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
