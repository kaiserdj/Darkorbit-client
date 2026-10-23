const { ipcMain } = require("electron");
const settings = require("electron-settings");
const { hasItem, sanitizeItem } = require("./validate");

class CustomCss {
    constructor(client, darkDev) {
        this.client = client;
        this.darkDev = darkDev;
        this.enable;
        this.list;

        this.loadSettings();

        ipcMain.on('SetEnableCustomCss', (event, opt) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.setEnable(opt);
        });

        ipcMain.on('NewCustomCss', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.newCustomCss(data);
        });

        ipcMain.on('enableCustomCssItem', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.setEnableCustomCssItem(data);
        });

        ipcMain.on('removeCustomCssItem', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.removeCustomCssItem(data);
        });
    }

    setEnable(opt) {
        this.enable = Boolean(opt);
        this.setSettings();
    }

    newCustomCss(data) {
        let item = sanitizeItem(data, false);
        if (!item) {
            return;
        }
        this.list[item.id] = item;
        this.setSettings();
    }

    setEnableCustomCssItem(data) {
        if (!data || !hasItem(this.list, data.id)) {
            return;
        }
        this.list[data.id].enable = Boolean(data.enable);
        this.setSettings();
    }

    removeCustomCssItem(id) {
        if (!hasItem(this.list, id)) {
            return;
        }
        delete this.list[id];
        this.setSettings();
    }

    setSettings() {
        let backup = settings.getSync();

        let CustomCssSettings = {
            enable: this.enable,
            list: this.list
        };

        backup.DarkDev.CustomCss = CustomCssSettings;

        settings.setSync(backup);

        this.client.setCustomCss();
    }

    loadSettings() {
        let backup = settings.getSync();

        this.enable = backup.DarkDev.CustomCss.enable;
        this.list = backup.DarkDev.CustomCss.list;
    }
}

module.exports = CustomCss;