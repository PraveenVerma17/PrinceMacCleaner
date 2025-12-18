import React, { useEffect, useState } from 'react';
import { Search, ChevronRight, ChevronDown, Package, Circle, CheckCircle, Trash2, FileText, Folder, Monitor } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface AppComponent {
    name: string;
    path: string;
    size: number;
    type: 'app' | 'plist' | 'folder' | 'file';
}

interface AppDetails {
    binaries: AppComponent[];
    preferences: AppComponent[];
    supportingFiles: AppComponent[];
}

interface AppItem {
    name: string;
    path: string;
    icon: string;
    size: number;
    lastUsed: number;
    isAppStore?: boolean;
    author?: string;
}

const AppManager: React.FC = () => {
    const [apps, setApps] = useState<AppItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
    const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
    const [appDetails, setAppDetails] = useState<Map<string, AppDetails>>(new Map());
    const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
    const [cleaning, setCleaning] = useState(false);

    const [category, setCategory] = useState<'all' | 'unused' | 'store' | 'apple' | 'other'>('all');
    const [sort, setSort] = useState<'name' | 'size'>('name');

    useEffect(() => {
        loadApps();
    }, []);

    const loadApps = async () => {
        setLoading(true);
        try {
            const data = await window.ipcRenderer.invoke('get-apps');
            setApps(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAppExpansion = async (appPath: string) => {
        const newExpanded = new Set(expandedApps);
        if (newExpanded.has(appPath)) {
            newExpanded.delete(appPath);
        } else {
            newExpanded.add(appPath);
            // Load details if not already loaded
            if (!appDetails.has(appPath)) {
                setLoadingDetails(new Set(loadingDetails).add(appPath));
                try {
                    const details = await window.ipcRenderer.invoke('get-app-details', appPath);
                    setAppDetails(new Map(appDetails).set(appPath, details));
                } catch (error) {
                    console.error('Failed to load app details:', error);
                } finally {
                    const newLoading = new Set(loadingDetails);
                    newLoading.delete(appPath);
                    setLoadingDetails(newLoading);
                }
            }
        }
        setExpandedApps(newExpanded);
    };

    const toggleAppSelection = (appPath: string) => {
        const newSelected = new Set(selectedApps);
        if (newSelected.has(appPath)) {
            newSelected.delete(appPath);
        } else {
            newSelected.add(appPath);
        }
        setSelectedApps(newSelected);
    };

    const handleUninstallSelected = async () => {
        if (selectedApps.size === 0) return;

        const appNames = Array.from(selectedApps).map(p => apps.find(a => a.path === p)?.name).filter(Boolean).join(', ');
        if (!confirm(`Are you sure you want to uninstall ${selectedApps.size} app(s)?\n\n${appNames}`)) return;

        setCleaning(true);
        try {
            for (const appPath of Array.from(selectedApps)) {
                try {
                    await window.ipcRenderer.invoke('uninstall-app', appPath);
                } catch (error) {
                    console.error(`Failed to uninstall ${appPath}:`, error);
                }
            }
            // Reload apps
            await loadApps();
            setSelectedApps(new Set());
            setExpandedApps(new Set());
        } catch (error) {
            alert('Some apps failed to uninstall');
        } finally {
            setCleaning(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 KB';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getFilterCount = (cat: typeof category) => {
        switch (cat) {
            case 'all': return apps.length;
            case 'store': return apps.filter(a => a.isAppStore).length;
            case 'apple': return apps.filter(a => a.author === 'Apple').length;
            case 'other': return apps.filter(a => a.author !== 'Apple').length;
            case 'unused': return 0;
            default: return 0;
        }
    };

    const filteredApps = apps
        .filter(app => {
            const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase());
            if (!matchesSearch) return false;

            if (category === 'store') return app.isAppStore;
            if (category === 'apple') return app.author === 'Apple';
            if (category === 'other') return app.author !== 'Apple';
            if (category === 'unused') return false;

            return true;
        })
        .sort((a, b) => {
            if (sort === 'size') return b.size - a.size;
            return a.name.localeCompare(b.name);
        });

    if (loading) return <LoadingSpinner message="Scanning Applications..." />;

    const SidebarItem = ({ label, cat, count }: { label: string, cat: typeof category, count: number | string }) => (
        <div
            onClick={() => { setCategory(cat); setSelectedApps(new Set()); }}
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: category === cat ? 'rgba(255,255,255,0.1)' : 'transparent',
                opacity: category === cat ? 1 : 0.7
            }}
        >
            <span style={{ fontSize: '14px', fontWeight: category === cat ? 500 : 400 }}>{label}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{count}</span>
        </div>
    );

    const ComponentRow = ({ component, indent = 0 }: { component: AppComponent, indent?: number }) => (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            paddingLeft: `${16 + indent * 32}px`,
            fontSize: '13px',
            color: 'var(--text-secondary)'
        }}>
            <div style={{ marginRight: 16, display: 'flex', alignItems: 'center' }}>
                <Circle size={16} color="var(--text-secondary)" strokeWidth={1.5} />
            </div>
            <div style={{ marginRight: 12 }}>
                {component.type === 'folder' ? <Folder size={18} /> : <FileText size={18} />}
            </div>
            <div style={{ flex: 1 }}>{component.name}</div>
            <div style={{ minWidth: '80px', textAlign: 'right' }}>{formatBytes(component.size)}</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left Sidebar */}
                <div style={{
                    width: '240px',
                    padding: '24px 16px',
                    borderRight: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                    overflowY: 'auto'
                }}>
                    <div>
                        <SidebarItem label="All Applications" cat="all" count={getFilterCount('all')} />
                        <SidebarItem label="Unused" cat="unused" count={getFilterCount('unused')} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: 12, marginBottom: 8, textTransform: 'uppercase' }}>Stores</h3>
                        <SidebarItem label="App Store" cat="store" count={getFilterCount('store')} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: 12, marginBottom: 8, textTransform: 'uppercase' }}>Vendors</h3>
                        <SidebarItem label="Apple" cat="apple" count={getFilterCount('apple')} />
                        <SidebarItem label="Other" cat="other" count={getFilterCount('other')} />
                    </div>
                </div>

                {/* Right Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: '32px 40px 20px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <h1 style={{ fontSize: '28px', margin: 0 }}>
                                {category === 'all' && 'All Applications'}
                                {category === 'store' && 'App Store Apps'}
                                {category === 'apple' && 'Apple Apps'}
                                {category === 'other' && 'Other Apps'}
                                {category === 'unused' && 'Unused Apps'}
                            </h1>
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '240px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <Search size={14} color="var(--text-secondary)" />
                                    <input
                                        type="text"
                                        placeholder="Search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            outline: 'none',
                                            fontSize: '13px',
                                            width: '100%'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                            {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''} found.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                            <button
                                onClick={() => setSort(s => s === 'size' ? 'name' : 'size')}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                                Sort by {sort === 'size' ? 'Size' : 'Name'} ▼
                            </button>
                        </div>
                    </div>

                    {/* List Container */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 40px 40px' }}>
                        {filteredApps.map((app) => {
                            const isSelected = selectedApps.has(app.path);
                            const isExpanded = expandedApps.has(app.path);
                            const details = appDetails.get(app.path);
                            const isLoadingDetails = loadingDetails.has(app.path);

                            return (
                                <div key={app.path} style={{ marginBottom: '4px' }}>
                                    {/* Main App Row */}
                                    <div
                                        onClick={() => toggleAppSelection(app.path)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            backgroundColor: isSelected ? 'rgba(255, 60, 172, 0.1)' : 'transparent',
                                            transition: 'background-color 0.2s',
                                            border: isSelected ? '1px solid var(--accent-color)' : '1px solid transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        {/* Selection Circle */}
                                        <div style={{ marginRight: 24, display: 'flex', alignItems: 'center' }}>
                                            {isSelected ? (
                                                <CheckCircle size={20} color="var(--accent-color)" />
                                            ) : (
                                                <Circle size={20} color="var(--text-secondary)" strokeWidth={1.5} />
                                            )}
                                        </div>

                                        {/* Icon */}
                                        <div style={{ width: 42, height: 42, marginRight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {app.icon && app.icon.length > 50 ? (
                                                <img src={app.icon} alt={app.name} style={{ width: '100%', height: '100%' }} />
                                            ) : (
                                                app.name.toLowerCase().includes('electron') ?
                                                    <Monitor size={32} color="var(--text-secondary)" /> :
                                                    <Package size={32} color="var(--text-secondary)" />
                                            )}
                                        </div>

                                        {/* Name */}
                                        <div style={{ flex: 1, fontWeight: 500, fontSize: '15px' }}>
                                            {app.name}
                                            {app.isAppStore && <span style={{ fontSize: '10px', marginLeft: 8, padding: '2px 4px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>App Store</span>}
                                        </div>

                                        {/* Expand/Collapse - Separate click handler */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent row selection
                                                toggleAppExpansion(app.path);
                                            }}
                                            style={{ marginRight: 16, cursor: 'pointer', padding: '4px' }}
                                        >
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </div>

                                        {/* Size */}
                                        <div style={{ minWidth: '100px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                            {formatBytes(app.size)}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div style={{ marginLeft: 0, marginTop: 4, marginBottom: 8, background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
                                            {isLoadingDetails ? (
                                                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading details...</div>
                                            ) : details ? (
                                                <>
                                                    {/* Binaries */}
                                                    {details.binaries.length > 0 && (
                                                        <div>
                                                            <div style={{ padding: '12px 16px', fontWeight: 500, fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>Binaries</div>
                                                            {details.binaries.map((comp, i) => <ComponentRow key={i} component={comp} indent={1} />)}
                                                        </div>
                                                    )}
                                                    {/* Preferences */}
                                                    {details.preferences.length > 0 && (
                                                        <div>
                                                            <div style={{ padding: '12px 16px', fontWeight: 500, fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>Preferences</div>
                                                            {details.preferences.map((comp, i) => <ComponentRow key={i} component={comp} indent={1} />)}
                                                        </div>
                                                    )}
                                                    {/* Supporting Files */}
                                                    {details.supportingFiles.length > 0 && (
                                                        <div>
                                                            <div style={{ padding: '12px 16px', fontWeight: 500, fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}>Supporting Files</div>
                                                            {details.supportingFiles.map((comp, i) => <ComponentRow key={i} component={comp} indent={1} />)}
                                                        </div>
                                                    )}
                                                    {details.binaries.length === 0 && details.preferences.length === 0 && details.supportingFiles.length === 0 && (
                                                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>No additional components found</div>
                                                    )}
                                                </>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {filteredApps.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 80 }}>
                                {category === 'unused' ? 'Usage tracking not yet enabled.' : 'No applications found.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Uninstall Button - Circular Design */}
            {selectedApps.size > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: 40,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000
                }}>
                    <button
                        onClick={handleUninstallSelected}
                        disabled={cleaning}
                        style={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            background: cleaning ? 'rgba(255, 82, 82, 0.5)' : 'linear-gradient(135deg, #FF5252 0%, #E91E63 100%)',
                            border: 'none',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: cleaning ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 8px 32px rgba(255, 82, 82, 0.5)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            opacity: cleaning ? 0.6 : 1,
                            backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={(e) => {
                            if (!cleaning) {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = '0 12px 40px rgba(255, 82, 82, 0.6)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!cleaning) {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 82, 82, 0.5)';
                            }
                        }}
                        onMouseDown={(e) => !cleaning && (e.currentTarget.style.transform = 'scale(1.05)')}
                        onMouseUp={(e) => !cleaning && (e.currentTarget.style.transform = 'scale(1.1)')}
                    >
                        <Trash2 size={32} />
                        <span style={{ fontSize: '12px' }}>
                            {cleaning ? 'Removing...' : 'Uninstall'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default AppManager;
