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

// 바코드 형식에 대한 상세 설명
const BARCODE_FORMAT_INFO: Record<string, { name: string; description: string }> = {
    'QR_CODE': { name: 'QR 코드', description: '2D 매트릭스 코드, 다양한 데이터 저장 가능 (URL, 텍스트 등)' },
    'CODE_128': { name: 'Code 128', description: '고밀도 1D 바코드, 물류/유통에서 주로 사용' },
    'CODE_39': { name: 'Code 39', description: '영숫자 1D 바코드, 산업용으로 널리 사용' },
    'EAN_13': { name: 'EAN-13', description: '13자리 국제 상품 바코드, 소매업에서 표준 사용' },
    'EAN_8': { name: 'EAN-8', description: '8자리 국제 상품 바코드, 소형 제품용' },
    'UPC_A': { name: 'UPC-A', description: '12자리 미국/캐나다 상품 바코드' },
    'UPC_E': { name: 'UPC-E', description: '압축된 6자리 UPC 바코드, 소형 제품용' },
    'DATA_MATRIX': { name: 'Data Matrix', description: '2D 매트릭스 코드, 작은 공간에 많은 데이터 저장' },
    'ITF': { name: 'ITF (Interleaved 2 of 5)', description: '숫자 전용 바코드, 박스/팔레트에 사용' },
    'CODABAR': { name: 'Codabar', description: '도서관, 혈액은행, 택배 등에서 사용' },
    'PDF_417': { name: 'PDF417', description: '2D 스택 바코드, 신분증/운전면허증에 사용' },
    'AZTEC': { name: 'Aztec', description: '2D 매트릭스 코드, 항공권/모바일 티켓에 사용' },
    'UNKNOWN': { name: '알 수 없음', description: '형식을 감지하지 못함' },
    'DETECTED': { name: '감지됨', description: 'html5-qrcode 라이브러리에서 감지' },
};

// 바코드 형식 정보 가져오기
function getBarcodeFormatInfo(format: string): { name: string; description: string } {
    const normalizedFormat = format.toUpperCase().replace(/-/g, '_');
    return BARCODE_FORMAT_INFO[normalizedFormat] || { name: format, description: '알려지지 않은 형식' };
}

