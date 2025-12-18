import React, { useState } from 'react';
import { Zap, Shield, Gauge, HardDrive, Loader, ArrowLeft } from 'lucide-react';

interface ScanResult {
    category: 'junk' | 'security' | 'performance';
    title: string;
    itemsFound: number;
    totalSize: number;
    severity: 'low' | 'medium' | 'high';
    details: string[];
    rawData?: any;
}

const SmartScan: React.FC = () => {
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStage, setCurrentStage] = useState('');
    const [results, setResults] = useState<ScanResult[]>([]);
    const [cleaning, setCleaning] = useState(false);
    const [detailedView, setDetailedView] = useState<ScanResult | null>(null);
    const [cleanupLogs, setCleanupLogs] = useState<string[]>([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const runSmartScan = async () => {
        setScanning(true);
        setProgress(0);
        setResults([]);
        setDetailedView(null);
        setCleanupLogs([]);

        try {
            setCurrentStage('Scanning System Junk...');
            setProgress(5);

            const [junkResult, languageResult, trashResult, brokenResult] = await Promise.all([
                window.ipcRenderer.invoke('scan-junk'),
                window.ipcRenderer.invoke('scan-language-files'),
                window.ipcRenderer.invoke('scan-trash-bins'),
                window.ipcRenderer.invoke('scan-broken-items')
            ]);

            setProgress(40);

            setCurrentStage('Checking Security...');
            const securityResult = await window.ipcRenderer.invoke('scan-security');
            setProgress(70);

            setCurrentStage('Analyzing Performance...');
            const performanceResult = await window.ipcRenderer.invoke('scan-performance');
            setProgress(100);

            setCurrentStage('Scan Complete!');

            const junkDetails: string[] = [];
            let junkSize = junkResult.totalSize || 0;

            if (junkResult.items?.length > 0) {
                junkDetails.push(`${junkResult.items.length} cache files`);
            }
            if (languageResult.count > 0) {
                junkDetails.push(`${languageResult.count} unused language files`);
                junkSize += languageResult.totalSize;
            }
            if (trashResult.count > 0) {
                const trashItemCount = trashResult.items?.reduce((sum: number, item: any) => sum + item.itemCount, 0) || 0;
                junkDetails.push(`${trashItemCount} items in trash`);
                junkSize += trashResult.totalSize;
            }
            if (brokenResult.count > 0) {
                junkDetails.push(`${brokenResult.count} broken items`);
            }

            const scanResults: ScanResult[] = [
                {
                    category: 'junk',
                    title: 'System Junk',
                    itemsFound: junkDetails.length,
                    totalSize: junkSize,
                    severity: junkSize > 1024 * 1024 * 1024 ? 'high' : junkSize > 100 * 1024 * 1024 ? 'medium' : 'low',
                    details: junkDetails,
                    rawData: {
                        caches: junkResult.items || [],
                        languageFiles: languageResult.files || [],
                        trash: trashResult.items || [],
                        broken: brokenResult.items || []
                    }
                },
                {
                    category: 'security',
                    title: 'Security Issues',
                    itemsFound: securityResult.issues?.length || 0,
                    totalSize: 0,
                    severity: securityResult.issues?.length > 5 ? 'high' : securityResult.issues?.length > 0 ? 'medium' : 'low',
                    details: securityResult.issues || [],
                    rawData: securityResult.details || {}
                },
                {
                    category: 'performance',
                    title: 'Performance Issues',
                    itemsFound: performanceResult.issues?.length || 0,
                    totalSize: 0,
                    severity: performanceResult.issues?.length > 3 ? 'medium' : 'low',
                    details: performanceResult.issues || [],
                    rawData: performanceResult.details || {}
                }
            ];

            setResults(scanResults);
        } catch (error) {
            console.error('Smart Scan error:', error);
            setCurrentStage('Scan failed. Please try again.');
            setTimeout(() => setScanning(false), 2000);
        } finally {
            // Ensure scanning is always set to false
            setTimeout(() => setScanning(false), 500);
        }
    };

    const handleCleanAll = async () => {
        if (results.length === 0) return;
        setShowConfirmModal(false);

        setCleaning(true);
        setCleanupLogs(['Starting cleanup...']);

        try {
            const response = await window.ipcRenderer.invoke('clean-all', results);

            if (response.results && response.results.length > 0) {
                setCleanupLogs(prev => [...prev, ...response.results, 'Cleanup completed!']);
            } else {
                setCleanupLogs(prev => [...prev, 'No cleanup actions performed', 'Cleanup completed!']);
            }

            // Keep logs visible for 3 seconds before clearing results
            setTimeout(() => {
                setResults([]);
                setDetailedView(null);
            }, 3000);
        } catch (error) {
            console.error('Cleanup error:', error);
            setCleanupLogs(prev => [...prev, 'Error: Cleanup failed. Please try again.']);
        } finally {
            setCleaning(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'high': return '#FF5252';
            case 'medium': return '#FFA726';
            case 'low': return '#66BB6A';
            default: return 'var(--text-secondary)';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'junk': return HardDrive;
            case 'security': return Shield;
            case 'performance': return Gauge;
            default: return Zap;
        }
    };

    const renderDetailedView = () => {
        if (!detailedView) return null;

        const Icon = getCategoryIcon(detailedView.category);

        return (
            <div>
                {/* Back Button */}
                <button
                    onClick={() => setDetailedView(null)}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 32
                    }}
                >
                    <ArrowLeft size={18} />
                    Back to Results
                </button>

                {/* Header */}
                <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                        <Icon size={40} color="var(--accent-color)" />
                        <h1 style={{ fontSize: '36px', margin: 0 }}>{detailedView.title}</h1>
                    </div>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '48px', fontWeight: 700, color: 'var(--accent-color)' }}>
                                {detailedView.itemsFound}
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                                {detailedView.itemsFound === 1 ? 'issue found' : 'issues found'}
                            </p>
                        </div>
                        {detailedView.totalSize > 0 && (
                            <div style={{
                                background: 'var(--bg-card)',
                                padding: '16px 24px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)'
                            }}>
                                <div style={{ fontSize: '24px', fontWeight: 600 }}>{formatBytes(detailedView.totalSize)}</div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>can be freed</p>
                            </div>
                        )}
                        <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: getSeverityColor(detailedView.severity)
                        }} />
                    </div>
                </div>

                {/* Detailed Information */}
                <div style={{ display: 'grid', gap: 24 }}>
                    {detailedView.category === 'junk' && detailedView.rawData && (
                        <>
                            {detailedView.rawData.languageFiles?.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16 }}>
                                        Language Files ({detailedView.rawData.languageFiles.length})
                                    </h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {detailedView.rawData.languageFiles.map((file: any, i: number) => (
                                            <div key={i} style={{
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '13px'
                                            }}>
                                                <span>{file.app}: {file.language}</span>
                                                <span style={{ color: 'var(--accent-color)' }}>{formatBytes(file.size)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {detailedView.rawData.trash?.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16 }}>
                                        Trash Bins ({detailedView.rawData.trash.length})
                                    </h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {detailedView.rawData.trash.map((item: any, i: number) => (
                                            <div key={i} style={{
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '13px'
                                            }}>
                                                <span>{item.name}: {item.itemCount} items</span>
                                                <span style={{ color: 'var(--accent-color)' }}>{formatBytes(item.size)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {detailedView.rawData.broken?.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16 }}>
                                        Broken Items ({detailedView.rawData.broken.length})
                                    </h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {detailedView.rawData.broken.map((item: any, i: number) => (
                                            <div key={i} style={{
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '8px',
                                                fontSize: '13px'
                                            }}>
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.type}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.reason}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {detailedView.category === 'security' && detailedView.rawData && (
                        <>
                            {detailedView.rawData.browserData?.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16 }}>Browser Data</h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {detailedView.rawData.browserData.map((item: any, i: number) => (
                                            <div key={i} style={{
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '13px'
                                            }}>
                                                <span>{item.browser}</span>
                                                <span style={{ color: 'var(--accent-color)' }}>{formatBytes(item.size)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {detailedView.rawData.launchAgents?.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16 }}>
                                        Launch Agents ({detailedView.rawData.launchAgents.length})
                                    </h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {detailedView.rawData.launchAgents.map((agent: string, i: number) => (
                                            <div key={i} style={{
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontFamily: 'monospace'
                                            }}>
                                                {agent}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {detailedView.category === 'performance' && detailedView.rawData && (
                        <>
                            {detailedView.rawData.highCPU?.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16 }}>High CPU Processes</h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {detailedView.rawData.highCPU.map((proc: any, i: number) => (
                                            <div key={i} style={{
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '13px'
                                            }}>
                                                <span>{proc.name}</span>
                                                <span style={{ color: '#FF5252' }}>{proc.cpu.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {detailedView.rawData.highMemory?.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16 }}>High Memory Processes</h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {detailedView.rawData.highMemory.map((proc: any, i: number) => (
                                            <div key={i} style={{
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '13px'
                                            }}>
                                                <span>{proc.name}</span>
                                                <span style={{ color: '#FFA726' }}>{proc.memory.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {detailedView.rawData.loginItems?.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16 }}>
                                        Login Items ({detailedView.rawData.loginItems.length})
                                    </h3>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {detailedView.rawData.loginItems.map((item: string, i: number) => (
                                            <div key={i} style={{
                                                padding: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '8px',
                                                fontSize: '13px'
                                            }}>
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Show detailed view if selected */}
            {detailedView ? (
                renderDetailedView()
            ) : (
                <>
                    <div style={{ marginBottom: 40 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                            <Zap size={40} color="var(--accent-color)" />
                            <h1 style={{ fontSize: '36px', margin: 0 }}>Smart Scan</h1>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '600px' }}>
                            Comprehensive system analysis that checks for junk files, security issues, and performance problems.
                        </p>
                    </div>

                    {!scanning && results.length === 0 && (
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '16px',
                            padding: '60px',
                            textAlign: 'center',
                            border: '1px solid var(--border-color)'
                        }}>
                            <Zap size={64} color="var(--accent-color)" style={{ marginBottom: 24 }} />
                            <h2 style={{ fontSize: '24px', marginBottom: 16 }}>Ready to Scan</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: '14px' }}>
                                This will analyze your system for junk files, security vulnerabilities, and performance issues.
                            </p>
                            <button
                                onClick={runSmartScan}
                                style={{
                                    background: 'var(--accent-gradient)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '16px 48px',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 20px rgba(255, 60, 172, 0.3)'
                                }}
                            >
                                Start Smart Scan
                            </button>
                        </div>
                    )}

                    {scanning && (
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '16px',
                            padding: '60px',
                            textAlign: 'center',
                            border: '1px solid var(--border-color)'
                        }}>
                            <Loader size={64} color="var(--accent-color)" style={{ marginBottom: 24, animation: 'spin 1s linear infinite' }} />
                            <h2 style={{ fontSize: '24px', marginBottom: 16 }}>{currentStage}</h2>
                            <div style={{
                                width: '100%',
                                maxWidth: '400px',
                                height: '8px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                margin: '0 auto',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    background: 'var(--accent-gradient)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                            <p style={{ color: 'var(--text-secondary)', marginTop: 16, fontSize: '14px' }}>
                                {progress}% Complete
                            </p>
                        </div>
                    )}

                    {!scanning && results.length > 0 && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 40 }}>
                                {results.map((result) => {
                                    const Icon = getCategoryIcon(result.category);
                                    return (
                                        <div
                                            key={result.category}
                                            onClick={() => result.itemsFound > 0 && setDetailedView(result)}
                                            style={{
                                                background: 'var(--bg-card)',
                                                borderRadius: '16px',
                                                padding: '32px',
                                                border: '1px solid var(--border-color)',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                cursor: result.itemsFound > 0 ? 'pointer' : 'default',
                                                transition: 'transform 0.2s, border-color 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (result.itemsFound > 0) {
                                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                                    e.currentTarget.style.borderColor = 'var(--accent-color)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                            }}
                                        >
                                            <div style={{
                                                position: 'absolute',
                                                top: 16,
                                                right: 16,
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: getSeverityColor(result.severity)
                                            }} />

                                            <Icon size={32} color="var(--accent-color)" style={{ marginBottom: 16 }} />
                                            <h3 style={{ fontSize: '20px', marginBottom: 8 }}>{result.title}</h3>

                                            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: 8, color: 'var(--accent-color)' }}>
                                                {result.itemsFound}
                                            </div>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: 16 }}>
                                                {result.itemsFound === 1 ? 'issue found' : 'issues found'}
                                            </p>

                                            {result.totalSize > 0 && (
                                                <div style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    fontSize: '14px'
                                                }}>
                                                    <strong>{formatBytes(result.totalSize)}</strong> can be freed
                                                </div>
                                            )}

                                            {result.itemsFound > 0 && (
                                                <div style={{
                                                    marginTop: 16,
                                                    fontSize: '12px',
                                                    color: 'var(--text-secondary)',
                                                    textAlign: 'center'
                                                }}>
                                                    Click to view details →
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Cleanup Logs */}
                            {cleanupLogs.length > 0 && (
                                <div style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    marginBottom: 24,
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {cleaning && <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />}
                                        Cleanup Progress
                                    </h3>
                                    <div style={{
                                        background: 'rgba(0,0,0,0.3)',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        fontFamily: 'monospace',
                                        fontSize: '13px',
                                        maxHeight: '200px',
                                        overflowY: 'auto'
                                    }}>
                                        {cleanupLogs.map((log, i) => (
                                            <div key={i} style={{ marginBottom: 4, color: log.includes('Error') ? '#FF5252' : 'var(--text-primary)' }}>
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                                <button
                                    onClick={() => setShowConfirmModal(true)}
                                    disabled={cleaning}
                                    style={{
                                        background: cleaning ? 'rgba(255, 82, 82, 0.3)' : '#FF5252',
                                        border: 'none',
                                        color: 'white',
                                        padding: '16px 48px',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        cursor: cleaning ? 'not-allowed' : 'pointer',
                                        opacity: cleaning ? 0.6 : 1,
                                        boxShadow: '0 4px 20px rgba(255, 82, 82, 0.3)'
                                    }}
                                >
                                    {cleaning ? 'Optimizing...' : 'Optimize'}
                                </button>
                                <button
                                    onClick={runSmartScan}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--border-color)',
                                        color: 'white',
                                        padding: '16px 48px',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Scan Again
                                </button>
                            </div>

                            {/* Confirmation Modal */}
                            {showConfirmModal && (
                                <div style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(0,0,0,0.7)',
                                    backdropFilter: 'blur(8px)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 1000,
                                    animation: 'fadeIn 0.2s ease'
                                }}>
                                    <div style={{
                                        background: 'var(--bg-card)',
                                        borderRadius: '20px',
                                        padding: '40px',
                                        maxWidth: '500px',
                                        border: '1px solid var(--border-color)',
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                                        animation: 'slideUp 0.3s ease'
                                    }}>
                                        <h2 style={{ fontSize: '24px', marginBottom: 16, textAlign: 'center' }}>
                                            Confirm Optimization
                                        </h2>
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center', fontSize: '15px' }}>
                                            Optimize {results.reduce((sum, r) => sum + r.itemsFound, 0)} issues found across all categories?
                                        </p>
                                        <div style={{
                                            background: 'rgba(255, 82, 82, 0.1)',
                                            border: '1px solid rgba(255, 82, 82, 0.3)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            marginBottom: 24
                                        }}>
                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                                                ⚠️ Items will be moved to trash. This action can be undone by restoring from trash.
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            <button
                                                onClick={() => setShowConfirmModal(false)}
                                                style={{
                                                    flex: 1,
                                                    background: 'transparent',
                                                    border: '1px solid var(--border-color)',
                                                    color: 'white',
                                                    padding: '14px',
                                                    borderRadius: '10px',
                                                    fontSize: '15px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCleanAll}
                                                style={{
                                                    flex: 1,
                                                    background: 'var(--accent-gradient)',
                                                    border: 'none',
                                                    color: 'white',
                                                    padding: '14px',
                                                    borderRadius: '10px',
                                                    fontSize: '15px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 20px rgba(255, 60, 172, 0.3)'
                                                }}
                                            >
                                                Optimize Now
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to { 
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

export default SmartScan;
