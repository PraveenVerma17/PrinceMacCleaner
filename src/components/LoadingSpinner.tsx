import React from 'react';

const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "Loading..." }) => {
    return (
        <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            flex: 1
        }}>
            <div className="spinner" style={{
                width: 50,
                height: 50,
                borderTopColor: '#FF3CAC',
                borderWidth: 4
            }}></div>
            <div style={{
                marginTop: 24,
                color: 'var(--text-secondary)',
                fontSize: 16,
                fontWeight: 500
            }}>
                {message}
            </div>
        </div>
    );
};

export default LoadingSpinner;
