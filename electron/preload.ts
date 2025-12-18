import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args
        return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args
        return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args
        return ipcRenderer.invoke(channel, ...omit)
    },

    // App API
    getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
    getSystemDetails: () => ipcRenderer.invoke('get-system-details'),
    scanJunk: () => ipcRenderer.invoke('scan-junk'),
    cleanJunk: (files: string[]) => ipcRenderer.invoke('clean-junk', files),
    cleanRam: () => ipcRenderer.invoke('clean-ram'),

    // You can expose other apts you need here.
    // ...
})
