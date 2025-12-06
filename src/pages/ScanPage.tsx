import { useState, useRef, useCallback, useEffect } from 'react';
import { MainCard } from '../components/MainCard';
import { RecentHistory } from '../components/RecentHistory';
import { createScanner, scanImageFile } from '../utils/barcodeScanner';
import type { ScanResult, NativeBarcodeScanner, BarcodeScanner } from '../utils/barcodeScanner';
import { generateBarcode, createA4Sheet, downloadImage } from '../utils/barcodeGenerator';
import type { A4SheetOptions } from '../utils/barcodeGenerator';
import {
    highlightWhitespace,
    hasWhitespaceOrSpecial,
    removeWhitespaceSpecial,
    addScanToHistory
} from '../utils/helpers';
import type { ScanHistoryItem } from '../utils/helpers';
import './ScanPage.css';

export function ScanPage() {
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [normalizedResult, setNormalizedResult] = useState<string>('');
    const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
    const [normalizedBarcodeImage, setNormalizedBarcodeImage] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    const [historyRefresh, setHistoryRefresh] = useState(0);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);

    // A4 Sheet options
    const [showA4Options, setShowA4Options] = useState(false);
    const [productName, setProductName] = useState('');
    const [addExpiry, setAddExpiry] = useState(false);
    const [expiryText, setExpiryText] = useState('0000-00-00');
    const [labelFontSize, setLabelFontSize] = useState(30);
    const [expiryFontSize, setExpiryFontSize] = useState(20);
    const [barcodeFontSize] = useState(18);
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(4);
    const [hMargin, setHMargin] = useState(47);
    const [vMargin, setVMargin] = useState(18);
    const [maxLabelLines] = useState(2);
    const [lineSpacing] = useState(4);

    const scannerRef = useRef<NativeBarcodeScanner | BarcodeScanner | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleScanResult = useCallback(async (result: ScanResult) => {
        setScanResult(result);
        addScanToHistory(result.text, result.format);
        setHistoryRefresh(prev => prev + 1);

        // Stop scanning after successful scan
        if (scannerRef.current) {
            await scannerRef.current.stop();
            setIsScanning(false);
        }

        // Check for whitespace
        if (hasWhitespaceOrSpecial(result.text)) {
            const normalized = removeWhitespaceSpecial(result.text);
            setNormalizedResult(normalized);

            // Generate both barcodes for comparison
            const [originalImg, normalizedImg] = await Promise.all([
                generateBarcode(result.text, 'CODE128', { fontSize: barcodeFontSize }),
                generateBarcode(normalized, 'CODE128', { fontSize: barcodeFontSize })
            ]);

            setBarcodeImage(originalImg);
            setNormalizedBarcodeImage(normalizedImg);
        } else {
            setNormalizedResult(result.text);
            const img = await generateBarcode(result.text, 'CODE128', { fontSize: barcodeFontSize });
            setBarcodeImage(null);
            setNormalizedBarcodeImage(img);
        }
    }, [barcodeFontSize]);

    const startCameraScan = async () => {
        setError('');
        setScanResult(null);
        setBarcodeImage(null);
        setNormalizedBarcodeImage(null);
        setIsScanning(true);

        // Wait for the container to be rendered
        setTimeout(async () => {
            scannerRef.current = createScanner('scanner-container');
            await scannerRef.current.start(
                handleScanResult,
                (err) => {
                    setError(err);
                    setIsScanning(false);
                }
            );
        }, 100);
    };

    const stopCameraScan = async () => {
        if (scannerRef.current) {
            await scannerRef.current.stop();
            setIsScanning(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError('');
        setScanResult(null);
        setBarcodeImage(null);
        setNormalizedBarcodeImage(null);
        setUploadedImage(null);

        const response = await scanImageFile(file);

        // Always show the resized image
        setUploadedImage(response.resizedImageUrl);

        if (response.success && response.result) {
            handleScanResult(response.result);
        } else {
            setError('바코드 또는 QR코드를 인식하지 못했습니다. 다른 이미지를 시도해 보세요.');
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleHistorySelect = async (item: ScanHistoryItem) => {
        setScanResult({ text: item.value, format: item.type });

        if (hasWhitespaceOrSpecial(item.value)) {
            const normalized = removeWhitespaceSpecial(item.value);
            setNormalizedResult(normalized);

            const [originalImg, normalizedImg] = await Promise.all([
                generateBarcode(item.value, 'CODE128', { fontSize: barcodeFontSize }),
                generateBarcode(normalized, 'CODE128', { fontSize: barcodeFontSize })
            ]);

            setBarcodeImage(originalImg);
            setNormalizedBarcodeImage(normalizedImg);
        } else {
            setNormalizedResult(item.value);
            const img = await generateBarcode(item.value, 'CODE128', { fontSize: barcodeFontSize });
            setBarcodeImage(null);
            setNormalizedBarcodeImage(img);
        }
    };

    const handleDownloadBarcode = () => {
        if (normalizedBarcodeImage) {
            downloadImage(normalizedBarcodeImage, `barcode_${normalizedResult}.png`);
        }
    };

    const handleCreateA4Sheet = async () => {
        if (!normalizedBarcodeImage || !productName.trim()) {
            setError('상품명을 입력해주세요.');
            return;
        }

        const options: A4SheetOptions = {
            rows,
            cols,
            hMargin,
            vMargin,
            productName,
            labelFontSize,
            expiryFontSize,
            addExpiry,
            expiryText,
            maxLabelLines,
            lineSpacing
        };

        const sheetDataUrl = await createA4Sheet(normalizedBarcodeImage, options);
        if (sheetDataUrl) {
            downloadImage(sheetDataUrl, `barcode_sheet_${normalizedResult}_${rows}x${cols}.png`);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop();
            }
        };
    }, []);

    return (
        <div className="scan-page container">
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
            />

            {!isScanning && !scanResult && (
                <>
                    <MainCard
                        onCameraScan={startCameraScan}
                        onImageUpload={() => fileInputRef.current?.click()}
                    />
                    <RecentHistory
                        onSelect={handleHistorySelect}
                        refreshTrigger={historyRefresh}
                    />
                </>
            )}

            {isScanning && (
                <div className="scanner-section animate-fadeIn">
                    <div id="scanner-container" className="scanner-container"></div>
                    <button className="btn btn-outline mt-2" onClick={stopCameraScan}>
                        스캔 중지
                    </button>
                </div>
            )}

            {error && (
                <div className="error-section animate-fadeIn">
                    <div className="alert alert-error mb-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        {error}
                    </div>

                    {uploadedImage && (
                        <div className="card mt-2">
                            <div className="barcode-preview">
                                <label className="label">📷 업로드된 이미지 (리사이즈됨)</label>
                                <img src={uploadedImage} alt="Uploaded and resized" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                            </div>
                            <button
                                className="btn btn-primary mt-2"
                                onClick={() => {
                                    setError('');
                                    setUploadedImage(null);
                                }}
                            >
                                다시 시도
                            </button>
                        </div>
                    )}
                </div>
            )}

            {scanResult && (
                <div className="result-section animate-fadeIn">
                    <div className="result-header">
                        <h3>스캔 결과</h3>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                                setScanResult(null);
                                setBarcodeImage(null);
                                setNormalizedBarcodeImage(null);
                            }}
                        >
                            새 스캔
                        </button>
                    </div>

                    <div className="result-type">
                        <span className="badge">{scanResult.format}</span>
                    </div>

                    {hasWhitespaceOrSpecial(scanResult.text) && (
                        <div className="alert alert-warning mb-2">
                            ⚠️ 바코드 데이터에 공백, 줄바꿈, 탭 등이 포함되어 있습니다.
                        </div>
                    )}

                    <div className="result-content">
                        <label className="label">인식된 값 (하이라이트)</label>
                        <div
                            className="barcode-result"
                            dangerouslySetInnerHTML={{ __html: highlightWhitespace(scanResult.text) }}
                        />
                    </div>

                    <div className="result-content mt-2">
                        <label className="label">정규화된 값</label>
                        <div className="barcode-result">
                            <code>{normalizedResult}</code>
                        </div>
                    </div>

                    {uploadedImage && (
                        <div className="barcode-preview mt-2">
                            <label className="label">📷 업로드된 이미지 (리사이즈됨)</label>
                            <img src={uploadedImage} alt="Uploaded and resized" />
                        </div>
                    )}

                    {barcodeImage && (
                        <div className="barcode-preview mt-2">
                            <label className="label">원본 바코드 (특수문자 포함)</label>
                            <img src={barcodeImage} alt="Original barcode" />
                        </div>
                    )}

                    {normalizedBarcodeImage && (
                        <div className="barcode-preview mt-2">
                            <label className="label">정규화 바코드</label>
                            <img src={normalizedBarcodeImage} alt="Normalized barcode" />
                            <button className="btn btn-primary mt-2" onClick={handleDownloadBarcode}>
                                바코드 다운로드 (PNG)
                            </button>
                        </div>
                    )}

                    <div className="a4-section mt-3">
                        <button
                            className="expander-header"
                            onClick={() => setShowA4Options(!showA4Options)}
                        >
                            <span>🖨️ A4 용지 배열 출력 (폼텍 LS-3102 규격)</span>
                            <svg
                                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                style={{ transform: showA4Options ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        {showA4Options && (
                            <div className="a4-options animate-fadeIn">
                                <div className="form-group">
                                    <label className="label">상품명 (바코드 위에 표시)</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={productName}
                                        onChange={(e) => setProductName(e.target.value)}
                                        placeholder="상품명을 입력하세요"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={addExpiry}
                                            onChange={(e) => setAddExpiry(e.target.checked)}
                                        />
                                        소비기한 표시
                                    </label>
                                </div>

                                {addExpiry && (
                                    <div className="form-group">
                                        <label className="label">소비기한</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={expiryText}
                                            onChange={(e) => setExpiryText(e.target.value)}
                                        />
                                    </div>
                                )}

                                <div className="grid grid-2">
                                    <div className="form-group">
                                        <label className="label">열 개수 (가로)</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={cols}
                                            onChange={(e) => setCols(Number(e.target.value))}
                                            min={1} max={10}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">행 개수 (세로)</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={rows}
                                            onChange={(e) => setRows(Number(e.target.value))}
                                            min={1} max={30}
                                        />
                                    </div>
                                </div>

                                <div className="slider-container">
                                    <label className="label">상품명 글씨 크기: {labelFontSize}px</label>
                                    <input
                                        type="range"
                                        className="slider"
                                        value={labelFontSize}
                                        onChange={(e) => setLabelFontSize(Number(e.target.value))}
                                        min={10} max={100}
                                    />
                                </div>

                                <div className="slider-container">
                                    <label className="label">소비기한 글씨 크기: {expiryFontSize}px</label>
                                    <input
                                        type="range"
                                        className="slider"
                                        value={expiryFontSize}
                                        onChange={(e) => setExpiryFontSize(Number(e.target.value))}
                                        min={10} max={100}
                                    />
                                </div>

                                <div className="slider-container">
                                    <label className="label">가로 여백: {hMargin}px</label>
                                    <input
                                        type="range"
                                        className="slider"
                                        value={hMargin}
                                        onChange={(e) => setHMargin(Number(e.target.value))}
                                        min={0} max={150}
                                    />
                                </div>

                                <div className="slider-container">
                                    <label className="label">세로 여백: {vMargin}px</label>
                                    <input
                                        type="range"
                                        className="slider"
                                        value={vMargin}
                                        onChange={(e) => setVMargin(Number(e.target.value))}
                                        min={0} max={150}
                                    />
                                </div>

                                <div className="alert alert-info mt-2">
                                    <strong>🖨️ 인쇄 팁</strong>
                                    <ul>
                                        <li>일반 A4 용지에 먼저 테스트 인쇄하세요</li>
                                        <li>인쇄 설정에서 "실제 크기", "100%" 옵션 선택</li>
                                        <li>"페이지에 맞춤" 옵션은 꺼두세요</li>
                                    </ul>
                                </div>

                                <button
                                    className="btn btn-primary mt-2"
                                    onClick={handleCreateA4Sheet}
                                    style={{ width: '100%' }}
                                >
                                    A4 시트 만들기 & 다운로드
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
