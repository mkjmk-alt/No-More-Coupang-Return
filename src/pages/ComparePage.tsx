import { useState, useRef, useCallback, useEffect } from 'react';
import { generateBarcode } from '../utils/barcodeGenerator';
import type { BarcodeType } from '../utils/barcodeGenerator';
import { WhitespaceInspector } from '../components/WhitespaceInspector';
import { useTranslation } from '../utils/LanguageContext';
import './ComparePage.css';

type ProcessingStatus = 'idle' | 'input' | 'generating' | 'complete' | 'error';
type CompareMode = 'side-by-side' | 'overlay';

interface ImageDimensions {
    width: number;
    height: number;
}

interface CompareResult {
    originalImage: string;
    originalDimensions: ImageDimensions;
    recognizedText: string;
    generatedBarcode: string;
    barcodeType: BarcodeType;
}

const BARCODE_TYPES: { value: BarcodeType; label: string }[] = [
    { value: 'CODE128', label: 'Code128' },
    { value: 'CODE128A', label: 'Code128-A' },
    { value: 'CODE128B', label: 'Code128-B' },
    { value: 'CODE128C', label: 'Code128-C' },
    { value: 'EAN13', label: 'EAN-13' },
    { value: 'EAN8', label: 'EAN-8' },
    { value: 'CODE39', label: 'Code39' }
];

const getImageDimensions = (dataUrl: string): Promise<ImageDimensions> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { resolve({ width: img.width, height: img.height }); };
        img.onerror = () => { resolve({ width: 300, height: 100 }); };
        img.src = dataUrl;
    });
};

const MAX_DISPLAY_SIZE = 800;

const resizeImageTo = (dataUrl: string, maxSize: number, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const { width, height } = img;
            if (width <= maxSize && height <= maxSize) {
                resolve(dataUrl);
                return;
            }
            const scale = Math.min(maxSize / width, maxSize / height);
            const newWidth = Math.round(width * scale);
            const newHeight = Math.round(height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

// Strip ALL invisible/whitespace characters
const stripInvisibleChars = (text: string): string => {
    return text.replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0\u2000-\u200A\u202F\u205F\u3000\r\n\t]/g, '');
};

