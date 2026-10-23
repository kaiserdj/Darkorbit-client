const { ipcMain } = require("electron");
const settings = require("electron-settings");

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
        this.enable = opt;
        this.setSettings();
    }

    newCustomLoad(data) {
        this.list[data.id] = data;
        this.setSettings();
    }

    setEnableCustomLoadItem(data) {
        this.list[data.id].enable = data.enable;
        this.setSettings();
    }

    removeCustomLoadItem(id) {
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