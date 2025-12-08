import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from './supabaseClient';

// --- Helper: Fetch API Key ---
const getGeminiKey = async (): Promise<string> => {
  // 1. Try Environment Variable
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }

  // 2. Try Supabase (Common patterns: api_keys table or shorts_settings)
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('key')
      .eq('service', 'gemini')
      .single();
      
    if (data?.key) return data.key;
    
    // Fallback check in settings if api_keys doesn't exist
    const { data: settings } = await supabase
      .from('shorts_settings')
      .select('gemini_key')
      .single();
      
    if (settings?.gemini_key) return settings.gemini_key;
    
  } catch (err) {
    console.warn("Error fetching Gemini key from DB:", err);
  }

  throw new Error("Gemini API Key not found. Please set VITE_GEMINI_API_KEY or configure it in the database.");
};

// --- Core Generation Logic ---
export const generateContent = async (
  apiKey: string,
  prompt: string,
  type: 'title' | 'description' | 'tags' | 'hashtags'
): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing.");
  if (!prompt || prompt.trim().length < 3) {
    throw new Error("Prompt is too short to generate context.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-pro",
    generationConfig: { temperature: 0.4 }
  });

  let systemInstruction = "";
  
  switch (type) {
    case 'title':
      systemInstruction = `Create ONE catchy, click-worthy title (max 60 chars) for a video about this topic. No quotes.`;
      break;
    case 'description':
      systemInstruction = `Write a 2-sentence engaging description for this video. Include a CTA. No hashtags.`;
      break;
    case 'tags':
      systemInstruction = `Extract 5-8 main entities/keywords (comma separated). No generic words like 'video', 'viral'.`;
      break;
    case 'hashtags':
      systemInstruction = `Generate 5 hashtags (space separated). First 3 specific, last 2 niche.`;
      break;
  }

  const finalPrompt = `
    SYSTEM: ${systemInstruction}
    INPUT: "${prompt}"
    
    Return ONLY the result string.
  `;

  try {
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    let text = response.text();
    return text.replace(/^"|"$/g, '').trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate content with AI.");
  }
};

// --- Unified Export for Components (VideoDetailsModal) ---
export const generateMetadata = async (
  field: 'title' | 'description' | 'tags' | 'hashtags',
  context: { title?: string; description?: string }
): Promise<string> => {
  const apiKey = await getGeminiKey();
  
  // Construct a rich prompt based on available context
  let prompt = "";
  if (context.title && context.description) {
    prompt = `Title: ${context.title}\nDescription: ${context.description}`;
  } else if (context.title) {
    prompt = context.title;
  } else if (context.description) {
    prompt = context.description;
  } else {
    throw new Error("Please provide a title or description for context.");
  }

  return generateContent(apiKey, prompt, field);
};

// --- Legacy/Direct Exports (Fixes 'generateTags' import error) ---

export const generateTags = async (input: string | { title: string, description?: string }) => {
  const context = typeof input === 'string' ? { title: input } : input;
  return generateMetadata('tags', context);
};

export const generateHashtags = async (input: string | { title: string, description?: string }) => {
  const context = typeof input === 'string' ? { title: input } : input;
  return generateMetadata('hashtags', context);
};

export const generateTitle = async (description: string) => {
  return generateMetadata('title', { description });
};

export const generateDescription = async (title: string) => {
  return generateMetadata('description', { title });
};
