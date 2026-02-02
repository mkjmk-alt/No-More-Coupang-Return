import { useEffect, useState } from 'react';
import { getScanHistory } from '../utils/helpers';
import type { ScanHistoryItem } from '../utils/helpers';
import './RecentHistory.css';

interface RecentHistoryProps {
    onSelect: (item: ScanHistoryItem) => void;
    refreshTrigger?: number;
}

export function RecentHistory({ onSelect, refreshTrigger }: RecentHistoryProps) {
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);

    useEffect(() => {
        setHistory(getScanHistory().slice(0, 5));
    }, [refreshTrigger]);

    if (history.length === 0) return null;

    return (
        <div className="history-section">
            <h3 className="section-title">SCAN HISTORY</h3>
            <div className="history-stack">
                {history.map((item, idx) => (
                    <div key={idx} className="history-card-neo" onClick={() => onSelect(item)}>
                        <div className="history-info-neo">
                            <div className="history-line">
                                <span className="label-neo">BARCODE:</span>
                                <span className="value-neo">{item.value}</span>
                                <span className="badge-neo">DETECTED</span>
                            </div>
                            <div className="history-line">
                                <span className="label-neo">Item Name:</span>
                                <span className="value-neo">Raw Energy Bar</span>
                            </div>
                            <div className="history-line">
                                <span className="label-neo">Date:</span>
                                <span className="value-neo">
                                    {new Date(item.timestamp).toLocaleDateString('en-GB', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined arrow">chevron_right</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
