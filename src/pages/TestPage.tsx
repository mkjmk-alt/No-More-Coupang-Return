import { useState, useEffect } from 'react';
import { getScanHistory, clearScanHistory } from '../utils/helpers';
import type { ScanHistoryItem } from '../utils/helpers';
import { useTranslation } from '../utils/LanguageContext';
import { WhitespaceInspector } from '../components/WhitespaceInspector';
import './TestPage.css';

export function TestPage() {
    const { t } = useTranslation();
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);

    useEffect(() => {
        setHistory(getScanHistory());
    }, []);

    const handleClear = () => {
        if (window.confirm(t.history.clearConfirm)) {
            clearScanHistory();
            setHistory([]);
        }
    };

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        alert(t.generate.copied);
    };

    const formatDate = (timestamp: number) => {
        const d = new Date(timestamp);
        return d.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="test-page container animate-fade">
            <div className="history-page-header">
                <h2>{t.history.title}</h2>
                {history.length > 0 && (
                    <button className="clear-link" onClick={handleClear}>{t.history.clearAll}</button>
                )}
            </div>

            <div className="history-list mt-3">
                {history.map((item) => (
                    <div key={item.id} className="history-card card mb-2">
                        <div className="history-card-top">
                            <div className="type-icon-box">
                                <span className="material-symbols-outlined">
                                    {item.type === 'QR' ? 'qr_code_2' : 'barcode'}
                                </span>
                            </div>
                            <div className="history-main-info">
                                <WhitespaceInspector text={item.value} />
                                <p className="history-sub">{item.type} • {formatDate(item.timestamp)}</p>
                            </div>
                        </div>
                        <div className="history-card-actions mt-2">
                            <button className="mini-btn" onClick={() => copyToClipboard(item.value)}>
                                <span className="material-symbols-outlined">content_copy</span>
                            </button>
                        </div>
                    </div>
                ))}

                {history.length === 0 && (
                    <div className="empty-state">
                        <span className="material-symbols-outlined emoji">history</span>
                        <h3>{t.history.noRecords}</h3>
                        <p className="text-muted">{t.history.getStarted}</p>
                        <button className="btn btn-primary mt-3" onClick={() => window.location.href = '/'}>
                            {t.history.getStarted}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
