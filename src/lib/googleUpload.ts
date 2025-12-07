// Variáveis para cache do token na memória
let tokenClient: any = null;
let accessToken: string | null = null;
let tokenExpirationTime: number = 0;

export const initializeGoogleApi = (clientId: string) => {
  return new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            accessToken = tokenResponse.access_token;
            // Define expiração (geralmente 3599 segundos, usamos um buffer de segurança)
            const expiresIn = tokenResponse.expires_in || 3599;
            tokenExpirationTime = Date.now() + (expiresIn * 1000);
          }
        },
      });
      resolve();
    };
    document.body.appendChild(script);
  });
};

export const requestGoogleAuth = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google API não inicializada.'));
      return;
    }

    // Se já temos um token válido e não expirado, retorna ele imediatamente
    // Evita abrir a janela de popup novamente
    if (accessToken && Date.now() < tokenExpirationTime) {
      resolve(accessToken);
      return;
    }

    // Sobrescreve o callback para capturar a promessa atual
    tokenClient.callback = (tokenResponse: any) => {
      if (tokenResponse.error) {
        reject(tokenResponse);
      } else {
        accessToken = tokenResponse.access_token;
        const expiresIn = tokenResponse.expires_in || 3599;
        tokenExpirationTime = Date.now() + (expiresIn * 1000);
        resolve(tokenResponse.access_token);
      }
    };

    // Solicita o token (abre o popup se não tiver permissão ou cookie válido)
    // prompt: '' tenta usar o cookie existente sem forçar consentimento
    tokenClient.requestAccessToken({ prompt: '' });
  });
};

export const uploadVideoToYouTube = async (
  videoBlob: Blob,
  accessToken: string,
  metadata: {
    title: string;
    description: string;
    privacyStatus: 'private' | 'public' | 'unlisted';
    publishAt?: string; // ISO string
    tags?: string[];
    onProgress?: (progress: number) => void;
  }
) => {
  const metadataPayload = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags || [],
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus: metadata.privacyStatus,
      publishAt: metadata.publishAt, // Só funciona se privacyStatus for 'private'
      selfDeclaredMadeForKids: false,
    },
  };

  const uploader = new ResumableUpload(videoBlob, accessToken, metadataPayload);
  return uploader.upload(metadata.onProgress);
};

class ResumableUpload {
  private file: Blob;
  private accessToken: string;
  private metadata: any;
  private uploadUrl: string | null = null;

  constructor(file: Blob, accessToken: string, metadata: any) {
    this.file = file;
    this.accessToken = accessToken;
    this.metadata = metadata;
  }

  async upload(onProgress?: (progress: number) => void) {
    // 1. Iniciar sessão de upload
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': this.file.size.toString(),
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify(this.metadata),
      }
    );

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error?.message || 'Erro ao iniciar upload');
    }

    this.uploadUrl = initResponse.headers.get('Location');
    if (!this.uploadUrl) throw new Error('URL de upload não recebida');

    // 2. Upload do arquivo (Chunked ou direto)
    // Para simplificar e evitar complexidade de chunks no browser, vamos tentar upload direto via PUT
    // O Google recomenda chunks para arquivos grandes, mas fetch direto funciona bem para shorts
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', this.uploadUrl!, true);
      xhr.setRequestHeader('Content-Type', 'video/mp4');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload falhou: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Erro de rede durante o upload'));

      xhr.send(this.file);
    });
  }
}
