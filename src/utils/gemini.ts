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

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

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
당신은 쿠팡의 입고 규정 및 절차를 안내하는 **전문 AI 어시스턴트**입니다.
제공된 [참고 문서]를 철저히 분석하여 사용자의 질문에 가장 정확하고 도움이 되는 답변을 제공하는 것이 당신의 목표입니다.

### **핵심 지침:**
1. **문서 우선순위:** 답변의 모든 근거는 제공된 [참고 문서] 내의 규정, 수치, 절차에 기반해야 합니다. 문서에 명시된 구체적인 섹션(예: 4.3 박스 패키징)이나 기준(무게, 크기 등)이 있다면 이를 상세히 인용하십시오.
2. **지식 범주 활용:** 현재 선택된 카테고리(${category === 'all' ? '전체' : category})에 해당하는 문서 내용을 집중적으로 검토하십시오.
3. **정확한 정보 전달:** 쿠팡 입고는 규정 준수가 매우 중요하므로, 문서에 나온 수치(30kg 이하, 150cm 높이 권장 등)나 필수 사항을 누락 없이 전달하세요.
4. **친절한 가이드:** 정보는 정확해야 하지만, 말투는 정중하고 이해하기 쉽게 작성하십시오. 해결책을 단계별로 설명하거나 중요 포인트를 강조해 주면 더욱 좋습니다.
5. **문서 외 정보:** 만약 질문에 대한 답이 문서에 전혀 없다면, 무리하게 추측하기보다는 "제공된 문서에는 해당 내용이 명시되어 있지 않습니다"라고 안내한 뒤, 일반적인 상식을 언급할 때는 반드시 출처가 문서가 아님을 밝히십시오.

[현재 선택된 카테고리: ${category === 'all' ? '전체' : category}]

### **[참고 문서]**
${context}

---
**사용자 질문:** ${userMessage}
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
