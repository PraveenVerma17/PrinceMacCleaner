const { app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

app.whenReady().then(async () => {
    try {
        const appDirs = ['/Applications', path.join(os.homedir(), 'Applications')];
        let foundApp = null;

        // Find existing app
        for (const dir of appDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                const appFile = files.find(f => f.endsWith('.app'));
                if (appFile) {
                    foundApp = path.join(dir, appFile);
                    break;
                }
            }
        }

        if (!foundApp) {
            console.error("No .app found to test with.");
            app.quit();
            return;
        }

        console.log(`Getting icon for: ${foundApp}`);
        const icon = await app.getFileIcon(foundApp, { size: 'large' });
        const dataURL = icon.toDataURL();
        console.log(`Success! Data URL length: ${dataURL.length}`);
        console.log(`Start of Data URL: ${dataURL.substring(0, 50)}`);
        app.quit();
    } catch (e) {
        console.error("Error:", e);
        app.quit();
    }
});
