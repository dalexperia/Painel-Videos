import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq' | 'ollama';
export type GenerationType = 'title' | 'description' | 'tags' | 'hashtags' | 'autocomplete_tags' | 'autocomplete_hashtags';

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  url?: string;
  model?: string;
}

// --- Prompts Otimizados para JSON ---
const getSystemInstruction = (type: GenerationType, context?: string): string => {
  const baseInstruction = `
    Você é um assistente de IA especializado em YouTube.
    REGRAS CRÍTICAS:
    1. Responda APENAS com um ARRAY JSON de strings válido.
    2. NÃO use Markdown.
    3. NÃO inclua explicações.
  `;

  switch (type) {
    case 'title':
      return `${baseInstruction}
      OBJETIVO: Gere 5 títulos virais, curtos e impactantes para um vídeo sobre: "${context}".`;
    
    case 'description':
      return `${baseInstruction}
      OBJETIVO: Gere 5 descrições curtas e engajadoras para um vídeo sobre: "${context}".`;
    
    case 'tags':
      return `${baseInstruction}
      OBJETIVO: Gere 5 listas de tags (separadas por vírgula) para um vídeo sobre: "${context}".`;
    
    case 'hashtags':
      return `${baseInstruction}
      OBJETIVO: Gere 5 combinações de hashtags para um vídeo sobre: "${context}".`;

    case 'autocomplete_tags':
      return `${baseInstruction}
      OBJETIVO: Você é um motor de autocomplete. O usuário digitou o termo parcial: "${context}".
      Retorne 5 a 8 sugestões curtas de tags que completem ou se relacionem com esse termo.
      As sugestões devem ser relevantes para YouTube.`;

    case 'autocomplete_hashtags':
      return `${baseInstruction}
      OBJETIVO: Você é um motor de autocomplete. O usuário digitou o termo parcial: "${context}".
      Retorne 5 a 8 sugestões de hashtags (com #) que completem esse termo.`;
    
    default:
      return baseInstruction;
  }
};

// --- Parsers e Limpeza ---
const parseAIResponse = (text: string): string[] => {
  try {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanText = cleanText.substring(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(cleanText);

    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(item => item.length > 0);
    }
    
    throw new Error("Resposta não é um array.");

  } catch (e) {
    console.warn("Falha ao fazer parse do JSON da IA. Tentando fallback manual.", e);
    return text
      .split('\n')
      .map(l => l.replace(/^\d+\.|-|\*|"|,|\[|\]/g, '').trim())
      .filter(l => l.length > 1);
  }
};

// --- Implementações dos Provedores ---

const generateGemini = async (apiKey: string, prompt: string, type: GenerationType) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" }
  });
  
  const systemPrompt = getSystemInstruction(type, prompt);
  // Para autocomplete, o prompt é o próprio termo parcial + contexto implícito se necessário
  // Mas aqui simplificamos passando o termo no systemInstruction para autocomplete
  
  const result = await model.generateContent(systemPrompt);
  return result.response.text();
};

const generateGroq = async (apiKey: string, prompt: string, type: GenerationType, modelId: string = 'llama3-70b-8192') => {
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true }); 
  
  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: getSystemInstruction(type, prompt) },
      { role: "user", content: "Gere o JSON agora." }
    ],
    model: modelId,
    temperature: 0.5, // Temperatura menor para autocomplete ser mais preciso
    response_format: { type: "json_object" }
  });

  return completion.choices[0]?.message?.content || "[]";
};

const generateOllama = async (url: string, apiKey: string | undefined, prompt: string, type: GenerationType, modelId: string = 'llama3') => {
  const baseUrl = url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/generate`;
  
  const fullPrompt = `${getSystemInstruction(type, prompt)}\nResponda apenas com o JSON.`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey.trim() !== '') headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ 
      model: modelId, 
      prompt: fullPrompt, 
      stream: false,
      format: "json"
    })
  });

  if (!response.ok) throw new Error(`Erro Ollama: ${response.statusText}`);
  const data = await response.json();
  return data.response;
};

// --- Função Principal ---
export const generateContentAI = async (
  config: AIConfig,
  prompt: string,
  type: GenerationType,
  extraContext?: string // Usado para passar o título do vídeo no autocomplete
): Promise<string[]> => {
  // Se for autocomplete, combinamos o termo parcial com o contexto do vídeo
  let finalPrompt = prompt;
  
  if (type === 'autocomplete_tags' || type === 'autocomplete_hashtags') {
    if (!prompt || prompt.length < 2) return []; // Não gera para 1 letra
    finalPrompt = `Termo parcial: "${prompt}". Contexto do vídeo: "${extraContext || ''}"`;
  }

  console.log(`[AI Service] Provider: ${config.provider} | Type: ${type}`);

  let rawResult = "";

  try {
    switch (config.provider) {
      case 'gemini':
        if (!config.apiKey) throw new Error("Chave Gemini não configurada.");
        rawResult = await generateGemini(config.apiKey, finalPrompt, type);
        break;
      case 'groq':
        if (!config.apiKey) throw new Error("Chave Groq não configurada.");
        rawResult = await generateGroq(config.apiKey, finalPrompt, type, config.model || 'llama3-70b-8192');
        break;
      case 'ollama':
        if (!config.url) throw new Error("URL do Ollama não configurada.");
        rawResult = await generateOllama(config.url, config.apiKey, finalPrompt, type, config.model || 'llama3');
        break;
      default:
        throw new Error("Provedor desconhecido.");
    }

    const variations = parseAIResponse(rawResult);
    return variations;

  } catch (error: any) {
    console.error(`Erro na geração (${config.provider}):`, error);
    // Em autocomplete, falhas silenciosas são preferíveis a alertas de erro
    if (type.includes('autocomplete')) return [];
    throw new Error(`Falha na IA: ${error.message}`);
  }
};
