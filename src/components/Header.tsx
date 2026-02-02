import { Link, useLocation } from 'react-router-dom';
import './Header.css';

export function Header() {
    return (
        <header className="header">
            <Link to="/" className="header-logo">
                <span className="logo-line-1">NEO-</span>
                <span className="logo-line-2">SCAN</span>
            </Link>
        </header>
    );
}

export function BottomNav() {
    const location = useLocation();

    return (
        <nav className="bottom-nav">
            <Link to="/" className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
                <span className="material-symbols-outlined">home</span>
                <span className="nav-label">HOME</span>
            </Link>
            <Link to="/generate" className={`bottom-nav-item ${location.pathname === '/generate' ? 'active' : ''}`}>
                <span className="material-symbols-outlined">add_box</span>
                <span className="nav-label">GEN</span>
            </Link>
            <Link to="/test" className={`bottom-nav-item ${location.pathname === '/test' ? 'active' : ''}`}>
                <span className="material-symbols-outlined">history</span>
                <span className="nav-label">HISTORY</span>
            </Link>
            <Link to="/compare" className={`bottom-nav-item ${location.pathname === '/compare' ? 'active' : ''}`}>
                <span className="material-symbols-outlined">settings</span>
                <span className="nav-label">SETTINGS</span>
            </Link>
        </nav>
    );
}
