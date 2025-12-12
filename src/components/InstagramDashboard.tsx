import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchInstagramMedia, fetchInstagramProfile, InstagramMedia, InstagramProfile } from '../lib/instagram';
import { 
  Instagram, Heart, MessageCircle, ExternalLink, Loader2, 
  AlertCircle, Video, Image as ImageIcon, Layers, RefreshCw, Settings, Plus 
} from 'lucide-react';
import InstagramPostModal from './InstagramPostModal';

const InstagramDashboard: React.FC = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  
  const [profile, setProfile] = useState<InstagramProfile | null>(null);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  // 1. Carregar canais que têm configuração de Instagram
  useEffect(() => {
    const loadChannels = async () => {
      const { data } = await supabase
        .from('shorts_settings')
        .select('channel, instagram_business_account_id, instagram_access_token')
        .not('instagram_business_account_id', 'is', null)
        .not('instagram_access_token', 'is', null);

      if (data && data.length > 0) {
        setChannels(data);
        setSelectedChannel(data[0].channel); // Seleciona o primeiro automaticamente
      }
    };
    loadChannels();
  }, []);

  // 2. Carregar dados do Instagram quando o canal muda
  useEffect(() => {
    if (!selectedChannel) return;
    loadInstagramData();
  }, [selectedChannel]);

  const loadInstagramData = async () => {
    setLoading(true);
    setError(null);
    setProfile(null);
    setMedia([]);

    try {
      const channelConfig = channels.find(c => c.channel === selectedChannel);
      if (!channelConfig) return;

      const { instagram_business_account_id, instagram_access_token } = channelConfig;

      if (!instagram_access_token || instagram_access_token.trim() === '') {
        throw new Error("Token de acesso está vazio. Verifique as configurações.");
      }

      // Busca Perfil e Mídia em paralelo
      const [profileData, mediaData] = await Promise.all([
        fetchInstagramProfile(instagram_business_account_id, instagram_access_token).catch(e => {
           if (e.message.includes('ID incorreto')) throw e;
           console.warn("Falha ao carregar perfil:", e);
           return null;
        }),
        fetchInstagramMedia(instagram_business_account_id, instagram_access_token)
      ]);

      setProfile(profileData);
      setMedia(mediaData);

    } catch (err: any) {
      let msg = err.message || "Erro ao conectar com o Instagram.";
      if (msg.includes("An access token is required")) {
        msg = "Token de acesso inválido ou não encontrado. Vá em Configurações e teste a conexão.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Helper para pegar config atual para o modal
  const getCurrentChannelConfig = () => {
    const config = channels.find(c => c.channel === selectedChannel);
    if (!config) return null;
    return {
      id: config.instagram_business_account_id,
      token: config.instagram_access_token,
      name: config.channel
    };
  };

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="bg-pink-50 p-4 rounded-full mb-4">
          <Instagram size={48} className="text-pink-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Nenhum canal configurado</h3>
        <p className="text-gray-500 text-center max-w-md mt-2">
          Vá em <strong>Configurações</strong> e adicione o ID e Token do Instagram para visualizar seus posts aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Seletor de Canal e Ações */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-0.5 rounded-full shrink-0">
            <div className="bg-white p-1.5 rounded-full">
              <Instagram size={20} className="text-gray-800" />
            </div>
          </div>
          <select 
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="bg-transparent font-bold text-gray-800 text-lg focus:outline-none cursor-pointer w-full sm:w-auto"
          >
            {channels.map(c => (
              <option key={c.channel} value={c.channel}>{c.channel}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={() => setIsPostModalOpen(true)}
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-pink-500/20"
          >
            <Plus size={18} />
            Nova Postagem
          </button>
          
          <button 
            onClick={loadInstagramData} 
            disabled={loading}
            className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-full transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="mt-0.5 flex-shrink-0" />
          <div className="flex-grow">
            <p className="font-bold">Erro de Conexão</p>
            <p className="text-sm mt-1">{error}</p>
            {error.includes('ID incorreto') && (
              <a href="/settings" className="inline-flex items-center gap-2 mt-3 text-sm font-medium bg-white border border-red-200 text-red-700 px-3 py-1.5 rounded hover:bg-red-50 transition-colors">
                <Settings size={14} /> Ir para Configurações
              </a>
            )}
          </div>
        </div>
      )}

      {/* Perfil Header */}
      {profile && (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-6">
          <img 
            src={profile.profile_picture_url} 
            alt={profile.name} 
            className="w-20 h-20 rounded-full border-4 border-white shadow-md"
          />
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
            <p className="text-gray-500 font-medium">@{profile.username}</p>
            <div className="flex gap-6 mt-3 justify-center sm:justify-start">
              <div className="text-center">
                <span className="block font-bold text-gray-900">{profile.media_count}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Posts</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-gray-900">{profile.followers_count}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Seguidores</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Mídia */}
      {loading && !profile ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="relative aspect-[4/5] bg-gray-100">
                {item.media_type === 'VIDEO' ? (
                  <>
                    <img src={item.thumbnail_url || item.media_url} alt="Thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-black/50 p-1 rounded text-white">
                      <Video size={16} />
                    </div>
                  </>
                ) : item.media_type === 'CAROUSEL_ALBUM' ? (
                  <>
                    <img src={item.media_url} alt="Post" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-black/50 p-1 rounded text-white">
                      <Layers size={16} />
                    </div>
                  </>
                ) : (
                  <>
                    <img src={item.media_url} alt="Post" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-black/50 p-1 rounded text-white">
                      <ImageIcon size={16} />
                    </div>
                  </>
                )}
                
                {/* Overlay Hover */}
                <a 
                  href={item.permalink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-bold"
                >
                  <div className="flex items-center gap-1">
                    <Heart className="fill-white" size={20} /> {item.like_count || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="fill-white" size={20} /> {item.comments_count || 0}
                  </div>
                  <ExternalLink size={20} />
                </a>
              </div>
              
              <div className="p-3">
                <p className="text-sm text-gray-600 line-clamp-2 mb-2" title={item.caption}>
                  {item.caption || 'Sem legenda'}
                </p>
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span>{new Date(item.timestamp).toLocaleDateString('pt-BR')}</span>
                  <span className="uppercase font-semibold text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                    {item.media_type === 'VIDEO' ? 'Reel' : 'Post'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Postagem */}
      <InstagramPostModal 
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        channelConfig={getCurrentChannelConfig()}
        onSuccess={() => {
          loadInstagramData(); // Recarrega o feed após postar
        }}
      />
    </div>
  );
};

export default InstagramDashboard;
