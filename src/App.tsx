import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SystemInfo from './components/SystemInfo';
import SystemJunk from './components/SystemJunk';
import RamCleaner from './components/RamCleaner';
import AppManager from './components/AppManager';
import SmartScan from './components/SmartScan';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const renderContent = () => {
    switch (currentView) {
      case 'smart-scan':
        return <SmartScan />;
      case 'junk':
        return <SystemJunk />;
      case 'ram':
        return <RamCleaner />;
      case 'uninstaller':
        return <AppManager />;
      case 'info':
        return <SystemInfo />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };


  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-dark)' }}>
        {/* Title Bar Spacer for traffic lights */}
        <div style={{ height: '40px', width: '100%', WebkitAppRegion: 'drag' } as any} />
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
