import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq' | 'ollama';
export type GenerationType = 'title' | 'description' | 'tags' | 'hashtags';

interface AIConfig {
  provider: AIProvider;
  apiKey?: string; // Para Gemini ou Groq
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
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true }); // Permitir browser para demo, idealmente via backend
  
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

// --- Implementação Ollama ---
const generateOllama = async (url: string, prompt: string, type: GenerationType, modelId: string = 'llama3') => {
  // Nota: O usuário precisa configurar CORS no Ollama localmente para funcionar via browser
  // OLLAMA_ORIGINS="*" ollama serve
  
  const fullUrl = `${url.replace(/\/$/, '')}/api/generate`;
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      prompt: `${getSystemInstruction(type)}\n\nCONTEXTO: "${prompt}"`,
      stream: false
    })
  });

  if (!response.ok) throw new Error(`Erro Ollama: ${response.statusText}`);
  
  const data = await response.json();
  return data.response;
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
        result = await generateOllama(config.url, prompt, type, config.model || 'llama3');
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
