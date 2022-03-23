const { app, Menu } = require('electron');
const path = require("path");
const fs = require('fs');
const settings = require("electron-settings");
const defaultSettings = require("./defaultSettings.json");

class Core {
    constructor() {
        return (async () => {
            this.app = app;
            global.app = app;
            this.appReady = false;
            this.ppapi_flash_path;

            this.ppapi();

            this.settings();

            if (!settings.getSync().Settings.HardwareAcceleration) {
                this.app.disableHardwareAcceleration();
            }

            if (settings.getSync().Settings.NoSandbox) {
                this.app.commandLine.appendSwitch('--no-sandbox');
            }

            this.app.commandLine.appendSwitch('ignore-certificate-errors');

            process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

            this.app.setAsDefaultProtocolClient('darkorbit-client');

            Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: "File", submenu: [{ role: "reload" }, { role: "close" }] }]));

            await this.app.whenReady();
            this.appReady = true;

            return this;
        })()
    }

    ppapi() {
        if (process.platform == 'win32') {
            this.ppapi_flash_path = path.join(app.getAppPath(), '../flash/pepflashplayer.dll');
            if (!fs.existsSync(this.ppapi_flash_path)) {
                this.ppapi_flash_path = path.join(app.getAppPath(), './flash/pepflashplayer.dll');
            }
        } else if (process.platform == 'linux') {
            this.ppapi_flash_path = path.join(process.resourcesPath.split("/")[1] === "tmp" ? process.resourcesPath : app.getAppPath(), './flash/libpepflashplayer.so');
            this.app.commandLine.appendSwitch("--no-sandbox");
        } else if (process.platform == 'darwin') {
            this.ppapi_flash_path = path.join(app.getAppPath(), `../flash/PepperFlashPlayer.plugin`);
            if (!fs.existsSync(this.ppapi_flash_path)) {
                this.ppapi_flash_path = path.join(app.getAppPath(), './flash/PepperFlashPlayer.plugin');
            }
        }

        this.app.commandLine.appendSwitch('ppapi-flash-path', this.ppapi_flash_path);
    }

    settings() {
        settings.configure({
            atomicSave: true,
            fileName: 'settings.json',
            prettify: true
        });

        if (!settings.getSync().check) {
            settings.setSync(defaultSettings);
        } else {
            let backup = settings.getSync();

            const isObject = x =>
                Object(x) === x

            const merge = (left = {}, right = {}) =>
                Object.entries(right)
                .reduce((acc, [k, v]) =>
                    isObject(v) && isObject(left[k]) ? { ...acc, [k]: merge(left[k], v) } : { ...acc, [k]: v }, left
                )

            settings.setSync(merge(defaultSettings, backup))
        }
    }
}

module.exports = Core;