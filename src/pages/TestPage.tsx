import { useState, useEffect } from 'react';
import { getScanHistory, clearScanHistory } from '../utils/helpers';
import type { ScanHistoryItem } from '../utils/helpers';
import './TestPage.css';

export function TestPage() {
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);

    useEffect(() => {
        setHistory(getScanHistory());
    }, []);

    const handleClear = () => {
        if (window.confirm('Delete all scan records?')) {
            clearScanHistory();
            setHistory([]);
        }
    };

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        alert('Copied to clipboard');
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
                <h2>Activity History</h2>
                {history.length > 0 && (
                    <button className="clear-link" onClick={handleClear}>Clear all</button>
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
                                <p className="history-value">{item.value}</p>
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
                        <h3>No activity found</h3>
                        <p className="text-muted">Scanned and generated items will appear here.</p>
                        <button className="btn btn-primary mt-3" onClick={() => window.location.href = '/'}>
                            Get Started
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
