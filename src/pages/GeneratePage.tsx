import { useState } from 'react';
import {
    generateBarcode,
    createA4Sheet,
    createA4SheetPDF,
    downloadImage,
    LS_3102_PRESET
} from '../utils/barcodeGenerator';
import type { BarcodeType, A4SheetOptions, A4SheetPDFOptions } from '../utils/barcodeGenerator';
import { removeWhitespaceSpecial } from '../utils/helpers';
import './GeneratePage.css';

const BARCODE_TYPES: { value: BarcodeType; label: string }[] = [
    { value: 'CODE128', label: 'Code128' },
    { value: 'QR', label: 'QR 코드' },
    { value: 'EAN13', label: 'EAN-13' },
    { value: 'EAN8', label: 'EAN-8' },
    { value: 'CODE39', label: 'Code39' }
];

export function GeneratePage() {
    const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
    const [inputText, setInputText] = useState('');
    const [productName, setProductName] = useState('');
    const [removeSpecial, setRemoveSpecial] = useState(true);
    const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
    const [error, setError] = useState('');

    // Font sizes
    const [labelFontSize, setLabelFontSize] = useState(30);
    const [expiryFontSize, setExpiryFontSize] = useState(20);
    const [barcodeFontSize, setBarcodeFontSize] = useState(18);
    const [maxLabelLines, setMaxLabelLines] = useState(2);
    const [lineSpacing, setLineSpacing] = useState(4);

    // A4 options
    const [addExpiry, setAddExpiry] = useState(false);
    const [expiryText, setExpiryText] = useState('0000-00-00');
    const [rows, setRows] = useState(10);
    const [cols, setCols] = useState(4);
    const [hMargin, setHMargin] = useState(47);
    const [vMargin, setVMargin] = useState(18);

    const handleGenerate = async () => {
        if (!inputText.trim()) {
            setError('바코드 내용을 입력해주세요.');
            return;
        }

        setError('');
        const content = removeSpecial ? removeWhitespaceSpecial(inputText) : inputText;

        const img = await generateBarcode(content, barcodeType, { fontSize: barcodeFontSize });

        if (img) {
            setBarcodeImage(img);
        } else {
            setError('바코드 생성 실패. 입력값과 바코드 종류를 확인해주세요.');
        }
    };

    const handleDownload = () => {
        if (barcodeImage) {
            const content = removeSpecial ? removeWhitespaceSpecial(inputText) : inputText;
            downloadImage(barcodeImage, `barcode_${content}.png`);
        }
    };

    const handleCreateA4Sheet = async () => {
        if (!barcodeImage) {
            setError('먼저 바코드를 생성해주세요.');
            return;
        }

        if (!productName.trim()) {
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

        const sheetDataUrl = await createA4Sheet(barcodeImage, options);
        if (sheetDataUrl) {
            const content = removeSpecial ? removeWhitespaceSpecial(inputText) : inputText;
            downloadImage(sheetDataUrl, `barcode_sheet_${content}_${rows}x${cols}.png`);
        }
    };

    const handleCreateA4SheetPDF = async () => {
        if (!barcodeImage) {
            setError('먼저 바코드를 생성해주세요.');
            return;
        }

        if (!productName.trim()) {
            setError('상품명을 입력해주세요.');
            return;
        }

        const pdfOptions: A4SheetPDFOptions = {
            ...LS_3102_PRESET,
            rows,
            cols,
            labelWidth: LS_3102_PRESET.labelWidth || 47,
            labelHeight: LS_3102_PRESET.labelHeight || 26.9,
            leftMargin: LS_3102_PRESET.leftMargin || 8,
            topMargin: LS_3102_PRESET.topMargin || 11,
            hGap: LS_3102_PRESET.hGap || 2.5,
            vGap: LS_3102_PRESET.vGap || 0,
            productName,
            labelFontSize: labelFontSize / 3, // Convert to mm (roughly)
            expiryFontSize: expiryFontSize / 3,
            addExpiry,
            expiryText
        };

        await createA4SheetPDF(barcodeImage, pdfOptions);
    };

    return (
        <div className="generate-page container">
            <div className="page-header">
                <h2>🛠️ 바코드/QR 생성기</h2>
                <p className="text-secondary">원하는 바코드 또는 QR 코드를 생성하세요</p>
            </div>

            <section className="section glass-card">
                <h3 className="section-title">바코드 정보</h3>

                <div className="form-group">
                    <label className="label">바코드 종류</label>
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

                <div className="form-group">
                    <label className="label">바코드 내용</label>
                    <input
                        type="text"
                        className="input"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="바코드에 들어갈 내용"
                        maxLength={100}
                    />
                </div>

                <div className="form-group">
                    <label className="label">상품명 (A4 배열 시 표시)</label>
                    <input
                        type="text"
                        className="input"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="상품명을 입력하세요"
                        maxLength={200}
                    />
                </div>

                <div className="form-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={removeSpecial}
                            onChange={(e) => setRemoveSpecial(e.target.checked)}
                        />
                        공백/특수문자 자동 제거
                    </label>
                </div>
            </section>

            <section className="section glass-card">
                <h3 className="section-title">글꼴 설정</h3>

                <div className="slider-container">
                    <label className="label">바코드 숫자 크기: {barcodeFontSize}px</label>
                    <input
                        type="range"
                        className="slider"
                        value={barcodeFontSize}
                        onChange={(e) => setBarcodeFontSize(Number(e.target.value))}
                        min={8} max={50}
                    />
                </div>

                <div className="slider-container">
                    <label className="label">상품명 크기: {labelFontSize}px</label>
                    <input
                        type="range"
                        className="slider"
                        value={labelFontSize}
                        onChange={(e) => setLabelFontSize(Number(e.target.value))}
                        min={10} max={100}
                    />
                </div>

                <div className="grid grid-2">
                    <div className="form-group">
                        <label className="label">상품명 줄 수</label>
                        <select
                            className="select"
                            value={maxLabelLines}
                            onChange={(e) => setMaxLabelLines(Number(e.target.value))}
                        >
                            <option value={1}>1줄</option>
                            <option value={2}>2줄</option>
                            <option value={3}>3줄</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="label">줄 간격</label>
                        <input
                            type="number"
                            className="input"
                            value={lineSpacing}
                            onChange={(e) => setLineSpacing(Number(e.target.value))}
                            min={0} max={20}
                        />
                    </div>
                </div>
            </section>

            <section className="section glass-card">
                <h3 className="section-title">A4 용지 설정 (폼텍 LS-3102)</h3>

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

                <div className="slider-container">
                    <label className="label">소비기한 크기: {expiryFontSize}px</label>
                    <input
                        type="range"
                        className="slider"
                        value={expiryFontSize}
                        onChange={(e) => setExpiryFontSize(Number(e.target.value))}
                        min={10} max={100}
                    />
                </div>

                <div className="grid grid-2">
                    <div className="form-group">
                        <label className="label">열 개수</label>
                        <input
                            type="number"
                            className="input"
                            value={cols}
                            onChange={(e) => setCols(Number(e.target.value))}
                            min={1} max={10}
                        />
                    </div>
                    <div className="form-group">
                        <label className="label">행 개수</label>
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

                <div className="alert alert-info">
                    <strong>🖨️ 인쇄 팁</strong>
                    <ul>
                        <li>일반 A4 용지에 먼저 테스트 인쇄하세요</li>
                        <li>인쇄 설정: "실제 크기", "100%" 선택</li>
                    </ul>
                </div>
            </section>

            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            <div className="action-buttons">
                <button className="btn btn-primary" onClick={handleGenerate}>
                    바코드 생성
                </button>

                {barcodeImage && (
                    <>
                        <button className="btn btn-outline" onClick={handleDownload}>
                            이미지 다운로드
                        </button>
                        <button className="btn btn-outline" onClick={handleCreateA4Sheet}>
                            A4 시트 (PNG)
                        </button>
                        <button className="btn btn-primary" onClick={handleCreateA4SheetPDF}>
                            📄 PDF 다운로드 (LS-3102)
                        </button>
                    </>
                )}
            </div>

            {barcodeImage && (
                <div className="preview-section glass-card animate-fadeIn">
                    <h3 className="section-title">미리보기</h3>
                    <div className="barcode-preview">
                        <img src={barcodeImage} alt="Generated barcode" />
                    </div>
                    <p className="text-center text-sm text-muted mt-2">
                        모바일에서는 이미지를 길게 눌러 저장할 수도 있습니다.
                    </p>
                </div>
            )}

            <div className="tips-section">
                <details>
                    <summary>❓ 사용 팁</summary>
                    <ul>
                        <li>문자/숫자/한글 모두 가능 (단, EAN13/EAN8은 숫자만)</li>
                        <li>바코드 하단 숫자 크기, 상품명 글씨 크기 조절 가능</li>
                        <li>상품명은 최대 3줄까지 자동 래핑</li>
                        <li>1D: CODE128(영숫자), EAN-13/8(숫자), Code39(영숫자)</li>
                        <li>A4 배열 기능은 상품명 입력 필수!</li>
                    </ul>
                </details>
            </div>
        </div>
    );
}
