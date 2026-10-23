const { app, Menu, session } = require('electron');
const path = require("path");
const fs = require('fs');
const settings = require("electron-settings");
const defaultSettings = require("./defaultSettings.json");
const { isTrustedUrl, isLocalFileUrl, parseUrl, openExternalSafe } = require("./security");

const ALLOWED_PERMISSIONS = ["fullscreen", "pointerLock"];

class Core {
    constructor() {
        return (async () => {
            this.app = app;
            this.appReady = false;
            this.ppapi_flash_path;
            this.newWindowHandler = null;
            this.navigationPolicy = null;

            this.ppapi();

            this.settings();

            if (!settings.getSync().Settings.HardwareAcceleration) {
                this.app.disableHardwareAcceleration();
            }

            this.app.setAsDefaultProtocolClient('darkorbit-client');

            Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: "File", submenu: [{ role: "reload" }, { role: "close" }] }]));

            await this.app.whenReady();
            this.appReady = true;

            session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
                callback(ALLOWED_PERMISSIONS.includes(permission) && isTrustedUrl(webContents.getURL()));
            });

            this.app.on('web-contents-created', (event, webContents) => {
                // https://github.com/advisories/GHSA-3p22-ghq8-v749
                webContents.on('select-bluetooth-device', (event, devices, callback) => {
                    event.preventDefault();
                    callback('');
                });

                webContents.on('will-attach-webview', (event) => {
                    event.preventDefault();
                });

                // Every popup is denied here; client windows get their own routing through newWindowHandler.
                webContents.on('new-window', (event, url) => {
                    event.preventDefault();
                    if (this.newWindowHandler) {
                        this.newWindowHandler(event, webContents, url);
                    } else {
                        openExternalSafe(url);
                    }
                });

                webContents.on('will-navigate', (event, url) => {
                    if (!this.isNavigationAllowed(webContents, url)) {
                        event.preventDefault();
                        openExternalSafe(url);
                    }
                });
            });

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
            // Pepper Flash cannot start inside the Chromium sandbox on Linux with Electron 11.
            // This is a known residual risk while the client depends on Flash.
            this.app.commandLine.appendSwitch("--no-sandbox");
        } else if (process.platform == 'darwin') {
            this.ppapi_flash_path = path.join(app.getAppPath(), `../flash/PepperFlashPlayer.plugin`);
            if (!fs.existsSync(this.ppapi_flash_path)) {
                this.ppapi_flash_path = path.join(app.getAppPath(), './flash/PepperFlashPlayer.plugin');
            }
        }

        this.app.commandLine.appendSwitch('ppapi-flash-path', this.ppapi_flash_path);
    }

    isNavigationAllowed(webContents, url) {
        let current = webContents.getURL();

        if (isLocalFileUrl(current)) {
            return isLocalFileUrl(url);
        }

        let parsed = parseUrl(url);
        if (parsed === null || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
            return false;
        }

        if (isTrustedUrl(url)) {
            return true;
        }

        return this.navigationPolicy ? this.navigationPolicy(webContents, url) : false;
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

            let merged = merge(defaultSettings, backup);
            delete merged.Settings.NoSandbox;
            settings.setSync(merged)
        }
    }
}

module.exports = Core;