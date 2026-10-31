const { ipcMain } = require('electron/main');
const settings = require("electron-settings");
const tools = require("./tools");
const { senderIsTrusted, parseUrl } = require("./security");

class Api {
    constructor() {
        // Only the Settings section is exposed; credentials (master, salt, accounts) never leave the main process.
        ipcMain.handle("getConfig", async (event) => {
            if (!senderIsTrusted(event)) {
                throw new Error("Untrusted sender");
            }
            return { Settings: settings.getSync().Settings };
        })

        ipcMain.handle("get", async (event, data) => {
            if (!senderIsTrusted(event)) {
                throw new Error("Untrusted sender");
            }
            let url = parseUrl(data);
            if (url === null || url.protocol !== "https:") {
                throw new Error("Only https urls are allowed");
            }
            return await tools.get(url.href);
        })
    }
}

module.exports = Api;
