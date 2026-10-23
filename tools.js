const { BrowserWindow, nativeTheme, Tray, Menu, dialog, clipboard } = require("electron");
const settings = require("electron-settings");
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const contextmenu = require("electron-context-menu");
const { parseUrl, isDarkorbitUrl } = require("./security");

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
        .epilog('for more information visit https://github.com/emrementese/darkorbit-client-secure')
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
                // All windows share the default session; clear each session only once.
                let sessions = new Set(BrowserWindow.getAllWindows().map(win => win.webContents.session));
                for (let session of sessions) {
                    await Promise.all([
                        session.clearCache(),
                        session.clearStorageData(),
                        session.clearHostResolverCache(),
                        session.clearAuthCache()
                    ]);
                }

                client.core.app.relaunch();
                client.core.app.exit(0);
            }
        },
        {
            label: "Copy SID",
            click: async () => {
                let sidNotFound = true;
                for ( let win of BrowserWindow.getAllWindows() ) {
                    let url = win.webContents.getURL();
                    if ( !isDarkorbitUrl(url) ) {
                        continue;
                    }

                    let hostname = parseUrl(url).hostname;
                    if ( hostname !== "www.darkorbit.com" ) {
                        let cookie = await  win.webContents.session.cookies.get({name:'dosid', domain: hostname});

                        if ( cookie[0] && cookie[0].value ) {
                            let SID = cookie[0].value;
                            clipboard.writeText(SID);
                            dialog.showMessageBox(win, { type: "info", title: "Copy SID", message: `SID: ${SID}\nCopied to clipboard` });
                            sidNotFound = false;
                            break;
                        }
                    }
                }
                if ( sidNotFound ) {
                    dialog.showMessageBox({ type: "info", title: "Copy SID", message: "SID not detected" });
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
                click: () => require('electron-process-manager').openProcessManager({
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

    // resize/move fire continuously while dragging; store the final bounds once.
    let saveBounds = null;
    const save = () => {
        clearTimeout(saveBounds);
        saveBounds = null;

        if (window.isDestroyed() || window.isMaximized() || window.isMinimized() || window.isFullScreen()) {
            return;
        }

        let backup = settings.getSync();
        let bounds = window.getBounds();
        backup[type].width = bounds.width;
        backup[type].height = bounds.height;
        backup[type].x = bounds.x;
        backup[type].y = bounds.y;

        settings.setSync(backup);
    };
    const scheduleSave = () => {
        clearTimeout(saveBounds);
        saveBounds = setTimeout(save, 500);
    };

    window.on('resize', scheduleSave);
    window.on('move', scheduleSave);
    window.on('close', () => {
        if (saveBounds !== null) {
            save();
        }
    });
}

async function get(url) {
    return new Promise((resolve, reject) => {
        require("axios").get(url)
            .then(response => resolve(response.data))
            .catch(error => reject(error));
    });
}

async function getBase64(url) {
    return new Promise((resolve, reject) => {
        require("axios").get(url, { responseType: 'arraybuffer' })
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