export function ComparePage() {
    const { t } = useTranslation();
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [result, setResult] = useState<CompareResult | null>(null);
    const [error, setError] = useState('');
    const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
    const [manualText, setManualText] = useState('');

    const [compareMode, setCompareMode] = useState<CompareMode>('side-by-side');
    const [overlayOpacity, setOverlayOpacity] = useState(50);
    const [sizeScale, setSizeScale] = useState(100);
    const [generatedDimensions, setGeneratedDimensions] = useState<ImageDimensions | null>(null);

    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    // Pending image (uploaded but not yet compared)
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [pendingDimensions, setPendingDimensions] = useState<ImageDimensions | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (result?.generatedBarcode) {
            getImageDimensions(result.generatedBarcode).then(setGeneratedDimensions);
        }
    }, [result?.generatedBarcode]);

    const handleAutoFit = useCallback(() => {
        if (result?.originalDimensions && generatedDimensions) {
            const scaleByWidth = (result.originalDimensions.width / generatedDimensions.width) * 100;
            setSizeScale(Math.max(50, Math.min(200, Math.round(scaleByWidth))));
        }
    }, [result?.originalDimensions, generatedDimensions]);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const rawDataUrl = ev.target?.result as string;
                const displayImage = await resizeImageTo(rawDataUrl, MAX_DISPLAY_SIZE);
                const dimensions = await getImageDimensions(displayImage);
                setPendingImage(displayImage);
                setPendingDimensions(dimensions);
                setStatus('input');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        const cleanText = stripInvisibleChars(manualText.trim());
        if (!cleanText || !pendingImage || !pendingDimensions) return;

        setStatus('generating');
        setError('');
        try {
            const generatedBarcode = await generateBarcode(cleanText, barcodeType, {
                fontSize: 16, height: 80, margin: 10, lineColor: '#000000'
            });
            if (!generatedBarcode) throw new Error(t.compare.generating);
            const genDimensions = await getImageDimensions(generatedBarcode);
            setGeneratedDimensions(genDimensions);
            setResult({
                originalImage: pendingImage,
                originalDimensions: pendingDimensions,
                recognizedText: cleanText,
                generatedBarcode,
                barcodeType
            });
            setManualText(cleanText);
            setStatus('complete');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Processing failed.');
        }
    };

    const handleManualRegenerate = async () => {
        if (!manualText.trim() || !result) return;
        setStatus('generating');
        try {
            const cleanText = stripInvisibleChars(manualText.trim());
            const generatedBarcode = await generateBarcode(cleanText, barcodeType, {
                fontSize: 16, height: 80, margin: 10, lineColor: '#000000'
            });
            if (!generatedBarcode) throw new Error('Failed to regenerate.');
            const genDimensions = await getImageDimensions(generatedBarcode);
            setGeneratedDimensions(genDimensions);
            setResult({ ...result, recognizedText: cleanText, generatedBarcode, barcodeType });
            setManualText(cleanText);
            setStatus('complete');
        } catch (err) {
            setError('Failed to regenerate barcode.');
            setStatus('error');
        }
    };

    const handleReset = () => {
        setStatus('idle');
        setResult(null);
        setError('');
        setManualText('');
        setPendingImage(null);
        setPendingDimensions(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getScaledStyle = () => {
        if (!generatedDimensions) return {};
        return {
            width: `${(generatedDimensions.width * sizeScale) / 100}px`,
            maxWidth: 'none',
            transform: `translate(${offsetX}px, ${offsetY}px)`,
            transition: 'transform 0.1s ease-out'
        };
    };

    return (
        <div className="compare-page container animate-fade">
            <div className="page-header mb-3">
                <h2>{t.compare.title}</h2>
                <p className="text-secondary">{t.compare.sub}</p>
            </div>

            {status === 'idle' && (
                <section className="section glass-card">
                    <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
                        <div className="drop-zone-icon">📷</div>
                        <p className="drop-zone-text">{t.compare.dropZoneText}</p>
                        <p className="drop-zone-hint">{t.compare.dropZoneHint}</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInputChange} style={{ display: 'none' }} />
                </section>
            )}

            {status === 'input' && pendingImage && (
                <section className="section glass-card">
                    <h3 className="section-title">
                        <span className="material-symbols-outlined">image</span> {t.compare.original}
                    </h3>
                    <div className="image-wrapper mb-2">
                        <img src={pendingImage} alt="Uploaded" />
                    </div>

                    <div className="recognition-info">
                        <div className="info-item">
                            <span className="info-label">{t.compare.labelResult}</span>
                            <input
                                type="text"
                                className="input-field"
                                value={manualText}
                                onChange={(e) => setManualText(e.target.value)}
                                placeholder="바코드 아래 숫자를 직접 입력하세요"
                            />
                            <WhitespaceInspector text={manualText} />
                        </div>
                        <div className="info-item">
                            <span className="info-label">{t.compare.labelFormat}</span>
                            <select className="input-field" value={barcodeType} onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}>
                                {BARCODE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <button
                            className="btn btn-primary mt-1"
                            onClick={handleGenerate}
                            disabled={!manualText.trim()}
                        >
                            <span className="material-symbols-outlined">compare_arrows</span> 바코드 생성 & 비교
                        </button>
                        <button className="btn btn-secondary mt-1" onClick={handleReset}>
                            취소
                        </button>
                    </div>
                </section>
            )}

            {status === 'generating' && (
                <section className="section glass-card">
                    <div className="processing-status">
                        <div className="spinner"></div>
                        <p className="status-text">{t.compare.generating}</p>
                    </div>
                </section>
            )}

            {status === 'error' && (
                <section className="section glass-card">
                    <div className="error-msg mb-2">⚠️ {error}</div>
                    <button className="btn btn-primary" onClick={handleReset}>{t.compare.uploadNew}</button>
                </section>
            )}

            {status === 'complete' && result && (
                <>
                    <section className="section glass-card">
                        <h3 className="section-title">{t.compare.resultTitle}</h3>
                        <div className="recognition-info">
                            <div className="info-item">
                                <span className="info-label">{t.compare.labelResult}</span>
                                <input type="text" className="input-field" value={manualText} onChange={(e) => setManualText(e.target.value)} />
                                <WhitespaceInspector text={manualText} />
                            </div>
                            <div className="info-item">
                                <span className="info-label">{t.compare.labelFormat}</span>
                                <select className="input-field" value={barcodeType} onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}>
                                    {BARCODE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <button className="btn btn-secondary mt-1" onClick={handleManualRegenerate}>
                                <span className="material-symbols-outlined">refresh</span> {t.compare.btnRegenerate}
                            </button>
                        </div>
                    </section>

                    <section className="section glass-card comparison-section">
                        <div className="comparison-header">
                            <h3 className="section-title">{t.compare.compareTitle}</h3>
                            <div className="compare-mode-toggle">
                                <button className={`mode-btn ${compareMode === 'side-by-side' ? 'active' : ''}`} onClick={() => setCompareMode('side-by-side')}>{t.compare.modeSide}</button>
                                <button className={`mode-btn ${compareMode === 'overlay' ? 'active' : ''}`} onClick={() => setCompareMode('overlay')}>{t.compare.modeOverlay}</button>
                            </div>
                        </div>

                        <div className="size-controls">
                            <div className="size-control-row">
                                <span className="size-label">{t.compare.scale}: {sizeScale}%</span>
                                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={handleAutoFit}>{t.compare.autoFit}</button>
                            </div>
                            <input type="range" className="input-field" value={sizeScale} onChange={(e) => setSizeScale(Number(e.target.value))} min={50} max={200} />

                            <div className="position-controls mt-2">
                                <span className="size-label">{t.compare.microAdjust} (X:{offsetX}, Y:{offsetY})</span>
                                <div className="pos-btn-grid">
                                    <div className="pos-row">
                                        <button className="pos-btn" onClick={() => setOffsetY(v => v - 1)}>↑</button>
                                    </div>
                                    <div className="pos-row">
                                        <button className="pos-btn" onClick={() => setOffsetX(v => v - 1)}>←</button>
                                        <button className="pos-btn" style={{ fontWeight: 800 }} onClick={() => { setOffsetX(0); setOffsetY(0); }}>◎</button>
                                        <button className="pos-btn" onClick={() => setOffsetX(v => v + 1)}>→</button>
                                    </div>
                                    <div className="pos-row">
                                        <button className="pos-btn" onClick={() => setOffsetY(v => v + 1)}>↓</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {compareMode === 'side-by-side' ? (
                            <div className="comparison-container">
                                <div className="comparison-item">
                                    <h4><span className="material-symbols-outlined">image</span> {t.compare.original}</h4>
                                    <div className="image-wrapper"><img src={result.originalImage} alt="Original" /></div>
                                </div>
                                <div className="comparison-item">
                                    <h4><span className="material-symbols-outlined">barcode</span> {t.compare.generated}</h4>
                                    <div className="image-wrapper"><img src={result.generatedBarcode} alt="Generated" style={getScaledStyle()} /></div>
                                    <p className="barcode-text">{result.recognizedText}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="overlay-container">
                                <div className="overlay-wrapper">
                                    <div className="overlay-layer original"><img src={result.originalImage} alt="Original" /></div>
                                    <div className="overlay-layer generated" style={{ opacity: overlayOpacity / 100 }}>
                                        <img src={result.generatedBarcode} alt="Generated" style={getScaledStyle()} />
                                    </div>
                                </div>
                                <div className="mt-2 w-full" style={{ width: '100%' }}>
                                    <p className="text-center text-muted mb-1">{t.compare.opacity}: {overlayOpacity}%</p>
                                    <input type="range" className="input-field" value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))} min={0} max={100} />
                                </div>
                                <p className="barcode-text">{result.recognizedText}</p>
                            </div>
                        )}
                    </section>

                    <button className="btn btn-primary mt-2" onClick={handleReset}>{t.compare.uploadNew}</button>
                </>
            )}
        </div>
    );
}
