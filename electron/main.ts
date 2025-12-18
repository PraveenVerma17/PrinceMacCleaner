import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'

// The built directory structure
//
// ├─┬─ dist
// │ ├─ index.html
// │ ├─ assets
// │ └─ ...
// ├─┬─ dist-electron
// │ ├─ main.js
// │ └─ preload.js
//
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')
const DIST = process.env.DIST || ''
const VITE_PUBLIC = process.env.VITE_PUBLIC || ''

let win: BrowserWindow | null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(VITE_PUBLIC, 'vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        width: 1400,
        height: 900,
        fullscreen: true, // Start in fullscreen
        titleBarStyle: 'hiddenInset',
        vibrancy: 'under-window',
        visualEffectState: 'active',
        backgroundColor: '#00000000',
        trafficLightPosition: { x: 15, y: 15 }
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(DIST, 'index.html'))
    }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})


import si from 'systeminformation';
import fs from 'fs';
import { exec } from 'child_process';
import os from 'os';
import util from 'util';

const execAsync = util.promisify(exec);


let cachedSSID: string | null = null;
let ssidPrompted = false;

async function getSSIDWithSudo() {
    if (cachedSSID) return cachedSSID;
    if (ssidPrompted) return null; // Don't spam prompt

    ssidPrompted = true;
    return new Promise<string | null>((resolve) => {
        console.log('Requesting admin privileges via osascript...');
        // Escape the command quotes for applescript
        const command = `/usr/sbin/system_profiler SPAirPortDataType -json`;
        const script = `do shell script "${command}" with administrator privileges`;

        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
            console.log('Osascript callback reached');
            if (error) {
                console.error("Osascript error:", error);
                resolve(null);
                return;
            }
            try {
                // stdout is the JSON result
                const output = stdout ? stdout.toString() : '';
                const data = JSON.parse(output);
                // Navigate format: SPAirPortDataType -> [0] -> spairport_airport_interfaces -> [0] -> spairport_current_network_information -> _name
                const interfaces = data.SPAirPortDataType?.[0]?.spairport_airport_interfaces;
                if (interfaces && interfaces.length > 0) {
                    const currentNetwork = interfaces[0]?.spairport_current_network_information;
                    if (currentNetwork) {
                        const ssid = currentNetwork._name || currentNetwork.spairport_network_name;
                        if (ssid) {
                            cachedSSID = ssid;
                            resolve(ssid);
                            return;
                        }
                    }
                }
            } catch (e) {
                console.error("Parse error:", e);
            }
            resolve(null);
        });
    });
}


async function getMacMemoryStats() {
    try {
        const { stdout } = await execAsync('vm_stat');
        const lines = stdout.split('\n');
        const pageSizeMatch = lines[0].match(/page size of (\d+) bytes/);
        const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384; // Default to 16KB (Apple Silicon) if parse fails

        const getPageCount = (key: string) => {
            const line = lines.find(l => l.includes(key));
            if (!line) return 0;
            const match = line.match(/:\s+(\d+)\./);
            return match ? parseInt(match[1], 10) : 0;
        };

        const pagesActive = getPageCount('Pages active');
        const pagesWired = getPageCount('Pages wired down');
        const pagesCompressed = getPageCount('Pages occupied by compressor');
        const pagesFree = getPageCount('Pages free');
        const pagesInactive = getPageCount('Pages inactive');

        const used = (pagesActive + pagesWired + pagesCompressed) * pageSize;
        const total = (await si.mem()).total; // systeminformation is still good for total RAM detection
        const available = total - used;

        return {
            total,
            used,
            free: pagesFree * pageSize, // Strict free
            available // Free + Inactive (User-facing "Available")
        };
    } catch (error) {
        console.error("Error parsing vm_stat:", error);
        // Fallback to systeminformation
        const mem = await si.mem();
        return {
            total: mem.total,
            used: mem.total - mem.available,
            free: mem.free,
            available: mem.available
        };
    }
}

