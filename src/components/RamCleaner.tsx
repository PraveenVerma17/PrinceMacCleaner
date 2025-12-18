import React, { useState } from 'react';
import { Zap, Check } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const RamCleaner: React.FC = () => {
    const [cleaning, setCleaning] = useState(false);
    const [result, setResult] = useState<{ success: boolean, message?: string } | null>(null);

    const clean = async () => {
        setCleaning(true);
        try {
            const res = await window.ipcRenderer.cleanRam();
            if (!res.message) await new Promise(r => setTimeout(r, 2000));
            setResult(res);
        } catch (e) {
            setResult({ success: false, message: 'Error' });
        } finally {
            setCleaning(false);
        }
    };

    if (cleaning) return <LoadingSpinner message="Optimizing Memory..." />;

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ marginTop: '60px' }}>
                <div style={{
                    width: '120px', height: '120px', borderRadius: '50%', background: 'var(--bg-card)',
                    margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(43, 134, 197, 0.2)'
                }}>
                    <Zap size={48} color="#2B86C5" />
                </div>

                <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>RAM Cleaner</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 40px', lineHeight: '1.6' }}>
                    Free up active memory to improve system performance. This operation might slow down your Mac briefly.
                </p>

                {!result ? (
                    <button
                        onClick={clean}
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
                        Free Up RAM
                    </button>
                ) : (
                    <div style={{ animation: 'fadeIn 0.5s' }}>
                        <div style={{ color: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '18px', marginBottom: '24px' }}>
                            <Check size={24} />
                            {result.message}
                        </div>
                        <button onClick={() => setResult(null)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'white', padding: '8px 24px', borderRadius: '20px', cursor: 'pointer' }}>
                            Done
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default RamCleaner;
