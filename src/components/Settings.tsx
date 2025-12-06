import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Edit, Trash2, Loader2, AlertCircle, Save, XCircle } from 'lucide-react';

interface Setting {
  id: number;
  channel: string;
  webhook: string;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [currentChannel, setCurrentChannel] = useState('');
  const [currentWebhook, setCurrentWebhook] = useState('');

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
  };

  const handleAddNew = () => {
    setIsFormOpen(true);
    setIsEditing(null);
    setCurrentChannel('');
    setCurrentWebhook('');
    window.scrollTo(0, 0);
  };

  const handleEdit = (setting: Setting) => {
    setIsEditing(setting.id);
    setCurrentChannel(setting.channel);
    setCurrentWebhook(setting.webhook);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentChannel || !currentWebhook) {
      setError("Canal e Webhook são obrigatórios.");
      return;
    }

    try {
      let error;
      if (isEditing) {
        const { error: updateError } = await supabase
          .from('shorts_settings')
          .update({ webhook: currentWebhook })
          .eq('id', isEditing);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('shorts_settings')
          .insert({ channel: currentChannel, webhook: currentWebhook });
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
      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-all">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-gray-800 text-lg">{setting.channel}</p>
                </div>
                <p className="text-sm text-gray-500 truncate max-w-xs sm:max-w-md">{setting.webhook}</p>
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
                <label htmlFor="webhook" className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <input
                  type="text"
                  id="webhook"
                  value={currentWebhook}
                  onChange={(e) => setCurrentWebhook(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500"
                  placeholder="https://discord.com/api/webhooks/..."
                />
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
