import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../utils/LanguageContext';
import './Sidebar.css';

interface SidebarMenuItem {
    path: string;
    label: string;
    icon: string;
    disabled?: boolean;
}

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const menuGroups: { title: string; items: SidebarMenuItem[] }[] = [
        {
            title: t.nav.categories.barcode,
            items: [
                { path: '/', label: t.nav.home, icon: 'add_box' },
                { path: '/scan', label: t.nav.scan, icon: 'qr_code_scanner' },
                { path: '/compare', label: t.nav.settings, icon: 'analytics' },
                { path: '/test', label: t.nav.records, icon: 'history' },
            ]
        },
        {
            title: t.nav.categories.expiration,
            items: [
                // Future items for Expiration Date
                { path: '#', label: '유통기한 관리 (준비 중)', icon: 'calendar_today', disabled: true },
            ]
        },
        {
            title: t.nav.categories.ai,
            items: [
                { path: '/ai', label: t.nav.ai, icon: 'smart_toy' },
            ]
        }
    ];

    const handleNavigate = (path: string, disabled?: boolean) => {
        if (disabled || path === '#') return;
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
                    {menuGroups.map((group, idx) => (
                        <div key={idx} className="sidebar-group">
                            <h3 className="sidebar-category-header">{group.title}</h3>
                            <div className="sidebar-items">
                                {group.items.map((item) => (
                                    <button
                                        key={item.path + item.label}
                                        className={`sidebar-menu-item ${location.pathname === item.path ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                                        onClick={() => handleNavigate(item.path, item.disabled)}
                                    >
                                        <span className="material-symbols-outlined">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
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
