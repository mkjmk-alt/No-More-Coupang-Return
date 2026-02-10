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

    const model = genAI.getGenerativeModel({ model: "gemini-3.0-flash-preview" });

    // Combine grounding documents into context
    const context = GROUNDING_DOCUMENTS.map(doc => `[파일 이름: ${doc.title}]\n${doc.content}`).join("\n\n");

    const prompt = `
당신은 'No-More-Coupang-Return'의 **비공개 지식 베이스(Internal Knowledge Base) 관리자**입니다.
아래 제공된 **비공개 내부 문서**들을 기반으로 사용자의 질문에 정확하고 전문적인 답변을 제공하세요.

**작동 지침:**
1. 모든 답변의 시작 부분에 [내부 지식 검색 결과] 라고 머리말을 붙이세요.
2. 반드시 제공된 [비공개 내부 문서 리스트]의 내용만을 근거로 답변하세요.
3. 문서에 답변할 내용이 없다면 "죄송합니다. 요청하신 정보는 현재 비공개 내부 문서에 포함되어 있지 않습니다."라고 답변하세요.
4. 답변의 마지막 줄에는 반드시 정보를 가져온 [파일 이름]을 명시하세요. 예: (출처: 쿠팡 반품 정책)

[비공개 내부 문서 리스트]
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
