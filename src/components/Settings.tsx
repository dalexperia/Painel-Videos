import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchVideoDetails, validateApiKey } from '../lib/youtube';
import { generateContentAI, AIProvider } from '../lib/ai';
import { fetchInstagramProfile, detectInstagramConfig } from '../lib/instagram';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { 
  Plus, Edit, Trash2, Loader2, AlertCircle, Save, XCircle, Key, 
  CheckCircle, Wifi, RefreshCw, Database, Users, Shield, Lock, User, Sparkles,
  Server, Zap, Globe, Info, Youtube, Fingerprint, Instagram, Facebook,
  Play, Activity, Copy, Search, HelpCircle
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
  // Instagram Fields
  instagram_business_account_id?: string;
  facebook_page_id?: string;
  instagram_access_token?: string;
  instagram_username?: string;
}

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
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
  
  // Form States - General
  const [currentChannel, setCurrentChannel] = useState('');
  const [currentWebhook, setCurrentWebhook] = useState('');
  
  // Form States - YouTube
  const [currentApiKey, setCurrentApiKey] = useState('');
  const [currentChannelId, setCurrentChannelId] = useState('');
  
  // Form States - Instagram
  const [currentIgBusinessId, setCurrentIgBusinessId] = useState('');
  const [currentFbPageId, setCurrentFbPageId] = useState('');
  const [currentIgToken, setCurrentIgToken] = useState('');
  const [currentIgUsername, setCurrentIgUsername] = useState('');

  // AI States
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [currentGeminiKey, setCurrentGeminiKey] = useState('');
  const [currentGroqKey, setCurrentGroqKey] = useState('');
  const [currentOllamaUrl, setCurrentOllamaUrl] = useState('http://localhost:11434');
  const [currentOllamaKey, setCurrentOllamaKey] = useState('');
  const [currentAiModel, setCurrentAiModel] = useState('');

  // Test States
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [isTestingIg, setIsTestingIg] = useState(false);
  const [isDetectingIg, setIsDetectingIg] = useState(false);
  const [igTestResult, setIgTestResult] = useState<{ success: boolean; message: string; isPartial?: boolean } | null>(null);

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
  const [triggeringWorkflow, setTriggeringWorkflow] = useState(false);
  const [workflowResponse, setWorkflowResponse] = useState<{ success: boolean; message: string } | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [useNoCors, setUseNoCors] = useState(false);

  // --- Fetch Data ---

  const fetchSettings = async () => {
    setLoadingSettings(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('shorts_settings').select('*').order('channel', { ascending: true });
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
      const { data, error } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError("Erro ao carregar usuários.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAutomationConfig = () => {
    const savedWebhook = localStorage.getItem('n8n_production_webhook');
    if (savedWebhook) setProductionWebhook(savedWebhook);
    setCurrentOrigin(window.location.origin);
  };

  useEffect(() => {
    if (activeTab === 'channels') fetchSettings();
    else if (activeTab === 'users' && isAdmin) fetchUsers();
    else if (activeTab === 'automation') fetchAutomationConfig();
  }, [activeTab, isAdmin]);

  // --- Handlers ---

  const resetForm = () => {
    setIsFormOpen(false);
    setIsEditing(null);
    setCurrentChannel('');
    setCurrentWebhook('');
    // YouTube
    setCurrentApiKey('');
    setCurrentChannelId('');
    // Instagram
    setCurrentIgBusinessId('');
    setCurrentFbPageId('');
    setCurrentIgToken('');
    setCurrentIgUsername('');
    // AI
    setAiProvider('gemini');
    setCurrentGeminiKey('');
    setCurrentGroqKey('');
    setCurrentOllamaUrl('http://localhost:11434');
    setCurrentOllamaKey('');
    setCurrentAiModel('');
    
    setTestResult(null);
    setIgTestResult(null);
    setAiTestResult(null);
    setError(null);
  };

  const handleAddNew = () => { resetForm(); setIsFormOpen(true); };

  const handleEdit = (setting: Setting) => {
    setIsEditing(setting.id);
    setCurrentChannel(setting.channel);
    setCurrentWebhook(setting.webhook);
    // YouTube
    setCurrentApiKey(setting.youtube_api_key || '');
    setCurrentChannelId(setting.youtube_channel_id || '');
    // Instagram
    setCurrentIgBusinessId(setting.instagram_business_account_id || '');
    setCurrentFbPageId(setting.facebook_page_id || '');
    setCurrentIgToken(setting.instagram_access_token || '');
    setCurrentIgUsername(setting.instagram_username || '');
    // AI
    setAiProvider(setting.ai_provider || 'gemini');
    setCurrentGeminiKey(setting.gemini_key || '');
    setCurrentGroqKey(setting.groq_key || '');
    setCurrentOllamaUrl(setting.ollama_url || 'http://localhost:11434');
    setCurrentOllamaKey(setting.ollama_key || '');
    setCurrentAiModel(setting.ai_model || '');
    
    setIsFormOpen(true);
    setTestResult(null);
    setIgTestResult(null);
    setAiTestResult(null);
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;
    if (window.confirm('Tem certeza que deseja excluir este canal?')) {
      try {
        const { error } = await supabase.from('shorts_settings').delete().eq('id', id);
        if (error) throw error;
        setSettings(settings.filter(s => s.id !== id));
      } catch (err: any) {
        setError("Não foi possível excluir a configuração.");
      }
    }
  };

  const handleDetectChannelId = async () => {
    setIsDetectingChannel(true);
    try {
      if (!window.google || !window.google.accounts) throw new Error("API do Google não carregada.");
      const accessToken = await new Promise<string>((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '441621535337-k4fcqj90ovvfp1d9sj6hugj4bqavhhlv.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/youtube.readonly',
          callback: (response: any) => {
            if (response.error) reject(response);
            else resolve(response.access_token);
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      });
      const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const channel = data.items[0];
        setCurrentChannelId(channel.id);
        alert(`Canal Detectado: ${channel.snippet.title}\nID: ${channel.id}`);
      } else {
        throw new Error("Nenhum canal encontrado.");
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsDetectingChannel(false);
    }
  };

  const handleTestApiKey = async () => {
    if (!currentApiKey) return;
    setIsTestingKey(true);
    setTestResult(null);
    try {
      await validateApiKey(currentApiKey);
      setTestResult({ success: true, message: "Chave válida!" });
    } catch (err: any) {
      setTestResult({ success: false, message: "Chave inválida ou erro de conexão." });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleDetectInstagram = async () => {
    if (!currentIgToken) {
      setIgTestResult({ success: false, message: "Cole o Token primeiro." });
      return;
    }
    setIsDetectingIg(true);
    setIgTestResult(null);
    try {
      // 1. Detecta os IDs
      const config = await detectInstagramConfig(currentIgToken.trim());
      setCurrentIgBusinessId(config.instagramId);
      setCurrentFbPageId(config.pageId);

      // 2. Tenta buscar o perfil completo imediatamente para preencher o username
      try {
        const profile = await fetchInstagramProfile(config.instagramId, currentIgToken.trim());
        if (profile) {
          const username = profile.username || '';
          setCurrentIgUsername(username);
          setIgTestResult({ 
            success: true, 
            message: `Detectado: ${profile.name} (@${username || 'sem-user'}) - ${profile.followers_count ?? 0} seg` 
          });
        } else {
          // Fallback se não conseguir ler o perfil completo
          setIgTestResult({ success: true, message: `IDs Detectados! (Perfil restrito)` });
        }
      } catch (innerErr) {
        // Se falhar o perfil, mas os IDs foram detectados, ainda é um sucesso parcial
        setIgTestResult({ success: true, message: `IDs Detectados! (Erro ao ler perfil)` });
      }

    } catch (err: any) {
      setIgTestResult({ success: false, message: err.message });
    } finally {
      setIsDetectingIg(false);
    }
  };

  const handleTestInstagram = async () => {
    if (!currentIgToken || !currentIgBusinessId) {
      setIgTestResult({ success: false, message: "Preencha o ID e o Token." });
      return;
    }
    setIsTestingIg(true);
    setIgTestResult(null);
    try {
      const profile = await fetchInstagramProfile(currentIgBusinessId.trim(), currentIgToken.trim());
      if (profile) {
        const username = profile.username || 'sem-user';
        const followers = profile.followers_count !== undefined ? profile.followers_count : '?';
        
        // Atualiza o campo de username se estiver vazio e se tivermos recebido um
        if (!currentIgUsername && profile.username && profile.username !== 'instagram_user') {
          setCurrentIgUsername(profile.username);
        }

        if (profile.is_partial) {
          setIgTestResult({ 
            success: true, 
            isPartial: true,
            message: `Conexão OK! (Modo Simplificado - Igual n8n)` 
          });
        } else {
          setIgTestResult({ 
            success: true, 
            message: `Conectado: ${profile.name} (@${username}) - ${followers} seg` 
          });
        }
      } else {
        throw new Error("Falha ao buscar perfil.");
      }
    } catch (err: any) {
      // Agora mostra a mensagem real do erro
      setIgTestResult({ success: false, message: err.message || "Token inválido ou ID incorreto." });
    } finally {
      setIsTestingIg(false);
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

      const config = { provider: aiProvider, apiKey: apiKeyToUse, url: currentOllamaUrl, model: currentAiModel };
      if (aiProvider !== 'ollama' && !config.apiKey) throw new Error("Chave de API necessária.");

      const results = await generateContentAI(config, "Olá, teste.", 'title');
      if (results) setAiTestResult({ success: true, message: `Conexão com ${aiProvider.toUpperCase()} OK!` });
    } catch (err: any) {
      setAiTestResult({ success: false, message: `Erro: ${err.message}` });
    } finally {
      setIsTestingAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setError(null);
    if (!currentChannel || !currentWebhook) { setError("Canal e Webhook são obrigatórios."); return; }

    try {
      const payload = { 
        channel: currentChannel, 
        webhook: currentWebhook, 
        // YouTube
        youtube_api_key: currentApiKey ? currentApiKey.trim() : null,
        youtube_channel_id: currentChannelId ? currentChannelId.trim() : null, 
        // Instagram
        instagram_business_account_id: currentIgBusinessId ? currentIgBusinessId.trim() : null,
        facebook_page_id: currentFbPageId ? currentFbPageId.trim() : null,
        instagram_access_token: currentIgToken ? currentIgToken.trim() : null,
        instagram_username: currentIgUsername ? currentIgUsername.trim() : null,
        // AI
        ai_provider: aiProvider, 
        gemini_key: currentGeminiKey || null,
        groq_key: currentGroqKey || null, 
        ollama_url: currentOllamaUrl || null, 
        ollama_key: currentOllamaKey || null,
        ai_model: currentAiModel || null
      };

      if (isEditing) await supabase.from('shorts_settings').update(payload).eq('id', isEditing);
      else await supabase.from('shorts_settings').insert(payload);

      resetForm();
      fetchSettings();
      setSuccessMessage("Configuração salva!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSyncMetadata = async () => {
    if (!isAdmin) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const { data: videos } = await supabase.from('shorts_youtube').select('id, youtube_id, channel').or('duration.is.null,title.is.null,title.eq.""');
      if (!videos || videos.length === 0) {
        setSyncResult({ updated: 0, total: 0, message: "Tudo atualizado." });
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
              await supabase.from('shorts_youtube').update({ title: details.title, duration: details.duration }).eq('id', video.id);
              updatedCount++;
            }
          }
        } catch (err) { console.error(err); }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      setSyncResult({ updated: updatedCount, total: videos.length, message: `${updatedCount} vídeos atualizados.` });
    } catch (err) { setError("Erro na sincronização."); } finally { setIsSyncing(false); }
  };

  const handleSaveUserRole = async (userId: string) => {
    if (!isAdmin) return;
    try {
      await supabase.from('user_profiles').update({ role: selectedRole }).eq('id', userId);
      setUsers(users.map(u => u.id === userId ? { ...u, role: selectedRole } : u));
      setEditingUserId(null);
      setSuccessMessage("Permissão atualizada!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) { setError("Erro ao atualizar permissão."); }
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

  const handleTriggerWorkflow = async (method: 'POST' | 'GET' = 'POST') => {
    if (!productionWebhook) {
      setError("Configure a URL do Webhook primeiro.");
      return;
    }

    setTriggeringWorkflow(true);
    setWorkflowResponse(null);

    const url = productionWebhook.trim();

    try {
      const payload = {
        triggered_by: user?.email,
        timestamp: new Date().toISOString(),
        action: 'manual_trigger'
      };

      let response;

      if (method === 'GET') {
        response = await fetch(url, { method: 'GET', mode: 'no-cors' });
        setWorkflowResponse({ success: true, message: "Ping enviado! Verifique o n8n." });
      } else if (useNoCors) {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload)
        });
        setWorkflowResponse({ success: true, message: "Disparo enviado (Modo Compatibilidade)." });
      } else {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          setWorkflowResponse({ success: true, message: "Fluxo disparado com sucesso!" });
        } else {
          throw new Error(`Erro ${response.status}`);
        }
      }
    } catch (err: any) {
      let msg = `Falha ao disparar: ${err.message}.`;
      if (err.message.includes('Failed to fetch')) msg = "Erro de CORS ou Rede. Tente o 'Modo de Compatibilidade'.";
      setWorkflowResponse({ success: false, message: msg });
    } finally {
      setTriggeringWorkflow(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copiado!");
  };

  // --- Renders ---

  const renderChannels = () => {
    if (loadingSettings) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-500" /></div>;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Database size={20} className="text-brand-500" /> Gerenciar Canais</h3>
            <p className="text-sm text-gray-500">Configure YouTube, Instagram e IA.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {isAdmin && (
              <button onClick={handleSyncMetadata} disabled={isSyncing} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50">
                {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} <span className="hidden sm:inline">Sincronizar</span>
              </button>
            )}
            {isAdmin && !isFormOpen && (
              <button onClick={handleAddNew} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-600 transition-colors shadow-sm">
                <Plus size={18} /> Adicionar
              </button>
            )}
          </div>
        </div>

        {syncResult && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-lg flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" /> <span>{syncResult.message}</span>
          </div>
        )}

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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Canal</label>
                    <input type="text" value={currentChannel} onChange={(e) => setCurrentChannel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500" placeholder="Ex: Canal Principal" disabled={!!isEditing} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Discord</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Wifi size={16} className="text-gray-400" /></div>
                      <input type="text" value={currentWebhook} onChange={(e) => setCurrentWebhook(e.target.value)} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500" placeholder="https://discord.com/api/webhooks/..." />
                    </div>
                  </div>
                </div>

                {/* Instagram & Facebook */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Instagram size={18} className="text-pink-600" />
                    Instagram & Facebook
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Access Token (Long-Lived)</label>
                      <div className="flex gap-2">
                        <div className="relative flex-grow">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Key size={16} className="text-gray-400" /></div>
                          <input type="password" value={currentIgToken} onChange={(e) => { setCurrentIgToken(e.target.value); setIgTestResult(null); }} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 font-mono text-sm" placeholder="EAA..." />
                        </div>
                        <button type="button" onClick={handleDetectInstagram} disabled={!currentIgToken || isDetectingIg} className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2 whitespace-nowrap">
                          {isDetectingIg ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Detectar IDs
                        </button>
                        <button type="button" onClick={handleTestInstagram} disabled={!currentIgToken || !currentIgBusinessId || isTestingIg} className="px-3 py-2 bg-pink-50 text-pink-700 border border-pink-100 rounded-lg hover:bg-pink-100 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2">
                          {isTestingIg ? <Loader2 size={16} className="animate-spin" /> : 'Testar'}
                        </button>
                      </div>
                      {igTestResult && (
                        <p className={`text-xs mt-2 flex items-center gap-1 ${igTestResult.success ? (igTestResult.isPartial ? 'text-yellow-600' : 'text-green-600') : 'text-red-600'}`}>
                          {igTestResult.success ? <CheckCircle size={12} /> : <AlertCircle size={12} />} {igTestResult.message}
                        </p>
                      )}
                      
                      {/* Dica de Permissões */}
                      <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                        <div className="flex items-start gap-2">
                          <HelpCircle size={14} className="mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-bold mb-1">Permissões Obrigatórias no Graph API:</p>
                            <p>Ao gerar o token, adicione estas permissões no campo "Add a permission":</p>
                            <ul className="list-disc list-inside mt-1 font-mono text-[10px] sm:text-xs">
                              <li>instagram_basic</li>
                              <li>pages_show_list</li>
                              <li>pages_read_engagement</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Instagram Business ID</label>
                      <input type="text" value={currentIgBusinessId} onChange={(e) => { setCurrentIgBusinessId(e.target.value); setIgTestResult(null); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 font-mono text-sm" placeholder="17841..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Page ID</label>
                      <input type="text" value={currentFbPageId} onChange={(e) => setCurrentFbPageId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 font-mono text-sm" placeholder="10050..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username (Opcional)</label>
                      <input type="text" value={currentIgUsername} onChange={(e) => setCurrentIgUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500" placeholder="@usuario" />
                    </div>
                  </div>
                </div>

                {/* YouTube Security */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Youtube size={18} className="text-red-600" />
                    Segurança e API do YouTube
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ID do Canal (Trava)</label>
                      <div className="flex gap-2">
                        <div className="relative flex-grow">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Fingerprint size={16} className="text-gray-400" /></div>
                          <input type="text" value={currentChannelId} onChange={(e) => setCurrentChannelId(e.target.value)} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500 font-mono text-sm" placeholder="UC..." />
                        </div>
                        <button type="button" onClick={handleDetectChannelId} disabled={isDetectingChannel} className="px-3 py-2 bg-red-50 text-red-700 border border-red-100 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2">
                          {isDetectingChannel ? <Loader2 size={16} className="animate-spin" /> : <Youtube size={16} />} Detectar
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">YouTube API Key</label>
                      <div className="flex gap-2">
                        <div className="relative flex-grow">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Key size={16} className="text-gray-400" /></div>
                          <input type="password" value={currentApiKey} onChange={(e) => { setCurrentApiKey(e.target.value); setTestResult(null); }} className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500 font-mono text-sm" placeholder="AIzaSy..." />
                        </div>
                        <button type="button" onClick={handleTestApiKey} disabled={!currentApiKey || isTestingKey} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium">
                          {isTestingKey ? <Loader2 size={16} className="animate-spin" /> : 'Testar'}
                        </button>
                      </div>
                      {testResult && <p className={`text-xs mt-2 flex items-center gap-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>{testResult.success ? <CheckCircle size={12} /> : <AlertCircle size={12} />} {testResult.message}</p>}
                    </div>
                  </div>
                </div>

                {/* AI Config */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2"><Sparkles size={18} className="text-purple-500" /> Configuração de IA</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <button type="button" onClick={() => setAiProvider('gemini')} className={`p-4 rounded-xl border-2 transition-all ${aiProvider === 'gemini' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'}`}>Gemini</button>
                    <button type="button" onClick={() => setAiProvider('groq')} className={`p-4 rounded-xl border-2 transition-all ${aiProvider === 'groq' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200'}`}>Groq</button>
                    <button type="button" onClick={() => setAiProvider('ollama')} className={`p-4 rounded-xl border-2 transition-all ${aiProvider === 'ollama' ? 'border-gray-800 bg-gray-100 text-gray-900' : 'border-gray-200'}`}>Ollama</button>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                    {aiProvider === 'gemini' && <input type="password" value={currentGeminiKey} onChange={(e) => setCurrentGeminiKey(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Gemini API Key" />}
                    {aiProvider === 'groq' && <input type="password" value={currentGroqKey} onChange={(e) => setCurrentGroqKey(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Groq API Key" />}
                    {aiProvider === 'ollama' && (
                      <>
                        <input type="text" value={currentOllamaUrl} onChange={(e) => setCurrentOllamaUrl(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="http://localhost:11434" />
                        <input type="text" value={currentAiModel} onChange={(e) => setCurrentAiModel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Modelo (ex: llama3)" />
                      </>
                    )}
                    <div className="flex justify-end">
                      <button type="button" onClick={handleTestAI} disabled={isTestingAI} className="text-sm flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        {isTestingAI ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Testar IA
                      </button>
                    </div>
                    {aiTestResult && <p className={`text-xs ${aiTestResult.success ? 'text-green-600' : 'text-red-600'}`}>{aiTestResult.message}</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"><XCircle size={18} /> Cancelar</button>
                <button type="submit" className="flex items-center gap-2 bg-brand-500 text-white px-6 py-2 rounded-lg hover:bg-brand-600"><Save size={18} /> Salvar</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid gap-4">
          {settings.map((setting) => (
            <div key={setting.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-brand-200 transition-all group">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-bold text-gray-800 text-lg">{setting.channel}</h4>
                    <div className="flex gap-2">
                      {setting.youtube_channel_id ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><Lock size={10} className="mr-1" /> Seguro</span> : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle size={10} className="mr-1" /> Aberto</span>}
                      {setting.instagram_business_account_id && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800"><Instagram size={10} className="mr-1" /> Insta</span>}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><Sparkles size={10} className="mr-1" /> {setting.ai_provider}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded w-fit max-w-full">
                    <Wifi size={12} /> <span className="truncate max-w-[200px] sm:max-w-md">{setting.webhook}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(setting)} className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(setting.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {settings.length === 0 && !isFormOpen && <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50"><Database className="mx-auto h-12 w-12 text-gray-300 mb-3" /><p className="text-gray-500">Nenhum canal configurado.</p></div>}
        </div>
      </div>
    );
  };

  const renderUsers = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={20} className="text-brand-500" /> Gerenciar Usuários</h3>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">Função</th><th className="px-6 py-4 text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4"><div className="flex items-center gap-3"><User size={16} /><span className="font-medium">{u.email}</span></div></td>
                <td className="px-6 py-4">
                  {editingUserId === u.id ? (
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as UserRole)} className="border-gray-300 rounded-md text-sm">
                      <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option>
                    </select>
                  ) : <span className="bg-gray-100 px-2 py-1 rounded-full text-xs capitalize">{u.role}</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingUserId === u.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleSaveUserRole(u.id)} className="text-green-600"><CheckCircle size={18} /></button>
                      <button onClick={() => setEditingUserId(null)} className="text-gray-400"><XCircle size={18} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingUserId(u.id); setSelectedRole(u.role); }} disabled={u.role === 'admin' && u.email === 'dalexperia@gmail.com'} className="text-gray-400 hover:text-brand-600 disabled:opacity-30"><Edit size={18} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAutomation = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Activity size={20} className="text-brand-500" /> Automação e Produção</h3>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Wifi size={18} className="text-gray-500" /> Configuração do Webhook</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL do Webhook de Produção (n8n)</label>
              <input type="text" value={productionWebhook} onChange={(e) => setProductionWebhook(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" placeholder="https://seu-n8n.com/webhook/..." />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <Info size={16} className="mt-0.5 flex-shrink-0" />
                <div className="flex-grow">
                  <p className="font-bold mb-1">Atenção ao CORS</p>
                  <div className="flex items-center gap-2 bg-white border border-amber-300 rounded px-2 py-1 font-mono text-xs">
                    <span className="truncate">{currentOrigin}</span>
                    <button onClick={() => copyToClipboard(currentOrigin)} className="text-amber-600 hover:text-amber-800 p-1"><Copy size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={handleSaveAutomation} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-900"><Save size={16} /> Salvar URL</button>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-brand-50 to-white p-6 rounded-xl shadow-sm border border-brand-100">
          <h4 className="font-bold text-brand-800 mb-4 flex items-center gap-2"><Play size={18} className="text-brand-600" /> Disparo Manual</h4>
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-gray-200 border-dashed">
            <div className="flex gap-2 w-full mb-4">
              <button onClick={() => handleTriggerWorkflow('POST')} disabled={triggeringWorkflow || !productionWebhook} className="flex-1 flex items-center justify-center gap-3 px-4 py-4 bg-brand-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-brand-700 disabled:opacity-50">
                {triggeringWorkflow ? <Loader2 size={24} className="animate-spin" /> : <><Zap size={24} /> INICIAR (POST)</>}
              </button>
              <button onClick={() => handleTriggerWorkflow('GET')} disabled={triggeringWorkflow || !productionWebhook} className="flex-none flex items-center justify-center px-4 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50"><Wifi size={24} /></button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input type="checkbox" id="useNoCors" checked={useNoCors} onChange={(e) => setUseNoCors(e.target.checked)} className="rounded border-gray-300 text-brand-600" />
              <label htmlFor="useNoCors" className="text-xs text-gray-600 cursor-pointer">Modo de Compatibilidade (Ignorar CORS)</label>
            </div>
          </div>
          {workflowResponse && (
            <div className={`mt-4 p-4 rounded-lg border flex items-start gap-3 ${workflowResponse.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {workflowResponse.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <div><p className="font-bold">{workflowResponse.success ? 'Sucesso!' : 'Erro'}</p><p className="text-sm mt-1">{workflowResponse.message}</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div><h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Configurações</h1><p className="text-gray-500 mt-1">Gerencie canais, integrações e permissões.</p></div>
      </div>
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
        <button onClick={() => setActiveTab('channels')} className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'channels' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>Canais e Integrações {activeTab === 'channels' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-t-full" />}</button>
        {isAdmin && <button onClick={() => setActiveTab('users')} className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'users' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>Usuários {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-t-full" />}</button>}
        {isAdmin && <button onClick={() => setActiveTab('automation')} className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'automation' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>Automação (n8n) {activeTab === 'automation' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600 rounded-t-full" />}</button>}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center mb-6 animate-shake"><AlertCircle className="mr-2 flex-shrink-0" /><span>{error}</span></div>}
      {successMessage && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center mb-6 animate-fade-in"><CheckCircle className="mr-2 flex-shrink-0" /><span>{successMessage}</span></div>}
      {activeTab === 'channels' && renderChannels()}
      {activeTab === 'users' && (isAdmin ? renderUsers() : <div className="p-8 text-center text-gray-500"><Lock className="mx-auto mb-2" />Acesso restrito.</div>)}
      {activeTab === 'automation' && (isAdmin ? renderAutomation() : <div className="p-8 text-center text-gray-500"><Lock className="mx-auto mb-2" />Acesso restrito.</div>)}
    </div>
  );
};

export default Settings;
