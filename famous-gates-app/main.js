const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { net } = require('electron');

const PRODUCTION_URL = 'https://famousgate.hirall.com';
const API_URL = 'https://api.hirall.com';
const SERVICES_URL = 'https://services.hirall.com';

let mainWindow;

// Suppress the console window on Windows
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

function checkOnline() {
  return new Promise((resolve) => {
    const request = net.request({ method: 'HEAD', url: PRODUCTION_URL });
    request.on('response', () => resolve(true));
    request.on('error', () => resolve(false));
    request.setTimeout(5000, () => { request.abort(); resolve(false); });
    request.end();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Famous Gates Hotels',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove menu bar entirely
  mainWindow.setMenuBarVisibility(false);

  const isOnline = await checkOnline();

  if (isOnline) {
    mainWindow.loadURL(PRODUCTION_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Retry going online every 30s when offline
  setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const currentURL = mainWindow.webContents.getURL();
      const isOfflinePage = currentURL.startsWith('file://');
      if (isOfflinePage) {
        const online = await checkOnline();
        if (online) mainWindow.loadURL(PRODUCTION_URL);
      }
    }
  }, 30000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Handle IPC from renderer
ipcMain.handle('get-config', () => ({
  apiUrl: API_URL,
  servicesUrl: SERVICES_URL,
  appUrl: PRODUCTION_URL,
}));