export function ScanPage() {
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [normalizedResult, setNormalizedResult] = useState<string>('');
    const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
    const [normalizedBarcodeImage, setNormalizedBarcodeImage] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    const [historyRefresh, setHistoryRefresh] = useState(0);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [cameraResolution, setCameraResolution] = useState<string>('');

    // 플래시 라이트 및 카메라 전환 상태
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [availableCameras, setAvailableCameras] = useState<{ deviceId: string; label: string }[]>([]);
    const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);

    // Camera scan mode: photo capture or realtime
    const [isPhotoMode, setIsPhotoMode] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

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
        setCameraResolution('');
        setTorchEnabled(false);
        setTorchSupported(false);
        setAvailableCameras([]);

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

            // Get video resolution and camera info after scanning starts
            setTimeout(async () => {
                const video = document.querySelector('#scanner-container video') as HTMLVideoElement;
                if (video && video.videoWidth && video.videoHeight) {
                    setCameraResolution(`${video.videoWidth} × ${video.videoHeight}`);
                }

                // Check torch support and get camera list (NativeBarcodeScanner only)
                if (scannerRef.current && 'isTorchSupported' in scannerRef.current) {
                    const scanner = scannerRef.current as NativeBarcodeScanner;
                    const supported = await scanner.isTorchSupported();
                    setTorchSupported(supported);

                    const cameras = await scanner.getAvailableCameras();
                    setAvailableCameras(cameras);

                    const currentId = scanner.getCurrentDeviceId();
                    setCurrentCameraId(currentId);
                }
            }, 500);
        }, 100);
    };

    const stopCameraScan = async () => {
        if (scannerRef.current) {
            await scannerRef.current.stop();
            setIsScanning(false);
            setTorchEnabled(false);
            setTorchSupported(false);
            setAvailableCameras([]);
            setCurrentCameraId(null);
        }
    };

    // 플래시 라이트 토글
    const handleToggleTorch = async () => {
        if (scannerRef.current && 'toggleTorch' in scannerRef.current) {
            const scanner = scannerRef.current as NativeBarcodeScanner;
            const enabled = await scanner.toggleTorch();
            setTorchEnabled(enabled);
        }
    };

    // 카메라 전환
    const handleSwitchCamera = async (deviceId: string) => {
        if (scannerRef.current && 'switchCamera' in scannerRef.current) {
            const scanner = scannerRef.current as NativeBarcodeScanner;
            await scanner.switchCamera(deviceId);
            setCurrentCameraId(deviceId);
            setTorchEnabled(false); // 카메라 전환 시 토치 리셋

            // Update resolution
            setTimeout(() => {
                const video = document.querySelector('#scanner-container video') as HTMLVideoElement;
                if (video && video.videoWidth && video.videoHeight) {
                    setCameraResolution(`${video.videoWidth} × ${video.videoHeight}`);
                }
            }, 500);
        }
    };

    // Photo capture mode functions
    const startPhotoMode = async () => {
        setError('');
        setScanResult(null);
        setBarcodeImage(null);
        setNormalizedBarcodeImage(null);
        setCapturedPhoto(null);
        setIsPhotoMode(true);
        setCameraResolution('');

        try {
            // Try 1920x1080 first, fallback for Safari
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
            }

            streamRef.current = stream;

            // Wait for DOM to render
            setTimeout(() => {
                const video = document.getElementById('photo-video') as HTMLVideoElement;
                if (video) {
                    video.srcObject = stream;
                    video.play();

                    // Show resolution after video starts
                    setTimeout(() => {
                        if (video.videoWidth && video.videoHeight) {
                            setCameraResolution(`${video.videoWidth} × ${video.videoHeight}`);
                        }
                    }, 500);
                }
            }, 100);
        } catch (err) {
            setError('카메라 시작 실패');
            setIsPhotoMode(false);
        }
    };

    const capturePhoto = () => {
        const video = document.getElementById('photo-video') as HTMLVideoElement;
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const photoDataUrl = canvas.toDataURL('image/png');
        setCapturedPhoto(photoDataUrl);
    };

    const scanCapturedPhoto = async () => {
        if (!capturedPhoto) return;

        setError('');

        // Convert data URL to File
        const response = await fetch(capturedPhoto);
        const blob = await response.blob();
        const file = new File([blob], 'captured.png', { type: 'image/png' });

        const result = await scanImageFile(file);

        if (result.success && result.result) {
            handleScanResult(result.result);
            stopPhotoMode();
        } else {
            setError('바코드를 인식하지 못했습니다. 다시 촬영해주세요.');
            setCapturedPhoto(null); // Allow retry
        }
    };

    const stopPhotoMode = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCapturedPhoto(null);
        setIsPhotoMode(false);
        setCameraResolution('');
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

            {!isScanning && !isPhotoMode && !scanResult && (
                <>
                    <MainCard
                        onCameraScan={startCameraScan}
                        onPhotoCapture={startPhotoMode}
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

                    {/* 스캐너 컨트롤 버튼들 */}
                    <div className="scanner-controls mt-2">
                        <button className="btn btn-outline" onClick={stopCameraScan}>
                            ⏹️ 중지
                        </button>

                        {torchSupported && (
                            <button
                                className={`btn ${torchEnabled ? 'btn-warning' : 'btn-outline'}`}
                                onClick={handleToggleTorch}
                            >
                                {torchEnabled ? '🔦 라이트 끄기' : '💡 라이트 켜기'}
                            </button>
                        )}

                        {availableCameras.length > 1 && (
                            <select
                                className="camera-select"
                                value={currentCameraId || ''}
                                onChange={(e) => handleSwitchCamera(e.target.value)}
                            >
                                {availableCameras.map((camera, index) => (
                                    <option key={camera.deviceId} value={camera.deviceId}>
                                        📷 {camera.label || `카메라 ${index + 1}`}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {cameraResolution && (
                        <p className="text-center text-sm text-muted mt-1">
                            📷 해상도: {cameraResolution}
                            {availableCameras.length > 1 && ` (${availableCameras.length}개 카메라 사용 가능)`}
                        </p>
                    )}
                </div>
            )}

            {isPhotoMode && !capturedPhoto && (
                <div className="scanner-section animate-fadeIn">
                    <h3 className="section-title">📸 사진 촬영 모드</h3>
                    <video
                        id="photo-video"
                        autoPlay
                        playsInline
                        className="scanner-container"
                        style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px' }}
                    />
                    <div className="action-buttons mt-2">
                        <button className="btn btn-primary" onClick={capturePhoto}>
                            📷 촬영
                        </button>
                        <button className="btn btn-outline" onClick={stopPhotoMode}>
                            취소
                        </button>
                    </div>
                    {cameraResolution && (
                        <p className="text-center text-sm text-muted mt-1">
                            📷 해상도: {cameraResolution}
                        </p>
                    )}
                </div>
            )}

            {isPhotoMode && capturedPhoto && (
                <div className="scanner-section animate-fadeIn">
                    <h3 className="section-title">📸 촬영된 사진</h3>
                    <img
                        src={capturedPhoto}
                        alt="Captured"
                        style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '12px' }}
                    />
                    <div className="action-buttons mt-2">
                        <button className="btn btn-primary" onClick={scanCapturedPhoto}>
                            🔍 바코드 스캔
                        </button>
                        <button className="btn btn-outline" onClick={() => setCapturedPhoto(null)}>
                            다시 촬영
                        </button>
                        <button className="btn btn-outline" onClick={stopPhotoMode}>
                            취소
                        </button>
                    </div>
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
                        {(() => {
                            const formatInfo = getBarcodeFormatInfo(scanResult.format);
                            return (
                                <div className="format-info-card">
                                    <div className="format-header">
                                        <span className="badge">{formatInfo.name}</span>
                                        <span className="format-raw">({scanResult.format})</span>
                                    </div>
                                    <p className="format-description">{formatInfo.description}</p>
                                </div>
                            );
                        })()}
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

                    {scanResult.screenshot && (
                        <div className="barcode-preview mt-2 screenshot-section">
                            <label className="label">📸 스캔 시점 스크린샷 (고해상도)</label>
                            <img src={scanResult.screenshot} alt="Scan screenshot" />
                            <button
                                className="btn btn-secondary mt-2"
                                onClick={() => {
                                    if (scanResult.screenshot) {
                                        downloadImage(scanResult.screenshot, `barcode_screenshot_${Date.now()}.jpg`);
                                    }
                                }}
                            >
                                📷 스크린샷 다운로드 (JPG)
                            </button>
                        </div>
                    )}

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
                            <div className="barcode-preview-header">
                                <label className="label">정규화 바코드</label>
                                <span className="badge badge-secondary">CODE 128</span>
                            </div>
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
