/**
 * Serviço para Upload Direto no YouTube via Browser
 */

const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest';

interface UploadOptions {
  title: string;
  description: string;
  privacyStatus: 'private' | 'public' | 'unlisted';
  publishAt?: string; // ISO Date string
  tags?: string[];
  onProgress?: (progress: number) => void;
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

/**
 * Inicializa os scripts do Google Identity Services e GAPI
 */
export const initializeGoogleApi = (clientId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (gapiInited && gisInited) {
      resolve();
      return;
    }

    const scriptGapi = document.createElement('script');
    scriptGapi.src = 'https://apis.google.com/js/api.js';
    scriptGapi.async = true;
    scriptGapi.defer = true;
    scriptGapi.onload = () => {
      (window as any).gapi.load('client', async () => {
        await (window as any).gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        if (gisInited) resolve();
      });
    };
    document.body.appendChild(scriptGapi);

    const scriptGis = document.createElement('script');
    scriptGis.src = 'https://accounts.google.com/gsi/client';
    scriptGis.async = true;
    scriptGis.defer = true;
    scriptGis.onload = () => {
      tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '', // Definido dinamicamente
      });
      gisInited = true;
      if (gapiInited) resolve();
    };
    document.body.appendChild(scriptGis);
  });
};

/**
 * Solicita autorização do usuário (Popup do Google)
 */
export const requestGoogleAuth = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google API não inicializada.'));
      return;
    }

    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        reject(resp);
      }
      resolve(resp.access_token);
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

/**
 * Realiza o upload do vídeo usando o protocolo Resumable Upload
 */
export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  accessToken: string,
  options: UploadOptions
): Promise<any> => {
  const metadata = {
    snippet: {
      title: options.title.substring(0, 100), // Limite do YouTube
      description: options.description,
      tags: options.tags || [],
      categoryId: '22', // People & Blogs (padrão)
    },
    status: {
      privacyStatus: options.privacyStatus,
      publishAt: options.publishAt, // Se definido, privacyStatus deve ser 'private'
      selfDeclaredMadeForKids: false,
    },
  };

  // 1. Iniciar Sessão de Upload (Resumable)
  const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Length': videoBlob.size.toString(),
      'X-Upload-Content-Type': 'video/mp4',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Falha ao iniciar upload: ${error}`);
  }

  const uploadUrl = response.headers.get('Location');
  if (!uploadUrl) throw new Error('URL de upload não recebida.');

  // 2. Upload do Arquivo (Binary)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', 'video/mp4');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        const percentComplete = (e.loaded / e.total) * 100;
        options.onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.response));
      } else {
        reject(new Error(`Erro no upload: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Erro de rede durante o upload.'));
    
    xhr.send(videoBlob);
  });
};
