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
      OBJETIVO: Você é um motor de autocomplete inteligente estilo YouTube Studio.
      CONTEXTO DO VÍDEO: O vídeo é sobre "${context}".
      TAREFA: O usuário digitou um termo parcial. Retorne 5 a 8 sugestões de tags que completem esse termo e sejam altamente relevantes para o contexto do vídeo.
      Exemplo: Se o contexto é "Salmos" e o termo é "salm", retorne ["salmo 91", "salmo 23", "salmos poderosos"].`;

    case 'autocomplete_hashtags':
      return `${baseInstruction}
      OBJETIVO: Você é um motor de autocomplete de hashtags.
      CONTEXTO DO VÍDEO: O vídeo é sobre "${context}".
      TAREFA: O usuário digitou um termo parcial. Retorne 5 a 8 hashtags (com #) que completem esse termo.`;
    
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
    temperature: 0.3, // Temperatura baixa para autocomplete preciso
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
  
  // Lógica especial para Autocomplete:
  // O "prompt" aqui será o termo parcial (ex: "salm")
  // O "extraContext" será o título do vídeo (ex: "Salmo 91 Oração")
  // Precisamos passar ambos para o prompt do sistema
  
  let finalPrompt = prompt;
  let contextForSystem = prompt; // Default

  if (type === 'autocomplete_tags' || type === 'autocomplete_hashtags') {
    if (!prompt || prompt.length < 2) return []; // Não gera para 1 letra
    // Para autocomplete, passamos o Título como contexto principal para o System Instruction
    // E o termo parcial concatenado na instrução
    contextForSystem = extraContext || "Vídeo Genérico";
    finalPrompt = `Termo parcial digitado pelo usuário: "${prompt}"`;
  }

  console.log(`[AI Service] Provider: ${config.provider} | Type: ${type}`);

  let rawResult = "";

  try {
    // Modificamos as chamadas para passar o contextForSystem corretamente nas instruções
    // Nota: As funções generate* usam o segundo argumento como input para o getSystemInstruction
    // Então precisamos garantir que o getSystemInstruction receba o contexto correto.
    
    // Hack rápido: As funções generate* chamam getSystemInstruction(type, prompt).
    // Para autocomplete, vamos passar o contexto no lugar do prompt para a instrução de sistema,
    // e o termo parcial já está embutido na lógica do switch case acima ou será passado de outra forma.
    
    // Vamos ajustar a chamada das funções internas para passar o contexto correto:
    
    const promptToUse = (type.includes('autocomplete')) ? contextForSystem : finalPrompt;
    // Mas espere, o termo parcial precisa ir também.
    // Vamos concatenar no promptToUse para simplificar sem mudar assinaturas
    
    const effectivePrompt = (type.includes('autocomplete')) 
      ? `${contextForSystem}. Termo parcial a completar: "${prompt}"`
      : finalPrompt;

    switch (config.provider) {
      case 'gemini':
        if (!config.apiKey) throw new Error("Chave Gemini não configurada.");
        rawResult = await generateGemini(config.apiKey, effectivePrompt, type);
        break;
      case 'groq':
        if (!config.apiKey) throw new Error("Chave Groq não configurada.");
        rawResult = await generateGroq(config.apiKey, effectivePrompt, type, config.model || 'llama3-70b-8192');
        break;
      case 'ollama':
        if (!config.url) throw new Error("URL do Ollama não configurada.");
        rawResult = await generateOllama(config.url, config.apiKey, effectivePrompt, type, config.model || 'llama3');
        break;
      default:
        throw new Error("Provedor desconhecido.");
    }

    const variations = parseAIResponse(rawResult);
    return variations;

  } catch (error: any) {
    console.error(`Erro na geração (${config.provider}):`, error);
    if (type.includes('autocomplete')) return [];
    throw new Error(`Falha na IA: ${error.message}`);
  }
};
