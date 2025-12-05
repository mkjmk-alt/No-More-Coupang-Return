import { Link, useLocation } from 'react-router-dom';
import './Header.css';

export function Header() {
    const location = useLocation();

    return (
        <header className="header">
            <div className="header-content">
                <Link to="/" className="header-logo">
                    <div className="logo-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                    </div>
                    <span className="logo-text">Barcode Lens</span>
                </Link>
                <span className="header-version">v2.0</span>
            </div>

            <nav className="header-nav">
                <Link
                    to="/"
                    className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                >
                    스캔
                </Link>
                <Link
                    to="/generate"
                    className={`nav-link ${location.pathname === '/generate' ? 'active' : ''}`}
                >
                    생성
                </Link>
            </nav>
        </header>
    );
}
