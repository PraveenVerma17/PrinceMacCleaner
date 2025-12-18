import React, { useEffect, useState } from 'react';
import { HardDrive, Server, Activity, Battery, Wifi, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface DashboardProps {
    onViewChange: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = async () => {
        try {
            const data = await window.ipcRenderer.getSystemStats();
            console.log('Stats:', data);
            setStats(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchStats();
        // Add a small delay so the animation is visible even if fetch is fast
        await new Promise(r => setTimeout(r, 500));
        setRefreshing(false);
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Storage I/O might be heavy, but SI handles keys. CPU/Mem is fast.
        return () => clearInterval(interval);
    }, []);

    if (loading) return <LoadingSpinner message="Loading Dashboard..." />;

    if (!stats) return <div style={{ padding: 40, color: '#FF5252' }}>Failed to load system stats.</div>;

    // Format bytes
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const usedMem = stats.mem.used;
    const totalMem = stats.mem.total;
    const memPercent = (usedMem / totalMem) * 100;

    const usedDisk = stats.disk.used;
    const totalDisk = stats.disk.size;
    const diskPercent = (usedDisk / totalDisk) * 100;

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '28px' }}>System Overview</h2>
                <button
                    onClick={handleRefresh}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: refreshing ? 'var(--accent-color)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: '50%',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Refresh Stats"
                >
                    <RefreshCw
                        size={20}
                        style={{
                            animation: refreshing ? 'spin 1s linear infinite' : 'none'
                        }}
                    />
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>

                {/* Storage Card */}
                <div
                    onClick={() => onViewChange('junk')}
                    style={{
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: 'var(--border-radius-lg)',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255, 60, 172, 0.1)' }}>
                            <HardDrive size={24} color="#FF3CAC" />
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Storage</div>
                            <div style={{ fontSize: '18px', fontWeight: 600 }}>Main Drive</div>
                        </div>
                        <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                            <ArrowUp size={16} style={{ transform: 'rotate(45deg)' }} />
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                            <span>{formatBytes(usedDisk)} used</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{formatBytes(stats.disk.available)} available</span>
                        </div>
                        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                            <div style={{
                                height: '100%',
                                width: `${diskPercent}%`,
                                background: '#FF3CAC',
                                borderRadius: '3px',
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                    </div>
                </div>

                {/* RAM Card */}
                <div
                    onClick={() => onViewChange('ram')}
                    style={{
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: 'var(--border-radius-lg)',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(43, 134, 197, 0.1)' }}>
                            <Server size={24} color="#2B86C5" />
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Memory</div>
                            <div style={{ fontSize: '18px', fontWeight: 600 }}>RAM Usage</div>
                        </div>
                        <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                            <ArrowUp size={16} style={{ transform: 'rotate(45deg)' }} />
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                            <span>{formatBytes(usedMem)} used</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{formatBytes(stats.mem.available)} available</span>
                        </div>
                        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                            <div style={{
                                height: '100%',
                                width: `${memPercent}%`,
                                background: '#2B86C5',
                                borderRadius: '3px',
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                    </div>
                </div>

                {/* Processor Card */}
                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--border-radius-lg)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(120, 75, 160, 0.1)' }}>
                            <Activity size={24} color="#784BA0" />
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Processor</div>
                            <div style={{ fontSize: '18px', fontWeight: 600 }}>{stats.cpu.brand}</div>
                        </div>
                    </div>

                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {stats.cpu.cores} Cores • {stats.cpu.speed} GHz
                        <br />
                        Virtualization: {stats.cpu.virtualization ? 'Enabled' : 'Disabled'}
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                            <span>Load</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{Math.round(stats.cpu.load)}%</span>
                        </div>
                        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                            <div style={{
                                height: '100%',
                                width: `${stats.cpu.load}%`,
                                background: stats.cpu.load < 50 ? '#4CAF50' : (stats.cpu.load < 80 ? '#FFC107' : '#FF5252'),
                                borderRadius: '3px',
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                    </div>
                </div>

                {/* Network Card */}
                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--border-radius-lg)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(0, 188, 212, 0.1)' }}>
                            {/* Use Wifi icon if available, import first */}
                            <Wifi size={24} color="#00BCD4" />
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Network</div>
                            <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                {(!stats.network.ssid || stats.network.ssid === 'Wi-Fi' || stats.network.ssid.includes('redacted'))
                                    ? 'Private Wi-Fi'
                                    : stats.network.ssid}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ArrowDown size={16} color="#4CAF50" />
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Download</div>
                                <div style={{ fontWeight: 600 }}>{formatBytes(stats.network.rx_sec || 0)}/s</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ArrowUp size={16} color="#FF5252" />
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Upload</div>
                                <div style={{ fontWeight: 600 }}>{formatBytes(stats.network.tx_sec || 0)}/s</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Battery Card */}
                {stats.battery && stats.battery.hasBattery && (
                    <div style={{
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: 'var(--border-radius-lg)',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(76, 175, 80, 0.1)' }}>
                                <Battery size={24} color="#4CAF50" />
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Battery</div>
                                <div style={{ fontSize: '18px', fontWeight: 600 }}>{stats.battery.percent}%</div>
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span>{stats.battery.isCharging ? 'Charging' : 'Discharging'}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {stats.battery.timeRemaining ? `${Math.floor(stats.battery.timeRemaining / 60)}h ${stats.battery.timeRemaining % 60}m` : ''}
                                </span>
                            </div>
                            <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${stats.battery.percent}%`,
                                    background: stats.battery.isCharging ? '#4CAF50' : (stats.battery.percent < 20 ? '#FF5252' : '#4CAF50'),
                                    borderRadius: '3px',
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Dashboard;
