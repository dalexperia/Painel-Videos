import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchVideoDetails } from '../lib/youtube';
import { testGeminiConnection } from '../lib/gemini';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { 
  Plus, Edit, Trash2, Loader2, AlertCircle, Save, XCircle, Key, 
  CheckCircle, Wifi, RefreshCw, Database, Users, Shield, Lock, User, Sparkles
} from 'lucide-react';

interface Setting {
  id: number;
  channel: string;
  webhook: string;
  youtube_api_key?: string;
  gemini_key?: string;
}

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

const Settings: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'channels' | 'users'>('channels');

  // --- Estados de Canais ---
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [currentChannel, setCurrentChannel] = useState('');
  const [currentWebhook, setCurrentWebhook] = useState('');
  const [currentApiKey, setCurrentApiKey] = useState('');
  const [currentGeminiKey, setCurrentGeminiKey] = useState('');

  // Estados de Teste YouTube
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Estados de Teste Gemini
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; total: number; message: string } | null>(null);

  // --- Estados de Usuários ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer');

  // --- Fetch Data ---

  const fetchSettings = async () => {
    setLoadingSettings(true);
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
      setLoadingSettings(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError("Erro ao carregar usuários.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'channels') {
      fetchSettings();
    } else if (activeTab === 'users' && isAdmin) {
      fetchUsers();
    }
  }, [activeTab, isAdmin]);

  // --- Handlers de Canais ---

  const resetForm = () => {
    setIsFormOpen(false);
    setIsEditing(null);
    setCurrentChannel('');
    setCurrentWebhook('');
    setCurrentApiKey('');
    setCurrentGeminiKey('');
    setTestResult(null);
    setGeminiTestResult(null);
    setError(null);
  };

  const handleAddNew = () => {
    setIsFormOpen(true);
    setIsEditing(null);
    setCurrentChannel('');
    setCurrentWebhook('');
    setCurrentApiKey('');
    setCurrentGeminiKey('');
    setTestResult(null);
    setGeminiTestResult(null);
  };

  const handleEdit = (setting: Setting) => {
    setIsEditing(setting.id);
    setCurrentChannel(setting.channel);
    setCurrentWebhook(setting.webhook);
    setCurrentApiKey(setting.youtube_api_key || '');
    setCurrentGeminiKey(setting.gemini_key || '');
    setIsFormOpen(true);
    setTestResult(null);
    setGeminiTestResult(null);
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;
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
      const testVideoId = 'Ks-_Mh1QhMc'; 
      await fetchVideoDetails([testVideoId], currentApiKey);
      setTestResult({ success: true, message: "Chave válida! Conexão com YouTube estabelecida." });
    } catch (err: any) {
      console.error("API Key Test Error:", err);
      setTestResult({ 
        success: false, 
        message: "Chave inválida ou erro de conexão. Verifique se a YouTube Data API v3 está ativada." 
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleTestGeminiKey = async () => {
    if (!currentGeminiKey) {
      setGeminiTestResult({ success: false, message: "Insira uma chave para testar." });
      return;
    }

    setIsTestingGemini(true);
    setGeminiTestResult(null);

    try {
      await testGeminiConnection(currentGeminiKey);
      setGeminiTestResult({ success: true, message: "Chave válida! IA conectada." });
    } catch (err: any) {
      console.error("Gemini Key Test Error:", err);
      setGeminiTestResult({ 
        success: false, 
        message: "Chave inválida. Verifique se a API Generative Language está ativa." 
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setError(null);
    
    if (!currentChannel || !currentWebhook) {
      setError("Canal e Webhook são obrigatórios.");
      return;
    }

    try {
      const payload = { 
        channel: currentChannel, 
        webhook: currentWebhook,
        youtube_api_key: currentApiKey || null,
        gemini_key: currentGeminiKey || null
      };

      let error;
      if (isEditing) {
        const { error: updateError } = await supabase
          .from('shorts_settings')
          .update(payload)
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
      setSuccessMessage("Canal salvo com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("Error saving setting:", err);
      let userMessage = "Não foi possível salvar a configuração.";
      if (err.message?.includes('duplicate key')) {
        userMessage = "O nome do canal já existe.";
      }
      setError(userMessage);
    }
  };

  const handleSyncMetadata = async () => {
    if (!isAdmin) return;
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      const { data: videos, error: fetchError } = await supabase
        .from('shorts_youtube')
        .select('id, youtube_id, channel')
        .or('duration.is.null,title.is.null,title.eq.""');

      if (fetchError) throw fetchError;

      if (!videos || videos.length === 0) {
        setSyncResult({ updated: 0, total: 0, message: "Todos os vídeos já possuem metadados." });
        return;
      }

      let updatedCount = 0;
      
      const videosByChannel: Record<string, typeof videos> = {};
      videos.forEach(v => {
        if (!videosByChannel[v.channel]) videosByChannel[v.channel] = [];
        videosByChannel[v.channel].push(v);
      });

      for (const channelName of Object.keys(videosByChannel)) {
        const channelSettings = settings.find(s => s.channel === channelName);
        if (!channelSettings?.youtube_api_key) continue;

        const channelVideos = videosByChannel[channelName];
        const videoIds = channelVideos.map(v => v.youtube_id); 
        
        try {
          const detailsMap = await fetchVideoDetails(videoIds, channelSettings.youtube_api_key);
          
          for (const video of channelVideos) {
            const details = detailsMap[video.youtube_id];
            
            if (details) {
              await supabase
                .from('shorts_youtube')
                .update({
                  title: details.title,
                  duration: details.duration
                })
                .eq('id', video.id);
              updatedCount++;
            }
          }
        } catch (err) {
          console.error(`Falha ao processar lote do canal ${channelName}:`, err);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setSyncResult({ 
        updated: updatedCount, 
        total: videos.length, 
        message: `Sincronização concluída. ${updatedCount} vídeos atualizados.` 
      });

    } catch (err: any) {
      console.error("Sync error:", err);
      setError("Erro durante a sincronização. Verifique o console para detalhes.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Handlers de Usuários ---

  const handleEditUser = (userProfile: UserProfile) => {
    setEditingUserId(userProfile.id);
    setSelectedRole(userProfile.role);
  };

  const handleCancelEditUser = () => {
    setEditingUserId(null);
  };

  const handleSaveUserRole = async (userId: string) => {
    if (!isAdmin) return;
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: selectedRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(u => u.id === userId ? { ...u, role: selectedRole } : u));
      setEditingUserId(null);
      setSuccessMessage("Permissão atualizada com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("Error updating role:", err);
      setError("Erro ao atualizar permissão.");
    }
  };

  // --- Render ---

  const renderChannels = () => {
    if (loadingSettings) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header de Ações */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Database size={20} className="text-brand-500" />
              Gerenciar Canais
            </h3>
            <p className="text-sm text-gray-500">Configure webhooks e chaves de API.</p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {isAdmin && (
              <button
                onClick={handleSyncMetadata}
                disabled={isSyncing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
                title="Buscar títulos e durações faltantes no YouTube"
              >
                {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                <span className="hidden sm:inline">Sincronizar Dados</span>
              </button>
            )}
            
            {isAdmin && !isFormOpen && (
              <button
                onClick={handleAddNew}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-600 transition-colors shadow-sm"
              >
                <Plus size={18} />
                Adicionar
              </button>
            )}
          </div>
        </div>

        {/* Feedback de Sync */}
        {syncResult && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-lg flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" />
            <span>{syncResult.message}</span>
          </div>
        )}

        {/* Formulário */}
        {isFormOpen && isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 animate-slide-up">
            <form onSubmit={handleSubmit}>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                {isEditing ? <Edit size={20} className="text-brand-500" /> : <Plus size={20} className="text-brand-500" />}
                {isEditing ? 'Editar Canal' : 'Novo Canal'}
              </h2>
              
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="channel" className="block text-sm font-medium text-gray-700 mb-1">Nome do Canal</label>
                  <input
                    type="text"
                    id="channel"
                    value={currentChannel}
                    onChange={(e) => setCurrentChannel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all disabled:bg-gray-100"
                    placeholder="Ex: Canal Principal"
                    disabled={!!isEditing}
                  />
                  {isEditing && <p className="text-xs text-gray-500 mt-1">O nome do canal é usado como identificador e não pode ser alterado.</p>}
                </div>

                <div>
                  <label htmlFor="webhook" className="block text-sm font-medium text-gray-700 mb-1">Webhook Discord</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Wifi size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="webhook"
                      value={currentWebhook}
                      onChange={(e) => setCurrentWebhook(e.target.value)}
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                      placeholder="https://discord.com/api/webhooks/..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* YouTube API Key */}
                  <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                      YouTube Data API Key <span className="text-gray-400 font-normal">(Opcional)</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Key size={16} className="text-gray-400" />
                        </div>
                        <input
                          type="password"
                          id="apiKey"
                          value={currentApiKey}
                          onChange={(e) => {
                            setCurrentApiKey(e.target.value);
                            setTestResult(null);
                          }}
                          className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-mono text-sm"
                          placeholder="AIzaSy..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleTestApiKey}
                        disabled={!currentApiKey || isTestingKey}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
                      >
                        {isTestingKey ? <Loader2 size={16} className="animate-spin" /> : 'Testar'}
                      </button>
                    </div>
                    {testResult && (
                      <p className={`text-xs mt-2 flex items-center gap-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.success ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                        {testResult.message}
                      </p>
                    )}
                  </div>

                  {/* Gemini API Key */}
                  <div>
                    <label htmlFor="geminiKey" className="block text-sm font-medium text-gray-700 mb-1">
                      Gemini AI Key <span className="text-gray-400 font-normal">(Opcional)</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Sparkles size={16} className="text-purple-500" />
                        </div>
                        <input
                          type="password"
                          id="geminiKey"
                          value={currentGeminiKey}
                          onChange={(e) => {
                            setCurrentGeminiKey(e.target.value);
                            setGeminiTestResult(null);
                          }}
                          className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-mono text-sm"
                          placeholder="AIzaSy..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleTestGeminiKey}
                        disabled={!currentGeminiKey || isTestingGemini}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
                      >
                        {isTestingGemini ? <Loader2 size={16} className="animate-spin" /> : 'Testar'}
                      </button>
                    </div>
                    {geminiTestResult && (
                      <p className={`text-xs mt-2 flex items-center gap-1 ${geminiTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {geminiTestResult.success ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                        {geminiTestResult.message}
                      </p>
                    )}
                    {!geminiTestResult && (
                      <p className="text-xs text-gray-500 mt-1">Usada para gerar títulos, descrições e tags com IA.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  <XCircle size={18} />
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-brand-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-600 transition-colors shadow-sm"
                >
                  <Save size={18} />
                  Salvar Configuração
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Canais */}
        <div className="grid gap-4">
          {settings.map((setting) => (
            <div key={setting.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-brand-200 transition-all group">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-bold text-gray-800 text-lg">{setting.channel}</h4>
                    <div className="flex gap-2">
                      {setting.youtube_api_key ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="YouTube API Ativa">
                          <Key size={10} className="mr-1" /> YT
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600" title="Sem YouTube API">
                          Sem YT
                        </span>
                      )}
                      {setting.gemini_key ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="Gemini AI Ativa">
                          <Sparkles size={10} className="mr-1" /> AI
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600" title="Sem Gemini AI">
                          Sem AI
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded w-fit max-w-full">
                    <Wifi size={12} />
                    <span className="truncate max-w-[200px] sm:max-w-md">{setting.webhook}</span>
                  </div>
                </div>
                
                {isAdmin && (
                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(setting)} 
                      className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(setting.id)} 
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {settings.length === 0 && !isFormOpen && (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
              <Database className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Nenhum canal configurado.</p>
              {isAdmin && <p className="text-sm text-gray-400 mt-1">Clique em "Adicionar" para começar.</p>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    if (loadingUsers) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Users size={20} className="text-brand-500" />
            Gerenciar Usuários
          </h3>
          <p className="text-sm text-gray-500">Controle quem tem acesso ao painel.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-700">Usuário</th>
                  <th className="px-6 py-4 font-semibold text-gray-700">Função</th>
                  <th className="px-6 py-4 font-semibold text-gray-700">Data de Cadastro</th>
                  <th className="px-6 py-4 font-semibold text-gray-700 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                          <User size={16} />
                        </div>
                        <span className="font-medium text-gray-900">{u.email}</span>
                        {u.id === user?.id && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Você</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingUserId === u.id ? (
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                          className="block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm rounded-md"
                        >
                          <option value="viewer">Viewer (Leitura)</option>
                          <option value="editor">Editor (Edição)</option>
                          <option value="admin">Admin (Total)</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                          ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                            u.role === 'editor' ? 'bg-blue-100 text-blue-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {u.role === 'admin' && <Shield size={10} className="mr-1" />}
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingUserId === u.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSaveUserRole(u.id)}
                            className="text-green-600 hover:text-green-800 p-1"
                            title="Salvar"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button
                            onClick={handleCancelEditUser}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Cancelar"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditUser(u)}
                          disabled={u.role === 'admin' && u.email === 'dalexperia@gmail.com'} // Proteção extra para o super admin principal
                          className="text-gray-400 hover:text-brand-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Alterar Permissão"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configurações</h1>
          <p className="text-gray-500 mt-1">Gerencie canais, integrações e permissões de acesso.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-8">
        <button
          onClick={() => setActiveTab('channels')}
          className={`pb-4 px-6 font-medium text-sm transition-colors relative ${
            activeTab === 'channels'
              ? 'text-brand-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Canais e Integrações
          {activeTab === 'channels' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-t-full" />
          )}
        </button>
        
        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-6 font-medium text-sm transition-colors relative ${
              activeTab === 'users'
                ? 'text-brand-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Usuários e Permissões
            {activeTab === 'users' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-t-full" />
            )}
          </button>
        )}
      </div>

      {/* Mensagens Globais */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center mb-6 animate-shake" role="alert">
          <AlertCircle className="mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center mb-6 animate-fade-in" role="alert">
          <CheckCircle className="mr-2 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Conteúdo da Aba */}
      {activeTab === 'channels' ? renderChannels() : (isAdmin ? renderUsers() : <div className="p-8 text-center text-gray-500"><Lock className="mx-auto mb-2" />Acesso restrito.</div>)}
    </div>
  );
};

export default Settings;