// Smart Scan: Security Check (Enhanced)
ipcMain.handle('scan-security', async () => {
    try {
        const issues: string[] = [];
        const details: any = {
            browserData: [],
            launchAgents: [],
            suspiciousProcesses: []
        };

        // 1. Check browser privacy traces
        const browserChecks = [
            {
                name: 'Chrome',
                history: path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'History'),
                cookies: path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Cookies'),
                cache: path.join(os.homedir(), 'Library', 'Caches', 'Google', 'Chrome')
            },
            {
                name: 'Safari',
                history: path.join(os.homedir(), 'Library', 'Safari', 'History.db'),
                cookies: path.join(os.homedir(), 'Library', 'Cookies', 'Cookies.binarycookies'),
                cache: path.join(os.homedir(), 'Library', 'Caches', 'com.apple.Safari')
            },
            {
                name: 'Firefox',
                history: path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles'),
                cookies: path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles'),
                cache: path.join(os.homedir(), 'Library', 'Caches', 'Firefox')
            }
        ];

        for (const browser of browserChecks) {
            let found = false;
            let size = 0;

            if (fs.existsSync(browser.history)) {
                found = true;
                try {
                    const stats = await fs.promises.stat(browser.history);
                    size += stats.size;
                } catch (e) {
                    // Ignore
                }
            }

            if (fs.existsSync(browser.cookies)) {
                found = true;
                try {
                    const stats = await fs.promises.stat(browser.cookies);
                    size += stats.size;
                } catch (e) {
                    // Ignore
                }
            }

            if (found) {
                details.browserData.push({ browser: browser.name, size });
                issues.push(`${browser.name} browsing data found`);
            }
        }

        // 2. Check for suspicious launch agents
        const launchAgentsDirs = [
            path.join(os.homedir(), 'Library', 'LaunchAgents'),
            '/Library/LaunchAgents'
        ];

        for (const dir of launchAgentsDirs) {
            if (fs.existsSync(dir)) {
                try {
                    const agents = await fs.promises.readdir(dir);
                    const nonAppleAgents = agents.filter(a => !a.startsWith('com.apple.'));

                    if (nonAppleAgents.length > 0) {
                        details.launchAgents.push(...nonAppleAgents);
                    }

                    if (agents.length > 15) {
                        issues.push(`${agents.length} launch agents (review recommended)`);
                    }
                } catch (e) {
                    // Ignore
                }
            }
        }

        // 3. Check for unsigned applications (basic check)
        try {
            const appsDir = '/Applications';
            const apps = await fs.promises.readdir(appsDir);
            const appFiles = apps.filter(app => app.endsWith('.app')).slice(0, 10); // Check first 10

            for (const app of appFiles) {
                try {
                    const appPath = path.join(appsDir, app);
                    const { stdout } = await execAsync(`codesign -dv "${appPath}" 2>&1`);

                    if (stdout.includes('not signed') || stdout.includes('code object is not signed')) {
                        details.suspiciousProcesses.push(app);
                    }
                } catch (e) {
                    // App might not be signed, which is suspicious
                    if (e instanceof Error && e.message.includes('not signed')) {
                        details.suspiciousProcesses.push(app);
                    }
                }
            }

            if (details.suspiciousProcesses.length > 0) {
                issues.push(`${details.suspiciousProcesses.length} unsigned applications found`);
            }
        } catch (e) {
            // Ignore
        }

        // 4. Check for chat logs
        const chatDirs = [
            path.join(os.homedir(), 'Library', 'Messages'),
            path.join(os.homedir(), 'Library', 'Application Support', 'Slack'),
            path.join(os.homedir(), 'Library', 'Application Support', 'Discord')
        ];

        for (const dir of chatDirs) {
            if (fs.existsSync(dir)) {
                const dirName = path.basename(dir);
                issues.push(`${dirName} chat logs present`);
            }
        }

        return {
            issues,
            details,
            totalIssues: issues.length
        };
    } catch (error) {
        console.error('Security scan error:', error);
        return { issues: [], details: {}, totalIssues: 0 };
    }
});

// Smart Scan: Performance Analysis (Enhanced)
ipcMain.handle('scan-performance', async () => {
    try {
        const issues: string[] = [];
        const details: any = {
            highCPU: [],
            highMemory: [],
            loginItems: [],
            lowRAM: false
        };

        // Check for high CPU processes
        try {
            const { stdout } = await execAsync('ps aux | sort -rk 3,3 | head -n 6');
            const lines = stdout.trim().split('\n').slice(1); // Skip header
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                const cpu = parseFloat(parts[2]);
                const processName = parts.slice(10).join(' ');
                if (cpu > 30) {
                    details.highCPU.push({ name: processName, cpu });
                    issues.push(`High CPU: ${processName} (${cpu.toFixed(1)}%)`);
                }
            });
        } catch (e) {
            // Ignore
        }

        // Check for high memory processes
        try {
            const { stdout } = await execAsync('ps aux | sort -rk 4,4 | head -n 6');
            const lines = stdout.trim().split('\n').slice(1);
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                const mem = parseFloat(parts[3]);
                const processName = parts.slice(10).join(' ');
                if (mem > 5) {
                    details.highMemory.push({ name: processName, memory: mem });
                    issues.push(`High Memory: ${processName} (${mem.toFixed(1)}%)`);
                }
            });
        } catch (e) {
            // Ignore
        }

        // Check login items
        try {
            const { stdout } = await execAsync('osascript -e \'tell application "System Events" to get the name of every login item\'');
            if (stdout.trim()) {
                const loginItems = stdout.trim().split(', ');
                details.loginItems = loginItems;
                if (loginItems.length > 5) {
                    issues.push(`${loginItems.length} login items (may slow startup)`);
                }
            }
        } catch (e) {
            // Ignore - might not have permission
        }

        // Check available RAM
        const mem = await si.mem();
        const availablePercent = (mem.available / mem.total) * 100;
        if (availablePercent < 20) {
            details.lowRAM = true;
            issues.push(`Low memory: ${availablePercent.toFixed(1)}% available`);
        }

        return {
            issues,
            details,
            totalIssues: issues.length
        };
    } catch (error) {
        console.error('Performance scan error:', error);
        return { issues: [], details: {}, totalIssues: 0 };
    }
});

