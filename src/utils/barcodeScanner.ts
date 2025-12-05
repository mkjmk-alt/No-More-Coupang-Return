import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export interface ScanResult {
    text: string;
    format: string;
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

export async function scanFromImage(file: File): Promise<ScanResult | null> {
    const html5QrCode = new Html5Qrcode('temp-scanner', { verbose: false });

    try {
        const result = await html5QrCode.scanFile(file, true);
        return {
            text: result,
            format: 'Unknown' // html5-qrcode doesn't provide format for file scans
        };
    } catch (error) {
        console.error('Scan error:', error);
        return null;
    }
}

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

            const cameras = await Html5Qrcode.getCameras();

            if (cameras.length === 0) {
                onError?.('카메라를 찾을 수 없습니다.');
                return;
            }

            // Prefer back camera
            const backCamera = cameras.find(c =>
                c.label.toLowerCase().includes('back') ||
                c.label.toLowerCase().includes('rear') ||
                c.label.toLowerCase().includes('environment')
            );

            const cameraId = backCamera?.id || cameras[0].id;

            await this.html5QrCode.start(
                cameraId,
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

export async function scanImageFile(file: File): Promise<ScanResult | null> {
    // Create a temporary container
    const tempContainer = document.createElement('div');
    tempContainer.id = 'temp-scanner-' + Date.now();
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);

    const html5QrCode = new Html5Qrcode(tempContainer.id, {
        verbose: false,
        formatsToSupport: SUPPORTED_FORMATS
    });

    try {
        const result = await html5QrCode.scanFile(file, true);
        return {
            text: result,
            format: 'Detected'
        };
    } catch (error) {
        console.error('Image scan error:', error);
        return null;
    } finally {
        html5QrCode.clear();
        document.body.removeChild(tempContainer);
    }
}
