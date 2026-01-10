import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || ''; 
// Note: In a real app, never expose keys on client. 
// This should be proxied via backend. 
// For this MVP structure, we assume env var is available or we fail gracefully.

const ai = new GoogleGenAI({ apiKey });

export const askReligiousQuestion = async (query: string) => {
  if (!apiKey) {
    return { 
      text: "عذرًا، مفتاح API غير متوفر. يرجى إعداد المفتاح لتفعيل البحث الذكي.",
      sources: []
    };
  }

  try {
    const model = 'gemini-3-flash-preview';
    const response = await ai.models.generateContent({
      model,
      contents: `بصفتك مساعدًا إسلاميًا ذكيًا في تطبيق "فَذَكِّر"، أجب عن السؤال التالي بإيجاز مع الدليل: ${query}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web?.uri)
      .filter((uri: string) => uri) || [];

    return { text, sources };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { 
      text: "حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقًا.", 
      sources: [] 
    };
  }
};
