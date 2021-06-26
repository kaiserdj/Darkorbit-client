const { ipcMain } = require('electron/main');
const settings = require("electron-settings");
const tools = require("./tools");

class Api {
    constructor() {
        ipcMain.handle("getConfig", async () => {
            return await settings.getSync();
        })

        ipcMain.handle("setConfig", async (event, data) => {
            settings.setSync(data);
            return true;
        })

        ipcMain.handle("get", async (event, data) => {
            return await tools.get(data);
        })

        ipcMain.handle("open", async (event, data) => {
            require('open')(data);
            return true;
        })
    }
}

module.exports = Api;