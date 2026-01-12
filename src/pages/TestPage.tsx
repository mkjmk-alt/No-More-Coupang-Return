import { useState } from 'react';
import { generateQRCode, downloadImage } from '../utils/barcodeGenerator';
import type { QRErrorCorrectionLevel, QREncodingMode } from '../utils/barcodeGenerator';
import JSZip from 'jszip';
import './TestPage.css';

// QR 코드 옵션 상수
const ERROR_CORRECTION_LEVELS: QRErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];
const MASK_PATTERNS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const ENCODING_MODES: QREncodingMode[] = ['auto', 'numeric', 'alphanumeric', 'byte', 'kanji'];
const VERSIONS = Array.from({ length: 40 }, (_, i) => i + 1);

// 에러 보정 레벨 설명
const ERROR_LEVEL_DESC: Record<QRErrorCorrectionLevel, string> = {
    'L': '낮음 (7% 복구)',
    'M': '중간 (15% 복구)',
    'Q': '높음 (25% 복구)',
    'H': '최고 (30% 복구)'
};

// 인코딩 모드 설명
const MODE_DESC: Record<QREncodingMode, string> = {
    'auto': '자동 (데이터에 따라 선택)',
    'numeric': '숫자 (0-9만)',
    'alphanumeric': '영숫자 (대문자, 숫자, 일부 기호)',
    'byte': '바이트 (모든 문자)',
    'kanji': '한자 (일본어)'
};

interface GeneratedQR {
    errorLevel: QRErrorCorrectionLevel;
    maskPattern: number;
    mode: QREncodingMode;
    version: number | undefined;
    dataUrl: string | null;
    filename: string;
    error?: string;
}

