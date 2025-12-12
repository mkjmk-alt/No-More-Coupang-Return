import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

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

            // Try 1920x1080 first, fallback for Safari compatibility
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
            } catch {
                // Fallback for Safari or unsupported devices
                console.log('1920x1080 failed, using fallback');
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
            }

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

            // Config with videoConstraints for iOS Safari 1920x1080 support
            const scanConfig = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                videoConstraints: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: "environment"
                }
            };

            const successCallback = (decodedText: string, decodedResult: { result: { format?: { formatName?: string } } }) => {
                onScan({
                    text: decodedText,
                    format: decodedResult.result.format?.formatName || 'Unknown'
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
                    qrbox: { width: 250, height: 250 }
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
    // Process image with contrast enhancement
    const { blob: processedBlob, dataUrl: resizedImageUrl } = await resizeImageForScanning(file);

    // Multi-scale factors to try (from smaller to larger for speed)
    const scales = [1.0, 0.75, 1.25, 0.5, 1.5];

    // Try ZXing first with multiple scales
    const zxingReader = createZXingReader();

    for (const scale of scales) {
        try {
            const scaledBlob = scale === 1.0
                ? processedBlob
                : await rescaleBlob(processedBlob, scale);

            const imageUrl = URL.createObjectURL(scaledBlob);

            try {
                const result = await zxingReader.decodeFromImageUrl(imageUrl);
                URL.revokeObjectURL(imageUrl);

                if (result) {
                    console.log(`ZXing scan success at scale ${scale}`);
                    return {
                        success: true,
                        result: {
                            text: result.getText(),
                            format: result.getBarcodeFormat().toString(),
                            resizedImageUrl
                        },
                        resizedImageUrl
                    };
                }
            } catch {
                URL.revokeObjectURL(imageUrl);
            }
        } catch (error) {
            console.log(`ZXing scan failed at scale ${scale}:`, error);
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

// Rescale blob to a different size
async function rescaleBlob(blob: Blob, scale: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

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