// Smart Scan: Clean All (Real Implementation)
ipcMain.handle('clean-all', async (_, results) => {
    try {
        console.log('Clean-all called with results:', results);
        const cleanupResults: string[] = [];

        // 1. Clean junk files
        const junkResult = results.find((r: any) => r.category === 'junk');
        console.log('Junk result:', junkResult);

        if (junkResult && junkResult.rawData) {
            // Clean language files
            if (junkResult.rawData.languageFiles?.length > 0) {
                const langPaths = junkResult.rawData.languageFiles.map((f: any) => f.path);
                console.log('Cleaning language files:', langPaths.length);
                try {
                    for (const filePath of langPaths) {
                        await shell.trashItem(filePath);
                    }
                    cleanupResults.push(`Removed ${langPaths.length} language files`);
                } catch (e) {
                    console.error('Language files cleanup error:', e);
                }
            }

            // Empty trash
            if (junkResult.rawData.trash?.length > 0) {
                console.log('Emptying trash bins');
                try {
                    const trashPath = path.join(os.homedir(), '.Trash');
                    if (fs.existsSync(trashPath)) {
                        const items = await fs.promises.readdir(trashPath);
                        for (const item of items) {
                            try {
                                await fs.promises.rm(path.join(trashPath, item), { recursive: true, force: true });
                            } catch (e) {
                                // Skip items that can't be deleted
                            }
                        }
                        cleanupResults.push(`Emptied trash`);
                    }
                } catch (e) {
                    console.error('Trash cleanup error:', e);
                }
            }

            // Clean broken items
            if (junkResult.rawData.broken?.length > 0) {
                const brokenPaths = junkResult.rawData.broken.map((b: any) => b.path);
                console.log('Cleaning broken items:', brokenPaths.length);
                try {
                    for (const filePath of brokenPaths) {
                        await shell.trashItem(filePath);
                    }
                    cleanupResults.push(`Removed ${brokenPaths.length} broken items`);
                } catch (e) {
                    console.error('Broken items cleanup error:', e);
                }
            }
        }

        // 2. Clean RAM
        console.log('Purging RAM');
        try {
            // Use sudo-prompt for elevated privileges
            const sudo = require('sudo-prompt');
            const options = {
                name: 'MacCleaner'
            };

            await new Promise<void>((resolve, reject) => {
                sudo.exec('purge', options, (error: any, stdout: any, stderr: any) => {
                    if (error) {
                        console.error('RAM cleanup error:', error);
                        cleanupResults.push('RAM purge skipped (admin privileges required)');
                        resolve(); // Don't fail the entire cleanup
                    } else {
                        cleanupResults.push('Purged inactive memory');
                        resolve();
                    }
                });
            });
        } catch (e) {
            console.error('RAM cleanup error:', e);
            cleanupResults.push('RAM purge skipped (admin privileges required)');
        }

        // 3. Run maintenance scripts
        console.log('Running maintenance');
        try {
            // Flush DNS cache
            try {
                await execAsync('dscacheutil -flushcache');
                cleanupResults.push('Flushed DNS cache');
            } catch (e) {
                // Ignore
            }

            // Clear font cache
            try {
                await execAsync('atsutil databases -remove');
                cleanupResults.push('Cleared font cache');
            } catch (e) {
                // Ignore
            }
        } catch (e) {
            console.error('Maintenance error:', e);
        }

        console.log('Cleanup results:', cleanupResults);
        return {
            success: true,
            results: cleanupResults,
            count: cleanupResults.length
        };
    } catch (error) {
        console.error('Clean all error:', error);
        throw error;
    }
});

