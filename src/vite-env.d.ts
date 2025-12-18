/// <reference types="vite/client" />

interface Window {
    ipcRenderer: {
        getSystemStats: () => Promise<any>;
        getSystemDetails: () => Promise<any>;
        scanJunk: () => Promise<any>;
        cleanJunk: (files: string[]) => Promise<any>;
        cleanRam: () => Promise<any>;
        invoke: (channel: 'get-apps' | 'get-app-details' | 'uninstall-app' | 'get-system-stats' | 'get-system-details' | 'scan-junk' | 'clean-junk' | 'cleanRam' | 'scan-security' | 'scan-performance' | 'clean-all' | 'scan-language-files' | 'scan-trash-bins' | 'scan-broken-items' | 'empty-all-trash' | 'clean-language-files' | 'clean-broken-items' | 'run-maintenance' | 'get-login-items' | 'remove-login-item' | 'kill-process' | 'get-background-tasks' | 'clean-browser-data' | 'clean-privacy-traces', ...args: any[]) => Promise<any>;
        on: (channel: string, func: (...args: any[]) => void) => void;
        off: (channel: string, func: (...args: any[]) => void) => void;
    }
}
