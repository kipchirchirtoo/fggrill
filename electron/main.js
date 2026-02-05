const { app, BrowserWindow, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;

let mainWindow;
let backendProcess;
let frontendProcess;

function startBackend() {
    if (isDev) return;

    const backendPath = path.join(process.resourcesPath, 'backend', 'dist', 'server.js');

    backendProcess = spawn('node', [backendPath], {
        env: { ...process.env, NODE_ENV: 'production', PORT: 5000 },
        stdio: 'inherit'
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
        stdio: 'inherit'
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
