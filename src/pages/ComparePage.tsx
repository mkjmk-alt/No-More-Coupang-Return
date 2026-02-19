import { useState, useRef, useCallback, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { generateBarcode } from '../utils/barcodeGenerator';
import type { BarcodeType } from '../utils/barcodeGenerator';
import { WhitespaceInspector } from '../components/WhitespaceInspector';
import { useTranslation } from '../utils/LanguageContext';
import './ComparePage.css';

type ProcessingStatus = 'idle' | 'uploading' | 'recognizing' | 'generating' | 'complete' | 'error';
type CompareMode = 'side-by-side' | 'overlay';

interface ImageDimensions {
    width: number;
    height: number;
}

interface RecognitionResult {
    text: string;
    confidence: number;
    source: 'barcode' | 'ocr';
    format?: string;
    success: boolean;
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
const MAX_OCR_SIZE = 1600;

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

const preprocessImageForOCR = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                let enhanced = ((gray - 128) * 1.5) + 128;
                enhanced = Math.max(0, Math.min(255, enhanced));
                const binary = enhanced > 128 ? 255 : 0;
                data[i] = binary;
                data[i + 1] = binary;
                data[i + 2] = binary;
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

// Strip ALL invisible/whitespace characters for clean barcode text
const stripInvisibleChars = (text: string): string => {
    // Remove all Unicode whitespace, zero-width characters, control characters
    return text.replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0\u2000-\u200A\u202F\u205F\u3000\r\n\t]/g, '');
};

// Barcode scanning with ZXing
const scanBarcodeFromImage = async (imageDataUrl: string): Promise<RecognitionResult> => {
    try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
            BarcodeFormat.ITF, BarcodeFormat.CODABAR
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        const result = await reader.decodeFromImageUrl(imageDataUrl);

        if (result) {
            const text = stripInvisibleChars(result.getText());
            const formatCode = result.getBarcodeFormat();
            const formatMap: Record<number, string> = {
                [BarcodeFormat.CODE_128]: 'CODE_128',
                [BarcodeFormat.CODE_39]: 'CODE_39',
                [BarcodeFormat.EAN_13]: 'EAN_13',
                [BarcodeFormat.EAN_8]: 'EAN_8',
                [BarcodeFormat.UPC_A]: 'UPC_A',
                [BarcodeFormat.UPC_E]: 'UPC_E',
                [BarcodeFormat.ITF]: 'ITF',
                [BarcodeFormat.CODABAR]: 'CODABAR'
            };
            return {
                text,
                confidence: 100,
                source: 'barcode',
                format: formatMap[formatCode] || 'UNKNOWN',
                success: true
            };
        }
    } catch {
        // ZXing failed, try native if available
    }

    // Try native BarcodeDetector
    if ('BarcodeDetector' in window) {
        try {
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = imageDataUrl;
            });
            const bitmap = await createImageBitmap(img);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const detector = new (window as any).BarcodeDetector({
                formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar']
            });
            const barcodes = await detector.detect(bitmap);
            if (barcodes.length > 0) {
                return {
                    text: stripInvisibleChars(barcodes[0].rawValue),
                    confidence: 100,
                    source: 'barcode',
                    format: barcodes[0].format?.toUpperCase() || 'DETECTED',
                    success: true
                };
            }
        } catch {
            // Native failed too
        }
    }

    return { text: '', confidence: 0, source: 'barcode', success: false };
};

