const { ipcMain } = require("electron");
const settings = require("electron-settings");

class CustomCss {
    constructor(client, window) {
        this.client = client;
        this.window = window;
        this.enable;
        this.list;

        this.loadSettings();

        ipcMain.on('SetEnableCustomCss', (event, opt) => {
            this.setEnable(opt);
        });

        ipcMain.on('NewCustomCss', (event, data) => {
            this.newCustomCss(data);
        });

        ipcMain.on('enableCustomCssItem', (event, data) => {
            this.setEnableCustomCssItem(data);
        });

        ipcMain.on('removeCustomCssItem', (event, data) => {
            this.removeCustomCssItem(data);
        });
    }

    setEnable(opt) {
        this.enable = opt;
        this.setSettings();
    }

    newCustomCss(data) {
        this.list[data.id] = data;
        this.setSettings();
    }

    setEnableCustomCssItem(data) {
        this.list[data.id].enable = data.enable;
        this.setSettings();
    }

    removeCustomCssItem(id) {
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