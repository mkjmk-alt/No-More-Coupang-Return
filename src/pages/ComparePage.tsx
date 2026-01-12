import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { generateBarcode } from '../utils/barcodeGenerator';
import type { BarcodeType } from '../utils/barcodeGenerator';
import './ComparePage.css';

type ProcessingStatus = 'idle' | 'uploading' | 'recognizing' | 'generating' | 'complete' | 'error';
type CompareMode = 'side-by-side' | 'overlay';

interface CompareResult {
    originalImage: string;
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

export function ComparePage() {
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [result, setResult] = useState<CompareResult | null>(null);
    const [error, setError] = useState('');
    const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
    const [manualText, setManualText] = useState('');
    const [progress, setProgress] = useState(0);

    // Compare mode states
    const [compareMode, setCompareMode] = useState<CompareMode>('side-by-side');
    const [overlayOpacity, setOverlayOpacity] = useState(50);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // Clean up recognized text - extract only barcode content
    const cleanBarcodeText = (text: string): string => {
        // Remove whitespace and common OCR artifacts
        let cleaned = text.trim();

        // Try to extract just numbers/alphanumeric sequences
        // Barcode text is usually a continuous string without spaces
        const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Find the line that looks most like a barcode (longest alphanumeric sequence)
        let bestMatch = '';
        for (const line of lines) {
            // Remove spaces and special characters that might be OCR errors
            const cleanLine = line.replace(/[\s\-\.]/g, '');
            // Check if it's alphanumeric
            if (/^[A-Za-z0-9]+$/.test(cleanLine) && cleanLine.length > bestMatch.length) {
                bestMatch = cleanLine;
            }
        }

        return bestMatch || cleaned.replace(/[\s\n]/g, '');
    };

    // Auto-detect barcode type based on content
    const detectBarcodeType = (text: string): BarcodeType => {
        const cleaned = text.replace(/\s/g, '');

        // EAN-13: exactly 13 digits
        if (/^\d{13}$/.test(cleaned)) {
            return 'EAN13';
        }
        // EAN-8: exactly 8 digits
        if (/^\d{8}$/.test(cleaned)) {
            return 'EAN8';
        }
        // Numbers only - suggest CODE128C
        if (/^\d+$/.test(cleaned) && cleaned.length % 2 === 0) {
            return 'CODE128C';
        }
        // Uppercase only with special chars - suggest CODE128A
        if (/^[A-Z0-9\s\!\"\#\$\%\&\'\(\)\*\+\,\-\.\/\:\;\<\=\>\?\@\[\\\]\^\_]+$/.test(cleaned)) {
            return 'CODE128A';
        }
        // Mixed case - suggest CODE128B
        if (/[a-z]/.test(cleaned)) {
            return 'CODE128B';
        }

        return 'CODE128';
    };

    const processImage = async (imageDataUrl: string) => {
        setStatus('recognizing');
        setStatusMessage('바코드 텍스트 인식 중...');
        setProgress(0);
        setError('');

        try {
            // Perform OCR
            const ocrResult = await Tesseract.recognize(
                imageDataUrl,
                'eng+kor', // Support both English and Korean
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

            // Auto-detect barcode type
            const detectedType = detectBarcodeType(recognizedText);
            setBarcodeType(detectedType);

            // Generate barcode
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

            setResult({
                originalImage: imageDataUrl,
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
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
                                        <img src={result.generatedBarcode} alt="Generated barcode" />
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
                                        <img src={result.generatedBarcode} alt="Generated barcode" />
                                    </div>
                                </div>

                                <div className="overlay-legend">
                                    <div className="legend-item">
                                        <span className="legend-color original"></span>
                                        <span>원본: 완전히 보임 (0%)</span>
                                    </div>
                                    <div className="legend-item">
                                        <span className="legend-color generated"></span>
                                        <span>생성: 완전히 보임 (100%)</span>
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
                        <li><strong>"겹쳐서" 모드</strong>: 슬라이더로 투명도를 조절하여 차이를 확인하세요</li>
                        <li>바코드 타입이 자동으로 감지되지만, 필요시 수동으로 변경할 수 있습니다</li>
                        <li>EAN-13/EAN-8은 정확한 자릿수(13자리/8자리)가 필요합니다</li>
                    </ul>
                </details>
            </div>
        </div>
    );
}

