import { GoogleGenerativeAI } from "@google/generative-ai";
import { GROUNDING_DOCUMENTS } from "../data/knowledge";

// It's recommended to use an environment variable (VITE_GEMINI_API_KEY)
// For this app, we'll try to get it from localStorage if not in env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY') || "";

export const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function chatWithGemini(userMessage: string, category: '로켓배송' | 'Rocket_Growth' | 'all' = 'all') {
    if (!genAI) {
        throw new Error("Gemini API Key가 설정되지 않았습니다. 설정에서 API 키를 등록해주세요.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Mapping titles to requested display names
    const titleMapping: Record<string, string> = {
        "Coupang_Corp_Supplier_Inbound_Manual_KR_Ver.3.06.pdf": "로켓배송",
        "coupang_rocket_growth_inbound_guide.pdf": "Rocket_Growth"
    };

    // Filter and combine grounding documents into context
    const context = GROUNDING_DOCUMENTS
        .filter(doc => category === 'all' || titleMapping[doc.title] === category)
        .map(doc => `[지식 범주: ${titleMapping[doc.title] || doc.title}]\n${doc.content}`)
        .join("\n\n");

    const prompt = `
당신은 'No-More-Coupang-Return' 프로젝트의 **폐쇄형 보안 지식 베이스(Closed-loop KB) 엔진**입니다.
현재 선택된 지식 범주는 **${category === 'all' ? '전체' : category}**입니다.

### **절대 규칙 (우선 순위 1순위):**
1. **내부 지능 제약:** 당신은 제공된 [비공개 내부 문서 리스트]의 내용 **외의** 정보는 전혀 알지 못하는 상태로 행동하십시오. 외부 지식(날씨, 역사, 일반 상식 등)은 모두 "데이터베이스 접근 권한 없음"으로 처리하십시오.
2. **답변 근거:** 모든 문장은 내부 문서의 구문을 인용하거나 요약해야 합니다.
3. **거절 프로토콜:** 문서에 없는 질문이나 외부 지식을 요구하는 경우, 다음 문구로만 답변을 시작하십시오: "죄송합니다. 보안 지침에 따라 요청하신 정보는 내부 데이터베이스에서 찾을 수 없습니다."
4. **출처 명시 금지:** 답변 끝에 파일명이나 출처를 적지 마십시오. 오직 본문 답변만 제공하십시오.

### **답변 스타일:**
- 기계적이고 명령어 중심적인 완결형 문장을 사용하십시오.
- 불필요한 친절함이나 사적인 대화를 지양하십시오.

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
