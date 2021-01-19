const { app, BrowserWindow } = require('electron');
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const path = require('path');
const settings = require("electron-settings");
const update = require("./update");
const userAgent = require("./useragent");

settings.configure({
    atomicSave: true,
    fileName: 'settings.json',
    prettify: true
});

if (!settings.getSync().check) {
    settings.setSync(require("./defaultSettings.json"));
}

let argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('login', {
        alias: 'l',
        type: 'array',
        description: 'Autologin on darkorbit. Example: --login user pass'
    })
    .option('dosid', {
        alias: 'sid',
        type: "string",
        description: "Run client with custom dosid"
    })
    .option('dev', {
        alias: 'd',
        type: 'boolean',
        description: 'Run in development mode'
    })
    .epilog('for more information visit https://github.com/kaiserdj/Darkorbit-client')
    .argv;

async function createWindow() {
    update.checkForUpdates();
    let Useragent = await userAgent.getVersion();

    let mainWindow;

    mainWindow = new BrowserWindow({
        'width': settings.getSync().client.width,
        'height': settings.getSync().client.height,
        'x': settings.getSync().client.x,
        'y': settings.getSync().client.y,
        'webPreferences': {
            'preload': `${__dirname}/inject/main.js`,
            'contextIsolation': true,
            'nodeIntegration': true,
            'plugins': true,
            'devTools': argv.dev
        },
    });

    if (argv.dev) {
        mainWindow.webContents.openDevTools();
    }

    if (argv.login) {
        if (argv.login.length === 2) {
            mainWindow.webContents.on('did-finish-load', () => {
                mainWindow.webContents.send("login", argv.login)
            });
        }
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

    settingsWindow(mainWindow, "client");

    mainWindow.webContents.on('new-window', async function(e, url) {
        let windowType;
        e.preventDefault();

        if (new URL(url).search === "?action=internalMapRevolution") {
            windowType = "game";
        } else if (new URL(url).host.split(".")[1] === "darkorbit") {
            if (new URL(url).host.split(".")[0].search("board") !== -1 || new URL(url).search === "?action=portal.redirectToBoard") {
                windowType = "board";
            } else {
                windowType = "client";
            }
        } else if (new URL(url).host.split(".")[1] === "bpsecure") {
            windowType = "config";
        } else {
            require('open')(url);
            return;
        }

        let window = new BrowserWindow({
            'width': settings.getSync()[windowType].width,
            'height': settings.getSync()[windowType].height,
            'x': settings.getSync()[windowType].x,
            'y': settings.getSync()[windowType].y,
            'webPreferences': {
                'contextIsolation': true,
                'nodeIntegration': true,
                'plugins': true,
                'devTools': argv.dev
            }
        });

        window.loadURL(url, { userAgent: Useragent });

        if (argv.dev) {
            window.webContents.openDevTools();
        }

        settingsWindow(window, windowType);
        });
};

let ppapi_flash_path;

if (process.platform == 'win32') {
    ppapi_flash_path = path.join(app.getAppPath(), '../flash/pepflashplayer.dll');
} else if (process.platform == 'linux') {
    ppapi_flash_path = path.join(app.getAppPath(), '../flash/libpepflashplayer.so');
} else if (process.platform == 'darwin') {
    ppapi_flash_path = path.join(app.getAppPath(), '../flash/PepperFlashPlayer.plugin');
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

function settingsWindow(window, type) {
    if (settings.getSync()[type].max) {
        window.maximize();
    }

    window.on('maximize', () => {
        let backup = settings.getSync();
        backup[type].max = true;
        settings.setSync(backup);
    });

    window.on("unmaximize", () => {
        let backup = settings.getSync();
        backup[type].max = false;
        settings.setSync(backup);
    });

    window.on('resize', function() {
        let backup = settings.getSync();
        let size = window.getSize();
        backup[type].width = size[0];
        backup[type].height = size[1];

        settings.setSync(backup);
    })

    window.on('move', function(data) {
        let backup = settings.getSync();
        let pos = data.sender.getBounds();
        backup[type].x = pos.x;
        backup[type].y = pos.y;

        settings.setSync(backup);
    });
}