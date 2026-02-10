import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

export interface ScanResult {
    text: string;
    format: string;
    screenshot?: string; // 고해상도 스크린샷 (data URL)
}

export interface ImageScanResult extends ScanResult {
    resizedImageUrl: string;
}

// Response that always includes the resized image, even if scan fails
export interface ImageScanResponse {
    success: boolean;
    result: ImageScanResult | null;
    resizedImageUrl: string;
}

// Check if native BarcodeDetector API is available
declare global {
    interface Window {
        BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetector;
    }
    interface BarcodeDetector {
        detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
    }
    interface DetectedBarcode {
        rawValue: string;
        format: string;
        boundingBox: DOMRectReadOnly;
    }
}

const SUPPORTED_FORMATS = [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.CODABAR
];

// Native BarcodeDetector formats
const NATIVE_FORMATS = [
    'qr_code',
    'code_128',
    'code_39',
    'ean_13',
    'ean_8',
    'upc_a',
    'upc_e',
    'data_matrix',
    'itf',
    'codabar'
];

// ZXing formats to decode
const ZXING_FORMATS = [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR
];

// Create ZXing reader with hints
function createZXingReader(): BrowserMultiFormatReader {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, ZXING_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    return new BrowserMultiFormatReader(hints);
}

// Check if native BarcodeDetector is supported
export function isNativeBarcodeDetectorSupported(): boolean {
    return 'BarcodeDetector' in window;
}

// Helper to convert numeric or raw format names to readable strings
export function getFormatName(format: any): string {
    if (!format) return 'Unknown';
    const formatStr = format.toString().toUpperCase();

    // Map common numeric IDs to names if they appear as numbers
    const numericMap: Record<string, string> = {
        '0': 'QR_CODE',
        '4': 'CODE_128',
        '3': 'CODE_39',
        '8': 'EAN_13',
        '7': 'EAN_8',
        '10': 'UPC_A',
        '11': 'UPC_E',
        '1': 'DATA_MATRIX',
        '9': 'ITF',
        '2': 'CODABAR'
    };

    if (numericMap[formatStr]) return numericMap[formatStr];

    // Clean up strings (e.g., remove 'FORMAT_' prefix if present in some libs)
    return formatStr.replace(/^(FORMAT_|AZTEC_|ISO_)/, '');
}

export async function scanFromImage(file: File): Promise<ScanResult | null> {
    const html5QrCode = new Html5Qrcode('temp-scanner', { verbose: false });

    try {
        const result = await html5QrCode.scanFile(file, true);
        return {
            text: result,
            format: 'Unknown'
        };
    } catch (error) {
        console.error('Scan error:', error);
        return null;
    }
}

// Native BarcodeDetector based scanner - better performance on supported browsers
export class NativeBarcodeScanner {
    private stream: MediaStream | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private detector: BarcodeDetector | null = null;
    private animationFrameId: number | null = null;
    private isScanning: boolean = false;
    private containerId: string;
    private torchEnabled: boolean = false;
    private currentDeviceId: string | null = null;
    private onScanCallback: ((result: ScanResult) => void) | null = null;
    private onErrorCallback: ((error: string) => void) | null = null;

    constructor(containerId: string) {
        this.containerId = containerId;
    }

