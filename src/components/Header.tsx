import { useNavigate, useLocation } from 'react-router-dom';
import './Header.css';

export function Header() {
    const navigate = useNavigate();
    const location = useLocation();

    const getTitle = () => {
        switch (location.pathname) {
            case '/': return 'Dashboard';
            case '/scan': return 'Scanner';
            case '/test': return 'History';
            case '/compare': return 'Settings';
            default: return 'Barcode App';
        }
    };

    return (
        <header className="app-header">
            <div className="header-inner container">
                <div className="header-logo" onClick={() => navigate('/')}>
                    <span className="logo-dot"></span>
                    <h1>{getTitle()}</h1>
                </div>
                <button className="icon-btn settings-trigger" onClick={() => navigate('/compare')}>
                    <span className="material-symbols-outlined">settings</span>
                </button>
            </div>
        </header>
    );
}

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <nav className="app-bottom-nav">
            <div className="nav-inner container">
                <button
                    className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
                    onClick={() => navigate('/')}
                >
                    <span className="material-symbols-outlined">grid_view</span>
                    <span>Home</span>
                </button>
                <button
                    className={`nav-item ${location.pathname === '/scan' ? 'active' : ''}`}
                    onClick={() => navigate('/scan')}
                >
                    <span className="material-symbols-outlined">qr_code_scanner</span>
                    <span>Scan</span>
                </button>
                <button
                    className={`nav-item ${location.pathname === '/test' ? 'active' : ''}`}
                    onClick={() => navigate('/test')}
                >
                    <span className="material-symbols-outlined">history</span>
                    <span>Records</span>
                </button>
            </div>
        </nav>
    );
}
