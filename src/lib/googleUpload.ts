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

// Inicializa a API do Google (Carrega o script gapi)
export const initializeGoogleApi = async (clientId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).gapi) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      (window as any).gapi.load('client:auth2', async () => {
        try {
          await (window as any).gapi.client.init({
            clientId: clientId,
            scope: 'https://www.googleapis.com/auth/youtube.upload',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'],
          });
          resolve();
        } catch (error) {
          console.error('Erro ao inicializar GAPI:', error);
          // Não rejeitamos aqui para não travar a app se a API falhar, apenas logamos
          resolve(); 
        }
      });
    };
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

// Solicita autenticação do usuário
export const requestGoogleAuth = async (): Promise<string> => {
  if (!(window as any).gapi) {
    throw new Error('Google API não inicializada.');
  }
  
  const GoogleAuth = (window as any).gapi.auth2.getAuthInstance();
  if (!GoogleAuth) {
    throw new Error('Instância de autenticação não encontrada. Verifique o Client ID.');
  }

  const user = await GoogleAuth.signIn();
  const authResponse = user.getAuthResponse();
  return authResponse.access_token;
};

// Realiza o upload do vídeo
export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  accessToken: string,
  options: UploadOptions
): Promise<UploadResult> => {
  // Implementação simplificada de upload via API REST do YouTube
  // Nota: Em produção real, recomenda-se usar o upload resumível (resumable upload)
  
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