export function ComparePage() {
    const { t } = useTranslation();
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

    // Dual recognition results
    const [barcodeResult, setBarcodeResult] = useState<RecognitionResult | null>(null);
    const [ocrResult, setOcrResult] = useState<RecognitionResult | null>(null);
    const [selectedSource, setSelectedSource] = useState<'barcode' | 'ocr' | null>(null);
    const [pendingDisplayImage, setPendingDisplayImage] = useState<string | null>(null);
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
        const result = bestMatch || cleaned.replace(/[\s\n]/g, '');
        return stripInvisibleChars(result);
    };

    const detectBarcodeType = (text: string): BarcodeType => {
        const cleaned = text.replace(/\s/g, '');
        if (/^\d{13}$/.test(cleaned)) return 'EAN13';
        if (/^\d{8}$/.test(cleaned)) return 'EAN8';
        if (/^\d+$/.test(cleaned) && cleaned.length % 2 === 0) return 'CODE128C';
        if (/[a-z]/.test(cleaned)) return 'CODE128B';
        return 'CODE128';
    };

    const formatToBarcodeType = (format: string | undefined): BarcodeType => {
        if (!format) return 'CODE128';
        const f = format.toUpperCase().replace('_', '');
        if (f.includes('EAN13') || f === 'EAN_13') return 'EAN13';
        if (f.includes('EAN8') || f === 'EAN_8') return 'EAN8';
        if (f.includes('CODE39') || f === 'CODE_39') return 'CODE39';
        if (f.includes('CODE128') || f === 'CODE_128') return 'CODE128';
        return 'CODE128';
    };

    const processImage = async (displayImageUrl: string, ocrImageUrl: string) => {
        setStatus('recognizing');
        setProgress(0);
        setError('');
        setBarcodeResult(null);
        setOcrResult(null);
        setSelectedSource(null);
        setResult(null);

        const originalDimensions = await getImageDimensions(displayImageUrl);
        setPendingDisplayImage(displayImageUrl);
        setPendingDimensions(originalDimensions);

        // Run barcode scan and OCR in parallel
        const barcodePromise = scanBarcodeFromImage(ocrImageUrl);
        const ocrPromise = (async (): Promise<RecognitionResult> => {
            try {
                const preprocessed = await preprocessImageForOCR(ocrImageUrl);
                const result = await Tesseract.recognize(
                    preprocessed,
                    'eng+kor',
                    {
                        logger: (m) => { if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)); },
                    }
                );
                const text = cleanBarcodeText(result.data.text);
                return {
                    text,
                    confidence: result.data.confidence,
                    source: 'ocr',
                    success: text.length > 0
                };
            } catch {
                return { text: '', confidence: 0, source: 'ocr', success: false };
            }
        })();

        const [barcodeRes, ocrRes] = await Promise.all([barcodePromise, ocrPromise]);
        setBarcodeResult(barcodeRes);
        setOcrResult(ocrRes);

        // Auto-select best result
        if (barcodeRes.success && ocrRes.success) {
            // Both succeeded — show selection UI
            // Default to barcode scan (more reliable for barcodes)
            setSelectedSource('barcode');
            setStatus('complete');
        } else if (barcodeRes.success) {
            await useRecognitionResult(barcodeRes, displayImageUrl, originalDimensions);
        } else if (ocrRes.success) {
            await useRecognitionResult(ocrRes, displayImageUrl, originalDimensions);
        } else {
            setStatus('error');
            setError('바코드와 텍스트 모두 인식할 수 없습니다. 더 선명한 이미지로 다시 시도해주세요.');
        }
    };

    const useRecognitionResult = async (
        recognition: RecognitionResult,
        displayImageUrl: string,
        originalDimensions: ImageDimensions
    ) => {
        const text = stripInvisibleChars(recognition.text);
        setManualText(text);

        const detectedType = recognition.source === 'barcode'
            ? formatToBarcodeType(recognition.format)
            : detectBarcodeType(text);

        setBarcodeType(detectedType);
        setRecommendedType(detectedType);
        setSelectedSource(recognition.source);

        setStatus('generating');
        try {
            const generatedBarcode = await generateBarcode(text, detectedType, {
                fontSize: 16, height: 80, margin: 10, lineColor: '#000000'
            });

            if (!generatedBarcode) throw new Error(t.compare.generating);

            const genDimensions = await getImageDimensions(generatedBarcode);
            setGeneratedDimensions(genDimensions);

            setResult({
                originalImage: displayImageUrl,
                originalDimensions,
                recognizedText: text,
                generatedBarcode,
                barcodeType: detectedType,
                confidence: recognition.confidence
            });
            setStatus('complete');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Processing failed.');
        }
    };

    const handleSelectResult = async (source: 'barcode' | 'ocr') => {
        const recognition = source === 'barcode' ? barcodeResult : ocrResult;
        if (!recognition?.success || !pendingDisplayImage || !pendingDimensions) return;

        setSelectedSource(source);
        await useRecognitionResult(recognition, pendingDisplayImage, pendingDimensions);
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const rawDataUrl = ev.target?.result as string;
                const [displayImage, ocrImage] = await Promise.all([
                    resizeImageTo(rawDataUrl, MAX_DISPLAY_SIZE),
                    resizeImageTo(rawDataUrl, MAX_OCR_SIZE, 0.92),
                ]);
                processImage(displayImage, ocrImage);
            };
            reader.readAsDataURL(file);
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
        setBarcodeResult(null);
        setOcrResult(null);
        setSelectedSource(null);
        setPendingDisplayImage(null);
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

    const renderRecognitionCard = (
        recognition: RecognitionResult | null,
        source: 'barcode' | 'ocr',
        label: string,
        icon: string
    ) => {
        const isSelected = selectedSource === source;
        return (
            <div
                className={`recognition-card ${isSelected ? 'selected' : ''} ${recognition?.success ? 'success' : 'failed'}`}
                onClick={() => recognition?.success && handleSelectResult(source)}
                style={{ cursor: recognition?.success ? 'pointer' : 'default' }}
            >
                <div className="recognition-card-header">
                    <span className="recognition-card-icon">{icon}</span>
                    <span className="recognition-card-label">{label}</span>
                    {recognition?.success ? (
                        <span className="recognition-status success">✓ {t.compare.scanSuccess}</span>
                    ) : (
                        <span className="recognition-status failed">✗ {t.compare.scanFail}</span>
                    )}
                </div>
                {recognition?.success ? (
                    <div className="recognition-card-body">
                        <code className="recognition-text">{recognition.text}</code>
                        {recognition.format && (
                            <span className="recognition-format">{t.compare.format}: {recognition.format}</span>
                        )}
                        {recognition.confidence > 0 && (
                            <span className="recognition-confidence">
                                {recognition.confidence.toFixed(1)}% {t.compare.confidence}
                            </span>
                        )}
                        <button
                            className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm mt-1`}
                            style={{ width: 'auto' }}
                            onClick={(e) => { e.stopPropagation(); handleSelectResult(source); }}
                        >
                            {isSelected ? `✓ ${t.compare.selected}` : t.compare.useThis}
                        </button>
                    </div>
                ) : (
                    <div className="recognition-card-body">
                        <p className="text-muted" style={{ fontSize: '13px' }}>
                            {source === 'barcode' ? '바코드를 인식할 수 없습니다.' : 'OCR로 텍스트를 인식할 수 없습니다.'}
                        </p>
                    </div>
                )}
            </div>
        );
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

            {(status === 'recognizing' || status === 'generating') && (
                <section className="section glass-card">
                    <div className="processing-status">
                        <div className="spinner"></div>
                        <p className="status-text">{status === 'recognizing' ? `${t.compare.analyzing} ${progress}%` : t.compare.generating}</p>
                    </div>
                </section>
            )}

            {status === 'error' && (
                <section className="section glass-card">
                    <div className="error-msg mb-2">⚠️ {error}</div>
                    <button className="btn btn-primary" onClick={handleReset}>{t.generate.btnGenerate}</button>
                </section>
            )}

            {status === 'complete' && (barcodeResult || ocrResult) && (
                <>
                    {/* Dual Recognition Results */}
                    {barcodeResult && ocrResult && (barcodeResult.success || ocrResult.success) && (
                        <section className="section glass-card">
                            <h3 className="section-title">
                                <span className="material-symbols-outlined">compare_arrows</span>
                                {t.compare.dualTitle}
                            </h3>
                            <div className="recognition-cards">
                                {renderRecognitionCard(barcodeResult, 'barcode', t.compare.barcodeScan, '📊')}
                                {renderRecognitionCard(ocrResult, 'ocr', t.compare.ocrScan, '🔤')}
                            </div>
                        </section>
                    )}

                    {/* Result section after selection */}
                    {result && (
                        <>
                            <section className="section glass-card">
                                <h3 className="section-title">{t.compare.resultTitle}</h3>
                                <div className="recognition-info">
                                    <div className="info-item">
                                        <span className="info-label">{t.compare.labelResult}</span>
                                        <input type="text" className="input-field" value={manualText} onChange={(e) => setManualText(e.target.value)} />
                                        <span className={`confidence-badge ${result.confidence > 80 ? 'high' : result.confidence > 50 ? 'medium' : 'low'}`}>
                                            {result.confidence.toFixed(1)}% {t.compare.confidence}
                                        </span>
                                        <WhitespaceInspector text={manualText} />
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">{t.compare.labelFormat}</span>
                                        <select className="input-field" value={barcodeType} onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}>
                                            {BARCODE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        {recommendedType && (
                                            <div className="recommendation-badge">
                                                ✨ {t.compare.recommended}: <strong>{BARCODE_TYPES.find(t => t.value === recommendedType)?.label}</strong>
                                            </div>
                                        )}
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
                        </>
                    )}

                    <button className="btn btn-primary mt-2" onClick={handleReset}>{t.compare.uploadNew}</button>
                </>
            )}
        </div>
    );
}
