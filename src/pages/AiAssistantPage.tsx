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
    const [apiKey, setApiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');
    const [showKeyInput, setShowKeyInput] = useState(!localStorage.getItem('GEMINI_API_KEY'));

    const handleSaveKey = () => {
        if (apiKey.trim()) {
            localStorage.setItem('GEMINI_API_KEY', apiKey.trim());
            setShowKeyInput(false);
            window.location.reload(); // Reload to initialize Gemini with new key
        }
    };

    const handleSend = useCallback(async (query: string) => {
        if (!query.trim() || isThinking) return;

        const userMessage: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        setIsThinking(true);
        setError(null);

        try {
            const aiResponse = await chatWithGemini(query);
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
            handleSend(state.autoQuery);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, handleSend]);

    const onManualSend = () => {
        if (!input.trim()) return;
        handleSend(input);
        setInput('');
    };

    return (
        <div className="ai-page container animate-fade">
            <div className="page-header mb-3 d-flex align-items-center justify-content-between">
                <div>
                    <h2>{t.ai.title}</h2>
                    <p className="text-secondary">{t.ai.sub}</p>
                </div>
                <button className="btn btn-icon btn-ghost" onClick={() => setShowKeyInput(!showKeyInput)}>
                    <span className="material-symbols-outlined">settings</span>
                </button>
            </div>

            {showKeyInput && (
                <div className="api-key-config glass-card mb-3 animate-slide-down">
                    <h4>Gemini API 설정</h4>
                    <p className="text-small text-secondary">
                        이 기능은 Google Gemini Pro를 사용합니다.
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"> AI Studio</a>에서
                        발급받은 API 키를 입력하세요.
                    </p>
                    <div className="d-flex gap-2">
                        <input
                            type="password"
                            className="input-field"
                            placeholder="AI Studio API Key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={handleSaveKey}>저장</button>
                    </div>
                </div>
            )}

            <div className="ai-chat-container glass-card">
                <div className="chat-history">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            <span className="material-symbols-outlined large-icon">temp_preferences_custom</span>
                            <p>{t.ai.noContext}</p>
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
                        disabled={isThinking || !input.trim() || !localStorage.getItem('GEMINI_API_KEY')}
                    >
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
