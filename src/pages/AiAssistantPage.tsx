import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../utils/LanguageContext';
import { chatWithGemini } from '../utils/gemini';
import './AiAssistantPage.css';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function AiAssistantPage() {
    const { t } = useTranslation();
    const location = useLocation();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<'로켓배송' | 'Rocket_Growth' | 'all'>('all');

    const handleSend = useCallback(async (query: string, category: '로켓배송' | 'Rocket_Growth' | 'all' = 'all') => {
        if (!query.trim() || isThinking) return;

        const userMessage: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        setIsThinking(true);
        setError(null);

        try {
            const aiResponse = await chatWithGemini(query, category);
            setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
        } catch (err: any) {
            console.error('Gemini call failed:', err);
            const errorMessage = err.message.includes("API Key")
                ? t.ai.apiKeyRequired
                : t.ai.connectionError;
            setError(errorMessage);
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + errorMessage }]);
        } finally {
            setIsThinking(false);
        }
    }, [isThinking, t.ai.apiKeyRequired, t.ai.connectionError]);

    // Handle initial auto-query from ScanPage
    useEffect(() => {
        const state = location.state as { autoQuery?: string };
        if (state?.autoQuery) {
            handleSend(state.autoQuery, selectedCategory);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, handleSend, selectedCategory]);

    const onManualSend = () => {
        if (!input.trim()) return;
        handleSend(input, selectedCategory);
        setInput('');
    };

    return (
        <div className="ai-page container animate-fade">
            <div className="page-header mb-3">
                <h2>{t.ai.title} (KB v2.0)</h2>
                <p className="text-secondary">보안된 내부 지식 베이스를 기반으로 답변합니다.</p>
            </div>

            <div className="category-selection d-flex gap-2 mb-3">
                <button
                    className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSelectedCategory('all')}
                >
                    전체
                </button>
                <button
                    className={`btn btn-sm ${selectedCategory === '로켓배송' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSelectedCategory('로켓배송')}
                >
                    로켓배송
                </button>
                <button
                    className={`btn btn-sm ${selectedCategory === 'Rocket_Growth' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSelectedCategory('Rocket_Growth')}
                >
                    Rocket_Growth
                </button>
            </div>

            <div className="ai-chat-container glass-card">
                <div className="chat-history">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            <span className="material-symbols-outlined large-icon">encrypted</span>
                            <p>내부 보안 문서가 로드되었습니다.<br />질문을 입력하면 지식 베이스를 검색합니다.</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`chat-message ${msg.role}`}>
                                <div className="message-bubble">
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}
                    {isThinking && (
                        <div className="chat-message assistant thinking">
                            <div className="message-bubble">
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                                {t.ai.thinking}
                            </div>
                        </div>
                    )}
                    {error && <div className="chat-error">{error}</div>}
                </div>

                <div className="chat-input-area">
                    <input
                        type="text"
                        className="input-field"
                        placeholder={t.ai.inputPlaceholder}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && onManualSend()}
                    />
                    <button
                        className="btn btn-primary btn-icon"
                        onClick={onManualSend}
                        disabled={isThinking || !input.trim()}
                    >
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
