import { getScanHistory, clearScanHistory } from '../utils/helpers';
import type { ScanHistoryItem } from '../utils/helpers';
import { useState, useEffect } from 'react';
import './RecentHistory.css';

interface RecentHistoryProps {
    onSelect?: (item: ScanHistoryItem) => void;
    refreshTrigger?: number;
}

export function RecentHistory({ onSelect, refreshTrigger }: RecentHistoryProps) {
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);

    useEffect(() => {
        setHistory(getScanHistory());
    }, [refreshTrigger]);

    const handleClear = () => {
        clearScanHistory();
        setHistory([]);
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        return date.toLocaleDateString('ko-KR');
    };

    return (
        <section className="recent-history">
            <div className="section-header">
                <h3 className="section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    최근 기록
                </h3>
                {history.length > 0 && (
                    <button className="btn-clear" onClick={handleClear}>
                        전체 삭제
                    </button>
                )}
            </div>

            {history.length === 0 ? (
                <div className="empty-state">
                    <p>아직 스캔 기록이 없습니다.</p>
                </div>
            ) : (
                <div className="history-list">
                    {history.map((item) => (
                        <div
                            key={item.id}
                            className="history-item"
                            onClick={() => onSelect?.(item)}
                        >
                            <div className="history-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <line x1="7" y1="8" x2="17" y2="8" />
                                    <line x1="7" y1="12" x2="17" y2="12" />
                                    <line x1="7" y1="16" x2="13" y2="16" />
                                </svg>
                            </div>
                            <div className="history-content">
                                <span className="history-value">{item.value}</span>
                                <span className="history-meta">
                                    <span className="history-type">{item.type}</span>
                                    <span className="history-time">{formatTime(item.timestamp)}</span>
                                </span>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="history-arrow">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