    async start(onScan: (result: ScanResult) => void, onError?: (error: string) => void): Promise<void> {
        if (this.isScanning) return;

        this.onScanCallback = onScan;
        this.onErrorCallback = onError || null;

        try {
            // Create video element
            const container = document.getElementById(this.containerId);
            if (!container) {
                onError?.('스캐너 컨테이너를 찾을 수 없습니다.');
                return;
            }

            this.videoElement = document.createElement('video');
            this.videoElement.style.width = '100%';
            this.videoElement.style.height = '100%';
            this.videoElement.style.objectFit = 'cover';
            this.videoElement.setAttribute('playsinline', 'true');
            this.videoElement.setAttribute('autoplay', 'true');
            container.appendChild(this.videoElement);

            await this.startCamera();

            // Create BarcodeDetector
            this.detector = new window.BarcodeDetector!({ formats: NATIVE_FORMATS });

            this.isScanning = true;

            // Start scanning loop
            const scan = async () => {
                if (!this.isScanning || !this.videoElement || !this.detector) return;

                try {
                    const barcodes = await this.detector.detect(this.videoElement);
                    if (barcodes.length > 0) {
                        const barcode = barcodes[0];

                        // 바코드 감지 시 고해상도 스크린샷 캡처
                        const screenshot = this.captureHighResScreenshot();

                        onScan({
                            text: barcode.rawValue,
                            format: getFormatName(barcode.format),
                            screenshot
                        });
                        return; // Stop after successful scan
                    }
                } catch (err) {
                    // Ignore detection errors
                }

                this.animationFrameId = requestAnimationFrame(scan);
            };

            this.animationFrameId = requestAnimationFrame(scan);

        } catch (error) {
            console.error('Native scanner start error:', error);
            onError?.(error instanceof Error ? error.message : '카메라 시작 실패');
        }
    }

    private async startCamera(deviceId?: string): Promise<void> {
        // Stop existing stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        const constraints: MediaStreamConstraints = {
            video: deviceId
                ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
                : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
            // Fallback
            console.log('High resolution failed, using fallback');
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
            });
        }

        if (this.videoElement) {
            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();
        }

        // Store current device ID
        const track = this.stream.getVideoTracks()[0];
        if (track) {
            const settings = track.getSettings();
            this.currentDeviceId = settings.deviceId || null;
        }
    }

    async stop(): Promise<void> {
        this.isScanning = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.videoElement) {
            this.videoElement.remove();
            this.videoElement = null;
        }

        this.torchEnabled = false;
    }

    async applyZoom(zoom: number): Promise<void> {
        if (!this.stream) return;
        const track = this.stream.getVideoTracks()[0];
        if (!track) return;

        try {
            const capabilities = track.getCapabilities() as any;
            if (capabilities.zoom) {
                const zoomVal = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min, zoom));
                await track.applyConstraints({
                    advanced: [{ zoom: zoomVal } as any]
                });
            }
        } catch (err) {
            console.error('Zoom applying failed:', err);
        }
    }

    getIsScanning(): boolean {
        return this.isScanning;
    }

    // 플래시/토치 토글
    async toggleTorch(): Promise<boolean> {
        if (!this.stream) return false;

        const track = this.stream.getVideoTracks()[0];
        if (!track) return false;

        try {
            const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
            if (!capabilities.torch) {
                console.log('Torch not supported on this device');
                return false;
            }

            this.torchEnabled = !this.torchEnabled;
            await track.applyConstraints({
                advanced: [{ torch: this.torchEnabled } as MediaTrackConstraintSet]
            });

            return this.torchEnabled;
        } catch (error) {
            console.error('Torch toggle failed:', error);
            return false;
        }
    }

    getTorchEnabled(): boolean {
        return this.torchEnabled;
    }

    // 토치 지원 여부 확인
    async isTorchSupported(): Promise<boolean> {
        if (!this.stream) return false;

        const track = this.stream.getVideoTracks()[0];
        if (!track) return false;

        try {
            const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
            return !!capabilities.torch;
        } catch {
            return false;
        }
    }

    // 사용 가능한 후면 카메라 목록 가져오기
    async getAvailableCameras(): Promise<{ deviceId: string; label: string }[]> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            // Filter for back cameras (usually contain 'back', 'rear', 'environment' in label)
            // Or just return all video devices if no specific back cameras found
            return videoDevices.map((device, index) => ({
                deviceId: device.deviceId,
                label: device.label || `카메라 ${index + 1}`
            }));
        } catch (error) {
            console.error('Failed to get cameras:', error);
            return [];
        }
    }

    getCurrentDeviceId(): string | null {
        return this.currentDeviceId;
    }

    // 다른 카메라로 전환
    async switchCamera(deviceId: string): Promise<void> {
        if (!this.isScanning || deviceId === this.currentDeviceId) return;

        try {
            // Pause scanning temporarily
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }

            // Switch to new camera
            await this.startCamera(deviceId);

            // Resume scanning
            const scan = async () => {
                if (!this.isScanning || !this.videoElement || !this.detector) return;

                try {
                    const barcodes = await this.detector.detect(this.videoElement);
                    if (barcodes.length > 0 && this.onScanCallback) {
                        const barcode = barcodes[0];
                        const screenshot = this.captureHighResScreenshot();
                        this.onScanCallback({
                            text: barcode.rawValue,
                            format: barcode.format.toUpperCase(),
                            screenshot
                        });
                        return;
                    }
                } catch {
                    // Ignore
                }

                this.animationFrameId = requestAnimationFrame(scan);
            };

            this.animationFrameId = requestAnimationFrame(scan);

            // Reset torch state when switching cameras
            this.torchEnabled = false;
        } catch (error) {
            console.error('Camera switch failed:', error);
            this.onErrorCallback?.('카메라 전환 실패');
        }
    }

    // 고해상도 스크린샷 캡처 (비디오 원본 해상도)
    private captureHighResScreenshot(): string | undefined {
        if (!this.videoElement) return undefined;

        try {
            const canvas = document.createElement('canvas');
            // 비디오의 실제 해상도로 캡처 (1080p 등)
            canvas.width = this.videoElement.videoWidth;
            canvas.height = this.videoElement.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return undefined;

            ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

            // 고품질 JPEG로 저장 (PNG는 용량이 너무 큼)
            return canvas.toDataURL('image/jpeg', 0.95);
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            return undefined;
        }
    }
}

