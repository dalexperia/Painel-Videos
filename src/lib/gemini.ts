import { GoogleGenerativeAI } from "@google/generative-ai";

// Log para confirmar que a nova versão foi carregada
console.log("Gemini Lib: Versão Variação Carregada 🚀 | Modelo: gemini-2.0-flash-001 | Temp: 0.75");

export const generateContent = async (
  apiKey: string,
  prompt: string,
  type: 'title' | 'description' | 'tags' | 'hashtags'
): Promise<string> => {
  // 1. Validação Inicial
  if (!apiKey) throw new Error("Chave da API Gemini não configurada.");
  
  console.log(`[Gemini Request] Tipo: ${type} | Prompt recebido: "${prompt}"`);

  if (!prompt || prompt.trim().length < 3) {
    console.warn("[Gemini] Prompt muito curto ou vazio.");
    throw new Error("O título é muito curto para gerar contexto. Digite algo mais específico.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-001",
    generationConfig: {
      temperature: 0.75, // AUMENTADO: Mais criatividade para gerar variações
    }
  });

  let systemInstruction = "";
  
  switch (type) {
    case 'title':
      systemInstruction = `
        Você é um especialista em Copywriting viral.
        Crie UMA NOVA E CRIATIVA variação de título para o vídeo sobre o tema abaixo.
        - Seja ousado e chamativo, mas fiel ao assunto.
        - Responda APENAS com o título, sem aspas.
        - Máximo 60 caracteres.
      `;
      break;

    case 'description':
      systemInstruction = `
        Crie uma NOVA variação da descrição (2 frases) para este vídeo.
        - Use palavras-chave do título.
        - Inclua uma chamada para ação (CTA) diferente da anterior.
        - Sem hashtags na descrição.
      `;
      break;

    case 'tags':
      systemInstruction = `
        EXTRAÇÃO DE ENTIDADES E SUGESTÃO DE METADATOS.
        Analise o texto e sugira as melhores entidades (Nomes, Lugares, Assuntos Técnicos).
        
        REGRAS RÍGIDAS (PROIBIÇÕES):
        - PROIBIDO usar palavras genéricas: "shorts", "viral", "video", "youtube", "fyp", "tiktok", "capcut", "dicas", "tutorial".
        - Se o texto for sobre um concurso, retorne a banca, o órgão, o cargo e o estado.
        
        FORMATO:
        Retorne 5 a 8 tags separadas APENAS por vírgula. Pense em variações ou sinônimos relevantes.
        Exemplo de Entrada: "Concurso ALE-RO 2025"
        Exemplo de Saída: Concurso ALE-RO, Assembleia Legislativa Rondônia, Edital 2025, Vagas Rondônia, Serviço Público
      `;
      break;

    case 'hashtags':
      systemInstruction = `
        Gere uma NOVA combinação de 5 hashtags.
        - As 3 primeiras DEVEM ser sobre o tema específico (ex: #NomeDoConcurso #Estado #Cargo).
        - As 2 últimas podem ser de nicho (ex: #ConcursosPublicos #Estudos).
        - PROIBIDO: #shorts #viral #fyp (a menos que não haja nada específico).
        - Separadas por espaço.
      `;
      break;
  }

  try {
    const finalPrompt = `
      INSTRUÇÃO DO SISTEMA: ${systemInstruction}
      
      ---
      CONTEÚDO DE ENTRADA (TÍTULO): "${prompt}"
      ---
      
      Responda seguindo estritamente as regras acima. Gere um resultado diferente do anterior.
    `;

    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    let text = response.text();
    
    // Limpeza
    text = text.replace(/^"|"$/g, '').trim();
    if (type === 'tags') {
      text = text.replace(/\.$/, ''); // Remove ponto final
    }

    console.log(`[Gemini Response] Resultado: "${text}"`);
    return text;

  } catch (error) {
    console.error("Erro na API Gemini:", error);
    throw new Error("Falha ao conectar com a IA. Verifique o console do navegador (F12) para detalhes técnicos.");
  }
};
