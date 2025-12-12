import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchVideoDetails, validateApiKey } from '../lib/youtube';
import { generateContentAI, AIProvider } from '../lib/ai';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { 
  Plus, Edit, Trash2, Loader2, AlertCircle, Save, XCircle, Key, 
  CheckCircle, Wifi, RefreshCw, Database, Users, Shield, Lock, User, Sparkles,
  Server, Zap, Globe, Info, Youtube, Fingerprint,
  Play, Activity, Copy, Link as LinkIcon
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

interface N8nWebhook {
  id: string;
  name: string;
  url: string;
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

  // --- Estados de Automação (n8n) ---
  const [webhooks, setWebhooks] = useState<N8nWebhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('');
  
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

  const fetchWebhooks = async () => {
    if (!isAdmin) return;
    setLoadingWebhooks(true);
    try {
      const { data, error } = await supabase.from('n8n_webhooks').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setWebhooks(data || []);
      if (data && data.length > 0 && !selectedWebhookId) {
        setSelectedWebhookId(data[0].id);
      }
    } catch (err: any) {
      console.error("Error fetching webhooks:", err);
    } finally {
      setLoadingWebhooks(false);
    }
    setCurrentOrigin(window.location.origin);
  };

  useEffect(() => {
    if (activeTab === 'channels') fetchSettings();
    else if (activeTab === 'users' && isAdmin) fetchUsers();
    else if (activeTab === 'automation' && isAdmin) fetchWebhooks();
  }, [activeTab, isAdmin]);

  // --- Handlers ---

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

  const handleAddNew = () => { resetForm(); setIsFormOpen(true); };

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
        channel: currentChannel, webhook: currentWebhook, youtube_api_key: currentApiKey || null,
        youtube_channel_id: currentChannelId || null, ai_provider: aiProvider, gemini_key: currentGeminiKey || null,
        groq_key: currentGroqKey || null, ollama_url: currentOllamaUrl || null, ollama_key: currentOllamaKey || null,
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

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookName || !newWebhookUrl) return;
    try {
      const { data, error } = await supabase.from('n8n_webhooks').insert({ name: newWebhookName, url: newWebhookUrl }).select().single();
      if (error) throw error;
      setWebhooks([...webhooks, data]);
      setNewWebhookName('');
      setNewWebhookUrl('');
      if (webhooks.length === 0) setSelectedWebhookId(data.id);
      setSuccessMessage("Webhook adicionado!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) { setError("Erro ao adicionar webhook."); }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!window.confirm("Remover este webhook?")) return;
    try {
      await supabase.from('n8n_webhooks').delete().eq('id', id);
      const updated = webhooks.filter(w => w.id !== id);
      setWebhooks(updated);
      if (selectedWebhookId === id) setSelectedWebhookId(updated.length > 0 ? updated[0].id : '');
    } catch (err) { setError("Erro ao remover webhook."); }
  };

  const handleTriggerWorkflow = async (method: 'POST' | 'GET' = 'POST') => {
    const selectedWebhook = webhooks.find(w => w.id === selectedWebhookId);
    if (!selectedWebhook) { setError("Selecione um webhook."); return; }
    setTriggeringWorkflow(true);
    setWorkflowResponse(null);
    const url = selectedWebhook.url.trim();
    try {
      const payload = { triggered_by: user?.email, timestamp: new Date().toISOString(), action: 'manual_trigger', webhook_name: selectedWebhook.name };
      if (method === 'GET') {
        await fetch(url, { method: 'GET', mode: 'no-cors' });
        setWorkflowResponse({ success: true, message: "Ping GET enviado!" });
      } else if (useNoCors) {
        await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
        setWorkflowResponse({ success: true, message: "Disparo enviado (No-CORS)." });
      } else {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (response.ok) setWorkflowResponse({ success: true, message: "Fluxo disparado!" });
        else throw new Error(`Erro ${response.status}`);
      }
    } catch (err: any) {
      setWorkflowResponse({ success: false, message: err.message.includes('fetch') ? "Erro de CORS/Rede." : err.message });
    } finally { setTriggeringWorkflow(false); }
  };

  // --- Renders ---

  const renderChannels = () => {
    if (loadingSettings) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-500" /></div>;
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div><h3 className="font-bold text-gray-800 flex items-center gap-2"><Database size={20} className="text-brand-500" />Gerenciar Canais</h3></div>
          <div className="flex gap-2">
            {isAdmin && <button onClick={handleSyncMetadata} disabled={isSyncing} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-100">{isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}<span className="hidden sm:inline">Sincronizar</span></button>}
            {isAdmin && !isFormOpen && <button onClick={handleAddNew} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600"><Plus size={18} />Adicionar</button>}
          </div>
        </div>
        {syncResult && <div className="bg-indigo-50 text-indigo-700 px-4 py-3 rounded-lg flex items-center"><CheckCircle className="mr-2 h-5 w-5" />{syncResult.message}</div>}
        
        {isFormOpen && isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 animate-slide-up">
            <form onSubmit={handleSubmit}>
              <h2 className="text-xl font-bold mb-4">{isEditing ? 'Editar' : 'Novo'} Canal</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div><label className="block text-sm font-medium mb-1">Nome</label><input type="text" value={currentChannel} onChange={e => setCurrentChannel(e.target.value)} className="w-full px-3 py-2 border rounded-lg" disabled={!!isEditing} /></div>
                <div><label className="block text-sm font-medium mb-1">Webhook Discord</label><input type="text" value={currentWebhook} onChange={e => setCurrentWebhook(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div className="border-t pt-6 mb-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Youtube size={18} className="text-red-600" />YouTube</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">ID do Canal (Trava)</label>
                    <div className="flex gap-2"><input type="text" value={currentChannelId} onChange={e => setCurrentChannelId(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" /><button type="button" onClick={handleDetectChannelId} disabled={isDetectingChannel} className="px-3 py-2 bg-red-50 text-red-700 rounded-lg">{isDetectingChannel ? <Loader2 size={16} className="animate-spin" /> : <Youtube size={16} />}</button></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">API Key</label>
                    <div className="flex gap-2"><input type="password" value={currentApiKey} onChange={e => { setCurrentApiKey(e.target.value); setTestResult(null); }} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" /><button type="button" onClick={handleTestApiKey} disabled={!currentApiKey || isTestingKey} className="px-3 py-2 bg-gray-100 rounded-lg">{isTestingKey ? <Loader2 size={16} className="animate-spin" /> : 'Testar'}</button></div>
                    {testResult && <p className={`text-xs mt-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>{testResult.message}</p>}
                  </div>
                </div>
              </div>
              <div className="border-t pt-6 mb-6">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Sparkles size={18} className="text-purple-500" />Inteligência Artificial</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {['gemini', 'groq', 'ollama'].map(p => (
                    <button key={p} type="button" onClick={() => setAiProvider(p as any)} className={`p-3 rounded-xl border-2 capitalize ${aiProvider === p ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>{p}</button>
                  ))}
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  {aiProvider === 'gemini' && <div><label className="block text-sm font-medium mb-1">Gemini Key</label><input type="password" value={currentGeminiKey} onChange={e => setCurrentGeminiKey(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" /></div>}
                  {aiProvider === 'groq' && <div className="space-y-3"><div><label className="block text-sm font-medium mb-1">Groq Key</label><input type="password" value={currentGroqKey} onChange={e => setCurrentGroqKey(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" /></div><div><label className="block text-sm font-medium mb-1">Modelo</label><input type="text" value={currentAiModel} onChange={e => setCurrentAiModel(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" placeholder="llama3-70b-8192" /></div></div>}
                  {aiProvider === 'ollama' && <div className="space-y-3"><div><label className="block text-sm font-medium mb-1">URL</label><input type="text" value={currentOllamaUrl} onChange={e => setCurrentOllamaUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" /></div><div><label className="block text-sm font-medium mb-1">Key (Opcional)</label><input type="password" value={currentOllamaKey} onChange={e => setCurrentOllamaKey(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" /></div><div><label className="block text-sm font-medium mb-1">Modelo</label><input type="text" value={currentAiModel} onChange={e => setCurrentAiModel(e.target.value)} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" placeholder="llama3" /></div></div>}
                  <div className="mt-3 flex justify-end"><button type="button" onClick={handleTestAI} disabled={isTestingAI} className="text-sm px-3 py-2 bg-white border rounded-lg flex items-center gap-2">{isTestingAI ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Testar IA</button></div>
                  {aiTestResult && <p className={`text-xs mt-2 ${aiTestResult.success ? 'text-green-600' : 'text-red-600'}`}>{aiTestResult.message}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">Salvar</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid gap-4">
          {settings.map((s) => (
            <div key={s.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center group">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-bold text-lg">{s.channel}</h4>
                  <div className="flex gap-1">
                    {s.youtube_channel_id && <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">Seguro</span>}
                    <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 capitalize">{s.ai_provider}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded truncate max-w-md">{s.webhook}</div>
              </div>
              {isAdmin && <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleEdit(s)} className="p-2 text-gray-500 hover:text-brand-600"><Edit size={18} /></button><button onClick={() => handleDelete(s.id)} className="p-2 text-gray-500 hover:text-red-600"><Trash2 size={18} /></button></div>}
            </div>
          ))}
          {settings.length === 0 && !isFormOpen && <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed"><Database className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-gray-500">Nenhum canal configurado.</p></div>}
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    if (loadingUsers) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-500" /></div>;
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={20} className="text-brand-500" />Gerenciar Usuários</h3></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b"><tr><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">Função</th><th className="px-6 py-4 text-right">Ações</th></tr></thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600"><User size={16} /></div><span className="font-medium">{u.email}</span></div></td>
                  <td className="px-6 py-4">
                    {editingUserId === u.id ? (
                      <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as UserRole)} className="border rounded p-1"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select>
                    ) : <span className={`px-2 py-1 rounded-full text-xs capitalize ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}>{u.role}</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingUserId === u.id ? (
                      <div className="flex justify-end gap-2"><button onClick={() => handleSaveUserRole(u.id)} className="text-green-600"><CheckCircle size={18} /></button><button onClick={handleCancelEditUser} className="text-gray-400"><XCircle size={18} /></button></div>
                    ) : <button onClick={() => handleEditUser(u)} disabled={u.role === 'admin' && u.email === 'dalexperia@gmail.com'} className="text-gray-400 hover:text-brand-600 disabled:opacity-30"><Edit size={18} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAutomation = () => {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Activity size={20} className="text-brand-500" />Automação (n8n)</h3></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gerenciar Webhooks */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><LinkIcon size={18} className="text-gray-500" />Webhooks Cadastrados</h4>
            <form onSubmit={handleAddWebhook} className="mb-6 flex gap-2">
              <input type="text" placeholder="Nome (ex: Produção)" value={newWebhookName} onChange={e => setNewWebhookName(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm" required />
              <input type="text" placeholder="URL do Webhook" value={newWebhookUrl} onChange={e => setNewWebhookUrl(e.target.value)} className="flex-[2] px-3 py-2 border rounded-lg text-sm font-mono" required />
              <button type="submit" className="bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-900"><Plus size={18} /></button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {webhooks.map(w => (
                <div key={w.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="overflow-hidden">
                    <p className="font-bold text-sm text-gray-700">{w.name}</p>
                    <p className="text-xs text-gray-500 font-mono truncate" title={w.url}>{w.url}</p>
                  </div>
                  <button onClick={() => handleDeleteWebhook(w.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                </div>
              ))}
              {webhooks.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Nenhum webhook cadastrado.</p>}
            </div>
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-bold mb-1">CORS Info:</p>
              <div className="flex items-center gap-2 bg-white border border-amber-300 rounded px-2 py-1 font-mono"><span className="truncate">{currentOrigin}</span><button onClick={() => copyToClipboard(currentOrigin)} className="text-amber-600"><Copy size={12} /></button></div>
            </div>
          </div>

          {/* Disparo Manual */}
          <div className="bg-gradient-to-br from-brand-50 to-white p-6 rounded-xl shadow-sm border border-brand-100">
            <h4 className="font-bold text-brand-800 mb-4 flex items-center gap-2"><Play size={18} className="text-brand-600" />Disparo Manual</h4>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Selecionar Webhook</label>
              <select value={selectedWebhookId} onChange={e => setSelectedWebhookId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-500">
                <option value="" disabled>Selecione...</option>
                {webhooks.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 w-full mb-4">
              <button onClick={() => handleTriggerWorkflow('POST')} disabled={triggeringWorkflow || !selectedWebhookId} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 disabled:opacity-50">
                {triggeringWorkflow ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />} INICIAR
              </button>
              <button onClick={() => handleTriggerWorkflow('GET')} disabled={triggeringWorkflow || !selectedWebhookId} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50" title="Ping GET"><Wifi size={20} /></button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" id="useNoCors" checked={useNoCors} onChange={(e) => setUseNoCors(e.target.checked)} className="rounded border-gray-300 text-brand-600" />
              <label htmlFor="useNoCors" className="text-xs text-gray-600 cursor-pointer">Modo Compatibilidade (Ignorar CORS)</label>
            </div>
            {workflowResponse && (
              <div className={`p-3 rounded-lg border flex items-start gap-2 text-sm ${workflowResponse.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {workflowResponse.success ? <CheckCircle size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                <span>{workflowResponse.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-fade-in">
      <div className="mb-8"><h1 className="text-3xl font-extrabold text-gray-900">Configurações</h1><p className="text-gray-500">Gerencie canais, integrações e permissões.</p></div>
      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto">
        <button onClick={() => setActiveTab('channels')} className={`pb-4 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'channels' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Canais</button>
        {isAdmin && <button onClick={() => setActiveTab('users')} className={`pb-4 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'users' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Usuários</button>}
        {isAdmin && <button onClick={() => setActiveTab('automation')} className={`pb-4 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'automation' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Automação</button>}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center mb-6"><AlertCircle className="mr-2" />{error}</div>}
      {successMessage && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center mb-6"><CheckCircle className="mr-2" />{successMessage}</div>}
      {activeTab === 'channels' && renderChannels()}
      {activeTab === 'users' && (isAdmin ? renderUsers() : <div className="p-8 text-center text-gray-500"><Lock className="mx-auto mb-2" />Acesso restrito.</div>)}
      {activeTab === 'automation' && (isAdmin ? renderAutomation() : <div className="p-8 text-center text-gray-500"><Lock className="mx-auto mb-2" />Acesso restrito.</div>)}
    </div>
  );
};

export default Settings;
