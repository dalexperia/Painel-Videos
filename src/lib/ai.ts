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

// --- Prompts Otimizados para JSON ---
const getSystemInstruction = (type: GenerationType): string => {
  const baseInstruction = `
    Você é um especialista em SEO e Copywriting para YouTube Shorts.
    Sua tarefa é gerar 5 variações distintas e criativas baseadas no contexto fornecido.

    REGRAS CRÍTICAS DE FORMATAÇÃO:
    1. Responda APENAS com um ARRAY JSON de strings válido.
    2. NÃO use Markdown (sem \`\`\`json).
    3. NÃO inclua explicações ou texto adicional.
    4. Exemplo de formato esperado: ["Variação 1", "Variação 2", "Variação 3", "Variação 4", "Variação 5"]
  `;

  switch (type) {
    case 'title':
      return `${baseInstruction}
      OBJETIVO: Títulos virais, curtos (máx 60 caracteres), impactantes e curiosos. Sem aspas no texto.`;
    
    case 'description':
      return `${baseInstruction}
      OBJETIVO: Descrições curtas (2 frases) com tom engajador e uma Chamada para Ação (CTA).`;
    
    case 'tags':
      return `${baseInstruction}
      OBJETIVO: Listas de tags separadas por vírgula.
      Cada item do array deve ser uma string contendo 5 a 8 tags.
      Exemplo de item: "tecnologia, inovação, gadgets, review, unboxing"`;
    
    case 'hashtags':
      return `${baseInstruction}
      OBJETIVO: Combinações de 5 hashtags relevantes separadas por espaço.
      Exemplo de item: "#tech #apple #iphone #review #shorts"`;
    
    default:
      return baseInstruction;
  }
};

// --- Parsers e Limpeza ---
const parseAIResponse = (text: string): string[] => {
  try {
    // 1. Remove blocos de código markdown se houver
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 2. Tenta encontrar o array JSON no texto (caso a IA fale algo antes)
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanText = cleanText.substring(firstBracket, lastBracket + 1);
    }

    // 3. Parse JSON
    const parsed = JSON.parse(cleanText);

    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(item => item.length > 0);
    }
    
    throw new Error("Resposta não é um array.");

  } catch (e) {
    console.warn("Falha ao fazer parse do JSON da IA. Tentando fallback manual.", e);
    // Fallback: Tenta quebrar por linhas se o JSON falhar
    return text
      .split('\n')
      .map(l => l.replace(/^\d+\.|-|\*|"|,/g, '').trim()) // Remove numeração/marcadores
      .filter(l => l.length > 5);
  }
};

// --- Implementações dos Provedores ---

const generateGemini = async (apiKey: string, prompt: string, type: GenerationType) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" } // Força JSON no Gemini
  });
  
  const fullPrompt = `${getSystemInstruction(type)}\n\nCONTEXTO DO VÍDEO: "${prompt}"`;
  
  const result = await model.generateContent(fullPrompt);
  return result.response.text();
};

const generateGroq = async (apiKey: string, prompt: string, type: GenerationType, modelId: string = 'llama3-70b-8192') => {
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true }); 
  
  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: getSystemInstruction(type) },
      { role: "user", content: `CONTEXTO: "${prompt}"` }
    ],
    model: modelId,
    temperature: 0.7,
    response_format: { type: "json_object" } // Tenta forçar JSON mode se suportado
  });

  return completion.choices[0]?.message?.content || "[]";
};

const generateOllama = async (url: string, apiKey: string | undefined, prompt: string, type: GenerationType, modelId: string = 'llama3') => {
  const baseUrl = url.replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/generate`;
  const fullPrompt = `${getSystemInstruction(type)}\n\nCONTEXTO: "${prompt}"`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey.trim() !== '') headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ 
      model: modelId, 
      prompt: fullPrompt, 
      stream: false,
      format: "json" // Força JSON no Ollama
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
  type: GenerationType
): Promise<string[]> => {
  console.log(`[AI Service] Provider: ${config.provider} | Type: ${type} | JSON Mode`);

  if (!prompt || prompt.trim().length < 3) {
    throw new Error("Texto de entrada muito curto.");
  }

  let rawResult = "";

  try {
    switch (config.provider) {
      case 'gemini':
        if (!config.apiKey) throw new Error("Chave Gemini não configurada.");
        rawResult = await generateGemini(config.apiKey, prompt, type);
        break;
      case 'groq':
        if (!config.apiKey) throw new Error("Chave Groq não configurada.");
        rawResult = await generateGroq(config.apiKey, prompt, type, config.model || 'llama3-70b-8192');
        break;
      case 'ollama':
        if (!config.url) throw new Error("URL do Ollama não configurada.");
        rawResult = await generateOllama(config.url, config.apiKey, prompt, type, config.model || 'llama3');
        break;
      default:
        throw new Error("Provedor desconhecido.");
    }

    console.log("[AI Raw Output]", rawResult);
    const variations = parseAIResponse(rawResult);
    
    if (variations.length === 0) throw new Error("Nenhuma variação válida gerada.");
    
    return variations;

  } catch (error: any) {
    console.error(`Erro na geração (${config.provider}):`, error);
    throw new Error(`Falha na IA: ${error.message}`);
  }
};
