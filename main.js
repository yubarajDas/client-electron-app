const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`)
});


let mainWindow;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 600,
     frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
     transparent: true,    // ✅ Transparent background
    resizable: false,     // Optional: disable resizing
    hasShadow: false,  
    
    show: false // Don't show the window by default
  });

  mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.openDevTools();
  // Hide the window when it's closed instead of quitting the app
  mainWindow.on('close', function (event) {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });
}

function createTray() {
  // Use a proper icon for your app
  const iconPath = path.join(__dirname, 'icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show App', 
      click: function() {
        mainWindow.show();
      } 
    },
    { 
      label: 'Network Stats', 
      click: function() {
        // You can add specific functionality here
        mainWindow.show();
      } 
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: function() {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setToolTip('Network Stats');
  tray.setContextMenu(contextMenu);
  
  // Optional: Show window when tray icon is clicked
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle the 'before-quit' event to properly clean up
app.on('before-quit', () => {
  app.isQuitting = true;
});