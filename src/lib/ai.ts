import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export type AIProvider = 'gemini' | 'groq' | 'ollama';
export type GenerationType = 'title' | 'description' | 'tags' | 'hashtags' | 'autocomplete_tags' | 'autocomplete_hashtags' | 'image_prompt' | 'caption';

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  url?: string;
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

    case 'image_prompt':
      return `${baseInstruction}
      OBJETIVO: Você é um Engenheiro de Prompt (Prompt Engineer) especialista em Midjourney e DALL-E 3.
      TAREFA: Melhore a ideia básica do usuário para criar uma imagem visualmente impressionante.
      CONTEXTO: O usuário quer uma imagem sobre: "${context}".
      SAÍDA: Gere 3 variações de prompts detalhados. Para cada variação, forneça a versão em INGLÊS (para a IA de imagem) e uma tradução correspondente em PORTUGUÊS (para exibição ao usuário).
      Formato de Saída: Um array de objetos, onde cada objeto tem as chaves 'pt' e 'en'.
      Exemplo de Saída: [{"pt": "Um gato preto místico, cercado por um halo de luz suave e etérea, em um cenário de floresta iluminada pela lua, com detalhes e texturas intrincados, no estilo de uma ilustração de fantasia, resolução 4k", "en": "A mystical black cat, surrounded by a halo of soft, ethereal light, set against a backdrop of a moonlit forest, with intricate details and textures, in the style of a fantasy illustration, 4k resolution"}]`;
    
    case 'caption':
      return `${baseInstruction}
      OBJETIVO: Você é um especialista em marketing de conteúdo para Instagram.
      TAREFA: Gere exatamente 3 sugestões de legendas criativas, detalhadas e envolventes para um post no Instagram.
      CONTEXTO: O post é sobre: "${context}".
      SAÍDA: As legendas devem ser em português, ter um bom tamanho (2-3 frases), incluir emojis relevantes e uma variedade de hashtags populares e específicas (5-10 hashtags por sugestão).
      Formato de Saída: Um array de strings.
      Exemplo de Saída: ["Descubra a sabedoria de Marco Aurélio! 💡 Filósofo e imperador romano, suas palavras ainda nos inspiram hoje a viver com propósito e resiliência. Uma verdadeira fonte de inspiração para a vida moderna. #MarcoAurelio #FilosofiaEstóica #SabedoriaAntiga #InspiraçãoDiária #PensamentosProfundos", "A vida é um presente, aproveite cada momento! 😊 Marco Aurélio nos lembra da importância de viver no presente, valorizando cada instante e buscando a serenidade em meio aos desafios. Viva intensamente! #Inspiração #Motivação #VivaOAgora #Gratidão #Mindfulness #DesenvolvimentoPessoal", "A força vem da calma e da determinação. 🙏 Marco Aurélio nos ensina a encontrar a força interior para superar obstáculos, mantendo a mente tranquila e o foco nos objetivos. A verdadeira resiliência nasce da paz interior. #Autoajuda #DesenvolvimentoPessoal #ForçaInterior #Resiliência #PazDeEspírito #FocoNoObjetivo"]`;
    
    default:
      return baseInstruction;
  }
};

// --- Parsers e Limpeza ---
const parseAIResponse = (text: string, type: GenerationType): string[] | { pt: string; en: string }[] => {
  try {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanText = cleanText.substring(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(cleanText);

    if (type === 'image_prompt') {
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && item !== null && 'pt' in item && 'en' in item)) {
        return parsed.map(item => ({ pt: String(item.pt).trim(), en: String(item.en).trim() }));
      }
      throw new Error("Resposta não é um array de objetos com chaves 'pt' e 'en'.");
    } else if (type === 'caption') {
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed.map(item => String(item).trim());
      }
      throw new Error("Resposta não é um array de strings para legenda.");
    } else {
      // Para outros tipos que esperam array de strings
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed.map(item => String(item).trim());
      }
      throw new Error("Resposta não é um array de strings.");
    }

  } catch (e) {
    console.warn("Falha ao fazer parse do JSON da IA. Tentando fallback manual.", e);
    const lines = text
      .split('\n')
      .map(l => l.replace(/^\d+\.|-|\*|"|,|\[|\]/g, '').trim())
      .filter(l => l.length > 1);
    
    if (type === 'image_prompt') {
      return lines.map(line => ({ pt: line, en: line }));
    } else {
      return lines;
    }
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
    temperature: 0.7, // Temperatura um pouco maior para criatividade nos prompts
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
  extraContext?: string
): Promise<string[] | { pt: string; en: string }[]> => {
  
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
      case 'ollama':
        if (!config.url) throw new Error("URL do Ollama não configurada.");
        rawResult = await generateOllama(config.url, cleanApiKey, effectivePrompt, type, config.model || 'llama3');
        break;
      default:
        throw new Error("Provedor desconhecido.");
    }

    const variations = parseAIResponse(rawResult, type);
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
