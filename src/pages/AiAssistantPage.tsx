import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../utils/LanguageContext';
import './AiAssistantPage.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function AiAssistantPage() {
    const { t } = useTranslation();
    const location = useLocation();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSend = useCallback(async (query: string) => {
        if (!query.trim() || isThinking) return;

        const userMessage: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        setIsThinking(true);
        setError(null);

        try {
            // This assumes the NotebookLM MCP server is running locally on port 8001
            // with HTTP transport enabled:
            // uv run notebooklm-mcp --config notebooklm-config.json server --transport http --port 8001
            const response = await fetch('http://localhost:8001/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method: 'tools/call',
                    params: {
                        name: 'chat_with_notebook',
                        arguments: {
                            message: query
                        }
                    }
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message || 'AI request failed');
            }

            // The MCP result structure depends on the tool output
            const aiContent = data.result?.content?.[0]?.text || 'No response from AI.';

            setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
        } catch (err) {
            console.error('AI call failed:', err);
            setError(t.ai.connectionError);
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + t.ai.connectionError }]);
        } finally {
            setIsThinking(false);
        }
    }, [isThinking, t.ai.connectionError]);

    // Handle initial auto-query from ScanPage
    useEffect(() => {
        const state = location.state as { autoQuery?: string };
        if (state?.autoQuery) {
            handleSend(state.autoQuery);
            // Clear state to prevent re-triggering on refresh
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
            <div className="page-header mb-3">
                <h2>{t.ai.title}</h2>
                <p className="text-secondary">{t.ai.sub}</p>
            </div>

            <div className="ai-chat-container glass-card">
                <div className="chat-history">
                    {messages.length === 0 ? (
                        <div className="chat-empty">
                            <span className="material-symbols-outlined large-icon">smart_toy</span>
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
                        disabled={isThinking || !input.trim()}
                    >
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </div>
            </div>

            <section className="section info-card mt-3">
                <h4>💡 Tip</h4>
                <p className="text-small">
                    이 기능은 로컬에서 실행 중인 **NotebookLM MCP 서버**와 통신합니다.
                    사용하시려면 먼저 서버를 HTTP 모드로 실행해 주세요:
                </p>
                <code>uv run notebooklm-mcp --config notebooklm-config.json server --transport http --port 8001</code>
            </section>
        </div>
    );
}
