import { useState, useRef, useEffect } from 'react';
import { createScanner, scanImageFile } from '../utils/barcodeScanner';
import { addScanToHistory } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../utils/LanguageContext';
import './ScanPage.css';

export function ScanPage() {
    const { t } = useTranslation();
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [maxZoom, setMaxZoom] = useState(5);
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

                    // Check for torch support
                    if (scannerRef.current.isTorchSupported) {
                        const supported = await scannerRef.current.isTorchSupported();
                        setHasTorch(supported);
                    }

                    // Check for zoom support and range
                    if (scannerRef.current.isZoomSupported) {
                        await scannerRef.current.isZoomSupported();

                        // Try to get actual hardware zoom range
                        try {
                            // @ts-ignore
                            const track = scannerRef.current.stream?.getVideoTracks()[0] || (scannerRef.current.html5QrCode?.getRunningTrack());
                            if (track) {
                                const capabilities = track.getCapabilities() as any;
                                if (capabilities.zoom) {
                                    setMaxZoom(capabilities.zoom.max);
                                }
                            }
                        } catch (e) {
                            // Default to 5 if range detection fails
                            setMaxZoom(5);
                        }
                    } else {
                        // Even if hardware zoom not supported, we use digital zoom CSS fallback
                        setMaxZoom(5);
                    }
                }
            } catch (e) {
                setError(t.scan.errorPermission);
                setIsScanning(false);
            }
        }, 100);
    };

    const toggleTorch = async () => {
        if (scannerRef.current && scannerRef.current.toggleTorch) {
            const newState = await scannerRef.current.toggleTorch();
            setTorchEnabled(newState);
        }
    };

    const handleZoom = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setZoomLevel(value);
        if (scannerRef.current && scannerRef.current.applyZoom) {
            await scannerRef.current.applyZoom(value);
        }
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
                <div className="scan-header container">
                    <button className="btn-icon-circular" onClick={() => navigate(-1)}>
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="header-actions">
                        {hasTorch && (
                            <button
                                className={`btn-icon-circular ${torchEnabled ? 'active' : ''}`}
                                onClick={toggleTorch}
                            >
                                <span className="material-symbols-outlined">
                                    {torchEnabled ? 'flashlight_on' : 'flashlight_off'}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="scan-frame-container">
                    <div className="scan-frame">
                        <div className="scan-corner top-left"></div>
                        <div className="scan-corner top-right"></div>
                        <div className="scan-corner bottom-left"></div>
                        <div className="scan-corner bottom-right"></div>
                        <div className="scan-line"></div>
                    </div>
                </div>

                <div className="scan-controls container">
                    <div className="zoom-slider-container">
                        <span className="material-symbols-outlined">zoom_out</span>
                        <input
                            type="range"
                            min="1"
                            max={maxZoom}
                            step="0.1"
                            value={zoomLevel}
                            onChange={handleZoom}
                            className="zoom-slider"
                        />
                        <span className="material-symbols-outlined">zoom_in</span>
                    </div>

                    <div className="scan-tip">
                        <p>{t.scan.tip}</p>
                    </div>
                </div>
            </div>

            <div id="scanner-container" className="scanner-viewport">
                {!isScanning && !error && <div className="scanner-status">{t.scan.initializing}</div>}
                {error && <div className="scanner-status error">{error}</div>}
            </div>

            <div className="scan-footer container">
                <button className="btn btn-secondary upload-btn" onClick={() => fileInputRef.current?.click()}>
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
