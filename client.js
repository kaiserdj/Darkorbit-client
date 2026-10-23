const { BrowserWindow, ipcMain, dialog } = require('electron');
const settings = require("electron-settings");
const fs = require("fs");
const path = require("path");

const tools = require("./tools");
const update = require("./update");
const useragent = require("./useragent");
const Settings = require("./settings/settings");
const Credentials = require("./credentials/credentials");
const DarkDev = require("./darkDev/darkDev");
const Api = require("./api");
const { parseUrl, isTrustedUrl, isDarkorbitUrl, openExternalSafe, matchesGlob } = require("./security");

const DEFAULT_URL = "https://www.darkorbit.com/";
const DEEP_LINK_PREFIX = "darkorbit-client://";

class Client {
    constructor(core) {
        return (async () => {
            update();
            this.core = core;
            this.arg = tools.commandLine();
            this.useragent = await useragent();
            this.windowTypes = new Map();

            // Deep links are parsed once at startup; later windows must not reuse them.
            let deepLink = process.argv.find(arg => typeof arg === "string" && arg.startsWith(DEEP_LINK_PREFIX));
            if (deepLink && /[?&](dosid|sid)=/.test(deepLink)) {
                this.arg.dosid = deepLink.slice(DEEP_LINK_PREFIX.length);
            }

            this.core.newWindowHandler = (event, webContents, url) => this.handleNewWindow(event, webContents, url);
            this.core.navigationPolicy = (webContents) => ["shop", "popup"].includes(this.windowTypes.get(webContents.id));

            if (this.arg.api) {
                console.log("api");
                console.log("Arguments:");
                console.log(this.arg);
                this.apiHandlers();
                this.createWindow("api");
                return this;
            }

            this.menuTray;
            this.tray = tools.tray(this);
            this.config = new Settings(this);
            this.credentials = new Credentials(this);
            this.api = new Api();
            this.darkDev;

            if (this.arg.dev) {
                this.darkDev = new DarkDev(this);
                console.log("Settings:");
                let { master, salt, accounts, ...visibleSettings } = settings.getSync();
                console.log(visibleSettings);
                console.log("Arguments:");
                console.log(this.arg);
                console.log(`Ppapi flash: ${this.core.ppapi_flash_path}`);
                console.log("Data GPU:");
                console.log(await this.core.app.getGPUFeatureStatus());
            }

            tools.contextMenu(this.arg.dev);

            this.createWindow("client");

            if (!settings.getSync().master && typeof this.arg.login === "undefined" && typeof this.arg.sid === "undefined" && !settings.getSync().hideMasterRegister) {
                this.credentials.mb.showWindow();
            }

            this.core.app.on("browser-window-created", () => {
                this.setCustomLoad();
                this.setCustomJs();
                this.setCustomCss();
            })

            ipcMain.handle("getAppPath", async () => this.core.app.getAppPath());

            return this;
        })()
    }

    createWindow(type, url) {
        let window;
        let options = {
            'width': this.arg.size ? this.arg.size[0] : settings.getSync()[type].width,
            'height': this.arg.size ? this.arg.size[1] : settings.getSync()[type].height,
            'x': settings.getSync()[type].x,
            'y': settings.getSync()[type].y,
            'webPreferences': {
                'preload': `${__dirname}/inject/${this.arg.api ? "ws" : "main"}.js`,
                'contextIsolation': true,
                'nodeIntegration': true,
                'enableRemoteModule': false,
                'plugins': true,
                'devTools': this.arg.dev,
                'offscreen': this.arg.offscreen
            }
        };

        if (this.arg.size) {
            delete this.arg.size;
        }

        window = new BrowserWindow(options);

        let webContentsId = window.webContents.id;
        this.windowTypes.set(webContentsId, type);

        window.setMenuBarVisibility(false);

        if (this.arg.dev) {
            window.webContents.openDevTools();
        }

        window.webContents.setBackgroundThrottling(settings.getSync().Settings.BackgroundThrottling);

        this.setCustomLoad();
        this.setCustomJs();
        this.setCustomCss();

        if (this.arg.login) {
            if (this.arg.login.length === 2) {
                let login = this.arg.login;
                window.webContents.once('did-finish-load', () => {
                    if (isDarkorbitUrl(window.webContents.getURL())) {
                        window.webContents.send("login", login);
                    }
                });
            }
            delete this.arg.login;
        }

        if (this.arg.dosid) {
            this.loadDosid(window, this.arg.dosid, this.arg.url);

            delete this.arg.dosid;
            delete this.arg.url;
        } else if (this.arg.url) {
            this.loadTrustedUrl(window, this.arg.url);

            delete this.arg.url;
        } else if (url) {
            this.loadTrustedUrl(window, url);
        } else {
            window.loadURL(DEFAULT_URL, { userAgent: this.useragent });
        }

        tools.settingsWindow(window, type);

        window.webContents.on('before-input-event', (event, input) => {
            let focus = () => BrowserWindow.getFocusedWindow();

            if (!focus()) {
                return;
            }

            if (this.arg.dev && input.control && input.shift && input.code === "KeyI" && new URL(focus().webContents.getURL()).search === "?action=internalMapRevolution") {
                event.preventDefault();
                focus().webContents.toggleDevTools();
            }
            if (input.control && input.code === "F5") {
                event.preventDefault();
                focus().reload();
            }
            if (input.control && input.code === "Numpad0") {
                event.preventDefault();
                focus().webContents.zoomLevel = 0;
            }
            if (input.control && input.key === "+") {
                event.preventDefault();
                focus().webContents.zoomLevel += 0.5;
            }
            if (input.control && input.key === "-") {
                event.preventDefault();
                focus().webContents.zoomLevel -= 0.5;
            }
        })

        window.on("close", (closeWin) => {
            if (this.arg.dev) {
                closeWin.sender.webContents.debugger.detach();
            }
        })

        window.on("closed", () => {
            this.windowTypes.delete(webContentsId);
            this.autoclose();
        })

        window.webContents.on('render-process-gone', (event, detailed) => {
            if (detailed.reason == "crashed") {
                this.core.app.relaunch();
                this.core.app.exit(0);
            }
        });

        return window;
    }