// Fallback scanner using html5-qrcode
export class BarcodeScanner {
    private html5QrCode: Html5Qrcode | null = null;
    private containerId: string;
    private isScanning: boolean = false;

    constructor(containerId: string) {
        this.containerId = containerId;
    }

    async start(onScan: (result: ScanResult) => void, onError?: (error: string) => void): Promise<void> {
        if (this.isScanning) return;

        try {
            this.html5QrCode = new Html5Qrcode(this.containerId, {
                verbose: false,
                formatsToSupport: SUPPORTED_FORMATS
            });

            // Config with videoConstraints for iOS Safari 1920x1080 support
            const scanConfig = {
                fps: 10,
                qrbox: { width: 280, height: 280 },
                videoConstraints: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: "environment"
                }
            };

            const successCallback = (decodedText: string, decodedResult: { result: { format?: { formatName?: string } } }) => {
                // 바코드 감지 시 고해상도 스크린샷 캡처
                const screenshot = this.captureHighResScreenshot();

                onScan({
                    text: decodedText,
                    format: getFormatName(decodedResult.result.format?.formatName),
                    screenshot
                });
            };

            try {
                // Try with FHD videoConstraints in config
                await this.html5QrCode.start(
                    { facingMode: "environment" },
                    scanConfig,
                    successCallback,
                    () => { }
                );
            } catch {
                // Fallback for unsupported browsers - without videoConstraints
                console.log('FHD failed, trying fallback constraints');
                if (this.html5QrCode) {
                    try { await this.html5QrCode.stop(); } catch { /* ignore */ }
                    this.html5QrCode.clear();
                }

                this.html5QrCode = new Html5Qrcode(this.containerId, {
                    verbose: false,
                    formatsToSupport: SUPPORTED_FORMATS
                });

                const fallbackConfig = {
                    fps: 10,
                    qrbox: { width: 280, height: 280 },
                };

                await this.html5QrCode.start(
                    { facingMode: "environment" },
                    fallbackConfig,
                    successCallback,
                    () => { }
                );
            }

            this.isScanning = true;
        } catch (error) {
            console.error('Scanner start error:', error);
            onError?.(error instanceof Error ? error.message : '카메라 시작 실패');
        }
    }

    async stop(): Promise<void> {
        if (!this.isScanning || !this.html5QrCode) return;

        try {
            await this.html5QrCode.stop();
            this.html5QrCode.clear();
            this.isScanning = false;
        } catch (error) {
            console.error('Scanner stop error:', error);
        }
    }

    async applyZoom(zoom: number): Promise<void> {
        if (!this.html5QrCode || !this.isScanning) return;
        try {
            // @ts-ignore - access internal track
            const track = (this.html5QrCode as any).getRunningTrack();
            if (track) {
                const capabilities = track.getCapabilities() as any;
                if (capabilities.zoom) {
                    const zoomVal = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min, zoom));
                    await track.applyConstraints({
                        advanced: [{ zoom: zoomVal } as any]
                    });
                }
            }
        } catch (err) {
            console.error('Html5Qrcode zoom failed:', err);
        }
    }

    getIsScanning(): boolean {
        return this.isScanning;
    }

    // 고해상도 스크린샷 캡처 (html5-qrcode 내부 비디오 요소에서)
    private captureHighResScreenshot(): string | undefined {
        try {
            // html5-qrcode가 생성한 비디오 요소 찾기
            const container = document.getElementById(this.containerId);
            if (!container) return undefined;

            const video = container.querySelector('video');
            if (!video) return undefined;

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return undefined;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 고품질 JPEG로 저장
            return canvas.toDataURL('image/jpeg', 0.95);
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            return undefined;
        }
    }
}

