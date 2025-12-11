import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Activity, 
  Terminal, 
  Clock, 
  Check,
  ExternalLink,
  AlertOctagon
} from 'lucide-react';

interface AutomationLog {
  id: string;
  source: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  execution_id: string;
  payload: any;
  resolved: boolean;
  created_at: string;
}

export const AutomationMonitor: React.FC = () => {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [n8nBaseUrl, setN8nBaseUrl] = useState<string>(''); // Opcional: para link direto

  // Carregar logs iniciais
  useEffect(() => {
    fetchLogs();

    // Configurar Realtime
    const channel = supabase
      .channel('automation-monitor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_logs',
          filter: 'resolved=eq.false'
        },
        (payload) => {
          // Novo erro chegou! Adiciona ao topo da lista
          const newLog = payload.new as AutomationLog;
          setLogs((prev) => [newLog, ...prev]);
          
          // Opcional: Tocar um som ou mostrar notificação nativa aqui
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Erro ao buscar logs de automação:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsResolved = async (id: string) => {
    try {
      // Atualiza UI otimista
      setLogs((prev) => prev.filter((log) => log.id !== id));

      const { error } = await supabase
        .from('automation_logs')
        .update({ resolved: true })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao resolver log:', err);
      fetchLogs(); // Reverte em caso de erro
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'error': return 'bg-red-50 text-red-600 border-red-100';
      case 'warning': return 'bg-yellow-50 text-yellow-600 border-yellow-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  const hasErrors = logs.length > 0;

  return (
    <>
      {/* Widget de Status (Fica no Header) */}
      <button
        onClick={() => setIsOpen(true)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 shadow-sm
          ${hasErrors 
            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100 animate-pulse-subtle' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}
        `}
      >
        {hasErrors ? (
          <>
            <AlertOctagon size={18} className="animate-pulse" />
            <span className="font-semibold text-sm">{logs.length} Erro(s) de Automação</span>
          </>
        ) : (
          <>
            <Activity size={18} />
            <span className="font-semibold text-sm">Sistemas Operacionais</span>
          </>
        )}
      </button>

      {/* Modal / Drawer de Logs */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Painel */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
            
            {/* Header do Painel */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Terminal size={24} className="text-gray-700" />
                  Monitor de Automação
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Logs de erro vindos do n8n e outros sistemas.
                </p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista de Logs */}
            <div className="overflow-y-auto p-6 space-y-4 bg-gray-50/30 flex-grow">
              {loading ? (
                <div className="text-center py-12 text-gray-400">Carregando...</div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Tudo limpo!</h3>
                  <p className="text-gray-500">Nenhum erro de automação pendente.</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`relative group p-5 rounded-xl border ${getLevelColor(log.level)} bg-white shadow-sm transition-all hover:shadow-md`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${getLevelColor(log.level)} bg-opacity-10`}>
                            {log.level}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </span>
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            {log.source}
                          </span>
                        </div>
                        
                        <h4 className="font-semibold text-gray-900 mb-1">{log.message}</h4>
                        
                        {log.execution_id && (
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 font-mono bg-gray-50 p-1.5 rounded border border-gray-100 w-fit">
                            <span>Exec ID: {log.execution_id}</span>
                            {/* Se tiver URL base do n8n configurada, poderia ser um link */}
                          </div>
                        )}

                        {/* Payload Expander (Simples) */}
                        {log.payload && Object.keys(log.payload).length > 0 && (
                          <details className="mt-3 text-xs">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium select-none">
                              Ver detalhes técnicos (JSON)
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto font-mono">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>

                      <button
                        onClick={() => markAsResolved(log.id)}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Marcar como resolvido"
                      >
                        <Check size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
