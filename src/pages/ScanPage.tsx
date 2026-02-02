import { useState, useRef, useEffect } from 'react';
import { createScanner, scanImageFile } from '../utils/barcodeScanner';
import { addScanToHistory } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../utils/LanguageContext';
import './ScanPage.css';

export function ScanPage() {
    const { t } = useTranslation();
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState('');
    const scannerRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    const startScanner = async () => {
        setIsScanning(true);
        setError('');

        setTimeout(async () => {
            try {
                scannerRef.current = createScanner('scanner-container');
                if (scannerRef.current) {
                    await scannerRef.current.start(
                        (result: any) => {
                            addScanToHistory(result.text, result.format);
                            navigate('/test');
                        },
                        (err: string) => {
                            setError(err);
                            setIsScanning(false);
                        }
                    );
                }
            } catch (e) {
                setError(t.scan.errorPermission);
                setIsScanning(false);
            }
        }, 100);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const response = await scanImageFile(file);
        if (response.success && response.result) {
            addScanToHistory(response.result.text, response.result.format);
            navigate('/test');
        } else {
            setError(t.scan.errorRecognition);
        }
    };

    useEffect(() => {
        startScanner();
        return () => {
            if (scannerRef.current) scannerRef.current.stop();
        };
    }, []);

    return (
        <div className="scan-page animate-fade">
            <div className="scan-overlay">
                <div className="scan-frame">
                    <div className="scan-corner top-left"></div>
                    <div className="scan-corner top-right"></div>
                    <div className="scan-corner bottom-left"></div>
                    <div className="scan-corner bottom-right"></div>
                    <div className="scan-line"></div>
                </div>

                <div className="scan-tip">
                    <p>{t.scan.tip}</p>
                </div>
            </div>

            <div id="scanner-container" className="scanner-viewport">
                {!isScanning && !error && <div className="scanner-status">{t.scan.initializing}</div>}
                {error && <div className="scanner-status error">{error}</div>}
            </div>

            <div className="scan-footer container">
                <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                    <span className="material-symbols-outlined">image</span>
                    {t.scan.btnUpload}
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleImageUpload}
                />
            </div>
        </div>
    );
}
