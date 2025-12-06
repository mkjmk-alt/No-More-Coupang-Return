import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export interface ScanResult {
    text: string;
    format: string;
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

// Check if native BarcodeDetector is supported
export function isNativeBarcodeDetectorSupported(): boolean {
    return 'BarcodeDetector' in window;
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

    constructor(containerId: string) {
        this.containerId = containerId;
    }

    async start(onScan: (result: ScanResult) => void, onError?: (error: string) => void): Promise<void> {
        if (this.isScanning) return;

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

            // Get camera stream (back camera)
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();

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
                        onScan({
                            text: barcode.rawValue,
                            format: barcode.format.toUpperCase()
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
    }

    getIsScanning(): boolean {
        return this.isScanning;
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

            // Use facingMode constraint for back camera
            await this.html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.333
                },
                (decodedText, decodedResult) => {
                    onScan({
                        text: decodedText,
                        format: decodedResult.result.format?.formatName || 'Unknown'
                    });
                },
                () => { } // Ignore scan failures
            );

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

    getIsScanning(): boolean {
        return this.isScanning;
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
    // Resize image for better performance on mobile
    const { blob: resizedBlob, dataUrl: resizedImageUrl } = await resizeImageForScanning(file);

    // Try native BarcodeDetector first
    if (isNativeBarcodeDetectorSupported()) {
        try {
            const bitmap = await createImageBitmap(resizedBlob);
            const detector = new window.BarcodeDetector!({ formats: NATIVE_FORMATS });
            const barcodes = await detector.detect(bitmap);

            if (barcodes.length > 0) {
                return {
                    success: true,
                    result: {
                        text: barcodes[0].rawValue,
                        format: barcodes[0].format.toUpperCase(),
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
        // Convert blob to file for html5-qrcode
        const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });
        const result = await html5QrCode.scanFile(resizedFile, true);
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
        console.error('Image scan error:', error);
        // Return failure with resized image still available
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

            // Get data URL for preview
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

            // Convert to blob
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
