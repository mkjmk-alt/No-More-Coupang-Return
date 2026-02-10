import { GoogleGenerativeAI } from "@google/generative-ai";
import { GROUNDING_DOCUMENTS } from "../data/knowledge";

// It's recommended to use an environment variable (VITE_GEMINI_API_KEY)
// For this app, we'll try to get it from localStorage if not in env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY') || "";

export const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function chatWithGemini(userMessage: string) {
    if (!genAI) {
        throw new Error("Gemini API Key가 설정되지 않았습니다. 설정에서 API 키를 등록해주세요.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Combine grounding documents into context
    const context = GROUNDING_DOCUMENTS.map(doc => `--- ${doc.title} ---\n${doc.content}`).join("\n\n");

    const prompt = `
당신은 'No-More-Coupang-Return' 앱의 바코드 분석 전문가입니다.
아래 제공된 [Grounding Data]를 기반으로 사용자의 질문에 답변하세요.
데이터에 없는 내용이라면 일반적인 지식을 바탕으로 답변하되, 가급적 앱의 목적(바코드 복원 및 반품 안내)에 맞게 답변하세요.

[Grounding Data]
${context}

사용자 질문: ${userMessage}
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
}
