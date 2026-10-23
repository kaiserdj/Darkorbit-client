const { ipcMain } = require("electron");
const settings = require("electron-settings");
const { hasItem, sanitizeItem } = require("./validate");

class CustomLoad {
    constructor(client, darkDev) {
        this.client = client;
        this.darkDev = darkDev;
        this.enable;
        this.list;

        this.loadSettings();

        ipcMain.on('SetEnableCustomLoad', (event, opt) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.setEnable(opt);
        });

        ipcMain.on('NewCustomLoad', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.newCustomLoad(data);
        });

        ipcMain.on('enableCustomLoadItem', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.setEnableCustomLoadItem(data);
        });

        ipcMain.on('removeCustomLoadItem', (event, data) => {
            if (!this.darkDev.isDarkDevWindow(event)) {
                return;
            }
            this.removeCustomLoadItem(data);
        });
    }

    setEnable(opt) {
        this.enable = Boolean(opt);
        this.setSettings();
    }

    newCustomLoad(data) {
        let item = sanitizeItem(data, true);
        if (!item) {
            return;
        }
        this.list[item.id] = item;
        this.setSettings();
    }

    setEnableCustomLoadItem(data) {
        if (!data || !hasItem(this.list, data.id)) {
            return;
        }
        this.list[data.id].enable = Boolean(data.enable);
        this.setSettings();
    }

    removeCustomLoadItem(id) {
        if (!hasItem(this.list, id)) {
            return;
        }
        delete this.list[id];
        this.setSettings();
    }

    setSettings() {
        let backup = settings.getSync();

        let CustomloadSettings = {
            enable: this.enable,
            list: this.list
        };

        backup.DarkDev.CustomLoad = CustomloadSettings;

        settings.setSync(backup);

        this.client.setCustomLoad();
    }

    loadSettings() {
        let backup = settings.getSync();

        this.enable = backup.DarkDev.CustomLoad.enable;
        this.list = backup.DarkDev.CustomLoad.list;
    }
}

module.exports = CustomLoad;