import { supabase } from './supabaseClient';

// Tipos para o upload
export interface UploadOptions {
  title: string;
  description: string;
  privacyStatus: 'private' | 'public' | 'unlisted';
  publishAt?: string;
  tags?: string[];
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  id: string;
  etag: string;
}

// Variável global para armazenar o cliente de token do GIS
let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;

// Função auxiliar para carregar scripts dinamicamente
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

// Inicializa as APIs do Google (GAPI para chamadas e GIS para Auth)
export const initializeGoogleApi = async (clientId: string): Promise<void> => {
  try {
    await Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client')
    ]);

    // Inicializa o cliente de Token do GIS (Google Identity Services)
    // @ts-ignore - google global
    if (window.google && window.google.accounts) {
      // @ts-ignore
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
        callback: '', // Será sobrescrito na chamada
      });
      gisInited = true;
    }

    // Inicializa o GAPI Client (opcional, mas bom para discovery docs)
    await new Promise<void>((resolve) => {
      // @ts-ignore
      if (window.gapi) {
        // @ts-ignore
        window.gapi.load('client', async () => {
          // @ts-ignore
          await window.gapi.client.init({
            // Não passamos clientId nem scope aqui no novo modelo, apenas discoveryDocs
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'],
          });
          gapiInited = true;
          resolve();
        });
      } else {
        resolve();
      }
    });

    console.log('Google APIs inicializadas (GIS + GAPI)');
  } catch (error) {
    console.error('Erro ao inicializar Google APIs:', error);
  }
};

// Solicita autenticação do usuário e retorna o Access Token
export const requestGoogleAuth = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Identity Services não inicializado. Recarregue a página.'));
      return;
    }

    // Define o callback para capturar a resposta do popup
    tokenClient.callback = (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      // O token vem em resp.access_token
      resolve(resp.access_token);
    };

    // Abre o popup de consentimento
    // prompt: '' força o login se necessário, ou usa sessão ativa
    // Se quiser forçar seleção de conta sempre: prompt: 'select_account'
    tokenClient.requestAccessToken({ prompt: '' });
  });
};

// Realiza o upload do vídeo
export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  accessToken: string,
  options: UploadOptions
): Promise<UploadResult> => {
  
  const metadata = {
    snippet: {
      title: options.title,
      description: options.description,
      tags: options.tags,
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus: options.privacyStatus,
      publishAt: options.publishAt, // Só funciona se privacyStatus for 'private'
      selfDeclaredMadeForKids: false,
    },
  };

  const formData = new FormData();
  formData.append(
    'snippet',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('file', videoBlob);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart'
    );
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    if (options.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          options.onProgress?.(progress);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve({
          id: response.id,
          etag: response.etag,
        });
      } else {
        try {
          const errorResp = JSON.parse(xhr.responseText);
          console.error('Erro detalhado do YouTube:', errorResp);
          reject(new Error(errorResp.error?.message || 'Erro no upload'));
        } catch {
          reject(new Error(`Erro HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Erro de rede durante o upload'));
    xhr.send(formData);
  });
};
