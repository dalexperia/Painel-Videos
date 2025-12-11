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
    tokenClient.requestAccessToken({ prompt: '' });
  });
};

/**
 * Realiza o upload do vídeo usando o protocolo RESUMABLE UPLOAD.
 * É mais robusto contra falhas de rede e CORS do que o multipart.
 */
export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  accessToken: string,
  options: UploadOptions
): Promise<UploadResult> => {
  
  // 1. Preparar Metadados
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

  console.log("Iniciando Resumable Upload...");

  // 2. Passo 1: Iniciar Sessão de Upload (POST para obter URL de upload)
  // Isso envia apenas os metadados primeiro.
  const initResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Length': videoBlob.size.toString(),
        'X-Upload-Content-Type': videoBlob.type || 'video/mp4'
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    console.error("Erro ao iniciar upload (Init Phase):", errorText);
    
    if (initResponse.status === 403 || errorText.includes('CORS')) {
      throw new Error('Bloqueio de Origem (CORS) ou Permissão. Verifique se a URL exata do site está no Google Cloud Console e aguarde a propagação.');
    }
    throw new Error(`Erro na inicialização do upload: ${initResponse.statusText}`);
  }

  // O Google retorna a URL de upload no header 'Location'
  const uploadUrl = initResponse.headers.get('Location');

  if (!uploadUrl) {
    throw new Error('Falha crítica: A API do Google não retornou a URL de upload (Header Location ausente).');
  }

  console.log("Sessão de upload criada. Enviando bytes...");

  // 3. Passo 2: Enviar o arquivo binário (PUT na URL recebida)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', videoBlob.type || 'video/mp4');

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
          console.error('Erro detalhado do YouTube (Upload Phase):', errorResp);
          reject(new Error(errorResp.error?.message || 'Erro no envio do arquivo'));
        } catch {
          reject(new Error(`Erro HTTP ${xhr.status} durante o envio do arquivo`));
        }
      }
    };

    xhr.onerror = () => {
      console.error('Erro de rede durante o envio do arquivo (PUT).');
      reject(new Error('Falha na conexão durante o envio do vídeo.'));
    };

    xhr.send(videoBlob);
  });
};