    apiHandlers() {
        const apiWindow = (event) => {
            if (this.windowTypes.get(event.sender.id) !== "api") {
                throw new Error("Untrusted sender");
            }
            return BrowserWindow.fromWebContents(event.sender);
        };

        ipcMain.handle("getApiConfig", async (event) => {
            apiWindow(event);
            return { port: Number(this.arg.api), dev: Boolean(this.arg.dev), version: this.core.app.getVersion() };
        });

        ipcMain.handle("getAppMetrics", async (event) => {
            apiWindow(event);
            return this.core.app.getAppMetrics();
        });

        ipcMain.handle("apiWindow", async (event, action, width, height) => {
            let window = apiWindow(event);

            switch (action) {
                case "setSize":
                    if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) {
                        window.setSize(width, height);
                    }
                    break;
                case "show":
                    window.show();
                    break;
                case "hide":
                    window.hide();
                    break;
                case "minimize":
                    window.minimize();
                    break;
                case "restore":
                    window.restore();
                    break;
            }
        });
    }

    loadTrustedUrl(window, url) {
        if (isTrustedUrl(url)) {
            window.loadURL(url, { userAgent: this.useragent });
        } else {
            dialog.showErrorBox("Load url", `Only https DarkOrbit urls can be loaded: ${url}`);
            window.loadURL(DEFAULT_URL, { userAgent: this.useragent });
        }
    }

    loadDosid(window, dosid, url) {
        let sid = dosid.match(/[?&](dosid|sid)=([^&#]+)/);
        let cookie;
        let target;

        if (sid !== null && isDarkorbitUrl(dosid)) {
            let baseUrl = new URL(dosid).origin;
            cookie = { url: baseUrl, name: 'dosid', value: sid[2] };
            target = `${baseUrl}/indexInternal.es?action=internalStart`;
        } else if (sid === null && parseUrl(dosid) === null) {
            if (!url) {
                dialog.showErrorBox("Load SID", `You also need the url parameter to be able to load the sid`);
            } else if (isDarkorbitUrl(url)) {
                cookie = { url: new URL(url).origin, name: 'dosid', value: dosid };
                target = url;
            }
        }

        if (!target) {
            if (sid !== null || url) {
                dialog.showErrorBox("Load SID", `Only https DarkOrbit urls can be used to load a sid`);
            }
            window.loadURL(DEFAULT_URL, { userAgent: this.useragent });
            return;
        }

        window.webContents.session.cookies.set(cookie)
            .catch(error => console.error(error))
            .then(() => window.loadURL(target, { userAgent: this.useragent }));
    }

    handleNewWindow(event, webContents, url) {
        let type = this.windowTypes.get(webContents.id);
        let window = BrowserWindow.fromWebContents(webContents);
        let parsed = parseUrl(url);

        if (!type || !window || parsed === null) {
            return openExternalSafe(url);
        }

        if (!isTrustedUrl(url)) {
            // Payment providers opened from the shop keep working in a window without preload or Node.
            if ((type === "shop" || type === "popup") && parsed.protocol === "https:") {
                event.newGuest = this.createPopupWindow(url);
                return;
            }
            return openExternalSafe(url);
        }

        if (parsed.search === "?action=internalMapRevolution") {
            return this.createWindow("game", url);
        }

        if (!isDarkorbitUrl(url)) {
            return this.createWindow("config", url);
        }

        let action = parsed.search.split("&")[0];

        if (parsed.hostname.split(".")[0].includes("board") || parsed.search === "?action=portal.redirectToBoard") {
            return this.createWindow("board", url);
        }

        if (action === "?action=internalPaymentProxy") {
            return this.createWindow("shop", url);
        }

        if (type === "game" || type === "shop" || type === "popup") {
            return this.createWindow("client", url);
        }

        if (action === "?action=externalLogout") {
            if (settings.getSync().Settings.PreventCloseSessionWindow) {
                return window.loadURL(DEFAULT_URL, { userAgent: this.useragent });
            }
            return window.close();
        }

        if (parsed.pathname.split("/")[1] === "p") {
            return this.createWindow("board", url);
        }

        return window.loadURL(url, { userAgent: this.useragent });
    }

    createPopupWindow(url) {
        let popup = new BrowserWindow({
            'width': 800,
            'height': 700,
            'webPreferences': {
                'contextIsolation': true,
                'nodeIntegration': false,
                'enableRemoteModule': false,
                'sandbox': true,
                'plugins': false,
                'devTools': this.arg.dev
            }
        });

        let webContentsId = popup.webContents.id;
        this.windowTypes.set(webContentsId, "popup");
        popup.on("closed", () => this.windowTypes.delete(webContentsId));

        popup.setMenuBarVisibility(false);
        popup.loadURL(url, { userAgent: this.useragent });

        return popup;
    }

    setCustomLoad() {
        if (!this.arg.dev || this.arg.api) {
            return;
        }

        let backup = settings.getSync();
        let customLoad = backup.DarkDev.CustomLoad;

        let windows = BrowserWindow.getAllWindows();

        for (let win of windows) {
            if (win.webContents.getURL().split(":")[0] === "file") {
                return;
            }

            let statusDevTools = win.webContents.isDevToolsOpened();
            if (!statusDevTools) {
                win.webContents.openDevTools();
            }

            if (!win.webContents.debugger.isAttached()) {
                win.webContents.debugger.attach("1.1");
            }

            if (!customLoad.enable) {
                win.webContents.debugger.sendCommand("Fetch.enable", { patterns: [] });
                win.webContents.debugger.removeAllListeners("message");
                if (!statusDevTools) {
                    win.webContents.closeDevTools();
                }
                return;
            }

            let patterns = [];

            for (let id in customLoad.list) {
                if (customLoad.list[id].enable) {
                    patterns.push({ urlPattern: customLoad.list[id].match });
                }
            }

            win.webContents.debugger.sendCommand("Fetch.enable", { patterns });

            win.webContents.debugger.removeAllListeners("message");

            win.webContents.debugger.on("message", async (event, method, params) => {
                if (method !== "Fetch.requestPaused") {
                    return;
                }

                for (let id in customLoad.list) {
                    if (!customLoad.list[id].enable) {
                        continue;
                    }

                    if (matchesGlob(customLoad.list[id].match, params.request.url)) {
                        let body;

                        try {
                            if (customLoad.list[id].LocalFileEnable) {
                                body = fs.readFileSync(path.normalize(customLoad.list[id].LocalFile), { encoding: "base64" });
                            } else if (parseUrl(customLoad.list[id].actionUrl)?.protocol === "https:") {
                                body = await tools.getBase64(customLoad.list[id].actionUrl);
                            } else {
                                throw new Error("Only https urls can be used as source");
                            }
                        } catch (error) {
                            console.error(error);
                            break;
                        }

                        win.webContents.debugger.sendCommand("Fetch.fulfillRequest", {
                            responseCode: 200,
                            requestId: params.requestId,
                            body
                        });

                        return;
                    }
                }
                dialog.showErrorBox("Injecting custom load", `Error when injecting custom load in the url: ${params.request.url}`);
                win.webContents.debugger.sendCommand("Fetch.continueRequest", { requestId: params.requestId });
            })
        }
    }

    setCustomJs() {
        if (!this.arg.dev || this.arg.api) {
            return;
        }

        let windows = BrowserWindow.getAllWindows();

        for (let win of windows) {
            if (win.webContents.getURL().split(":")[0] === "file") {
                return;
            }

            win.webContents.on("dom-ready", () => {
                if (settings.getSync().DarkDev.CustomJs.enable) {
                    win.webContents.send("customJs", settings.getSync().DarkDev.CustomJs);
                }
            })
        }
    }

    setCustomCss() {
        if (!this.arg.dev || this.arg.api) {
            return;
        }

        let windows = BrowserWindow.getAllWindows();

        for (let win of windows) {
            if (win.webContents.getURL().split(":")[0] === "file") {
                return;
            }

            win.webContents.on("dom-ready", () => {
                if (settings.getSync().DarkDev.CustomCss.enable) {
                    win.webContents.send("customCss", settings.getSync().DarkDev.CustomCss);
                }
            })
        }
    }

    autoclose() {
        if (this.arg.api) {
            return;
        }
        if (settings.getSync().autoClose) {
            let allWin = BrowserWindow.getAllWindows();
            if (allWin.length < 2) {
                allWin.forEach((win) => {
                    win.destroy();
                })
                this.core.app.quit();
            }
        }
    }

    rebuildTrayMenu() {
        this.tray.setContextMenu(this.menuTray);
    }
}

module.exports = Client;