// Scan Language Files
ipcMain.handle('scan-language-files', async () => {
    try {
        const languageFiles: { app: string; language: string; path: string; size: number }[] = [];
        let totalSize = 0;

        // Get system language (default to 'en')
        const systemLang = 'en'; // Could be detected via process.env.LANG or defaults

        const appDirs = ['/Applications', path.join(os.homedir(), 'Applications')];

        for (const dir of appDirs) {
            if (!fs.existsSync(dir)) continue;

            const apps = await fs.promises.readdir(dir);

            for (const appName of apps) {
                if (!appName.endsWith('.app')) continue;

                const appPath = path.join(dir, appName);
                const resourcesPath = path.join(appPath, 'Contents', 'Resources');

                if (!fs.existsSync(resourcesPath)) continue;

                try {
                    const resources = await fs.promises.readdir(resourcesPath);

                    for (const resource of resources) {
                        // Check for .lproj folders (language resources)
                        if (resource.endsWith('.lproj')) {
                            const langCode = resource.replace('.lproj', '');

                            // Skip system language
                            if (langCode === systemLang || langCode === 'en' || langCode === 'Base') continue;

                            const langPath = path.join(resourcesPath, resource);

                            // Calculate size of language folder
                            try {
                                const { stdout } = await execAsync(`du -sk "${langPath}"`);
                                const sizeInKb = parseInt(stdout.split(/\s+/)[0], 10);
                                const size = sizeInKb * 1024;

                                languageFiles.push({
                                    app: appName.replace('.app', ''),
                                    language: langCode,
                                    path: langPath,
                                    size
                                });

                                totalSize += size;
                            } catch (e) {
                                // Skip if can't calculate size
                            }
                        }
                    }
                } catch (e) {
                    // Skip if can't read resources
                }
            }
        }

        return {
            files: languageFiles,
            totalSize,
            count: languageFiles.length
        };
    } catch (error) {
        console.error('Language files scan error:', error);
        return { files: [], totalSize: 0, count: 0 };
    }
});

// Scan Trash Bins
ipcMain.handle('scan-trash-bins', async () => {
    try {
        const trashLocations = [
            { name: 'Finder Trash', path: path.join(os.homedir(), '.Trash') },
            { name: 'Mail Trash', path: path.join(os.homedir(), 'Library', 'Mail', 'V10', 'MailData', 'Deleted Messages') },
        ];

        const trashItems: { name: string; path: string; size: number; itemCount: number }[] = [];
        let totalSize = 0;

        for (const location of trashLocations) {
            if (!fs.existsSync(location.path)) continue;

            try {
                // Count items
                const items = await fs.promises.readdir(location.path);
                const itemCount = items.length;

                if (itemCount === 0) continue;

                // Calculate size
                const { stdout } = await execAsync(`du -sk "${location.path}"`);
                const sizeInKb = parseInt(stdout.split(/\s+/)[0], 10);
                const size = sizeInKb * 1024;

                trashItems.push({
                    name: location.name,
                    path: location.path,
                    size,
                    itemCount
                });

                totalSize += size;
            } catch (e) {
                // Skip if can't access
            }
        }

        return {
            items: trashItems,
            totalSize,
            count: trashItems.length
        };
    } catch (error) {
        console.error('Trash scan error:', error);
        return { items: [], totalSize: 0, count: 0 };
    }
});

// Scan Broken Items
ipcMain.handle('scan-broken-items', async () => {
    try {
        const brokenItems: { type: string; path: string; reason: string }[] = [];

        // 1. Check for orphaned preference files
        const prefsDir = path.join(os.homedir(), 'Library', 'Preferences');
        if (fs.existsSync(prefsDir)) {
            const prefs = await fs.promises.readdir(prefsDir);
            const installedApps = await fs.promises.readdir('/Applications');
            const installedBundleIds = installedApps
                .filter(app => app.endsWith('.app'))
                .map(app => app.replace('.app', '').toLowerCase());

            for (const pref of prefs) {
                if (!pref.endsWith('.plist')) continue;

                const bundleId = pref.replace('.plist', '');
                const appName = bundleId.split('.').pop()?.toLowerCase() || '';

                // Check if corresponding app exists
                const hasApp = installedBundleIds.some(id =>
                    id.toLowerCase().includes(appName) || appName.includes(id.toLowerCase())
                );

                if (!hasApp && !bundleId.startsWith('com.apple.')) {
                    brokenItems.push({
                        type: 'Orphaned Preference',
                        path: path.join(prefsDir, pref),
                        reason: `No matching application found for ${bundleId}`
                    });
                }
            }
        }

        // 2. Check for broken symlinks in common locations
        const checkSymlinks = async (dir: string) => {
            if (!fs.existsSync(dir)) return;

            try {
                const items = await fs.promises.readdir(dir);
                for (const item of items) {
                    const itemPath = path.join(dir, item);
                    try {
                        const stats = await fs.promises.lstat(itemPath);
                        if (stats.isSymbolicLink()) {
                            // Check if link target exists
                            try {
                                await fs.promises.stat(itemPath);
                            } catch (e) {
                                brokenItems.push({
                                    type: 'Broken Symlink',
                                    path: itemPath,
                                    reason: 'Link target does not exist'
                                });
                            }
                        }
                    } catch (e) {
                        // Skip
                    }
                }
            } catch (e) {
                // Skip
            }
        };

        await checkSymlinks('/Applications');
        await checkSymlinks(path.join(os.homedir(), 'Applications'));

        return {
            items: brokenItems,
            count: brokenItems.length
        };
    } catch (error) {
        console.error('Broken items scan error:', error);
        return { items: [], count: 0 };
    }
});

