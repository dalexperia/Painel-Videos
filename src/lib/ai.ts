import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq' | 'ollama';
export type GenerationType = 'title' | 'description' | 'tags' | 'hashtags';

interface AIConfig {
  provider: AIProvider;
  apiKey?: string; // Para Gemini, Groq ou Ollama (Opcional)
  url?: string;    // Para Ollama
  model?: string;  // Opcional, para especificar modelo
}

// Prompts do Sistema Centralizados
const getSystemInstruction = (type: GenerationType): string => {
  switch (type) {
    case 'title':
      return `Você é um especialista em Copywriting viral para YouTube Shorts.
      Crie UMA variação de título curta, impactante e curiosa.
      - Máximo 60 caracteres.
      - Sem aspas.
      - Responda APENAS o título.`;
    case 'description':
      return `Crie uma descrição curta (2 frases) para este vídeo.
      - Use tom engajador.
      - Inclua uma chamada para ação (CTA).
      - Sem hashtags no texto.`;
    case 'tags':
      return `Gere 5 a 8 tags separadas APENAS por vírgula.
      - Foque em entidades, nomes próprios e nicho.
      - Exemplo: Tecnologia, Apple, iPhone 15, Review, Smartphone`;
    case 'hashtags':
      return `Gere 5 hashtags relevantes.
      - As 3 primeiras específicas, as 2 últimas de nicho.
      - Separadas por espaço.
      - Exemplo: #iPhone15 #Apple #Tech #Review #Shorts`;
    default:
      return '';
  }
};

// --- Implementação Gemini ---
const generateGemini = async (apiKey: string, prompt: string, type: GenerationType) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const fullPrompt = `${getSystemInstruction(type)}\n\nCONTEXTO: "${prompt}"`;
  
  const result = await model.generateContent(fullPrompt);
  return result.response.text();
};

// --- Implementação Groq ---
const generateGroq = async (apiKey: string, prompt: string, type: GenerationType, modelId: string = 'llama3-70b-8192') => {
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true }); 
  
  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: getSystemInstruction(type) },
      { role: "user", content: prompt }
    ],
    model: modelId,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content || "";
};

// --- Implementação Ollama (Via Fetch Nativo para suporte a Cloud/Custom Headers) ---
const generateOllama = async (url: string, apiKey: string | undefined, prompt: string, type: GenerationType, modelId: string = 'llama3') => {
  // Remove barra final se existir
  const baseUrl = url.replace(/\/$/, '');
  
  // Endpoint específico solicitado: /api/generate
  const endpoint = `${baseUrl}/api/generate`;

  // Combina instrução do sistema com o prompt do usuário (já que /generate é single-prompt)
  const systemInstruction = getSystemInstruction(type);
  const finalPrompt = `${systemInstruction}\n\nCONTEXTO: "${prompt}"`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Adiciona Bearer Token se existir chave
  if (apiKey && apiKey.trim() !== '') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        prompt: finalPrompt,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // O endpoint /api/generate retorna o texto no campo 'response'
    return data.response;

  } catch (error: any) {
    console.error("Erro Ollama Fetch:", error);
    
    if (error.message?.includes('Failed to fetch')) {
      throw new Error(`Falha de conexão com ${baseUrl}. Verifique se a URL está correta e se o servidor permite CORS.`);
    }
    
    throw error;
  }
};

// --- Função Principal Exportada ---
export const generateContentAI = async (
  config: AIConfig,
  prompt: string,
  type: GenerationType
): Promise<string> => {
  console.log(`[AI Service] Provider: ${config.provider} | Type: ${type}`);

  if (!prompt || prompt.trim().length < 3) {
    throw new Error("Texto de entrada muito curto para gerar contexto.");
  }

  let result = "";

  try {
    switch (config.provider) {
      case 'gemini':
        if (!config.apiKey) throw new Error("Chave Gemini não configurada.");
        result = await generateGemini(config.apiKey, prompt, type);
        break;
        
      case 'groq':
        if (!config.apiKey) throw new Error("Chave Groq não configurada.");
        result = await generateGroq(config.apiKey, prompt, type, config.model || 'llama3-70b-8192');
        break;
        
      case 'ollama':
        if (!config.url) throw new Error("URL do Ollama não configurada.");
        result = await generateOllama(config.url, config.apiKey, prompt, type, config.model || 'llama3');
        break;
        
      default:
        throw new Error("Provedor de IA desconhecido.");
    }

    // Limpeza básica pós-processamento
    return result.replace(/^"|"$/g, '').trim();

  } catch (error: any) {
    console.error(`Erro na geração (${config.provider}):`, error);
    throw new Error(`Falha na IA (${config.provider}): ${error.message}`);
  }
};
