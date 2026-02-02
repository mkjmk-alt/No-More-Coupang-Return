import { useState, useEffect } from 'react';
import {
    generateBarcode,
    generateQRCode,
    downloadImage,
} from '../utils/barcodeGenerator';
import type { BarcodeType } from '../utils/barcodeGenerator';
import {
    getScanHistory,
    addScanToHistory,
} from '../utils/helpers';
import type { ScanHistoryItem } from '../utils/helpers';
import './GeneratePage.css';

const BARCODE_TYPES: { value: BarcodeType; label: string }[] = [
    { value: 'CODE128', label: 'CODE 128' },
    { value: 'QR', label: 'QR CODE' },
    { value: 'EAN13', label: 'EAN 13' },
    { value: 'EAN8', label: 'EAN 8' },
];

export function GeneratePage() {
    const [inputText, setInputText] = useState('');
    const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
    const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        setHistory(getScanHistory());
    }, []);

    const handleGenerate = async () => {
        if (!inputText.trim()) {
            setError('Please enter some text');
            return;
        }

        setError('');
        let img: string | null = null;

        try {
            if (barcodeType === 'QR') {
                img = await generateQRCode(inputText, { width: 300, margin: 2 });
            } else {
                img = await generateBarcode(inputText, barcodeType, { fontSize: 20 });
            }

            if (img) {
                setBarcodeImage(img);
                addScanToHistory(inputText, barcodeType);
                setHistory(getScanHistory());
            } else {
                setError('Failed to generate. Check your input.');
            }
        } catch (e) {
            setError('Invalid characters for this format');
        }
    };

    const handleDownload = () => {
        if (barcodeImage) {
            downloadImage(barcodeImage, `barcode_${inputText}.png`);
        }
    };

    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(inputText);
        alert('Copied to clipboard');
    }

    return (
        <div className="generate-page container animate-fade">
            <section className="hero-section">
                <h2>Create something new</h2>
                <p className="text-muted">Enter a value to generate a professional barcode or QR code instantly.</p>
            </section>

            <div className="main-creation-card mt-3">
                <div className="input-with-label">
                    <input
                        type="text"
                        className="input-field"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="e.g. 123456789"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                </div>

                <div className="type-chips-wrapper mt-2">
                    {BARCODE_TYPES.map(type => (
                        <button
                            key={type.value}
                            className={`type-chip-modern ${barcodeType === type.value ? 'active' : ''}`}
                            onClick={() => setBarcodeType(type.value)}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>

                <button className="btn btn-primary mt-3" onClick={handleGenerate}>
                    <span className="material-symbols-outlined">add</span>
                    Generate Barcode
                </button>
                {error && <p className="error-msg mt-1">{error}</p>}
            </div>

            {barcodeImage && (
                <div className="result-preview-card mt-3 card animate-fade">
                    <div className="preview-image-box">
                        <img src={barcodeImage} alt="Generated result" />
                    </div>
                    <div className="preview-meta">
                        <span className="type-badge">{barcodeType}</span>
                        <h3 className="preview-val">{inputText}</h3>
                    </div>
                    <div className="preview-actions">
                        <button className="btn btn-secondary" onClick={copyToClipboard}>
                            <span className="material-symbols-outlined">content_copy</span>
                            Copy
                        </button>
                        <button className="btn btn-primary" onClick={handleDownload}>
                            <span className="material-symbols-outlined">download</span>
                            Save
                        </button>
                    </div>
                </div>
            )}

            <section className="quick-history-section mt-3">
                <div className="section-header">
                    <h3>Recent Creations</h3>
                    <button className="text-btn" onClick={() => window.location.href = '/test'}>View All</button>
                </div>

                <div className="minimal-history-list mt-2">
                    {history.slice(0, 3).map(item => (
                        <div key={item.id} className="minimal-history-item" onClick={() => setInputText(item.value)}>
                            <div className="item-left">
                                <span className="material-symbols-outlined">
                                    {item.type === 'QR' ? 'qr_code_2' : 'barcode'}
                                </span>
                                <div>
                                    <p className="item-val">{item.value}</p>
                                    <p className="item-meta">{item.type}</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined arrow">chevron_right</span>
                        </div>
                    ))}
                    {history.length === 0 && (
                        <p className="empty-text text-center mt-3 text-muted">No history yet.</p>
                    )}
                </div>
            </section>
        </div>
    );
}
