const { BrowserWindow, MenuItem, ipcMain, dialog } = require('electron');
const settings = require("electron-settings");

const CustomLoad = require("./tools/CustomLoad");
const CustomJs = require("./tools/CustomJs");
const CustomCss = require("./tools/CustomCss");
const ResourceDownload = require("./tools/ResourceDownload");

class DarkDev {
    constructor(client) {
        this.client = client;
        this.customLoad;
        this.customJs;
        this.customCss;
        this.window;

        if (!this.client.arg.dev) {
            return;
        }

        this.client.menuTray.insert(0, new MenuItem({
            label: "DarkDev",
            type: "normal",
            click: () => this.open()
        }));

        this.client.menuTray.insert(1, new MenuItem({
            type: "separator"
        }));

        this.client.rebuildTrayMenu();

        this.customLoad = new CustomLoad(this.client, this.window);
        this.customJs = new CustomJs(this.client, this.window);
        this.customCss = new CustomCss(this.client, this.window);

        ipcMain.on("LoadConfigDarkDev", () => {
            this.window.webContents.send("SendLoadConfigDarkDev", settings.getSync().DarkDev);
        })

        ipcMain.on('ResourceDownload', (event, opt) => {
            if (!this.isDarkDevWindow(event)) {
                return;
            }
            this.resourceDownload(opt);
        });

        ipcMain.handle("selectDirectory", async (event, title) => {
            if (!this.isDarkDevWindow(event)) {
                return null;
            }
            let result = await dialog.showOpenDialog(this.window, {
                properties: ["openDirectory"],
                title: String(title)
            });
            return result.canceled ? null : result.filePaths[0] || null;
        });
    }

    isDarkDevWindow(event) {
        return Boolean(this.window) && event.sender === this.window.webContents;
    }

    async open() {
        if (this.window) {
            this.window.focus();
            return;
        }

        let options = {
            'webPreferences': {
                'preload': `${__dirname}/master.js`,
                'contextIsolation': true,
                'nodeIntegration': true,
                'enableRemoteModule': false,
                'devTools': this.client.arg.dev
            }
        };

        this.window = new BrowserWindow(options);

        this.window.setMenuBarVisibility(false);

        this.window.loadFile("./darkDev/index.html");

        this.window.on('closed', () => {
            this.window = null;
            this.client.autoclose();
        });
    }

    async resourceDownload(opt) {
        await new ResourceDownload(this.window, opt);
    }
}

module.exports = DarkDev;