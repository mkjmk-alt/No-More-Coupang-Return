import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../utils/LanguageContext';
import './Sidebar.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const menuItems = [
        { path: '/', label: t.nav.home, icon: 'add_box' },
        { path: '/scan', label: t.nav.scan, icon: 'qr_code_scanner' },
        { path: '/compare', label: t.nav.settings, icon: 'analytics' },
        { path: '/test', label: t.nav.records, icon: 'history' },
    ];

    const handleNavigate = (path: string) => {
        navigate(path);
        onClose();
    };

    return (
        <>
            <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2>Menu</h2>
                    <button className="close-btn" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <nav className="sidebar-content">
                    {menuItems.map((item) => (
                        <button
                            key={item.path}
                            className={`sidebar-menu-item ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => handleNavigate(item.path)}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="footer-brand">
                        <span className="footer-dot"></span>
                        <span>BARCODE LENS</span>
                    </div>
                </div>
            </aside>
        </>
    );
}