// Smart scanner factory - uses native when available, fallback otherwise
export function createScanner(containerId: string): NativeBarcodeScanner | BarcodeScanner {
    if (isNativeBarcodeDetectorSupported()) {
        console.log('Using native BarcodeDetector API');
        return new NativeBarcodeScanner(containerId);
    } else {
        console.log('Falling back to html5-qrcode');
        return new BarcodeScanner(containerId);
    }
}

export async function scanImageFile(file: File): Promise<ImageScanResponse> {
    // Process image with contrast enhancement
    const { blob: processedBlob, dataUrl: resizedImageUrl } = await resizeImageForScanning(file);

    // Multi-scale factors and rotations to try
    const rotations = [0, 90, 270, 180]; // Try common orientations
    const scales = [1.0, 0.75, 1.25];

    // Try ZXing first with multiple rotations and scales
    const zxingReader = createZXingReader();

    for (const rotation of rotations) {
        for (const scale of scales) {
            try {
                // If it's the first attempt (0 rotation, 1.0 scale), use processedBlob directly
                const scaledBlob = (rotation === 0 && scale === 1.0)
                    ? processedBlob
                    : await transformBlob(processedBlob, scale, rotation);

                const imageUrl = URL.createObjectURL(scaledBlob);

                try {
                    const result = await zxingReader.decodeFromImageUrl(imageUrl);
                    URL.revokeObjectURL(imageUrl);

                    if (result) {
                        const formatCode = result.getBarcodeFormat();
                        const formatName = getFormatName(formatCode);

                        console.log(`ZXing scan success at rotation ${rotation}, scale ${scale}: ${formatName}`);
                        return {
                            success: true,
                            result: {
                                text: result.getText(),
                                format: formatName,
                                resizedImageUrl
                            },
                            resizedImageUrl
                        };
                    }
                } catch {
                    URL.revokeObjectURL(imageUrl);
                }
            } catch (error) {
                console.log(`ZXing scan failed at rotation ${rotation}, scale ${scale}:`, error);
            }
        }
    }

    // Try native BarcodeDetector
    if (isNativeBarcodeDetectorSupported()) {
        try {
            const bitmap = await createImageBitmap(processedBlob);
            const detector = new window.BarcodeDetector!({ formats: NATIVE_FORMATS });
            const barcodes = await detector.detect(bitmap);

            if (barcodes.length > 0) {
                console.log('Native BarcodeDetector success');
                return {
                    success: true,
                    result: {
                        text: barcodes[0].rawValue,
                        format: getFormatName(barcodes[0].format),
                        resizedImageUrl
                    },
                    resizedImageUrl
                };
            }
        } catch (error) {
            console.error('Native image scan error:', error);
        }
    }

    // Fallback to html5-qrcode
    const tempContainer = document.createElement('div');
    tempContainer.id = 'temp-scanner-' + Date.now();
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);

    const html5QrCode = new Html5Qrcode(tempContainer.id, {
        verbose: false,
        formatsToSupport: SUPPORTED_FORMATS
    });

    try {
        const resizedFile = new File([processedBlob], file.name, { type: 'image/jpeg' });
        const result = await html5QrCode.scanFile(resizedFile, true);
        console.log('html5-qrcode success');
        return {
            success: true,
            result: {
                text: result,
                format: 'Detected',
                resizedImageUrl
            },
            resizedImageUrl
        };
    } catch (error) {
        console.error('All scanners failed:', error);
        return {
            success: false,
            result: null,
            resizedImageUrl
        };
    } finally {
        html5QrCode.clear();
        document.body.removeChild(tempContainer);
    }
}

