import { useState, useRef, useCallback, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { generateBarcode } from '../utils/barcodeGenerator';
import type { BarcodeType } from '../utils/barcodeGenerator';
import './ComparePage.css';

type ProcessingStatus = 'idle' | 'uploading' | 'recognizing' | 'generating' | 'complete' | 'error';
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
    confidence: number;
}

const BARCODE_TYPES: { value: BarcodeType; label: string }[] = [
    { value: 'CODE128', label: 'Code128 (자동)' },
    { value: 'CODE128A', label: 'Code128-A' },
    { value: 'CODE128B', label: 'Code128-B' },
    { value: 'CODE128C', label: 'Code128-C (숫자)' },
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

export function ComparePage() {
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [result, setResult] = useState<CompareResult | null>(null);
    const [error, setError] = useState('');
    const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
    const [manualText, setManualText] = useState('');
    const [progress, setProgress] = useState(0);

    const [compareMode, setCompareMode] = useState<CompareMode>('side-by-side');
    const [overlayOpacity, setOverlayOpacity] = useState(50);
    const [sizeScale, setSizeScale] = useState(100);
    const [generatedDimensions, setGeneratedDimensions] = useState<ImageDimensions | null>(null);
    const [recommendedType, setRecommendedType] = useState<BarcodeType | null>(null);

    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

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

    const cleanBarcodeText = (text: string): string => {
        let cleaned = text.trim();
        const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let bestMatch = '';
        for (const line of lines) {
            const cleanLine = line.replace(/[\s\-\.]/g, '');
            if (/^[A-Za-z0-9]+$/.test(cleanLine) && cleanLine.length > bestMatch.length) {
                bestMatch = cleanLine;
            }
        }
        return bestMatch || cleaned.replace(/[\s\n]/g, '');
    };

    const detectBarcodeType = (text: string): BarcodeType => {
        const cleaned = text.replace(/\s/g, '');
        if (/^\d{13}$/.test(cleaned)) return 'EAN13';
        if (/^\d{8}$/.test(cleaned)) return 'EAN8';
        if (/^\d+$/.test(cleaned) && cleaned.length % 2 === 0) return 'CODE128C';
        if (/[a-z]/.test(cleaned)) return 'CODE128B';
        return 'CODE128';
    };

    const processImage = async (imageDataUrl: string) => {
        setStatus('recognizing');
        setProgress(0);
        setError('');

        try {
            const originalDimensions = await getImageDimensions(imageDataUrl);
            const ocrResult = await Tesseract.recognize(
                imageDataUrl,
                'eng+kor',
                { logger: (m) => { if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)); } }
            );

            const recognizedText = cleanBarcodeText(ocrResult.data.text);
            if (!recognizedText) throw new Error('Could not recognize text. Please use a clearer image.');

            setManualText(recognizedText);
            const detectedType = detectBarcodeType(recognizedText);
            setBarcodeType(detectedType);
            setRecommendedType(detectedType);

            setStatus('generating');
            const generatedBarcode = await generateBarcode(recognizedText, detectedType, {
                fontSize: 16, height: 80, margin: 10, lineColor: '#000000'
            });

            if (!generatedBarcode) throw new Error('Failed to generate comparison barcode.');

            const genDimensions = await getImageDimensions(generatedBarcode);
            setGeneratedDimensions(genDimensions);

            setResult({
                originalImage: imageDataUrl,
                originalDimensions,
                recognizedText,
                generatedBarcode,
                barcodeType: detectedType,
                confidence: ocrResult.data.confidence
            });
            setStatus('complete');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Processing failed.');
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => processImage(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleManualRegenerate = async () => {
        if (!manualText.trim() || !result) return;
        setStatus('generating');
        try {
            const generatedBarcode = await generateBarcode(manualText.trim(), barcodeType, {
                fontSize: 16, height: 80, margin: 10, lineColor: '#000000'
            });
            if (!generatedBarcode) throw new Error('Failed to regenerate.');
            const genDimensions = await getImageDimensions(generatedBarcode);
            setGeneratedDimensions(genDimensions);
            setResult({ ...result, recognizedText: manualText.trim(), generatedBarcode, barcodeType });
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
                <h2>Barcode Comparison</h2>
                <p className="text-secondary">Upload an image to recognize text and compare with a fresh barcode.</p>
            </div>

            {status === 'idle' && (
                <section className="section glass-card">
                    <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
                        <div className="drop-zone-icon">📷</div>
                        <p className="drop-zone-text">Click to upload original barcode</p>
                        <p className="drop-zone-hint">Clear images work best for recognition</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInputChange} style={{ display: 'none' }} />
                </section>
            )}

            {(status === 'recognizing' || status === 'generating') && (
                <section className="section glass-card">
                    <div className="processing-status">
                        <div className="spinner"></div>
                        <p className="status-text">{status === 'recognizing' ? `Recognizing... ${progress}%` : 'Generating...'}</p>
                    </div>
                </section>
            )}

            {status === 'error' && (
                <section className="section glass-card">
                    <div className="error-msg mb-2">⚠️ {error}</div>
                    <button className="btn btn-primary" onClick={handleReset}>Try Again</button>
                </section>
            )}

            {status === 'complete' && result && (
                <>
                    <section className="section glass-card">
                        <h3 className="section-title">Recognition Result</h3>
                        <div className="recognition-info">
                            <div className="info-item">
                                <span className="info-label">Recognized Text</span>
                                <input type="text" className="input-field" value={manualText} onChange={(e) => setManualText(e.target.value)} />
                                <span className={`confidence-badge ${result.confidence > 80 ? 'high' : result.confidence > 50 ? 'medium' : 'low'}`}>
                                    {result.confidence.toFixed(1)}% Confidence
                                </span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Barcode Format</span>
                                <select className="input-field" value={barcodeType} onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}>
                                    {BARCODE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                {recommendedType && (
                                    <div className="recommendation-badge">
                                        ✨ Recommended: <strong>{BARCODE_TYPES.find(t => t.value === recommendedType)?.label}</strong>
                                    </div>
                                )}
                            </div>
                            <button className="btn btn-secondary mt-1" onClick={handleManualRegenerate}>
                                <span className="material-symbols-outlined">refresh</span> Regenerate
                            </button>
                        </div>
                    </section>

                    <section className="section glass-card comparison-section">
                        <div className="comparison-header">
                            <h3 className="section-title">Comparison</h3>
                            <div className="compare-mode-toggle">
                                <button className={`mode-btn ${compareMode === 'side-by-side' ? 'active' : ''}`} onClick={() => setCompareMode('side-by-side')}>Side-by-Side</button>
                                <button className={`mode-btn ${compareMode === 'overlay' ? 'active' : ''}`} onClick={() => setCompareMode('overlay')}>Overlay</button>
                            </div>
                        </div>

                        <div className="size-controls">
                            <div className="size-control-row">
                                <span className="size-label">Scale: {sizeScale}%</span>
                                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={handleAutoFit}>Auto Fit</button>
                            </div>
                            <input type="range" className="input-field" value={sizeScale} onChange={(e) => setSizeScale(Number(e.target.value))} min={50} max={200} />

                            <div className="position-controls mt-2">
                                <span className="size-label">Micro-adjust (X:{offsetX}, Y:{offsetY})</span>
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
                                    <h4><span className="material-symbols-outlined">image</span> Original</h4>
                                    <div className="image-wrapper"><img src={result.originalImage} alt="Original" /></div>
                                </div>
                                <div className="comparison-item">
                                    <h4><span className="material-symbols-outlined">barcode</span> Generated</h4>
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
                                    <p className="text-center text-muted mb-1">Overlay Opacity: {overlayOpacity}%</p>
                                    <input type="range" className="input-field" value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))} min={0} max={100} />
                                </div>
                                <p className="barcode-text">{result.recognizedText}</p>
                            </div>
                        )}
                    </section>

                    <button className="btn btn-primary mt-2" onClick={handleReset}>Upload New Image</button>
                </>
            )}
        </div>
    );
}
