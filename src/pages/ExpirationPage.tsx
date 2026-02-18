import { useState, useMemo } from 'react';
import { useTranslation } from '../utils/LanguageContext';
import './ExpirationPage.css';

export function ExpirationPage() {
    const { t } = useTranslation();

    // Unified Validator State
    const [validatorType, setValidatorType] = useState<'EXPIRY' | 'MFG'>('EXPIRY');
    const [physicalDate, setPhysicalDate] = useState('');
    const [systemDate, setSystemDate] = useState('');
    const [isObscured, setIsObscured] = useState(false);
    const [isPhysicalMissing, setIsPhysicalMissing] = useState(false);
    const [isSystemMissing, setIsSystemMissing] = useState(false);

    const validationResult = useMemo(() => {
        // 1. Check for immediate failures (Missing or Obscured)
        if (isObscured) return { status: 'fail', reason: t.expiration.reasonSticker };
        if (isPhysicalMissing) return { status: 'fail', reason: t.expiration.reasonMissingPhysical };
        if (isSystemMissing) return { status: 'fail', reason: t.expiration.reasonMissingSystem };

        if (!physicalDate || !systemDate) return null;

        const pDate = new Date(physicalDate);
        const sDate = new Date(systemDate);

        // Normalize to midnight
        pDate.setHours(0, 0, 0, 0);
        sDate.setHours(0, 0, 0, 0);

        if (pDate < sDate) {
            return { status: 'fail', reason: t.expiration.reasonShort };
        }

        return { status: 'pass', reason: t.expiration.resultPass };
    }, [physicalDate, systemDate, validatorType, isObscured, isPhysicalMissing, isSystemMissing, t.expiration]);

    return (
        <div className="expiration-page container animate-fade">
            <section className="hero-section">
                <h2>{t.expiration.title}</h2>
                <p className="text-muted">{t.expiration.sub}</p>
            </section>

            <div className="validators-stack">
                {/* Unified Smart Validator */}
                <section className="validator-section mt-4 glass-card">
                    <div className="section-header">
                        <span className="material-symbols-outlined emoji">verified_user</span>
                        <h3>{t.expiration.unifiedValidatorTitle}</h3>
                    </div>

                    <div className="validator-type-toggle mt-3">
                        <button
                            className={`type-btn ${validatorType === 'EXPIRY' ? 'active' : ''}`}
                            onClick={() => setValidatorType('EXPIRY')}
                        >
                            {t.expiration.typeExpiry}
                        </button>
                        <button
                            className={`type-btn ${validatorType === 'MFG' ? 'active' : ''}`}
                            onClick={() => setValidatorType('MFG')}
                        >
                            {t.expiration.typeMfg}
                        </button>
                    </div>

                    <div className="validator-grid mt-3">
                        <div className="input-group">
                            <label className="info-label">{t.expiration.physicalLabel}</label>
                            <input
                                type="date"
                                className="input-field"
                                value={physicalDate}
                                onChange={(e) => setPhysicalDate(e.target.value)}
                                disabled={isPhysicalMissing}
                            />
                        </div>
                        <div className="input-group">
                            <label className="info-label">{t.expiration.systemLabel}</label>
                            <input
                                type="date"
                                className="input-field"
                                value={systemDate}
                                onChange={(e) => setSystemDate(e.target.value)}
                                disabled={isSystemMissing}
                            />
                        </div>

                        <div className="checkbox-stack mt-2">
                            <label className="checkbox-container">
                                <input
                                    type="checkbox"
                                    checked={isPhysicalMissing}
                                    onChange={(e) => setIsPhysicalMissing(e.target.checked)}
                                />
                                <span className="checkmark"></span>
                                {t.expiration.physicalMissing}
                            </label>
                            <label className="checkbox-container">
                                <input
                                    type="checkbox"
                                    checked={isSystemMissing}
                                    onChange={(e) => setIsSystemMissing(e.target.checked)}
                                />
                                <span className="checkmark"></span>
                                {t.expiration.systemMissing}
                            </label>
                            <label className="checkbox-container">
                                <input
                                    type="checkbox"
                                    checked={isObscured}
                                    onChange={(e) => setIsObscured(e.target.checked)}
                                />
                                <span className="checkmark"></span>
                                {t.expiration.stickerCovered}
                            </label>
                        </div>
                    </div>

                    {validationResult && (
                        <div className={`result-box mt-3 ${validationResult.status}`}>
                            <div className="result-header">
                                {validationResult.status === 'pass' ? t.expiration.resultPass : t.expiration.resultFail}
                            </div>
                            <p className="result-reason">{validationResult.reason}</p>
                            {validationResult.status === 'fail' && (
                                <p className="strict-notice mt-1">⚠️ {t.expiration.strictNotice}</p>
                            )}
                        </div>
                    )}
                </section>
            </div>

            <div className="expiration-grid mt-4">
                {/* Domestic & Imported Card */}
                <div className="info-card highlight-card">
                    <div className="card-header">
                        <span className="material-symbols-outlined">inventory_2</span>
                        <h3>{t.expiration.remaining}</h3>
                    </div>
                    <div className="criteria-list">
                        <div className="criteria-item">
                            <span className="label">{t.expiration.domestic}</span>
                            <span className="value primary">{t.expiration.criteria50}</span>
                        </div>
                        <div className="criteria-item">
                            <span className="label">{t.expiration.imported}</span>
                            <span className="value secondary">{t.expiration.criteria40}</span>
                        </div>
                    </div>
                </div>

                {/* Manufacturing Date Card */}
                <div className="info-card">
                    <div className="card-header">
                        <span className="material-symbols-outlined">factory</span>
                        <h3>{t.expiration.mfgDate}</h3>
                    </div>
                    <div className="mfg-list">
                        <div className="mfg-item">
                            <div className="mfg-main">
                                <span>{t.expiration.diaper} / {t.expiration.wetWipes}</span>
                                <span className="mfg-val">12~15개월</span>
                            </div>
                            <p className="mfg-sub">국내 12개월 / 수입 15개월 이내</p>
                        </div>
                        <div className="mfg-item">
                            <div className="mfg-main">
                                <span>{t.expiration.petWipes}</span>
                                <span className="mfg-val">8개월</span>
                            </div>
                            <p className="mfg-sub">국내/수입 공통 240일 이내</p>
                        </div>
                        <div className="mfg-item">
                            <div className="mfg-main">
                                <span>{t.expiration.grains}</span>
                                <span className="mfg-val">7~14일</span>
                            </div>
                            <p className="mfg-sub">{t.expiration.grainsTip}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pro Tips Section */}
            <section className="tips-section mt-4">
                <div className="section-header">
                    <span className="material-symbols-outlined emoji">lightbulb</span>
                    <h3>{t.expiration.tipTitle}</h3>
                </div>
                <div className="tips-grid mt-2">
                    <div className="tip-card">
                        <div className="tip-number">01</div>
                        <p>{t.expiration.tip1}</p>
                    </div>
                    <div className="tip-card">
                        <div className="tip-number">02</div>
                        <p>{t.expiration.tip2}</p>
                    </div>
                    <div className="tip-card">
                        <div className="tip-number">03</div>
                        <p>{t.expiration.tip3}</p>
                    </div>
                </div>
            </section>

            <section className="footer-notice mt-4">
                <p className="text-muted small">
                    * 위 기준은 쿠팡의 공식 공급자 입고 매뉴얼(v3.06) 및 로켓그로스 가이드를 바탕으로 작성되었습니다.
                    정확한 최신 기준은 윙(WING) 시스템의 공지사항을 반드시 확인하시기 바랍니다.
                </p>
            </section>
        </div>
    );
}
