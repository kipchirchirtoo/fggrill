const { app, BrowserWindow, globalShortcut, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;

// Configure logging for auto-updater
// autoUpdater.logger = require('electron-log');
// autoUpdater.logger.transports.file.level = 'info';

let mainWindow;
let backendProcess;
let frontendProcess;

function startBackend() {
    if (isDev) return;

    const backendPath = path.join(process.resourcesPath, 'backend', 'dist', 'server.js');

    backendProcess = spawn('node', [backendPath], {
        env: { ...process.env, NODE_ENV: 'production', PORT: 5000 },
        stdio: 'ignore', // Hides terminal output
        windowsHide: true // Explicitly hide the CMD window on Windows
    });

    backendProcess.on('error', (err) => {
        console.error('Failed to start backend:', err);
    });
}

function startFrontend() {
    if (isDev) return;

    // The standalone build generates a server.js that needs to be started
    const frontendPath = path.join(process.resourcesPath, 'frontend', 'server.js');

    frontendProcess = spawn('node', [frontendPath], {
        env: { ...process.env, NODE_ENV: 'production', PORT: 3000, HOSTNAME: 'localhost' },
        stdio: 'ignore', // Hides terminal output
        windowsHide: true // Explicitly hide the CMD window on Windows
    });

    frontendProcess.on('error', (err) => {
        console.error('Failed to start frontend:', err);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        fullscreen: !isDev,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Register Escape key to toggle fullscreen
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape' && mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
        }
    });

    // Points to the local server
    const startUrl = 'http://localhost:3000/terminal';

    // If in production, we might need a small delay for servers to start
    setTimeout(() => {
        mainWindow.loadURL(startUrl).catch(e => {
            console.error('Failed to load URL, retrying...', e);
            setTimeout(() => mainWindow.loadURL(startUrl), 2000);
        });
    }, isDev ? 0 : 3000);

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (backendProcess) backendProcess.kill();
        if (frontendProcess) frontendProcess.kill();
    });
}

// Auto-Updater Events
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available.');
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.');
});

autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater: ' + err);
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded. The application will now restart to apply the update.',
        buttons: ['Restart Now']
    }).then(() => {
        autoUpdater.quitAndInstall();
    });
});

app.on('ready', () => {
    startBackend();
    startFrontend();
    createWindow();

    // Check for updates every time the app opens
    if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
