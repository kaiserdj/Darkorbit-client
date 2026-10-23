const { ipcMain } = require("electron");
const settings = require("electron-settings");
const { hasItem, sanitizeItem } = require("./validate");

class CustomJs {
    constructor(client, darkDev) {
        this.client = client;
        this.darkDev = darkDev;
        this.enable;
        this.list;

        this.loadSettings();

        ipcMain.on('SetEnableCustomJs', (event, opt) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.setEnable(opt);
        });

        ipcMain.on('NewCustomJs', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.newCustomJs(data);
        });

        ipcMain.on('enableCustomJsItem', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.setEnableCustomJsItem(data);
        });

        ipcMain.on('removeCustomJsItem', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.removeCustomJsItem(data);
        });
    }

    setEnable(opt) {
        this.enable = Boolean(opt);
        this.setSettings();
    }

    newCustomJs(data) {
        let item = sanitizeItem(data, false);
        if (!item) {
            return;
        }
        this.list[item.id] = item;
        this.setSettings();
    }

    setEnableCustomJsItem(data) {
        if (!data || !hasItem(this.list, data.id)) {
            return;
        }
        this.list[data.id].enable = Boolean(data.enable);
        this.setSettings();
    }

    removeCustomJsItem(id) {
        if (!hasItem(this.list, id)) {
            return;
        }
        delete this.list[id];
        this.setSettings();
    }

    setSettings() {
        let backup = settings.getSync();

        let CustomJsSettings = {
            enable: this.enable,
            list: this.list
        };

        backup.DarkDev.CustomJs = CustomJsSettings;

        settings.setSync(backup);

        this.client.setCustomJs();
    }

    loadSettings() {
        let backup = settings.getSync();

        this.enable = backup.DarkDev.CustomJs.enable;
        this.list = backup.DarkDev.CustomJs.list;
    }
}

module.exports = CustomJs;