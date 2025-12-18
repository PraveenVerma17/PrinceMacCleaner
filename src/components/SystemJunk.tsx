import React, { useState } from 'react';
import { Trash2, CheckCircle } from 'lucide-react';

const SystemJunk: React.FC = () => {
    const [scanning, setScanning] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [data, setData] = useState<any>(null);
    const [cleanupResult, setCleanupResult] = useState<{ cleanedCount: number, freedSpace: number } | null>(null);

    const startScan = async () => {
        setScanning(true);
        setScanned(false);
        setCleanupResult(null);
        try {
            const result = await window.ipcRenderer.scanJunk();
            // Simulate delay for "scanning effect" if it returns too fast
            if (result.fileCount < 1000) await new Promise(r => setTimeout(r, 1000));
            setData(result);
            setScanned(true);
        } catch (e) {
            console.error(e);
        } finally {
            setScanning(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const cleanFiles = async () => {
        if (!data || (!data.topFiles && !data.allFiles)) return;
        setCleaning(true);
        setCleanupResult(null);

        // Use allFiles if available, otherwise fallback to topFiles
        const filesToClean = data.allFiles || data.topFiles.map((f: any) => f.path);

        try {
            const result = await window.ipcRenderer.cleanJunk(filesToClean);

            if (result.success) {
                // Artificial delay for smooth transition
                await new Promise(r => setTimeout(r, 1500));

                setCleanupResult({
                    cleanedCount: result.cleanedCount,
                    freedSpace: result.freedSpace
                });

                // Reset scan data
                setScanned(false);
                setData(null);
            } else {
                throw new Error(result.error || 'Cleanup failed');
            }
        } catch (e: any) {
            console.error('Cleanup error:', e);
            alert(`Cleanup failed: ${e.message || 'Some files may require admin privileges.'}`);
        } finally {
            setCleaning(false);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>

            {!scanned && !scanning && !cleaning && !cleanupResult && (
                <div style={{ marginTop: '60px' }}>
                    <div style={{
                        width: '120px', height: '120px', borderRadius: '50%', background: 'var(--bg-card)',
                        margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 40px rgba(0,0,0,0.3)'
                    }}>
                        <Trash2 size={48} color="var(--accent-color)" />
                    </div>
                    <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>System Junk</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 40px', lineHeight: '1.6' }}>
                        Optimize your Mac by removing temporary files, logs, and caches that clutter your system.
                    </p>
                    <button
                        onClick={startScan}
                        style={{
                            background: 'var(--accent-gradient)',
                            border: 'none',
                            padding: '16px 48px',
                            borderRadius: '30px',
                            color: 'white',
                            fontSize: '18px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(120, 75, 160, 0.4)',
                            transition: 'transform 0.1s'
                        } as any}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        Scan
                    </button>
                </div>
            )}

            {scanning && (
                <div style={{ marginTop: '100px' }}>
                    <div className="spinner" style={{
                        width: '60px', height: '60px', borderRadius: '50%', border: '4px solid var(--bg-card)',
                        borderTopColor: 'var(--accent-color)', margin: '0 auto 32px',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    <h2>Scanning your system...</h2>
                </div>
            )}

            {cleaning && (
                <div style={{ marginTop: '100px' }}>
                    <div style={{
                        width: '300px', height: '6px', background: 'var(--bg-card)', borderRadius: '3px', margin: '0 auto 32px', overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%', background: 'var(--accent-gradient)', width: '100%',
                            animation: 'progress 2s ease-in-out infinite',
                            transformOrigin: 'left'
                        }} />
                    </div>
                    <style>{`@keyframes progress { 0% { transform: scaleX(0); } 50% { transform: scaleX(0.7); } 100% { transform: scaleX(1); } }`}</style>
                    <h2>Cleaning System Junk...</h2>
                </div>
            )}

            {scanned && data && !cleaning && (
                <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                        <div>
                            <h2 style={{ fontSize: '24px' }}>Scan Complete</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>Found {data.fileCount} files</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '32px', fontWeight: 700, color: '#FF3CAC' }}>
                                {formatBytes(data.totalSize)}
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Potential Savings</div>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                            <span>File</span>
                            <span>Size</span>
                        </div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {data.topFiles.map((file: any, i: number) => (
                                <div key={i} style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF3CAC' }}></div>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }} title={file.path}>
                                            {file.path.split('/').pop()}
                                            <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '12px' }}>{file.path.replace(file.path.split('/').pop(), '')}</span>
                                        </span>
                                    </div>
                                    <span style={{ fontFamily: 'monospace' }}>{formatBytes(file.size)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <button
                            onClick={cleanFiles}
                            style={{
                                background: 'var(--accent-gradient)',
                                border: 'none',
                                padding: '14px 40px',
                                borderRadius: '30px',
                                color: 'white',
                                fontSize: '16px',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}>
                            Clean Now
                        </button>
                        <button onClick={() => setScanned(false)} style={{
                            background: 'transparent', border: 'none', color: 'var(--text-secondary)', marginTop: '16px', cursor: 'pointer', display: 'block', margin: '16px auto'
                        }}>
                            Back
                        </button>
                    </div>
                </div>
            )}

            {cleanupResult && !cleaning && (
                <div style={{ marginTop: '60px', animation: 'fadeIn 0.5s' }}>
                    <div style={{
                        width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(76, 175, 80, 0.1)',
                        margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <CheckCircle size={64} color="#4CAF50" />
                    </div>
                    <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>Cleanup Successful!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '18px' }}>
                        Successfully removed <span style={{ color: 'white', fontWeight: 600 }}>{cleanupResult.cleanedCount}</span> files
                        <br />
                        and freed <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{formatBytes(cleanupResult.freedSpace)}</span> of space.
                    </p>
                    <button
                        onClick={() => setCleanupResult(null)}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            padding: '12px 40px',
                            borderRadius: '30px',
                            color: 'white',
                            fontSize: '16px',
                            cursor: 'pointer'
                        }}
                    >
                        Done
                    </button>
                    <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(20px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                </div>
            )}

        </div>
    );
};

export default SystemJunk;
