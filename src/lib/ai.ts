import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq' | 'ollama';
export type GenerationType = 'title' | 'description' | 'tags' | 'hashtags';

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  url?: string;
  model?: string;
}

// Prompts do Sistema Centralizados
const getSystemInstruction = (type: GenerationType, variations: boolean = false): string => {
  const separatorInstruction = variations 
    ? `\n\nIMPORTANTE: Gere 5 variações distintas. Separe cada variação EXATAMENTE com "|||". Não numere as linhas.` 
    : '';

  switch (type) {
    case 'title':
      return `Você é um especialista em Copywriting viral para YouTube Shorts.
      Crie títulos curtos, impactantes e curiosos (máximo 60 caracteres).
      Sem aspas.${separatorInstruction}`;
    case 'description':
      return `Crie descrições curtas (2 frases) com tom engajador e CTA (Chamada para Ação).
      Sem hashtags no texto.${separatorInstruction}`;
    case 'tags':
      return `Gere listas de tags separadas por vírgula.
      Foque em entidades, nomes próprios e nicho.
      Exemplo: Tecnologia, Apple, iPhone 15${separatorInstruction}`;
    case 'hashtags':
      return `Gere combinações de 5 hashtags relevantes.
      Exemplo: #iPhone15 #Apple #Tech${separatorInstruction}`;
    default:
      return '';
  }
};

// --- Implementação Gemini ---
const generateGemini = async (apiKey: string, prompt: string, type: GenerationType, variations: boolean) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const fullPrompt = `${getSystemInstruction(type, variations)}\n\nCONTEXTO: "${prompt}"`;
  
  const result = await model.generateContent(fullPrompt);
  return result.response.text();
};

// --- Implementação Groq ---
const generateGroq = async (apiKey: string, prompt: string, type: GenerationType, variations: boolean, modelId: string = 'llama3-70b-8192') => {
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true }); 
  
  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: getSystemInstruction(type, variations) },
      { role: "user", content: prompt }
    ],
    model: modelId,
    temperature: 0.8, // Um pouco mais criativo para variações
  });

  return completion.choices[0]?.message?.content || "";
};

// --- Implementação Ollama ---
const generateOllama = async (url: string, apiKey: string | undefined, prompt: string, type: GenerationType, variations: boolean, modelId: string = 'llama3') => {
  const baseUrl = url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/generate`;
  const systemInstruction = getSystemInstruction(type, variations);
  const finalPrompt = `${systemInstruction}\n\nCONTEXTO: "${prompt}"`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey.trim() !== '') headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: modelId, prompt: finalPrompt, stream: false })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error: any) {
    console.error("Erro Ollama Fetch:", error);
    if (error.message?.includes('Failed to fetch')) {
      throw new Error(`Falha de conexão com ${baseUrl}. Verifique CORS.`);
    }
    throw error;
  }
};

// --- Função Principal Exportada ---
export const generateContentAI = async (
  config: AIConfig,
  prompt: string,
  type: GenerationType
): Promise<string[]> => {
  console.log(`[AI Service] Provider: ${config.provider} | Type: ${type} | Mode: Variations`);

  if (!prompt || prompt.trim().length < 3) {
    throw new Error("Texto de entrada muito curto para gerar contexto.");
  }

  let rawResult = "";

  try {
    switch (config.provider) {
      case 'gemini':
        if (!config.apiKey) throw new Error("Chave Gemini não configurada.");
        rawResult = await generateGemini(config.apiKey, prompt, type, true);
        break;
      case 'groq':
        if (!config.apiKey) throw new Error("Chave Groq não configurada.");
        rawResult = await generateGroq(config.apiKey, prompt, type, true, config.model || 'llama3-70b-8192');
        break;
      case 'ollama':
        if (!config.url) throw new Error("URL do Ollama não configurada.");
        rawResult = await generateOllama(config.url, config.apiKey, prompt, type, true, config.model || 'llama3');
        break;
      default:
        throw new Error("Provedor de IA desconhecido.");
    }

    // Processamento das variações
    // 1. Remove aspas extras
    // 2. Divide pelo separador |||
    // 3. Limpa espaços e linhas vazias
    const variations = rawResult
      .replace(/^"|"$/g, '')
      .split('|||')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    // Fallback se a IA não respeitar o separador (tenta quebrar por linha)
    if (variations.length <= 1 && rawResult.includes('\n')) {
      return rawResult.split('\n').map(v => v.trim()).filter(v => v.length > 0 && !v.match(/^\d+\./)); // Remove numeração se houver
    }

    return variations;

  } catch (error: any) {
    console.error(`Erro na geração (${config.provider}):`, error);
    throw new Error(`Falha na IA (${config.provider}): ${error.message}`);
  }
};
