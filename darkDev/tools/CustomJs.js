const { ipcMain } = require("electron");
const settings = require("electron-settings");

class CustomJs {
    constructor(client, window) {
        this.client = client;
        this.window = window;
        this.enable;
        this.list;

        this.loadSettings();

        ipcMain.on('SetEnableCustomJs', (event, opt) => {
            this.setEnable(opt);
        });

        ipcMain.on('NewCustomJs', (event, data) => {
            this.newCustomJs(data);
        });

        ipcMain.on('enableCustomJsItem', (event, data) => {
            this.setEnableCustomJsItem(data);
        });

        ipcMain.on('removeCustomJsItem', (event, data) => {
            this.removeCustomJsItem(data);
        });
    }

    setEnable(opt) {
        this.enable = opt;
        this.setSettings();
    }

    newCustomJs(data) {
        this.list[data.id] = data;
        this.setSettings();
    }

    setEnableCustomJsItem(data) {
        this.list[data.id].enable = data.enable;
        this.setSettings();
    }

    removeCustomJsItem(id) {
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