// Empty All Trash
ipcMain.handle('empty-all-trash', async () => {
    try {
        const trashPath = path.join(os.homedir(), '.Trash');

        if (fs.existsSync(trashPath)) {
            const items = await fs.promises.readdir(trashPath);
            for (const item of items) {
                const itemPath = path.join(trashPath, item);
                try {
                    await shell.trashItem(itemPath);
                } catch (e) {
                    console.error(`Failed to delete ${itemPath}:`, e);
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Empty trash error:', error);
        throw error;
    }
});

// Clean Language Files
ipcMain.handle('clean-language-files', async (_, filePaths: string[]) => {
    try {
        for (const filePath of filePaths) {
            try {
                await shell.trashItem(filePath);
            } catch (e) {
                console.error(`Failed to delete ${filePath}:`, e);
            }
        }
        return { success: true };
    } catch (error) {
        console.error('Clean language files error:', error);
        throw error;
    }
});

// Clean Broken Items
ipcMain.handle('clean-broken-items', async (_, itemPaths: string[]) => {
    try {
        for (const itemPath of itemPaths) {
            try {
                await shell.trashItem(itemPath);
            } catch (e) {
                console.error(`Failed to delete ${itemPath}:`, e);
            }
        }
        return { success: true };
    } catch (error) {
        console.error('Clean broken items error:', error);
        throw error;
    }
});

// Run Maintenance Scripts
ipcMain.handle('run-maintenance', async () => {
    try {
        const results: string[] = [];

        // 1. Rebuild Launch Services database
        try {
            await execAsync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user');
            results.push('Rebuilt Launch Services database');
        } catch (e) {
            results.push('Launch Services rebuild failed (may need permissions)');
        }

        // 2. Flush DNS cache
        try {
            await execAsync('sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder');
            results.push('Flushed DNS cache');
        } catch (e) {
            // Try without sudo
            try {
                await execAsync('dscacheutil -flushcache');
                results.push('Flushed DNS cache (partial)');
            } catch (e2) {
                results.push('DNS flush failed');
            }
        }

        // 3. Clear font cache
        try {
            await execAsync('atsutil databases -remove');
            results.push('Cleared font cache');
        } catch (e) {
            results.push('Font cache clear failed');
        }

        // 4. Purge inactive memory (already have cleanRam handler)
        try {
            await execAsync('sudo purge');
            results.push('Purged inactive memory');
        } catch (e) {
            results.push('Memory purge failed (needs admin)');
        }

        return {
            success: true,
            results,
            count: results.length
        };
    } catch (error) {
        console.error('Maintenance error:', error);
        return { success: false, results: [], count: 0 };
    }
});

// Get Login Items
ipcMain.handle('get-login-items', async () => {
    try {
        const { stdout } = await execAsync('osascript -e \'tell application "System Events" to get the name of every login item\'');

        if (!stdout.trim()) {
            return { items: [] };
        }

        const items = stdout.trim().split(', ').map(name => ({
            name,
            enabled: true // macOS doesn't easily provide enabled/disabled status
        }));

        return { items };
    } catch (error) {
        console.error('Get login items error:', error);
        return { items: [] };
    }
});

// Remove Login Item
ipcMain.handle('remove-login-item', async (_, itemName: string) => {
    try {
        await execAsync(`osascript -e 'tell application "System Events" to delete login item "${itemName}"'`);
        return { success: true };
    } catch (error) {
        console.error('Remove login item error:', error);
        throw error;
    }
});

// Kill Process
ipcMain.handle('kill-process', async (_, processName: string) => {
    try {
        // Use pkill to kill by name
        await execAsync(`pkill -f "${processName}"`);
        return { success: true };
    } catch (error) {
        console.error('Kill process error:', error);
        throw error;
    }
});

// Clean RAM (Consolidated)
ipcMain.handle('clean-ram', async () => {
    try {
        const sudo = require('sudo-prompt');
        const options = {
            name: 'MacCleaner'
        };

        return await new Promise((resolve, reject) => {
            sudo.exec('purge', options, (error: any, stdout: any, stderr: any) => {
                if (error) {
                    console.error('RAM cleanup error:', error);
                    // Silently fail or return partial success if user cancels sudo prompt
                    resolve({ success: false, message: 'Admin privileges required to purge RAM' });
                } else {
                    resolve({ success: true, message: 'RAM purged successfully' });
                }
            });
        });
    } catch (error) {
        console.error('RAM cleanup error:', error);
        return { success: false, error: 'Unexpected error during RAM purge' };
    }
});

// Get Background Tasks (detailed)
ipcMain.handle('get-background-tasks', async () => {
    try {
        const tasks: any = {
            highCPU: [],
            highMemory: [],
            all: []
        };

        // Get all processes sorted by CPU
        const { stdout } = await execAsync('ps aux | sort -rk 3,3 | head -n 20');
        const lines = stdout.trim().split('\n').slice(1); // Skip header

        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const user = parts[0];
            const pid = parts[1];
            const cpu = parseFloat(parts[2]);
            const mem = parseFloat(parts[3]);
            const processName = parts.slice(10).join(' ');

            const task = {
                pid,
                name: processName,
                user,
                cpu,
                memory: mem
            };

            tasks.all.push(task);

            if (cpu > 30) {
                tasks.highCPU.push(task);
            }
            if (mem > 5) {
                tasks.highMemory.push(task);
            }
        });

        return tasks;
    } catch (error) {
        console.error('Get background tasks error:', error);
        return { highCPU: [], highMemory: [], all: [] };
    }
});

// Clean Browser Data
ipcMain.handle('clean-browser-data', async (_, browserName: string) => {
    try {
        const browserPaths: { [key: string]: string[] } = {
            'Chrome': [
                path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'History'),
                path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Cookies'),
                path.join(os.homedir(), 'Library', 'Caches', 'Google', 'Chrome')
            ],
            'Safari': [
                path.join(os.homedir(), 'Library', 'Safari', 'History.db'),
                path.join(os.homedir(), 'Library', 'Cookies', 'Cookies.binarycookies'),
                path.join(os.homedir(), 'Library', 'Caches', 'com.apple.Safari')
            ],
            'Firefox': [
                path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles'),
                path.join(os.homedir(), 'Library', 'Caches', 'Firefox')
            ]
        };

        const paths = browserPaths[browserName] || [];

        for (const filePath of paths) {
            if (fs.existsSync(filePath)) {
                try {
                    await shell.trashItem(filePath);
                } catch (e) {
                    console.error(`Failed to delete ${filePath}:`, e);
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Clean browser data error:', error);
        throw error;
    }
});

// Clean All Privacy Traces
ipcMain.handle('clean-privacy-traces', async () => {
    try {
        const browsers = ['Chrome', 'Safari', 'Firefox'];

        for (const browser of browsers) {
            try {
                await ipcMain.emit('clean-browser-data', browser);
            } catch (e) {
                console.error(`Failed to clean ${browser}:`, e);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Clean privacy traces error:', error);
        throw error;
    }
});

app.whenReady().then(() => {
    createWindow();


    // Helper vars moved to top level



    // IPC Handlers
    ipcMain.handle('get-system-stats', async () => {
        try {
            const [cpu, fsSize, battery, load, network, wifi] = await Promise.all([
                si.cpu(),
                si.fsSize(),
                si.battery(),
                si.currentLoad(),
                si.networkStats(),
                si.wifiConnections()
            ]);

            const memoryStats = await getMacMemoryStats();

            // Find main disk (mounted on /)
            const mainDisk = fsSize.find(d => d.mount === '/') || fsSize[0];

            // Network & WiFi
            const netStats = network[0] || {};

            let currentSSID = wifi[0]?.ssid;
            console.log('SystemInfo SSID:', currentSSID);

            // If SSID is empty or looks like valid "redacted" text (though usually it's just empty string in si)
            // Also check for "Wi-Fi" which might be a generic interface name returned by SI specific versions
            if (!currentSSID || currentSSID.length === 0 || currentSSID === 'Wi-Fi' || currentSSID.toLowerCase().includes('redacted')) {
                if (!ssidPrompted || cachedSSID) {
                    console.log('Attempting sudo fetch for SSID...');
                    try {
                        const elevatedSSID = await getSSIDWithSudo();
                        console.log('Sudo SSID result:', elevatedSSID);
                        if (elevatedSSID) currentSSID = elevatedSSID;
                    } catch (err) {
                        console.error('Sudo attempt failed', err);
                    }
                }
            }

            // Allow refreshing cached SSID occasionally? For now, sticky cache is safer than repeated prompts.
            // If user changes network, app restart needed. Acceptable for MVP.

            const diskStats = {
                ...mainDisk,
                used: mainDisk.size - mainDisk.available,
                use: ((mainDisk.size - mainDisk.available) / mainDisk.size) * 100
            };

            return {
                cpu: { ...cpu, load: load.currentLoad },
                mem: memoryStats,
                disk: diskStats,
                battery,
                network: { ...netStats, ssid: currentSSID }
            };
        } catch (e) {
            console.error(e);
            return null;
        }
    });

    ipcMain.handle('get-system-details', async () => {
        try {
            const [osInfo, system, graphics, battery] = await Promise.all([
                si.osInfo(),
                si.system(),
                si.graphics(),
                si.battery()
            ]);
            return { osInfo, system, graphics, battery };
        } catch (e) {
            console.error(e);
            return null;
        }
    });

    // Helper to get directory size in bytes
    const getAppSize = async (appPath: string): Promise<number> => {
        try {
            // du -k -d 0 returns size in KB
            const { stdout } = await execAsync(`du -k -d 0 "${appPath}"`);
            const sizeInKb = parseInt(stdout.split(/\s+/)[0], 10);
            return sizeInKb * 1024;
        } catch (error) {
            return 0;
        }
    };

    // Get Apps
    ipcMain.handle('get-apps', async () => {
        const appDirs = ['/Applications', path.join(os.homedir(), 'Applications')];
        const apps: any[] = [];

        for (const dir of appDirs) {
            try {
                if (!fs.existsSync(dir)) continue;
                const items = await fs.promises.readdir(dir);
                for (const item of items) {
                    if (item.endsWith('.app')) {
                        const fullPath = path.join(dir, item);
                        try {
                            const icon = await app.getFileIcon(fullPath, { size: 'large' });
                            const dataURL = icon.toDataURL();

                            // Calculate real size
                            const size = await getAppSize(fullPath);

                            // Basic stat for sorting/dates (optional but keeps lastUsed)
                            const stats = await fs.promises.stat(fullPath);

                            apps.push({
                                name: item.replace('.app', ''),
                                path: fullPath,
                                icon: dataURL,
                                size: size,
                                lastUsed: stats.atime,
                                isAppStore: fs.existsSync(path.join(fullPath, 'Contents', '_MASReceipt')),
                                isSystem: false // Will update logic below if needed, but for now we default
                            });

                            // Simple heuristic for vendor: check if Info.plist contains "com.apple."
                            // We do this read asynchronously to not block too much, but inside the loop it is sequential.
                            try {
                                const infoPlist = await fs.promises.readFile(path.join(fullPath, 'Contents', 'Info.plist'), 'utf8');
                                if (infoPlist.includes('com.apple.')) {
                                    apps[apps.length - 1].author = 'Apple';
                                } else {
                                    apps[apps.length - 1].author = 'Other';
                                }
                            } catch (e) {
                                apps[apps.length - 1].author = 'Other';
                            }
                        } catch (e) {
                            // Skip
                        }
                    }
                }
            } catch (err) {
                console.error(`Failed to scan dir ${dir}:`, err);
            }
        }
        return apps.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Get App Details (hierarchical breakdown)
    ipcMain.handle('get-app-details', async (_, appPath: string) => {
        try {
            const components: any = {
                binaries: [],
                preferences: [],
                supportingFiles: []
            };

            // 1. Binaries - the .app bundle itself
            const appSize = await getAppSize(appPath);
            components.binaries.push({
                name: path.basename(appPath),
                path: appPath,
                size: appSize,
                type: 'app'
            });

            // 2. Preferences - look in ~/Library/Preferences
            const appName = path.basename(appPath, '.app');
            const prefsDir = path.join(os.homedir(), 'Library', 'Preferences');

            try {
                const prefFiles = await fs.promises.readdir(prefsDir);
                for (const file of prefFiles) {
                    // Match files containing app name or bundle ID pattern
                    if (file.toLowerCase().includes(appName.toLowerCase()) ||
                        file.includes('com.') && file.toLowerCase().includes(appName.toLowerCase().replace(/\s+/g, ''))) {
                        const prefPath = path.join(prefsDir, file);
                        try {
                            const stat = await fs.promises.stat(prefPath);
                            components.preferences.push({
                                name: file,
                                path: prefPath,
                                size: stat.size,
                                type: 'plist'
                            });
                        } catch (e) {
                            // Skip if can't stat
                        }
                    }
                }
            } catch (e) {
                // Prefs dir might not be accessible
            }

            // 3. Supporting Files - look in ~/Library/Application Support, Caches, Containers
            const supportDirs = [
                path.join(os.homedir(), 'Library', 'Application Support'),
                path.join(os.homedir(), 'Library', 'Caches'),
                path.join(os.homedir(), 'Library', 'Containers')
            ];

            for (const dir of supportDirs) {
                try {
                    if (!fs.existsSync(dir)) continue;
                    const items = await fs.promises.readdir(dir);
                    for (const item of items) {
                        if (item.toLowerCase().includes(appName.toLowerCase()) ||
                            item.includes('com.') && item.toLowerCase().includes(appName.toLowerCase().replace(/\s+/g, ''))) {
                            const itemPath = path.join(dir, item);
                            try {
                                const stat = await fs.promises.stat(itemPath);
                                let size = stat.size;

                                // If directory, get recursive size
                                if (stat.isDirectory()) {
                                    try {
                                        const { stdout } = await execAsync(`du -k -d 0 "${itemPath}"`);
                                        const sizeInKb = parseInt(stdout.split(/\s+/)[0], 10);
                                        size = sizeInKb * 1024;
                                    } catch (e) {
                                        size = 0;
                                    }
                                }

                                components.supportingFiles.push({
                                    name: item,
                                    path: itemPath,
                                    size: size,
                                    type: stat.isDirectory() ? 'folder' : 'file'
                                });
                            } catch (e) {
                                // Skip if can't access
                            }
                        }
                    }
                } catch (e) {
                    // Dir might not exist
                }
            }

            return components;
        } catch (error) {
            console.error('Error getting app details:', error);
            return { binaries: [], preferences: [], supportingFiles: [] };
        }
    });

    // Uninstall App
    ipcMain.handle('uninstall-app', async (_, appPath) => {
        try {
            console.log('Moving to trash:', appPath);
            await shell.trashItem(appPath);
            return { success: true };
        } catch (error: any) {
            console.error('Uninstall failed:', error);
            return { success: false, error: error.message };
        }
    });

    // Clean Junk Files (Consolidated and Improved)
    ipcMain.handle('clean-junk', async (event, files: string[]) => {
        try {
            console.log('Cleaning junk files:', files?.length || 0);
            if (!files || !Array.isArray(files)) {
                return { success: false, error: 'No files specified' };
            }

            let cleanedCount = 0;
            let totalFreed = 0;

            for (const filePath of files) {
                try {
                    if (fs.existsSync(filePath)) {
                        const stats = await fs.promises.stat(filePath);
                        // Move to trash instead of permanent deletion
                        await shell.trashItem(filePath);
                        cleanedCount++;
                        totalFreed += stats.size;
                    }
                } catch (error) {
                    console.error(`Failed to clean ${filePath}:`, error);
                }
            }

            console.log(`Successfully cleaned ${cleanedCount} files, freed ${totalFreed} bytes`);
            return {
                success: true,
                cleanedCount,
                totalFiles: files.length,
                freedSpace: totalFreed
            };
        } catch (error) {
            console.error('Clean junk error:', error);
            return { success: false, error: 'Failed to complete cleanup' };
        }
    });

    ipcMain.handle('scan-junk', async () => {
        const junkDirs = [
            path.join(os.homedir(), 'Library/Caches'),
            path.join(os.homedir(), 'Library/Logs'),
            path.join(os.homedir(), 'Library/Application Support/Caches'),
            '/Library/Caches',
            '/Library/Logs'
        ];

        let totalSize = 0;
        let files: { path: string; size: number }[] = [];

        // Helper to get directory size or file size
        const scanItem = async (itemPath: string) => {
            try {
                if (!fs.existsSync(itemPath)) return;
                const stats = await fs.promises.stat(itemPath);

                if (stats.isDirectory()) {
                    const entries = await fs.promises.readdir(itemPath, { withFileTypes: true });
                    for (const entry of entries) {
                        await scanItem(path.join(itemPath, entry.name));
                    }
                } else {
                    files.push({ path: itemPath, size: stats.size });
                    totalSize += stats.size;
                }
            } catch (err) {
                // Ignore errors (permissions, etc.)
            }
        };

        // For performance, we limit deep scanning of massive folders
        // or just scan the top level folders for summary
        const scanSummaryOnly = async (dir: string) => {
            try {
                if (!fs.existsSync(dir)) return;
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    try {
                        const stats = await fs.promises.stat(fullPath);
                        if (stats.isDirectory()) {
                            // Get size of directory using du for speed
                            const { stdout } = await execAsync(`du -sk "${fullPath}"`);
                            const sizePos = stdout.trim().split(/\s+/)[0];
                            const size = parseInt(sizePos, 10) * 1024;
                            files.push({ path: fullPath, size });
                            totalSize += size;
                        } else {
                            files.push({ path: fullPath, size: stats.size });
                            totalSize += stats.size;
                        }
                    } catch (e) { }
                }
            } catch (err) { }
        };

        await Promise.all(junkDirs.map(d => scanSummaryOnly(d)));

        files.sort((a, b) => b.size - a.size);

        return {
            totalSize,
            fileCount: files.length,
            topFiles: files.slice(0, 200), // Return more top files
            allFiles: files.map(f => f.path) // Return all paths for cleanup
        };
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