// Transform (resize and rotate) blob
async function transformBlob(blob: Blob, scale: number, rotation: number = 0): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const radian = (rotation * Math.PI) / 180;

            // Calculate new dimensions after rotation
            const width = img.width * scale;
            const height = img.height * scale;

            if (rotation === 90 || rotation === 270) {
                canvas.width = height;
                canvas.height = width;
            } else {
                canvas.width = width;
                canvas.height = height;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Rotate and draw
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(radian);
            ctx.drawImage(img, -width / 2, -height / 2, width, height);

            canvas.toBlob(
                (newBlob) => {
                    if (newBlob) {
                        resolve(newBlob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                'image/jpeg',
                0.92
            );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(blob);
    });
}


// Resize image for better scanning performance on mobile
// Uses high-quality bicubic-like interpolation with multi-step downscaling
async function resizeImageForScanning(file: File): Promise<{ blob: Blob; dataUrl: string }> {
    const MAX_WIDTH = 1280;
    const MAX_HEIGHT = 1280;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let targetWidth = img.width;
            let targetHeight = img.height;

            // Calculate target dimensions while maintaining aspect ratio
            if (targetWidth > MAX_WIDTH || targetHeight > MAX_HEIGHT) {
                const ratio = Math.min(MAX_WIDTH / targetWidth, MAX_HEIGHT / targetHeight);
                targetWidth = Math.round(targetWidth * ratio);
                targetHeight = Math.round(targetHeight * ratio);
            }

            // Use multi-step downscaling for better quality (Lanczos-like effect)
            // Step down by half until we're close to target size
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Enable high-quality image smoothing (bicubic-like interpolation)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            let currentWidth = img.width;
            let currentHeight = img.height;
            let currentSource: CanvasImageSource = img;

            // Multi-step downscaling: step down by 50% at a time for better quality
            // This mimics Lanczos algorithm behavior by avoiding extreme scaling in one step
            while (currentWidth > targetWidth * 2 || currentHeight > targetHeight * 2) {
                const stepWidth = Math.round(currentWidth / 2);
                const stepHeight = Math.round(currentHeight / 2);

                const stepCanvas = document.createElement('canvas');
                stepCanvas.width = stepWidth;
                stepCanvas.height = stepHeight;

                const stepCtx = stepCanvas.getContext('2d');
                if (!stepCtx) {
                    reject(new Error('Failed to get step canvas context'));
                    return;
                }

                stepCtx.imageSmoothingEnabled = true;
                stepCtx.imageSmoothingQuality = 'high';
                stepCtx.drawImage(currentSource, 0, 0, stepWidth, stepHeight);

                currentSource = stepCanvas;
                currentWidth = stepWidth;
                currentHeight = stepHeight;
            }

            // Final resize to target dimensions
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(currentSource, 0, 0, targetWidth, targetHeight);

            // Apply contrast enhancement and sharpening for better barcode recognition
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const data = imageData.data;

            // Contrast enhancement (increase difference between light and dark)
            const contrastFactor = 1.3; // 1.0 = no change, >1.0 = more contrast
            const contrastOffset = 128 * (1 - contrastFactor);

            for (let i = 0; i < data.length; i += 4) {
                // Apply contrast to RGB channels
                data[i] = Math.min(255, Math.max(0, data[i] * contrastFactor + contrastOffset));     // R
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * contrastFactor + contrastOffset)); // G
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * contrastFactor + contrastOffset)); // B
                // Alpha channel (i+3) unchanged
            }

            ctx.putImageData(imageData, 0, 0);

            // Apply simple sharpening using convolution
            const sharpenedCanvas = document.createElement('canvas');
            sharpenedCanvas.width = targetWidth;
            sharpenedCanvas.height = targetHeight;
            const sharpCtx = sharpenedCanvas.getContext('2d');

            if (sharpCtx) {
                // Get contrasted image data
                const srcData = ctx.getImageData(0, 0, targetWidth, targetHeight);
                const dstData = sharpCtx.createImageData(targetWidth, targetHeight);
                const src = srcData.data;
                const dst = dstData.data;

                // Sharpening kernel: center = 5, neighbors = -1 (simple unsharp)
                const strength = 0.3; // 0.0 = no sharpening, 1.0 = full sharpening

                for (let y = 1; y < targetHeight - 1; y++) {
                    for (let x = 1; x < targetWidth - 1; x++) {
                        const idx = (y * targetWidth + x) * 4;

                        for (let c = 0; c < 3; c++) { // RGB only
                            const center = src[idx + c];
                            const top = src[((y - 1) * targetWidth + x) * 4 + c];
                            const bottom = src[((y + 1) * targetWidth + x) * 4 + c];
                            const left = src[(y * targetWidth + (x - 1)) * 4 + c];
                            const right = src[(y * targetWidth + (x + 1)) * 4 + c];

                            // Unsharp mask: sharpened = original + strength * (original - blurred)
                            const blurred = (top + bottom + left + right) / 4;
                            const sharpened = center + strength * (center - blurred);

                            dst[idx + c] = Math.min(255, Math.max(0, sharpened));
                        }
                        dst[idx + 3] = 255; // Alpha
                    }
                }

                // Copy edges without sharpening
                for (let x = 0; x < targetWidth; x++) {
                    const topIdx = x * 4;
                    const bottomIdx = ((targetHeight - 1) * targetWidth + x) * 4;
                    for (let c = 0; c < 4; c++) {
                        dst[topIdx + c] = src[topIdx + c];
                        dst[bottomIdx + c] = src[bottomIdx + c];
                    }
                }
                for (let y = 0; y < targetHeight; y++) {
                    const leftIdx = (y * targetWidth) * 4;
                    const rightIdx = (y * targetWidth + targetWidth - 1) * 4;
                    for (let c = 0; c < 4; c++) {
                        dst[leftIdx + c] = src[leftIdx + c];
                        dst[rightIdx + c] = src[rightIdx + c];
                    }
                }

                sharpCtx.putImageData(dstData, 0, 0);

                // Get data URL from sharpened canvas
                const dataUrl = sharpenedCanvas.toDataURL('image/jpeg', 0.92);

                // Convert to blob
                sharpenedCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve({ blob, dataUrl });
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    },
                    'image/jpeg',
                    0.92
                );
            } else {
                // Fallback if sharpening canvas fails
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve({ blob, dataUrl });
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    },
                    'image/jpeg',
                    0.92
                );
            }
        };

        img.onerror = () => reject(new Error('Failed to load image'));

        // Read file as data URL
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}
