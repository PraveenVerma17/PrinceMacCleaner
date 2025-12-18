import React from 'react';
import { Trash2, Cpu, Activity, HardDrive, LayoutDashboard, Info } from 'lucide-react';

interface SidebarProps {
    currentView: string;
    onViewChange: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'smart-scan', label: 'Smart Scan', icon: Activity },
        { id: 'uninstaller', label: 'Uninstaller', icon: Trash2 },
        { id: 'ram', label: 'RAM Cleaner', icon: Cpu },
        { id: 'junk', label: 'Junk Cleaner', icon: HardDrive },
        { id: 'info', label: 'System Info', icon: Info }
    ];

    return (
        <div style={{
            width: '240px',
            backgroundColor: 'var(--bg-sidebar)',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 0',
            borderRight: '1px solid var(--border-color)',
            height: '100vh',
            boxSizing: 'border-box',
            WebkitAppRegion: 'drag' // Allow dragging window
        } as any}>
            <div style={{ padding: '0 24px 32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--accent-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Activity size={20} color="white" />
                </div>
                <h1 style={{ fontSize: '18px', fontWeight: 700 }}>MacCleaner</h1>
            </div>

            <nav style={{ flex: 1, padding: '0 12px' }}>
                {menuItems.map((item) => {
                    const isActive = currentView === item.id;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 16px',
                                backgroundColor: isActive ? 'var(--bg-card-hover)' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                color: isActive ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                marginBottom: '4px',
                                transition: 'all 0.2s',
                                WebkitAppRegion: 'no-drag' // Clickable areas must not be draggable
                            } as any}
                        >
                            <Icon size={18} />
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div style={{ padding: '24px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                v1.0.0
            </div>
        </div>
    );
};

export default Sidebar;