export function TestPage() {
    const [testContent, setTestContent] = useState('https://example.com');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedQRs, setGeneratedQRs] = useState<GeneratedQR[]>([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState('');

    // 선택된 옵션들
    const [selectedLevels, setSelectedLevels] = useState<QRErrorCorrectionLevel[]>(['M']);
    const [selectedMasks, setSelectedMasks] = useState<number[]>([]);
    const [selectedModes, setSelectedModes] = useState<QREncodingMode[]>(['auto']);
    const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
    const [useAutoVersion, setUseAutoVersion] = useState(true);

    // 모든 조합 생성
    const generateAllCombinations = async () => {
        if (!testContent.trim()) {
            setError('테스트할 내용을 입력하세요.');
            return;
        }

        setIsGenerating(true);
        setError('');
        setGeneratedQRs([]);

        // 선택된 옵션이 없으면 기본값 사용
        const levels = selectedLevels.length > 0 ? selectedLevels : ['M'] as QRErrorCorrectionLevel[];
        const masks = selectedMasks.length > 0 ? selectedMasks : [undefined];
        const modes = selectedModes.length > 0 ? selectedModes : ['auto'] as QREncodingMode[];
        const versions = useAutoVersion ? [undefined] : (selectedVersions.length > 0 ? selectedVersions : [undefined]);

        const combinations: { level: QRErrorCorrectionLevel; mask: number | undefined; mode: QREncodingMode; version: number | undefined }[] = [];

        for (const level of levels) {
            for (const mask of masks) {
                for (const mode of modes) {
                    for (const version of versions) {
                        combinations.push({ level, mask, mode, version });
                    }
                }
            }
        }

        setProgress({ current: 0, total: combinations.length });

        const results: GeneratedQR[] = [];

        for (let i = 0; i < combinations.length; i++) {
            const { level, mask, mode, version } = combinations[i];

            // UI 업데이트를 위해 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 0));

            try {
                const dataUrl = await generateQRCode(testContent, {
                    width: 300,
                    margin: 2,
                    errorCorrectionLevel: level,
                    maskPattern: mask as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined,
                    mode,
                    version
                });

                const filename = `qr_${level}_mask${mask ?? 'auto'}_${mode}_v${version ?? 'auto'}.png`;

                if (dataUrl) {
                    results.push({
                        errorLevel: level,
                        maskPattern: mask ?? -1,
                        mode,
                        version,
                        dataUrl,
                        filename
                    });
                } else {
                    // 생성 실패 (null 반환)
                    results.push({
                        errorLevel: level,
                        maskPattern: mask ?? -1,
                        mode,
                        version,
                        dataUrl: null,
                        filename,
                        error: '생성 실패 (용량 초과 등)'
                    });
                }
            } catch (err) {
                const filename = `qr_${level}_mask${mask ?? 'auto'}_${mode}_v${version ?? 'auto'}.png`;
                results.push({
                    errorLevel: level,
                    maskPattern: mask ?? -1,
                    mode,
                    version,
                    dataUrl: null,
                    filename,
                    error: err instanceof Error ? err.message : '알 수 없는 오류'
                });
            }

            setProgress({ current: i + 1, total: combinations.length });
        }

        setGeneratedQRs(results);
        setIsGenerating(false);
    };

    // ZIP으로 모든 QR 코드 다운로드
    const downloadAllAsZip = async () => {
        const validQRs = generatedQRs.filter(qr => qr.dataUrl);
        if (validQRs.length === 0) return;

        const zip = new JSZip();

        for (const qr of validQRs) {
            if (qr.dataUrl) {
                // Data URL에서 base64 데이터 추출
                const base64Data = qr.dataUrl.split(',')[1];
                zip.file(qr.filename, base64Data, { base64: true });
            }
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr_test_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // 개별 다운로드
    const handleDownloadSingle = (qr: GeneratedQR) => {
        if (qr.dataUrl) {
            downloadImage(qr.dataUrl, qr.filename);
        }
    };

    // 체크박스 토글 헬퍼
    const toggleArrayItem = <T,>(arr: T[], item: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        if (arr.includes(item)) {
            setter(arr.filter(x => x !== item));
        } else {
            setter([...arr, item]);
        }
    };

    // 전체 선택/해제
    const selectAll = <T,>(items: readonly T[], setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        setter([...items]);
    };

    const deselectAll = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        setter([]);
    };

    // 예상 조합 수 계산
    const estimatedCount = () => {
        const levels = selectedLevels.length || 1;
        const masks = selectedMasks.length || 1;
        const modes = selectedModes.length || 1;
        const versions = useAutoVersion ? 1 : (selectedVersions.length || 1);
        return levels * masks * modes * versions;
    };

    return (
        <div className="test-page container">
            <div className="page-header">
                <h2>🧪 QR 코드 테스트</h2>
                <p className="text-muted">모든 QR 코드 변수 조합을 테스트하고 이미지로 저장합니다.</p>
            </div>

            {/* 테스트 내용 입력 */}
            <div className="card">
                <div className="form-group">
                    <label className="label">테스트 내용</label>
                    <input
                        type="text"
                        className="input"
                        value={testContent}
                        onChange={(e) => setTestContent(e.target.value)}
                        placeholder="QR 코드에 인코딩할 내용"
                    />
                </div>
            </div>

            {/* 옵션 선택 */}
            <div className="options-grid">
                {/* 에러 보정 레벨 */}
                <div className="card option-card">
                    <div className="option-header">
                        <h3>📊 에러 보정 레벨</h3>
                        <div className="option-actions">
                            <button className="btn-link" onClick={() => selectAll(ERROR_CORRECTION_LEVELS, setSelectedLevels)}>전체</button>
                            <button className="btn-link" onClick={() => deselectAll(setSelectedLevels)}>해제</button>
                        </div>
                    </div>
                    <div className="option-list">
                        {ERROR_CORRECTION_LEVELS.map(level => (
                            <label key={level} className="checkbox-item">
                                <input
                                    type="checkbox"
                                    checked={selectedLevels.includes(level)}
                                    onChange={() => toggleArrayItem(selectedLevels, level, setSelectedLevels)}
                                />
                                <span><strong>{level}</strong> - {ERROR_LEVEL_DESC[level]}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 마스크 패턴 */}
                <div className="card option-card">
                    <div className="option-header">
                        <h3>🎭 마스크 패턴</h3>
                        <div className="option-actions">
                            <button className="btn-link" onClick={() => setSelectedMasks([...MASK_PATTERNS])}>전체</button>
                            <button className="btn-link" onClick={() => deselectAll(setSelectedMasks)}>해제</button>
                        </div>
                    </div>
                    <div className="option-list option-grid-small">
                        {MASK_PATTERNS.map(mask => (
                            <label key={mask} className="checkbox-item">
                                <input
                                    type="checkbox"
                                    checked={selectedMasks.includes(mask)}
                                    onChange={() => toggleArrayItem(selectedMasks, mask, setSelectedMasks)}
                                />
                                <span>패턴 {mask}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-sm text-muted">선택 안함 = 자동</p>
                </div>

                {/* 인코딩 모드 */}
                <div className="card option-card">
                    <div className="option-header">
                        <h3>📝 인코딩 모드</h3>
                        <div className="option-actions">
                            <button className="btn-link" onClick={() => selectAll(ENCODING_MODES, setSelectedModes)}>전체</button>
                            <button className="btn-link" onClick={() => deselectAll(setSelectedModes)}>해제</button>
                        </div>
                    </div>
                    <div className="option-list">
                        {ENCODING_MODES.map(mode => (
                            <label key={mode} className="checkbox-item">
                                <input
                                    type="checkbox"
                                    checked={selectedModes.includes(mode)}
                                    onChange={() => toggleArrayItem(selectedModes, mode, setSelectedModes)}
                                />
                                <span><strong>{mode}</strong> - {MODE_DESC[mode]}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 버전 */}
                <div className="card option-card">
                    <div className="option-header">
                        <h3>📐 버전 (1-40)</h3>
                        <div className="option-actions">
                            <button className="btn-link" onClick={() => { setUseAutoVersion(false); setSelectedVersions([1, 5, 10, 20, 40]); }}>샘플</button>
                            <button className="btn-link" onClick={() => { setUseAutoVersion(true); deselectAll(setSelectedVersions); }}>자동</button>
                        </div>
                    </div>
                    <label className="checkbox-item">
                        <input
                            type="checkbox"
                            checked={useAutoVersion}
                            onChange={(e) => setUseAutoVersion(e.target.checked)}
                        />
                        <span>자동 버전 (라이브러리가 결정)</span>
                    </label>
                    {!useAutoVersion && (
                        <div className="version-grid">
                            {VERSIONS.map(v => (
                                <label key={v} className="checkbox-item-small">
                                    <input
                                        type="checkbox"
                                        checked={selectedVersions.includes(v)}
                                        onChange={() => toggleArrayItem(selectedVersions, v, setSelectedVersions)}
                                    />
                                    <span>{v}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 생성 버튼 */}
            <div className="card generate-section">
                <div className="generate-info">
                    <p>예상 생성 개수: <strong>{estimatedCount()}</strong>개 QR 코드</p>
                </div>
                <button
                    className="btn btn-primary btn-lg"
                    onClick={generateAllCombinations}
                    disabled={isGenerating}
                >
                    {isGenerating ? `생성 중... (${progress.current}/${progress.total})` : '🚀 모든 조합 생성'}
                </button>
            </div>

            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            {/* 생성 진행률 */}
            {isGenerating && (
                <div className="progress-section">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                    </div>
                    <p className="text-center text-sm">{progress.current} / {progress.total}</p>
                </div>
            )}

            {/* 생성 결과 */}
            {generatedQRs.length > 0 && (
                <div className="results-section">
                    <div className="results-header">
                        <h3>생성 결과: {generatedQRs.length}개</h3>
                        <button className="btn btn-primary" onClick={downloadAllAsZip}>
                            📦 전체 ZIP 다운로드
                        </button>
                    </div>

                    <div className="qr-grid">
                        {generatedQRs.map((qr, index) => (
                            <div key={index} className={`qr-card ${!qr.dataUrl ? 'error-card' : ''}`}>
                                {qr.dataUrl ? (
                                    <img src={qr.dataUrl} alt={qr.filename} />
                                ) : (
                                    <div className="qr-error-placeholder">
                                        <span>⚠️ 실패</span>
                                        <small>{qr.error}</small>
                                    </div>
                                )}
                                <div className="qr-info">
                                    <span className="badge">{qr.errorLevel}</span>
                                    <span className="badge badge-secondary">M{qr.maskPattern === -1 ? 'auto' : qr.maskPattern}</span>
                                    <span className="badge badge-secondary">{qr.mode}</span>
                                    <span className="badge badge-secondary">v{qr.version ?? 'auto'}</span>
                                </div>
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => qr.dataUrl && handleDownloadSingle(qr)}
                                    disabled={!qr.dataUrl}
                                >
                                    다운로드
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
