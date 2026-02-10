import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../utils/LanguageContext';
import { Sidebar } from './Sidebar';
import './Header.css';

export function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, language, setLanguage } = useTranslation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const getTitle = () => {
        switch (location.pathname) {
            case '/': return t.nav.dashboard;
            case '/scan': return t.nav.scanner;
            case '/test': return t.nav.records;
            case '/compare': return t.compare.title;
            case '/ai': return t.ai.title;
            default: return 'Barcode App';
        }
    };

    return (
        <header className="app-header">
            <div className="header-inner container">
                <div className="header-left">
                    <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <div className="header-logo" onClick={() => navigate('/')}>
                        <span className="logo-dot"></span>
                        <h1>{getTitle()}</h1>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="lang-toggle-btn"
                        onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
                    >
                        {language === 'ko' ? 'EN' : 'KO'}
                    </button>
                    {/* Settings icon removed as requested - moved to bottom nav */}
                </div>
            </div>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </header>
    );
}

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    return (
        <nav className="app-bottom-nav">
            <div className="nav-inner container">
                <button
                    className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
                    onClick={() => navigate('/')}
                >
                    <span className="material-symbols-outlined">add_box</span>
                    <span>{t.nav.home}</span>
                </button>
                <button
                    className={`nav-item ${location.pathname === '/scan' ? 'active' : ''}`}
                    onClick={() => navigate('/scan')}
                >
                    <span className="material-symbols-outlined">qr_code_scanner</span>
                    <span>{t.nav.scan}</span>
                </button>
                <button
                    className={`nav-item ${location.pathname === '/compare' ? 'active' : ''}`}
                    onClick={() => navigate('/compare')}
                >
                    <span className="material-symbols-outlined">analytics</span>
                    <span>{t.nav.settings}</span>
                </button>
                <button
                    className={`nav-item ${location.pathname === '/test' ? 'active' : ''}`}
                    onClick={() => navigate('/test')}
                >
                    <span className="material-symbols-outlined">history</span>
                    <span>{t.nav.records}</span>
                </button>
                <button
                    className={`nav-item ${location.pathname === '/ai' ? 'active' : ''}`}
                    onClick={() => navigate('/ai')}
                >
                    <span className="material-symbols-outlined">smart_toy</span>
                    <span>{t.nav.ai}</span>
                </button>
            </div>
        </nav>
    );
}
