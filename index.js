const { app, BrowserWindow } = require('electron');
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const path = require('path');
const update = require("./update");
const userAgent = require("./useragent");

let argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('dosid', {
        type: "string",
        description: "Run client with custom dosid",
        default: null
    })
    .option('dev', {
        alias: 'd',
        type: 'boolean',
        description: 'Run in development mode',
        default: false
    })
    .epilog('for more information visit https://github.com/kaiserdj/Darkorbit-client')
    .argv;

async function createWindow() {
    update.checkForUpdates()
    let Useragent = await userAgent.getVersion()

    let mainWindow;

    mainWindow = new BrowserWindow({
        'width': 800,
        'height': 600,
        'webPreferences': {
            'contextIsolation': true,
            'nodeIntegration': true,
            'plugins': true,
            'devTools': argv.dev
        },
    });

    if (argv.dev) {
        mainWindow.webContents.openDevTools()
    }

    if (argv.dosid) {
        let sid = argv.dosid.match(/[?&](dosid|sid)=([^&]+)/);
        let baseUrl = new URL(argv.dosid).origin;

        if (sid !== null && baseUrl !== null) {
            const cookie = { url: baseUrl, name: 'dosid', value: sid[2] };
            mainWindow.webContents.session.cookies.set(cookie);
            mainWindow.loadURL(`${baseUrl}/indexInternal.es?action=internalStart`, { userAgent: Useragent });
        }
    } else {
        mainWindow.loadURL(`https://www.darkorbit.com/`, { userAgent: Useragent });
    }

    mainWindow.webContents.on('new-window', async function(e, url) {
        let window;
        e.preventDefault()

        if (new URL(url).search === "?action=internalMapRevolution") {
            window = new BrowserWindow({
                'webPreferences': {
                    'contextIsolation': true,
                    'nodeIntegration': true,
                    'plugins': true,
                    'devTools': argv.dev
                }
            });
        } else if (new URL(url).host.split(".")[1] === "darkorbit") {
            if (new URL(url).host.split(".")[0].search("board") !== -1) {
                window = new BrowserWindow({
                    'webPreferences': {
                        'contextIsolation': true,
                        'nodeIntegration': true,
                        'plugins': true,
                        'devTools': argv.dev
                    }
                });
            } else {
                window = new BrowserWindow({
                    'webPreferences': {
                        'contextIsolation': true,
                        'nodeIntegration': true,
                        'plugins': true,
                        'devTools': argv.dev
                    }
                });
            }
        } else if (new URL(url).host.split(".")[1] === "bpsecure") {
            window = new BrowserWindow({
                'webPreferences': {
                    'contextIsolation': true,
                    'nodeIntegration': true,
                    'plugins': true,
                    'devTools': argv.dev
                }
            });
        } else {
            require('open')(url)
            return
        }

        window.loadURL(url, { userAgent: Useragent });

        if (argv.dev) {
            window.webContents.openDevTools()
        }
    });
}

let ppapi_flash_path;

if (process.platform == 'win32') {
    ppapi_flash_path = path.join(app.getAppPath(), '../flash/pepflashplayer.dll')
} else if (process.platform == 'linux') {
    ppapi_flash_path = path.join(app.getAppPath(), '../flash/libpepflashplayer.so')
} else if (process.platform == 'darwin') {
    ppapi_flash_path = path.join(app.getAppPath(), '../flash/PepperFlashPlayer.plugin')
}

app.commandLine.appendSwitch('ppapi-flash-path', ppapi_flash_path);

app.whenReady().then(createWindow);

app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});