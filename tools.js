const { BrowserWindow, nativeTheme, Tray, Menu } = require("electron");
const settings = require("electron-settings");
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const contextmenu = require("electron-context-menu");
const { openProcessManager } = require('electron-process-manager');
const axios = require("axios");

function commandLine() {
    return yargs(hideBin(process.argv))
        .usage('Usage: $0 [options]')
        .option('login', {
            alias: 'l',
            type: 'array',
            description: 'Autologin on darkorbit. Example: --login user pass'
        })
        .option('url', {
            type: "string",
            description: "Define url that the client will load when opening"
        })
        .option('dosid', {
            alias: 'sid',
            type: "string",
            description: "Run client with custom dosid"
        })
        .option('dev', {
            alias: 'd',
            type: 'boolean',
            description: 'Run in development mode',
            default: settings.getSync().Settings.DefaultDev
        })
        .option('api', {
            type: 'string',
            description: 'Open client with api ws. Example: --api 8080'
        })
        .option('size', {
            type: 'array',
            description: 'Open client with custom window size. Example: --size 900 800',
        })
        .option('offscreen', {
            type: 'boolean',
            description: 'Run in offscreen mode',
            default: false
        })
        .epilog('for more information visit https://github.com/kaiserdj/Darkorbit-client')
        .argv;
}

function tray(client) {
    let tray = new Tray(`${__dirname}/tray.png`);
    client.menuTray = Menu.buildFromTemplate([{
            label: "Auto-close",
            type: "checkbox",
            checked: settings.getSync().autoClose ? true : false,
            click: () => {
                let backup = settings.getSync();

                backup.autoClose = !backup.autoClose;

                settings.setSync(backup);
            }
        },
        {
            label: "Clear Cache",
            click: async () => {
                for(let win of BrowserWindow.getAllWindows()) {
                    await win.webContents.session.clearCache();
                    await win.webContents.session.clearStorageData();
                    await win.webContents.session.clearHostResolverCache();
                    await win.webContents.session.clearAuthCache();
                }

                client.core.app.relaunch();
                client.core.app.exit(0);
            }
        },
        {
            label: "Copy SID",
            click: () => {
                for(let win of BrowserWindow.getAllWindows()) {
                    if (new URL(win.webContents.getURL()).hostname.search("darkorbit") != -1) {
                        win.webContents.executeJavaScript("(typeof SID != 'undefined' && typeof SID == 'string') ? " +
                            "(alert(`SID : ${SID.replace('dosid=', '')}\nCopied to clipboard`), SID.replace('dosid=', '')) : " +
                            "(alert(`SID not detected`), null)")
                            .then( (result) => {
                                if (result) {
                                    const {clipboard} = require('electron');
                                    clipboard.writeText(result);
                                }
                            });
                        break;
                    }
                }
            }
        },
        {
            type: "separator"
        },
        {
            label: "Exit",
            click: () => {
                BrowserWindow.getAllWindows().forEach((win) => {
                    win.destroy();
                });
                client.core.app.quit();
            }
        }
    ]);
    tray.setToolTip("Darkorbit Client");
    tray.setContextMenu(client.menuTray);

    return tray;
}

function contextMenu(dev) {
    contextmenu({
        shouldShowMenu: (event, params) => {
            switch (params.pageURL.split(":")[0]) {
                case "file":
                    if (dev) {
                        return true;
                    } else {
                        return false;
                    }
                    default:
                        return true;
            }
        },
        prepend: (defaultActions, params, browserWindow) => [{
                label: 'Back',
                icon: `${__dirname}/contextMenu/back${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`,
                enabled: browserWindow.webContents.canGoBack(),
                click: (menu, win) => win.webContents.goBack()
            },
            {
                label: 'Forward',
                icon: `${__dirname}/contextMenu/forward${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`,
                enabled: browserWindow.webContents.canGoForward(),
                click: (menu, win) => win.webContents.goForward()
            },
            {
                label: 'Refresh',
                accelerator: "CmdOrCtrl+F5",
                icon: `${__dirname}/contextMenu/refresh${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`,
                click: (menu, win) => win.webContents.reload()
            },
            {
                label: 'Full Screen',
                icon: `${__dirname}/contextMenu/fullscreen${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`,
                visible: !browserWindow.isFullScreen(),
                click: (menu, win) => win.setFullScreen(true)
            },
            {
                label: 'Full Screen',
                icon: `${__dirname}/contextMenu/fullscreen_exit${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`,
                visible: browserWindow.isFullScreen(),
                click: (menu, win) => win.setFullScreen(false)
            },
            { type: 'separator' },
            {
                role: 'resetzoom',
                label: 'Normal zoom',
                accelerator: "CmdOrCtrl+num0",
                icon: `${__dirname}/contextMenu/resetZoom${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`
            },
            {
                role: 'zoomin',
                accelerator: "CmdOrCtrl+numadd",
                icon: `${__dirname}/contextMenu/zoomIn${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`
            },
            {
                role: 'zoomout',
                accelerator: "CmdOrCtrl+numsub",
                icon: `${__dirname}/contextMenu/zoomOut${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`
            },
            {
                type: 'separator',
                visible: dev
            },
            {
                label: 'Inspect Element',
                icon: `${__dirname}/contextMenu/inspectElement${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`,
                visible: dev,
                click: () => {
                    browserWindow.isDevToolsOpened()
                    browserWindow.inspectElement(params.x, params.y)
                }
            },
            {
                label: 'Process Manager',
                icon: `${__dirname}/contextMenu/processManager${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`,
                visible: dev,
                click: () => openProcessManager({
                    defaultSorting: {
                        path: 'pid',
                        how: 'ascending'
                    }
                })
            },
            {
                role: 'forcereload',
                label: 'Force reload',
                icon: `${__dirname}/contextMenu/forceReload${nativeTheme.shouldUseDarkColors ? "" : "_dark"}.png`,
                visible: dev
            }
        ],
        showSelectAll: dev,
        showLookUpSelection: dev,
        showCopyImage: dev,
        showCopyImageAddress: dev,
        showSaveImage: dev,
        showSaveImageAs: dev,
        showSaveLinkAs: dev,
        showServices: dev,
        showSearchWithGoogle: dev,
        showInspectElement: false,
    });
}

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

    window.on('resize', () => {
        let backup = settings.getSync();
        let size = window.getSize();
        backup[type].width = size[0];
        backup[type].height = size[1];

        settings.setSync(backup);
    })

    window.on('move', (data) => {
        let backup = settings.getSync();
        let pos = data.sender.getBounds();
        backup[type].x = pos.x;
        backup[type].y = pos.y;

        settings.setSync(backup);
    });
}

async function get(url) {
    return new Promise((resolve, reject) => {
        axios.get(url)
            .then(response => resolve(response.data))
            .catch(error => reject(error));
    });
}

async function getBase64(url) {
    return new Promise((resolve, reject) => {
        axios.get(url, { responseType: 'arraybuffer' })
            .then(response => resolve(Buffer.from(response.data, 'binary').toString('base64')))
            .catch(error => reject(error));
    });
}

module.exports = {
    commandLine,
    tray,
    contextMenu,
    settingsWindow,
    get,
    getBase64
}