import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchVideoDetails, validateApiKey } from '../lib/youtube';
import { generateContentAI, AIProvider } from '../lib/ai';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { 
  Plus, Edit, Trash2, Loader2, AlertCircle, Save, XCircle, Key, 
  CheckCircle, Wifi, RefreshCw, Database, Users, Shield, Lock, User, Sparkles,
  Cpu, Server, Zap, Globe, HelpCircle, ExternalLink, Info, Youtube, Fingerprint,
  Play, Activity, Clock
} from 'lucide-react';

interface Setting {
  id: number;
  channel: string;
  webhook: string;
  youtube_api_key?: string;
  youtube_channel_id?: string;
  ai_provider: AIProvider;
  gemini_key?: string;
  groq_key?: string;
  ollama_url?: string;
  ollama_key?: string;
  ai_model?: string;
}

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

// Interface para configurações globais (como o webhook de produção)
interface GlobalConfig {
  key: string;
  value: string;
}

const Settings: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'channels' | 'users' | 'automation'>('channels');

  // --- Estados de Canais ---
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  
  // Form States
  const [currentChannel, setCurrentChannel] = useState('');
  const [currentWebhook, setCurrentWebhook] = useState('');
  const [currentApiKey, setCurrentApiKey] = useState('');
  const [currentChannelId, setCurrentChannelId] = useState('');
  
  // AI States
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [currentGeminiKey, setCurrentGeminiKey] = useState('');
  const [currentGroqKey, setCurrentGroqKey] = useState('');
  const [currentOllamaUrl, setCurrentOllamaUrl] = useState('http://localhost:11434');
  const [currentOllamaKey, setCurrentOllamaKey] = useState('');
  const [currentAiModel, setCurrentAiModel] = useState('');

  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isDetectingChannel, setIsDetectingChannel] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; total: number; message: string } | null>(null);

  // --- Estados de Usuários ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer');

  // --- Estados de Automação ---
  const [productionWebhook, setProductionWebhook] = useState('');
  const [loadingAutomation, setLoadingAutomation] = useState(false);
  const [triggeringWorkflow, setTriggeringWorkflow] = useState(false);
  const [workflowResponse, setWorkflowResponse] = useState<{ success: boolean; message: string } | null>(null);

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

  // Carregar Webhook de Produção (usando localStorage por simplicidade ou tabela de config se existir)
  // Idealmente, criaríamos uma tabela 'app_config', mas vamos usar localStorage para persistência local rápida
  // ou salvar em um campo específico se houver tabela. Vamos usar localStorage para este exemplo rápido
  // para não exigir migração de banco agora, mas o ideal é banco.
  const fetchAutomationConfig = () => {
    const savedWebhook = localStorage.getItem('n8n_production_webhook');
    if (savedWebhook) setProductionWebhook(savedWebhook);
  };

  useEffect(() => {
    if (activeTab === 'channels') {
      fetchSettings();
    } else if (activeTab === 'users' && isAdmin) {
      fetchUsers();
    } else if (activeTab === 'automation') {
      fetchAutomationConfig();
    }
  }, [activeTab, isAdmin]);

  // --- Handlers de Canais ---

  const resetForm = () => {
    setIsFormOpen(false);
    setIsEditing(null);
    setCurrentChannel('');
    setCurrentWebhook('');
    setCurrentApiKey('');
    setCurrentChannelId('');
    
    setAiProvider('gemini');
    setCurrentGeminiKey('');
    setCurrentGroqKey('');
    setCurrentOllamaUrl('http://localhost:11434');
    setCurrentOllamaKey('');
    setCurrentAiModel('');

    setTestResult(null);
    setAiTestResult(null);
    setError(null);
  };

  const handleAddNew = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (setting: Setting) => {
    setIsEditing(setting.id);
    setCurrentChannel(setting.channel);
    setCurrentWebhook(setting.webhook);
    setCurrentApiKey(setting.youtube_api_key || '');
    setCurrentChannelId(setting.youtube_channel_id || '');
    
    setAiProvider(setting.ai_provider || 'gemini');
    setCurrentGeminiKey(setting.gemini_key || '');
    setCurrentGroqKey(setting.groq_key || '');
    setCurrentOllamaUrl(setting.ollama_url || 'http://localhost:11434');
    setCurrentOllamaKey(setting.ollama_key || '');
    setCurrentAiModel(setting.ai_model || '');

    setIsFormOpen(true);
    setTestResult(null);
    setAiTestResult(null);
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

  // Função para detectar o ID do canal logado
  const handleDetectChannelId = async () => {
    setIsDetectingChannel(true);
    try {
      if (!window.google || !window.google.accounts) {
        throw new Error("API do Google não carregada. Recarregue a página.");
      }

      // 1. Solicitar Token
      const accessToken = await new Promise<string>((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '441621535337-k4fcqj90ovvfp1d9sj6hugj4bqavhhlv.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/youtube.readonly',
          callback: (response: any) => {
            if (response.error) reject(response);
            else resolve(response.access_token);
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' }); // Força seleção de conta
      });

      // 2. Buscar info do canal ("mine")
      const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const channel = data.items[0];
        setCurrentChannelId(channel.id);
        alert(`Canal Detectado: ${channel.snippet.title}\nID: ${channel.id}\n\nO ID foi preenchido no formulário.`);
      } else {
        throw new Error("Nenhum canal do YouTube encontrado nesta conta.");
      }

    } catch (err: any) {
      console.error("Erro ao detectar canal:", err);
      alert(`Erro: ${err.message || 'Falha ao detectar canal'}`);
    } finally {
      setIsDetectingChannel(false);
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
      await validateApiKey(currentApiKey);
      setTestResult({ success: true, message: "Chave válida! Conexão com YouTube estabelecida." });
    } catch (err: any) {
      console.error("API Key Test Error:", err);
      let msg = "Chave inválida ou erro de conexão.";
      if (err.message.includes('API key not valid')) msg = "A chave informada não é válida.";
      else if (err.message.includes('quota')) msg = "Cota da API excedida.";
      else if (err.message) msg = `Erro: ${err.message}`;

      setTestResult({ success: false, message: msg });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleTestAI = async () => {
    setIsTestingAI(true);
    setAiTestResult(null);

    try {
      let apiKeyToUse = '';
      if (aiProvider === 'gemini') apiKeyToUse = currentGeminiKey;
      else if (aiProvider === 'groq') apiKeyToUse = currentGroqKey;
      else if (aiProvider === 'ollama') apiKeyToUse = currentOllamaKey;

      const config = {
        provider: aiProvider,
        apiKey: apiKeyToUse,
        url: currentOllamaUrl,
        model: currentAiModel
      };

      if (aiProvider !== 'ollama' && !config.apiKey) {
        throw new Error("Chave de API necessária.");
      }

      const results = await generateContentAI(config, "Olá, teste de conexão.", 'title');
      
      if (results && results.length > 0) {
        setAiTestResult({ success: true, message: `Conexão com ${aiProvider.toUpperCase()} bem sucedida!` });
      } else {
        throw new Error("Resposta vazia da IA.");
      }
    } catch (err: any) {
      console.error("AI Test Error:", err);
      let msg = "Erro de conexão.";
      if (aiProvider === 'ollama') {
        if (err.message.includes('Failed to fetch') || err.message.includes('CORS')) {
          msg = "Bloqueio de CORS detectado. O servidor não permitiu a conexão.";
        } else {
          msg = `Erro: ${err.message}`;
        }
      } else {
        msg = `Erro: ${err.message}`;
      }
      setAiTestResult({ success: false, message: msg });
    } finally {
      setIsTestingAI(false);
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
        youtube_channel_id: currentChannelId || null,
        ai_provider: aiProvider,
        gemini_key: currentGeminiKey || null,
        groq_key: currentGroqKey || null,
        ollama_url: currentOllamaUrl || null,
        ollama_key: currentOllamaKey || null,
        ai_model: currentAiModel || null
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
      setSuccessMessage("Configuração salva com sucesso!");
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

  // --- Handlers de Automação ---

  const handleSaveAutomation = () => {
    if (!productionWebhook) {
      setError("Insira uma URL válida.");
      return;
    }
    localStorage.setItem('n8n_production_webhook', productionWebhook);
    setSuccessMessage("Webhook de produção salvo localmente!");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleTriggerWorkflow = async () => {
    if (!productionWebhook) {
      setError("Configure a URL do Webhook primeiro.");
      return;
    }

    setTriggeringWorkflow(true);
    setWorkflowResponse(null);

    try {
      // Dispara o webhook
      const response = await fetch(productionWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          triggered_by: user?.email,
          timestamp: new Date().toISOString(),
          action: 'manual_trigger'
        })
      });

      if (response.ok) {
        setWorkflowResponse({
          success: true,
          message: "Fluxo disparado com sucesso! O n8n iniciou o processamento."
        });
      } else {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      console.error("Workflow Trigger Error:", err);
      setWorkflowResponse({
        success: false,
        message: `Falha ao disparar: ${err.message}. Verifique CORS ou a URL.`
      });
    } finally {
      setTriggeringWorkflow(false);
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
            <p className="text-sm text-gray-500">Configure webhooks, YouTube API e Provedor de IA.</p>
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
                {/* Dados Básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    {isEditing && <p className="text-xs text-gray-500 mt-1">O nome do canal é usado como identificador.</p>}
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
                </div>

                {/* YouTube Security & API */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Youtube size={18} className="text-red-600" />
                    Segurança e API do YouTube
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Channel ID Lock */}
                    <div>
                      <label htmlFor="channelId" className="block text-sm font-medium text-gray-700 mb-1">
                        ID do Canal (Trava de Segurança)
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-grow">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Fingerprint size={16} className="text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="channelId"
                            value={currentChannelId}
                            onChange={(e) => setCurrentChannelId(e.target.value)}
                            className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-mono text-sm"
                            placeholder="UC..."
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleDetectChannelId}
                          disabled={isDetectingChannel}
                          className="px-3 py-2 bg-red-50 text-red-700 border border-red-100 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                          title="Logar com Google para detectar ID"
                        >
                          {isDetectingChannel ? <Loader2 size={16} className="animate-spin" /> : <Youtube size={16} />}
                          Detectar
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Se preenchido, o sistema só permitirá uploads se o usuário logado tiver este ID exato.
                      </p>
                    </div>

                    {/* API Key */}
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
                  </div>
                </div>

                {/* Configuração de IA */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-500" />
                    Configuração de Inteligência Artificial
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <button
                      type="button"
                      onClick={() => { setAiProvider('gemini'); setAiTestResult(null); }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        aiProvider === 'gemini' 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-200 hover:border-blue-200 text-gray-600'
                      }`}
                    >
                      <Sparkles size={24} className="mb-2" />
                      <span className="font-bold">Google Gemini</span>
                      <span className="text-xs mt-1">Rápido & Gratuito (Tier Free)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAiProvider('groq'); setAiTestResult(null); }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        aiProvider === 'groq' 
                          ? 'border-orange-500 bg-orange-50 text-orange-700' 
                          : 'border-gray-200 hover:border-orange-200 text-gray-600'
                      }`}
                    >
                      <Zap size={24} className="mb-2" />
                      <span className="font-bold">Groq (Llama 3)</span>
                      <span className="text-xs mt-1">Ultra Rápido & Baixo Custo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAiProvider('ollama'); setAiTestResult(null); }}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        aiProvider === 'ollama' 
                          ? 'border-gray-800 bg-gray-100 text-gray-900' 
                          : 'border-gray-200 hover:border-gray-400 text-gray-600'
                      }`}
                    >
                      <Server size={24} className="mb-2" />
                      <span className="font-bold">Ollama / API</span>
                      <span className="text-xs mt-1">Local ou Remoto</span>
                    </button>
                  </div>

                  {/* Campos Dinâmicos baseados no Provider */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    {aiProvider === 'gemini' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                        <input
                          type="password"
                          value={currentGeminiKey}
                          onChange={(e) => { setCurrentGeminiKey(e.target.value); setAiTestResult(null); }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                          placeholder="AIzaSy..."
                        />
                      </div>
                    )}

                    {aiProvider === 'groq' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Groq API Key</label>
                          <input
                            type="password"
                            value={currentGroqKey}
                            onChange={(e) => { setCurrentGroqKey(e.target.value); setAiTestResult(null); }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                            placeholder="gsk_..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Modelo (Opcional)</label>
                          <input
                            type="text"
                            value={currentAiModel}
                            onChange={(e) => setCurrentAiModel(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                            placeholder="llama3-70b-8192"
                          />
                          <p className="text-xs text-gray-500 mt-1">Padrão: llama3-70b-8192</p>
                        </div>
                      </div>
                    )}

                    {aiProvider === 'ollama' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">URL do Servidor / API</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Globe size={16} className="text-gray-400" />
                            </div>
                            <input
                              type="text"
                              value={currentOllamaUrl}
                              onChange={(e) => { setCurrentOllamaUrl(e.target.value); setAiTestResult(null); }}
                              className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-mono text-sm"
                              placeholder="https://ollama.com"
                            />
                          </div>
                          <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                            <Info size={14} className="mt-0.5 flex-shrink-0" />
                            <p>
                              <strong>Atenção CORS:</strong> Para conexões via navegador (Local ou Remoto), o servidor Ollama deve permitir a origem.
                              <br />
                              No terminal local, inicie com: <code>OLLAMA_ORIGINS="*" ollama serve</code>
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            API Key / Token <span className="text-gray-400 font-normal">(Obrigatório para Cloud)</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Key size={16} className="text-gray-400" />
                            </div>
                            <input
                              type="password"
                              value={currentOllamaKey}
                              onChange={(e) => { setCurrentOllamaKey(e.target.value); setAiTestResult(null); }}
                              className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-mono text-sm"
                              placeholder="Bearer Token ou API Key"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                          <input
                            type="text"
                            value={currentAiModel}
                            onChange={(e) => setCurrentAiModel(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-mono text-sm"
                            placeholder="llama3"
                          />
                          <p className="text-xs text-gray-500 mt-1">Padrão: llama3</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleTestAI}
                        disabled={isTestingAI}
                        className="text-sm flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {isTestingAI ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        Testar Conexão IA
                      </button>
                    </div>
                    {aiTestResult && (
                      <div className={`mt-3 p-3 rounded-lg text-sm border ${
                        aiTestResult.success 
                          ? 'bg-green-50 border-green-200 text-green-700' 
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        <div className="flex items-start gap-2">
                          {aiTestResult.success ? <CheckCircle size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                          <span>{aiTestResult.message}</span>
                        </div>
                      </div>
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
                      {/* Badge YouTube Lock */}
                      {setting.youtube_channel_id ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Canal Travado (Seguro)">
                          <Lock size={10} className="mr-1" /> Seguro
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title="Sem trava de segurança">
                          <AlertCircle size={10} className="mr-1" /> Aberto
                        </span>
                      )}

                      {/* Badge YouTube API */}
                      {setting.youtube_api_key ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="YouTube API Ativa">
                          <Key size={10} className="mr-1" /> API
                        </span>
                      ) : null}
                      
                      {/* Badge IA */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                        ${setting.ai_provider === 'gemini' ? 'bg-purple-100 text-purple-800' : 
                          setting.ai_provider === 'groq' ? 'bg-orange-100 text-orange-800' : 
                          'bg-gray-100 text-gray-800'}`}
                      >
                        <Sparkles size={10} className="mr-1" /> {setting.ai_provider || 'Gemini'}
                      </span>
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

  const renderAutomation = () => {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Activity size={20} className="text-brand-500" />
            Automação e Produção
          </h3>
          <p className="text-sm text-gray-500">Controle manual dos fluxos de backend (n8n).</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card de Configuração */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Wifi size={18} className="text-gray-500" />
              Configuração do Webhook
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL do Webhook de Produção (n8n)
                </label>
                <input
                  type="text"
                  value={productionWebhook}
                  onChange={(e) => setProductionWebhook(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono text-sm"
                  placeholder="https://seu-n8n.com/webhook/iniciar-producao"
                />
                <p className="text-xs text-gray-500 mt-2">
                  No n8n, use o nó <strong>Webhook</strong> com método <strong>POST</strong>.
                  Isso substituirá ou complementará o nó "Schedule" (Cron) que costuma falhar.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveAutomation}
                  className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-900 transition-colors"
                >
                  <Save size={16} />
                  Salvar URL
                </button>
              </div>
            </div>
          </div>

          {/* Card de Ação Manual */}
          <div className="bg-gradient-to-br from-brand-50 to-white p-6 rounded-xl shadow-sm border border-brand-100">
            <h4 className="font-bold text-brand-800 mb-4 flex items-center gap-2">
              <Play size={18} className="text-brand-600" />
              Disparo Manual
            </h4>
            
            <p className="text-sm text-gray-600 mb-6">
              Se o fluxo automático (Cron) não rodou ou travou, use este botão para forçar o início da produção de Shorts imediatamente.
            </p>

            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-gray-200 border-dashed">
              <button
                onClick={handleTriggerWorkflow}
                disabled={triggeringWorkflow || !productionWebhook}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-brand-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-500/30 hover:bg-brand-700 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {triggeringWorkflow ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Zap size={24} />
                    INICIAR PRODUÇÃO AGORA
                  </>
                )}
              </button>
              
              {!productionWebhook && (
                <p className="text-xs text-red-500 mt-3 font-medium">
                  Configure a URL ao lado primeiro.
                </p>
              )}
            </div>

            {workflowResponse && (
              <div className={`mt-4 p-4 rounded-lg border flex items-start gap-3 animate-fade-in ${
                workflowResponse.success 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {workflowResponse.success ? <CheckCircle size={20} className="mt-0.5" /> : <AlertCircle size={20} className="mt-0.5" />}
                <div>
                  <p className="font-bold">{workflowResponse.success ? 'Sucesso!' : 'Erro'}</p>
                  <p className="text-sm mt-1">{workflowResponse.message}</p>
                </div>
              </div>
            )}
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
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveTab('channels')}
          className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${
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
            className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${
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

        {isAdmin && (
          <button
            onClick={() => setActiveTab('automation')}
            className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'automation'
                ? 'text-brand-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Automação (n8n)
            {activeTab === 'automation' && (
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
      {activeTab === 'channels' && renderChannels()}
      {activeTab === 'users' && (isAdmin ? renderUsers() : <div className="p-8 text-center text-gray-500"><Lock className="mx-auto mb-2" />Acesso restrito.</div>)}
      {activeTab === 'automation' && (isAdmin ? renderAutomation() : <div className="p-8 text-center text-gray-500"><Lock className="mx-auto mb-2" />Acesso restrito.</div>)}
    </div>
  );
};

export default Settings;
