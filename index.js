const { app, BrowserWindow } = require('electron');
const path = require('path');
const userAgent = require("./useragent")

async function createWindow() {
    let Useragent = await userAgent.getVersion()

    let mainWindow;

    let ppapi_flash_path;

    if (process.platform == 'win32') {
        ppapi_flash_path = path.join(__dirname, 'pepflashplayer.dll')
    } else if (process.platform == 'linux') {
        ppapi_flash_path = path.join(__dirname, 'libpepflashplayer.so')
    } else if (process.platform == 'darwin') {
        ppapi_flash_path = path.join(__dirname, 'PepperFlashPlayer.plugin')
    }

    app.commandLine.appendSwitch('ppapi-flash-path', ppapi_flash_path)

    mainWindow = new BrowserWindow({
        'width': 800,
        'height': 600,
        'webPreferences': {
            'contextIsolation': true,
            'plugins': true
        },
    })

    mainWindow.loadURL(`https://www.darkorbit.com/`, { userAgent: Useragent })

    mainWindow.webContents.on('new-window', async function(e, url) {
        e.preventDefault()
        const external = new BrowserWindow({
            'webPreferences': {
                'contextIsolation': true,
                'plugins': true
            }
        })

        external.loadURL(url, { userAgent: Useragent })
    });
}

app.whenReady().then(createWindow)

app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})