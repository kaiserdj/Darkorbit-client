const { BrowserWindow, MenuItem, ipcMain } = require('electron');
const settings = require("electron-settings");
const { openExternalSafe } = require("../security");

class Settings {
    constructor(client) {
        this.client = client;
        this.window;

        this.client.menuTray.insert(4, new MenuItem({
            label: "Settings",
            type: "normal",
            click: () => this.open()
        }));

        this.client.menuTray.insert(5, new MenuItem({
            type: "separator"
        }));

        this.client.rebuildTrayMenu();

        ipcMain.on("LoadSettings", () => {
            this.window.webContents.send("SendLoadSettings", settings.getSync().Settings)
        })

        ipcMain.on("relaunch", (event) => {
            if (!this.isSettingsWindow(event)) {
                return;
            }
            this.client.core.app.relaunch();
            this.client.core.app.exit(0);
        });

        ipcMain.on("openExternal", (event, url) => {
            if (!this.isSettingsWindow(event)) {
                return;
            }
            openExternalSafe(url);
        });

        ipcMain.on('SetOptionConfig', (event, opt, data) => {
            let backup = settings.getSync();
            backup.Settings[opt] = data;
            settings.setSync(backup);
        });
    }

    isSettingsWindow(event) {
        return Boolean(this.window) && event.sender === this.window.webContents;
    }

    open() {
        if (this.window) {
            this.window.focus();
            return;
        }

        let options = {
            'webPreferences': {
                'preload': `${__dirname}/settings_js.js`,
                'contextIsolation': true,
                'nodeIntegration': true,
                'enableRemoteModule': false,
                'devTools': this.client.arg.dev
            }
        };

        this.window = new BrowserWindow(options);

        this.window.setMenuBarVisibility(false);

        this.window.loadFile("./settings/index.html");

        this.window.on('closed', () => {
            this.window = null;
            this.client.autoclose();
        });
    }
}

module.exports = Settings;