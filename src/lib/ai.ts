import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq';
export type GenerationType = 'title' | 'description' | 'tags' | 'hashtags' | 'autocomplete_tags' | 'autocomplete_hashtags' | 'image_prompt';

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
}

// --- Prompts Otimizados para JSON ---
const getSystemInstruction = (type: GenerationType, context?: string): string => {
  const baseInstruction = `
    Você é um assistente de IA especializado em YouTube e Criação de Conteúdo.
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
      OBJETIVO: Gere uma lista de tags específicas para o vídeo sobre: "${context}".
      REGRAS:
      - Gere entre 12 e 18 tags focadas no tema.
      - Cada tag com no máximo 30 caracteres.
      - Não use espaços nas tags: substitua espaços por hífens (ex: concurso-publico).
      - Remova caracteres especiais como "<" e ">".
      - Evite tags genéricas: ["shorts","viral","video","youtube","fyp","tiktok","capcut","dicas","tutorial"].
      - Retorne APENAS um ARRAY JSON de strings.`;
    
    case 'hashtags':
      return `${baseInstruction}
      OBJETIVO: Gere exatamente 10 hashtags relevantes para o vídeo sobre: "${context}".
      REGRAS:
      - Cada hashtag deve começar com "#".
      - Sem espaços dentro das hashtags.
      - Use letras minúsculas quando possível.
      - Evite genéricas (#shorts #viral #fyp) a menos que não haja contexto.
      - Retorne APENAS um ARRAY JSON de strings.`;

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

    case 'image_prompt':
      return `${baseInstruction}
      OBJETIVO: Você é um Engenheiro de Prompt (Prompt Engineer) especialista em Midjourney e DALL-E 3.
      TAREFA: Melhore a ideia básica do usuário para criar uma imagem visualmente impressionante.
      CONTEXTO: O usuário quer uma imagem sobre: "${context}".
      SAÍDA: Gere 3 variações de prompts detalhados, em INGLÊS (pois as IAs de imagem entendem melhor), focando em iluminação, estilo, câmera e detalhes artísticos.
      Retorne APENAS um ARRAY JSON de strings.`;
    
    default:
      return baseInstruction;
  }
};

// --- Parsers e Limpeza ---
const parseAIResponse = (text: string): string[] => {
  try {
    // CORREÇÃO: Remover uso de RegExp com template literals
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanText = cleanText.substring(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(cleanText);

    if (typeof parsed === 'object' && parsed !== null && 'prompts' in parsed && Array.isArray(parsed.prompts)) {
      return parsed.prompts.map(item => String(item).trim()).filter(item => item.length > 0);
    } else if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim()).filter(item => item.length > 0);
    }
    
    throw new Error("Resposta não é um array ou objeto com chave 'prompts'.");

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
    temperature: 0.7,
    response_format: { type: "json_object" }
  });

  return completion.choices[0]?.message?.content || "[]";
};


// --- Função Principal ---
export const generateContentAI = async (
  config: AIConfig,
  prompt: string,
  type: GenerationType,
  extraContext?: string
): Promise<string[]> => {
  
  let finalPrompt = prompt;
  let contextForSystem = prompt;

  // Limpeza da chave de API (Trim)
  const cleanApiKey = config.apiKey ? config.apiKey.trim() : undefined;

  if (type === 'autocomplete_tags' || type === 'autocomplete_hashtags') {
    if (!prompt || prompt.length < 2) return [];
    contextForSystem = extraContext || "Vídeo Genérico";
    finalPrompt = `Termo parcial digitado pelo usuário: "${prompt}"`;
  }

  console.log(`[AI Service] Provider: ${config.provider} | Type: ${type}`);

  let rawResult = "";

  try {
    const effectivePrompt = (type.includes('autocomplete')) 
      ? `${contextForSystem}. Termo parcial a completar: "${prompt}"`
      : finalPrompt;

    switch (config.provider) {
      case 'gemini':
        if (!cleanApiKey) throw new Error("Chave Gemini não configurada.");
        rawResult = await generateGemini(cleanApiKey, effectivePrompt, type);
        break;
      case 'groq':
        if (!cleanApiKey) throw new Error("Chave Groq não configurada.");
        rawResult = await generateGroq(cleanApiKey, effectivePrompt, type, config.model || 'llama3-70b-8192');
        break;
      
      default:
        throw new Error("Provedor desconhecido.");
    }

    console.log("Raw AI Result:", rawResult);
    const variations = parseAIResponse(rawResult);
    return variations;

  } catch (error: any) {
    console.error(`Erro na geração (${config.provider}):`, error);
    
    // Tratamento de erro mais amigável para o usuário
    let friendlyMessage = error.message;
    
    if (error.message.includes('401') || error.message.includes('invalid_api_key')) {
      friendlyMessage = "Chave de API inválida (401). Verifique se a chave está correta e sem espaços.";
    } else if (error.message.includes('429')) {
      friendlyMessage = "Limite de requisições excedido (429). Tente novamente mais tarde.";
    }

    if (type.includes('autocomplete')) return [];
    throw new Error(friendlyMessage);
  }
};