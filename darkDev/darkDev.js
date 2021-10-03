const { BrowserWindow, MenuItem, ipcMain } = require('electron');
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

        this.customLoad = new CustomLoad(this.client, this.window);
        this.customJs = new CustomJs(this.client, this.window);
        this.customCss = new CustomCss(this.client, this.window);

        ipcMain.on("LoadConfigDarkDev", () => {
            this.window.webContents.send("SendLoadConfigDarkDev", settings.getSync().DarkDev);
        })

        ipcMain.on('ResourceDownload', (event, opt) => {
            this.resourceDownload(opt);
        });
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
                'nodeIntegrationInWorker': true,
                'enableRemoteModule': true,
                'webSecurity': false,
                'plugins': true,
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