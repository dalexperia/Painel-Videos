import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateContent = async (
  apiKey: string,
  prompt: string,
  type: 'title' | 'description' | 'tags' | 'hashtags'
): Promise<string> => {
  if (!apiKey) throw new Error("Chave da API Gemini não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  let systemInstruction = "";
  switch (type) {
    case 'title':
      systemInstruction = "Crie UM título chamativo, curto e viral para um vídeo Short do YouTube sobre o seguinte tema. Responda APENAS com o título, sem aspas.";
      break;
    case 'description':
      systemInstruction = "Crie uma descrição engajadora e curta (máximo 3 frases) para um vídeo Short do YouTube sobre o tema. Inclua uma chamada para ação.";
      break;
    case 'tags':
      systemInstruction = "Gere 5 a 8 tags relevantes para YouTube separadas APENAS por vírgula, sem espaços extras, sobre o tema. Exemplo: tag1,tag2,tag3";
      break;
    case 'hashtags':
      systemInstruction = "Gere 5 hashtags virais e relevantes separadas por espaço ou vírgula para este tema. Exemplo: #viral #shorts";
      break;
  }

  try {
    const result = await model.generateContent(`${systemInstruction}\n\nTema/Conteúdo: ${prompt}`);
    const response = await result.response;
    let text = response.text();
    
    // Limpeza básica
    text = text.replace(/^"|"$/g, '').trim();
    if (type === 'tags') text = text.replace(/\s*,\s*/g, ', ');
    
    return text;
  } catch (error) {
    console.error("Erro na API Gemini:", error);
    throw new Error("Falha ao gerar conteúdo com IA.");
  }
};
