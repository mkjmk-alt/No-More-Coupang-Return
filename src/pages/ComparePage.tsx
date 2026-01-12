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

// Get image dimensions from data URL
const getImageDimensions = (dataUrl: string): Promise<ImageDimensions> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
            resolve({ width: 300, height: 100 }); // Default fallback
        };
        img.src = dataUrl;
    });
};

export function ComparePage() {
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [result, setResult] = useState<CompareResult | null>(null);
    const [error, setError] = useState('');
    const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
    const [manualText, setManualText] = useState('');
    const [progress, setProgress] = useState(0);

    // Compare mode and size adjustment states
    const [compareMode, setCompareMode] = useState<CompareMode>('side-by-side');
    const [overlayOpacity, setOverlayOpacity] = useState(50);
    const [sizeScale, setSizeScale] = useState(100); // Percentage scale for generated barcode
    const [generatedDimensions, setGeneratedDimensions] = useState<ImageDimensions | null>(null);

    // Position offset for overlay comparison
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // Update generated barcode dimensions when result changes
    useEffect(() => {
        if (result?.generatedBarcode) {
            getImageDimensions(result.generatedBarcode).then(setGeneratedDimensions);
        }
    }, [result?.generatedBarcode]);

    // Auto-calculate optimal scale based on original image dimensions
    const calculateOptimalScale = useCallback((original: ImageDimensions, generated: ImageDimensions): number => {
        // Calculate scale to match widths
        const scaleByWidth = (original.width / generated.width) * 100;
        // Clamp between 50% and 200%
        return Math.max(50, Math.min(200, Math.round(scaleByWidth)));
    }, []);

    // Apply auto-fit when dimensions are available
    const handleAutoFit = useCallback(() => {
        if (result?.originalDimensions && generatedDimensions) {
            const optimalScale = calculateOptimalScale(result.originalDimensions, generatedDimensions);
            setSizeScale(optimalScale);
        }
    }, [result?.originalDimensions, generatedDimensions, calculateOptimalScale]);

    // Clean up recognized text - extract only barcode content
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

    // Auto-detect barcode type based on content
    const detectBarcodeType = (text: string): BarcodeType => {
        const cleaned = text.replace(/\s/g, '');

        if (/^\d{13}$/.test(cleaned)) return 'EAN13';
        if (/^\d{8}$/.test(cleaned)) return 'EAN8';
        if (/^\d+$/.test(cleaned) && cleaned.length % 2 === 0) return 'CODE128C';
        if (/^[A-Z0-9\s\!\"\#\$\%\&\'\(\)\*\+\,\-\.\/\:\;\<\=\>\?\@\[\\\]\^\_]+$/.test(cleaned)) return 'CODE128A';
        if (/[a-z]/.test(cleaned)) return 'CODE128B';

        return 'CODE128';
    };

    const processImage = async (imageDataUrl: string) => {
        setStatus('recognizing');
        setStatusMessage('바코드 텍스트 인식 중...');
        setProgress(0);
        setError('');

        try {
            // Get original image dimensions
            const originalDimensions = await getImageDimensions(imageDataUrl);

            // Perform OCR
            const ocrResult = await Tesseract.recognize(
                imageDataUrl,
                'eng+kor',
                {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            setProgress(Math.round(m.progress * 100));
                        }
                    }
                }
            );

            const rawText = ocrResult.data.text;
            const confidence = ocrResult.data.confidence;
            const recognizedText = cleanBarcodeText(rawText);

            if (!recognizedText) {
                throw new Error('텍스트를 인식할 수 없습니다. 바코드 아래의 숫자/문자가 선명하게 보이는지 확인해주세요.');
            }

            setManualText(recognizedText);

            const detectedType = detectBarcodeType(recognizedText);
            setBarcodeType(detectedType);

            setStatus('generating');
            setStatusMessage('바코드 생성 중...');

            const generatedBarcode = await generateBarcode(recognizedText, detectedType, {
                fontSize: 16,
                height: 80,
                margin: 10
            });

            if (!generatedBarcode) {
                throw new Error('바코드 생성에 실패했습니다. 인식된 텍스트가 선택한 바코드 형식에 맞지 않을 수 있습니다.');
            }

            // Get generated barcode dimensions for auto-fit
            const genDimensions = await getImageDimensions(generatedBarcode);
            setGeneratedDimensions(genDimensions);

            // Calculate and set optimal scale
            const optimalScale = calculateOptimalScale(originalDimensions, genDimensions);
            setSizeScale(optimalScale);

            setResult({
                originalImage: imageDataUrl,
                originalDimensions,
                recognizedText,
                generatedBarcode,
                barcodeType: detectedType,
                confidence
            });

            setStatus('complete');
            setStatusMessage('완료!');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
        }
    };

    const handleFileSelect = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('이미지 파일만 업로드할 수 있습니다.');
            return;
        }

        setStatus('uploading');
        setStatusMessage('이미지 로드 중...');

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            processImage(dataUrl);
        };
        reader.onerror = () => {
            setError('파일을 읽는 중 오류가 발생했습니다.');
            setStatus('error');
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('dragover');

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.add('dragover');
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('dragover');
    }, []);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleManualRegenerate = async () => {
        if (!manualText.trim() || !result) return;

        setStatus('generating');
        setStatusMessage('바코드 재생성 중...');

        try {
            const generatedBarcode = await generateBarcode(manualText.trim(), barcodeType, {
                fontSize: 16,
                height: 80,
                margin: 10
            });

            if (!generatedBarcode) {
                throw new Error('바코드 생성에 실패했습니다.');
            }

            const genDimensions = await getImageDimensions(generatedBarcode);
            setGeneratedDimensions(genDimensions);

            const optimalScale = calculateOptimalScale(result.originalDimensions, genDimensions);
            setSizeScale(optimalScale);

            setResult({
                ...result,
                recognizedText: manualText.trim(),
                generatedBarcode,
                barcodeType
            });

            setStatus('complete');
        } catch (err) {
            setError(err instanceof Error ? err.message : '바코드 생성 중 오류가 발생했습니다.');
            setStatus('error');
        }
    };

    const handleReset = () => {
        setStatus('idle');
        setResult(null);
        setError('');
        setManualText('');
        setProgress(0);
        setSizeScale(100);
        setGeneratedDimensions(null);
        setOffsetX(0);
        setOffsetY(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Calculate scaled dimensions and position
    const getScaledStyle = () => {
        if (!generatedDimensions) return {};
        return {
            width: `${(generatedDimensions.width * sizeScale) / 100}px`,
            maxWidth: 'none', // Remove maxWidth to allow movement
            transform: `translate(${offsetX}px, ${offsetY}px)`,
            transition: 'transform 0.1s ease-out'
        };
    };

    return (
        <div className="compare-page container">
            <div className="page-header">
                <h2>🔍 바코드 비교</h2>
                <p className="text-secondary">
                    바코드 이미지를 업로드하면 텍스트를 인식하여 새 바코드를 생성하고 비교합니다
                </p>
            </div>

            {status === 'idle' && (
                <section className="section glass-card">
                    <h3 className="section-title">이미지 업로드</h3>

                    <div
                        ref={dropZoneRef}
                        className="drop-zone"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="drop-zone-icon">📷</div>
                        <p className="drop-zone-text">
                            바코드 이미지를 여기에 드래그하거나<br />
                            클릭하여 파일을 선택하세요
                        </p>
                        <p className="drop-zone-hint">
                            바코드 아래의 숫자/문자가 선명하게 보이는 이미지를 사용하세요
                        </p>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        style={{ display: 'none' }}
                    />
                </section>
            )}

            {(status === 'uploading' || status === 'recognizing' || status === 'generating') && (
                <section className="section glass-card">
                    <div className="processing-status">
                        <div className="spinner"></div>
                        <p className="status-text">{statusMessage}</p>
                        {status === 'recognizing' && (
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {status === 'error' && (
                <section className="section glass-card">
                    <div className="alert alert-error">
                        <strong>⚠️ 오류</strong>
                        <p>{error}</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleReset}>
                        다시 시도
                    </button>
                </section>
            )}

            {status === 'complete' && result && (
                <>
                    <section className="section glass-card">
                        <h3 className="section-title">인식 결과</h3>

                        <div className="recognition-info">
                            <div className="info-item">
                                <span className="info-label">인식된 텍스트:</span>
                                <input
                                    type="text"
                                    className="input"
                                    value={manualText}
                                    onChange={(e) => setManualText(e.target.value)}
                                    placeholder="인식된 텍스트"
                                />
                            </div>
                            <div className="info-item">
                                <span className="info-label">인식 신뢰도:</span>
                                <span className={`confidence-badge ${result.confidence > 80 ? 'high' : result.confidence > 50 ? 'medium' : 'low'}`}>
                                    {result.confidence.toFixed(1)}%
                                </span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">바코드 타입:</span>
                                <select
                                    className="select"
                                    value={barcodeType}
                                    onChange={(e) => setBarcodeType(e.target.value as BarcodeType)}
                                >
                                    {BARCODE_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>
                            <button className="btn btn-outline" onClick={handleManualRegenerate}>
                                🔄 재생성
                            </button>
                        </div>
                    </section>

                    <section className="section glass-card comparison-section">
                        <div className="comparison-header">
                            <h3 className="section-title">비교</h3>
                            <div className="compare-mode-toggle">
                                <button
                                    className={`mode-btn ${compareMode === 'side-by-side' ? 'active' : ''}`}
                                    onClick={() => setCompareMode('side-by-side')}
                                >
                                    ↔️ 나란히
                                </button>
                                <button
                                    className={`mode-btn ${compareMode === 'overlay' ? 'active' : ''}`}
                                    onClick={() => setCompareMode('overlay')}
                                >
                                    🔀 겹쳐서
                                </button>
                            </div>
                        </div>

                        {/* Size and Position adjustment controls */}
                        <div className="size-controls">
                            <div className="size-control-row">
                                <span className="size-label">생성 바코드 크기: {sizeScale}%</span>
                                <button className="btn btn-sm btn-outline" onClick={handleAutoFit}>
                                    📐 자동 맞춤
                                </button>
                            </div>
                            <input
                                type="range"
                                className="size-slider"
                                value={sizeScale}
                                onChange={(e) => setSizeScale(Number(e.target.value))}
                                min={50}
                                max={200}
                            />

                            <div className="position-controls">
                                <span className="size-label">위치 미세 조절 (X: {offsetX}px, Y: {offsetY}px)</span>
                                <div className="pos-btn-grid">
                                    <div className="pos-row">
                                        <button className="btn btn-sm btn-outline pos-btn" title="위로" onClick={() => setOffsetY(prev => prev - 1)}>↑</button>
                                    </div>
                                    <div className="pos-row">
                                        <button className="btn btn-sm btn-outline pos-btn" title="왼쪽으로" onClick={() => setOffsetX(prev => prev - 1)}>←</button>
                                        <button className="btn btn-sm btn-outline pos-btn reset-pos" title="위치 초기화" onClick={() => { setOffsetX(0); setOffsetY(0); }}>◎</button>
                                        <button className="btn btn-sm btn-outline pos-btn" title="오른쪽으로" onClick={() => setOffsetX(prev => prev + 1)}>→</button>
                                    </div>
                                    <div className="pos-row">
                                        <button className="btn btn-sm btn-outline pos-btn" title="아래로" onClick={() => setOffsetY(prev => prev + 1)}>↓</button>
                                    </div>
                                </div>
                            </div>

                            <div className="size-info">
                                <span>원본: {result.originalDimensions.width}×{result.originalDimensions.height}px</span>
                                {generatedDimensions && (
                                    <span>생성: {Math.round(generatedDimensions.width * sizeScale / 100)}×{Math.round(generatedDimensions.height * sizeScale / 100)}px</span>
                                )}
                            </div>
                        </div>

                        {compareMode === 'side-by-side' ? (
                            <div className="comparison-container">
                                <div className="comparison-item">
                                    <h4>📷 원본 이미지</h4>
                                    <div className="image-wrapper">
                                        <img src={result.originalImage} alt="Original barcode" />
                                    </div>
                                </div>

                                <div className="comparison-divider">
                                    <span className="vs-badge">VS</span>
                                </div>

                                <div className="comparison-item">
                                    <h4>🔄 생성된 바코드</h4>
                                    <div className="image-wrapper generated">
                                        <img
                                            src={result.generatedBarcode}
                                            alt="Generated barcode"
                                            style={getScaledStyle()}
                                        />
                                    </div>
                                    <p className="barcode-text">{result.recognizedText}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="overlay-container">
                                <div className="overlay-controls">
                                    <span className="overlay-label">📷 원본</span>
                                    <input
                                        type="range"
                                        className="overlay-slider"
                                        value={overlayOpacity}
                                        onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                                        min={0}
                                        max={100}
                                    />
                                    <span className="overlay-label">🔄 생성</span>
                                </div>
                                <p className="overlay-hint">
                                    슬라이더를 조절하여 두 바코드를 비교하세요 (투명도: {overlayOpacity}%)
                                </p>

                                <div className="overlay-wrapper">
                                    <div className="overlay-layer original">
                                        <img src={result.originalImage} alt="Original barcode" />
                                    </div>
                                    <div
                                        className="overlay-layer generated"
                                        style={{ opacity: overlayOpacity / 100 }}
                                    >
                                        <img
                                            src={result.generatedBarcode}
                                            alt="Generated barcode"
                                            style={getScaledStyle()}
                                        />
                                    </div>
                                </div>

                                <p className="barcode-text">{result.recognizedText}</p>
                            </div>
                        )}
                    </section>

                    <div className="action-buttons">
                        <button className="btn btn-primary" onClick={handleReset}>
                            새 이미지 업로드
                        </button>
                    </div>
                </>
            )}

            <div className="tips-section">
                <details>
                    <summary>💡 사용 팁</summary>
                    <ul>
                        <li>바코드 아래의 숫자/문자가 선명하게 보이는 이미지를 사용하세요</li>
                        <li>텍스트가 잘못 인식된 경우 직접 수정 후 "재생성" 버튼을 클릭하세요</li>
                        <li><strong>"📐 자동 맞춤"</strong> 버튼으로 원본과 비슷한 크기로 자동 조절</li>
                        <li><strong>"🔀 겹쳐서"</strong> 모드에서 투명도 슬라이더로 차이 확인</li>
                        <li>슬라이더로 생성된 바코드 크기를 수동 미세 조절 가능</li>
                    </ul>
                </details>
            </div>
        </div>
    );
}

