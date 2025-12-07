import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchVideoDetails } from '../lib/youtube';
import { 
  Plus, Edit, Trash2, Loader2, AlertCircle, Save, XCircle, Key, 
  CheckCircle, Wifi, RefreshCw, Database, ArrowRight 
} from 'lucide-react';

interface Setting {
  id: number;
  channel: string;
  webhook: string;
  youtube_api_key?: string;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [currentChannel, setCurrentChannel] = useState('');
  const [currentWebhook, setCurrentWebhook] = useState('');
  const [currentApiKey, setCurrentApiKey] = useState('');

  // Estados para o teste da API
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Estados para Sincronização
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; total: number; message: string } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('shorts_settings')
        .select('*')
        .order('channel', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
    } catch (err: any) {
      console.error("Error fetching settings:", err);
      setError("Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const resetForm = () => {
    setIsFormOpen(false);
    setIsEditing(null);
    setCurrentChannel('');
    setCurrentWebhook('');
    setCurrentApiKey('');
    setTestResult(null);
  };

  const handleAddNew = () => {
    setIsFormOpen(true);
    setIsEditing(null);
    setCurrentChannel('');
    setCurrentWebhook('');
    setCurrentApiKey('');
    setTestResult(null);
    window.scrollTo(0, 0);
  };

  const handleEdit = (setting: Setting) => {
    setIsEditing(setting.id);
    setCurrentChannel(setting.channel);
    setCurrentWebhook(setting.webhook);
    setCurrentApiKey(setting.youtube_api_key || '');
    setTestResult(null);
    setIsFormOpen(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este canal?')) {
      try {
        const { error } = await supabase
          .from('shorts_settings')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        setSettings(settings.filter(s => s.id !== id));
      } catch (err: any) {
        console.error("Error deleting setting:", err);
        setError("Não foi possível excluir a configuração.");
      }
    }
  };

  const handleTestApiKey = async () => {
    if (!currentApiKey) {
      setTestResult({ success: false, message: "Insira uma chave para testar." });
      return;
    }

    setIsTestingKey(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=Ks-_Mh1QhMc&key=${currentApiKey}`
      );
      
      const data = await response.json();

      if (!response.ok) {
        let errorMsg = "Chave inválida ou erro na API.";
        if (data.error && data.error.message) {
          if (data.error.message.includes('API key not valid')) errorMsg = "Chave de API inválida.";
          else if (data.error.message.includes('Project has not enabled the API')) errorMsg = "API do YouTube não habilitada no Google Cloud.";
          else errorMsg = `Erro: ${data.error.message}`;
        }
        throw new Error(errorMsg);
      }

      setTestResult({ success: true, message: "Conexão bem-sucedida! A chave está ativa." });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSyncYouTubeData = async () => {
    if (!window.confirm("Isso irá verificar todos os vídeos no YouTube e atualizar as datas de publicação e status no banco de dados local. Deseja continuar?")) {
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      // 1. Buscar todos os vídeos que têm youtube_id
      const { data: videos, error: videosError } = await supabase
        .from('shorts_youtube')
        .select('id, youtube_id, channel, publish_at, status')
        .not('youtube_id', 'is', null);

      if (videosError) throw videosError;
      if (!videos || videos.length === 0) {
        setSyncResult({ updated: 0, total: 0, message: "Nenhum vídeo com ID do YouTube encontrado." });
        return;
      }

      // 2. Mapear Canais -> API Keys
      const channelKeys: Record<string, string> = {};
      settings.forEach(s => {
        if (s.channel && s.youtube_api_key) {
          channelKeys[s.channel.trim().toLowerCase()] = s.youtube_api_key;
        }
      });

      // 3. Agrupar vídeos por API Key
      const videosByApiKey: Record<string, typeof videos> = {};
      
      videos.forEach(v => {
        const normalizedChannel = v.channel ? v.channel.trim().toLowerCase() : '';
        const apiKey = channelKeys[normalizedChannel];
        
        if (apiKey) {
          if (!videosByApiKey[apiKey]) videosByApiKey[apiKey] = [];
          videosByApiKey[apiKey].push(v);
        }
      });

      let updatedCount = 0;

      // 4. Processar cada grupo
      for (const [apiKey, groupVideos] of Object.entries(videosByApiKey)) {
        const ids = groupVideos.map(v => v.youtube_id);
        
        // Busca detalhes reais no YouTube
        const detailsMap = await fetchVideoDetails(ids, apiKey);

        // Compara e atualiza
        for (const video of groupVideos) {
          const details = detailsMap[video.youtube_id];
          
          if (details) {
            // Se o vídeo foi encontrado, ele é público ou não listado
            const newDate = details.publishedAt;
            const isPublic = details.privacyStatus === 'public';
            
            let needsUpdate = false;
            const updates: any = {};

            // Verifica se a data mudou
            if (newDate && newDate !== video.publish_at) {
              updates.publish_at = newDate;
              needsUpdate = true;
            }

            // Verifica se o status deve ser atualizado para Posted
            if (isPublic && video.status !== 'Posted') {
              updates.status = 'Posted';
              needsUpdate = true;
            }

            if (needsUpdate) {
              const { error: updateError } = await supabase
                .from('shorts_youtube')
                .update(updates)
                .eq('id', video.id);
              
              if (!updateError) updatedCount++;
            }
          }
        }
      }

      setSyncResult({ 
        updated: updatedCount, 
        total: videos.length, 
        message: `Sincronização concluída! ${updatedCount} vídeos foram atualizados com dados reais do YouTube.` 
      });

    } catch (err: any) {
      console.error("Erro na sincronização:", err);
      setSyncResult({ updated: 0, total: 0, message: "Erro ao sincronizar: " + err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentChannel || !currentWebhook) {
      setError("Canal e Webhook são obrigatórios.");
      return;
    }

    try {
      let error;
      const payload = {
        channel: currentChannel,
        webhook: currentWebhook,
        youtube_api_key: currentApiKey || null
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('shorts_settings')
          .update({ 
            webhook: currentWebhook,
            youtube_api_key: currentApiKey || null
          })
          .eq('id', isEditing);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('shorts_settings')
          .insert(payload);
        error = insertError;
      }

      if (error) throw error;

      resetForm();
      fetchSettings();
    } catch (err: any) {
      console.error("Error saving setting:", err);
      let userMessage = "Não foi possível salvar a configuração. Tente novamente.";
      if (err.message && err.message.includes('duplicate key value violates unique constraint')) {
        userMessage = "Não foi possível salvar: o nome do canal ou webhook já existe.";
      }
      setError(userMessage);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Seção de Sincronização */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <Database size={20} />
                Sincronização de Dados
              </h3>
              <p className="text-sm text-blue-700 mt-1 max-w-xl">
                Atualize as datas de publicação e status dos vídeos locais consultando diretamente a API do YouTube. 
                Isso corrige discrepâncias caso você tenha alterado datas no YouTube Studio.
              </p>
            </div>
            <button
              onClick={handleSyncYouTubeData}
              disabled={isSyncing || settings.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSyncing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Sincronizar Agora
                </>
              )}
            </button>
          </div>
          
          {syncResult && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${syncResult.updated > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
              {syncResult.updated > 0 ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{syncResult.message}</span>
            </div>
          )}
        </div>

        {/* Lista de Canais */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Canais Configurados</h3>
          {settings.map((setting) => (
            <div key={setting.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-all">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-gray-800 text-lg">{setting.channel}</p>
                    {!setting.youtube_api_key ? (
                      <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium border border-yellow-200">
                        Sem API Key
                      </span>
                    ) : (
                      <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium border border-green-200 flex items-center gap-1">
                        <CheckCircle size={10} />
                        API Configurada
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate max-w-xs sm:max-w-md flex items-center gap-2">
                    <span className="font-medium text-gray-400">Webhook:</span> {setting.webhook}
                  </p>
                  {setting.youtube_api_key && (
                    <p className="text-sm text-gray-500 truncate max-w-xs sm:max-w-md flex items-center gap-2">
                      <Key size={14} className="text-gray-400" />
                      <span className="font-medium text-gray-400">API Key:</span> 
                      <span className="font-mono text-xs bg-gray-50 px-1 rounded">
                        {setting.youtube_api_key.substring(0, 8)}...
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(setting)} 
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Editar"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(setting.id)} 
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {settings.length === 0 && !isFormOpen && (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">Nenhum canal configurado.</p>
              <p className="text-sm text-gray-400">Clique em "Adicionar Canal" para começar.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configurações</h1>
        {!isFormOpen && (
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-600 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Adicionar Canal
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8">
          <form onSubmit={handleSubmit}>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{isEditing ? 'Editar Canal' : 'Novo Canal'}</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="channel" className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                <input
                  type="text"
                  id="channel"
                  value={currentChannel}
                  onChange={(e) => setCurrentChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100"
                  placeholder="Ex: Canal Principal"
                  disabled={!!isEditing}
                />
                {isEditing && <p className="text-xs text-gray-500 mt-1">O nome do canal não pode ser alterado.</p>}
              </div>
              
              <div>
                <label htmlFor="webhook" className="block text-sm font-medium text-gray-700 mb-1">Webhook URL (Discord/n8n)</label>
                <input
                  type="text"
                  id="webhook"
                  value={currentWebhook}
                  onChange={(e) => setCurrentWebhook(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube API Key
                  <span className="ml-2 text-xs font-normal text-gray-500">(Opcional, para exibir visualizações/likes)</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="apiKey"
                      value={currentApiKey}
                      onChange={(e) => {
                        setCurrentApiKey(e.target.value);
                        setTestResult(null); // Limpa resultado ao editar
                      }}
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 font-mono text-sm"
                      placeholder="AIzaSy..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleTestApiKey}
                    disabled={!currentApiKey || isTestingKey}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium border border-gray-200"
                    title="Testar conexão com o YouTube"
                  >
                    {isTestingKey ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Wifi size={16} />
                    )}
                    Testar
                  </button>
                </div>
                
                {/* Resultado do Teste */}
                {testResult && (
                  <div className={`mt-2 text-sm flex items-center gap-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-1">
                  Necessária apenas para ler estatísticas públicas. Não compartilhe sua chave privada.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                <XCircle size={18} />
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-600 transition-colors shadow-sm"
              >
                <Save size={18} />
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-center mb-6" role="alert">
          <AlertCircle className="mr-2" />
          <span>{error}</span>
        </div>
      )}

      {renderContent()}
    </div>
  );
};

export default Settings;
