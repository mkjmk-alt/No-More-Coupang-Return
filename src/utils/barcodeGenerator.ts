import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export type BarcodeType = 'CODE128' | 'EAN13' | 'EAN8' | 'CODE39' | 'QR';

export interface BarcodeOptions {
    width?: number;
    height?: number;
    fontSize?: number;
    displayValue?: boolean;
    margin?: number;
}

export async function generateBarcode(
    content: string,
    type: BarcodeType,
    options: BarcodeOptions = {}
): Promise<string | null> {
    const {
        width = 2,
        height = 100,
        fontSize = 18,
        displayValue = true,
        margin = 10
    } = options;

    if (type === 'QR') {
        return generateQRCode(content, { width: 250, margin: 2 });
    }

    try {
        const canvas = document.createElement('canvas');

        JsBarcode(canvas, content, {
            format: type,
            width,
            height,
            fontSize,
            displayValue,
            margin,
            background: '#ffffff',
            lineColor: '#000000'
        });

        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Barcode generation error:', error);
        return null;
    }
}

export async function generateQRCode(
    content: string,
    options: { width?: number; margin?: number } = {}
): Promise<string | null> {
    const { width = 250, margin = 2 } = options;

    try {
        const dataUrl = await QRCode.toDataURL(content, {
            width,
            margin,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        return dataUrl;
    } catch (error) {
        console.error('QR generation error:', error);
        return null;
    }
}

// Create A4 sheet with barcodes
export interface A4SheetOptions {
    rows: number;
    cols: number;
    hMargin: number;
    vMargin: number;
    productName: string;
    labelFontSize: number;
    expiryFontSize: number;
    addExpiry: boolean;
    expiryText: string;
    maxLabelLines: number;
    lineSpacing: number;
}

export async function createA4Sheet(
    barcodeDataUrl: string,
    options: A4SheetOptions
): Promise<string | null> {
    const A4_W = 2480;
    const A4_H = 3508;

    const {
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
    } = options;

    const cellW = Math.floor((A4_W - (cols + 1) * hMargin) / cols);
    const cellH = Math.floor((A4_H - (rows + 1) * vMargin) / rows);

    const canvas = document.createElement('canvas');
    canvas.width = A4_W;
    canvas.height = A4_H;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4_W, A4_H);

    // Load barcode image
    const barcodeImg = await loadImage(barcodeDataUrl);
    if (!barcodeImg) return null;

    const TEXT_TOP_PADDING = 10;
    const CONTENT_SPACING = 15;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cellX = hMargin + c * (cellW + hMargin);
            const cellY = vMargin + r * (cellH + vMargin);

            // Draw product name
            ctx.fillStyle = '#000000';
            ctx.font = `${labelFontSize}px "Malgun Gothic", sans-serif`;
            ctx.textAlign = 'center';

            const productLines = wrapText(ctx, productName, cellW - 10, maxLabelLines);
            let yCursor = cellY + TEXT_TOP_PADDING;

            for (const line of productLines) {
                ctx.fillText(line, cellX + cellW / 2, yCursor + labelFontSize);
                yCursor += labelFontSize + lineSpacing;
            }

            // Draw expiry date if enabled
            if (addExpiry && expiryText) {
                ctx.font = `${expiryFontSize}px "Malgun Gothic", sans-serif`;
                ctx.textAlign = 'right';
                const expiryLine = `소비기한 : ${expiryText}`;
                yCursor += CONTENT_SPACING;
                ctx.fillText(expiryLine, cellX + cellW - 5, yCursor + expiryFontSize);
                yCursor += expiryFontSize;
            }

            // Draw barcode
            const barcodeAreaY = yCursor + CONTENT_SPACING;
            const barcodeAreaH = (cellY + cellH) - barcodeAreaY - 10;

            if (barcodeAreaH > 20) {
                const aspectRatio = barcodeImg.height / barcodeImg.width;
                let newW = cellW - 10;
                let newH = newW * aspectRatio;

                if (newH > barcodeAreaH) {
                    newH = barcodeAreaH;
                    newW = newH / aspectRatio;
                }

                const pasteX = cellX + (cellW - newW) / 2;
                const pasteY = barcodeAreaY + (barcodeAreaH - newH) / 2;

                ctx.drawImage(barcodeImg, pasteX, pasteY, newW, newH);
            }
        }
    }

    return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
    const lines: string[] = [];
    let currentLine = '';

    for (const char of text) {
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = char;

            if (lines.length >= maxLines) {
                return lines;
            }
        } else {
            currentLine = testLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.slice(0, maxLines);
}

export function downloadImage(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
