const { BrowserWindow, dialog } = require('electron');
const settings = require("electron-settings");
const fs = require("fs");
const path = require("path");

const tools = require("./tools");
const update = require("./update");
const useragent = require("./useragent");
const Settings = require("./settings/settings");
const Credentials = require("./credentials/credentials");
const Api = require("./api");
const ApiServer = require("./apiServer");
const PacketService = require("./packet");
const { parseUrl, isTrustedUrl, isDarkorbitUrl, isLoginPage, openExternalSafe, matchesGlob } = require("./security");

const DEFAULT_URL = "https://www.darkorbit.com/";
const DEEP_LINK_PREFIX = "darkorbit-client://";
const UPDATE_DELAY = 3000;
// Every client window runs in a sandboxed renderer without Node. DarkOrbit windows get the bundled
// preload (built by `npm run build:preload`); windows that may show third party payment pages get none.
const PRELOAD = path.join(__dirname, "inject", "dist", "preload.js");
const THIRD_PARTY_TYPES = ["shop", "popup"];
// window.open() from these pages keeps a live reference to the new window. Electron ties such a
// window to its opener, so other pages (e.g. the start page opening the game) open independent windows.
const OPENER_KEEPS_WINDOW = ["game", "shop", "popup"];

class Client {
    constructor(core) {
        return (async () => {
            this.core = core;
            this.arg = tools.commandLine();
            this.useragent = await useragent();
            this.windowTypes = new Map();
            this.customJsHooked = new Set();
            this.customCssHooked = new Set();

            // Deep links are parsed once at startup; later windows must not reuse them.
            let deepLink = process.argv.find(arg => typeof arg === "string" && arg.startsWith(DEEP_LINK_PREFIX));
            if (deepLink && /[?&](dosid|sid)=/.test(deepLink)) {
                this.arg.dosid = deepLink.slice(DEEP_LINK_PREFIX.length);
            }

            this.core.newWindowHandler = (event, webContents, url, loadOptions, guest) => this.handleNewWindow(event, webContents, url, loadOptions, guest);
            this.core.navigationPolicy = (webContents, url) => THIRD_PARTY_TYPES.includes(this.windowTypes.get(webContents.id)) && parseUrl(url)?.protocol === "https:";

            if (this.arg.api) {
                console.log("api");
                console.log("Arguments:");
                console.log(this.arg);
                let window = this.createWindow("api");
                this.apiServer = new ApiServer(this.core.app, window, Number(this.arg.api), { dev: this.arg.dev });
                setTimeout(update, UPDATE_DELAY);
                return this;
            }

            this.packets = new PacketService(this.core.app);

            this.tray = tools.tray(this);
            this.config = new Settings(this);
            this.credentials = new Credentials(this);
            this.api = new Api();

            if (this.arg.dev) {
                // DarkDev (and xml2js) is only loaded in developer mode.
                const DarkDev = require("./darkDev/darkDev");
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

            // createWindow consumes --login/--dosid, so decide about the master register window first.
            let autoStart = typeof this.arg.login !== "undefined" || typeof this.arg.dosid !== "undefined";

            this.createWindow("client");

            // Checked a few seconds after startup so loading the updater does not compete with the first page.
            setTimeout(update, UPDATE_DELAY);

            if (!settings.getSync().master && !autoStart && !settings.getSync().hideMasterRegister) {
                this.credentials.showWhenReady();
            }

            return this;
        })()
    }

    // `guest` is the webContents Chromium created for window.open(); using it keeps the opener's
    // reference alive and lets Chromium load the url itself (including form posts).
    createWindow(type, url, loadOptions, guest) {
        let window;
        // getSync reads and parses settings.json from disk, so read it once per window.
        let config = settings.getSync();
        let options = {
            'width': this.arg.size ? this.arg.size[0] : config[type].width,
            'height': this.arg.size ? this.arg.size[1] : config[type].height,
            'x': config[type].x,
            'y': config[type].y,
            'webPreferences': {
                'sandbox': true,
                'contextIsolation': true,
                'nodeIntegration': false,
                'enableRemoteModule': false,
                'plugins': true,
                'devTools': this.arg.dev,
                'offscreen': this.arg.offscreen
            }
        };

        if (!THIRD_PARTY_TYPES.includes(type) && type !== "api") {
            options.webPreferences.preload = PRELOAD;
        }

        if (guest) {
            options.webContents = guest;
        }

        if (this.arg.size) {
            delete this.arg.size;
        }

        window = new BrowserWindow(options);

        let webContentsId = window.webContents.id;
        this.windowTypes.set(webContentsId, type);

        if (this.packets) {
            window.webContents.on("did-finish-load", () => this.packets.onPageLoaded(window.webContents));
        }

        window.setMenuBarVisibility(false);

        if (this.arg.dev) {
            window.webContents.openDevTools();
        }

        window.webContents.setBackgroundThrottling(config.Settings.BackgroundThrottling);

        this.setCustomLoad();
        this.setCustomJs();
        this.setCustomCss();

        if (this.arg.login) {
            if (this.arg.login.length === 2) {
                let login = this.arg.login;
                window.webContents.once('did-finish-load', () => {
                    if (isLoginPage(window.webContents.getURL())) {
                        window.webContents.send("login", login);
                    }
                });
            }
            delete this.arg.login;
        }

        if (guest) {
            // Chromium is already navigating the window.open() target.
        } else if (this.arg.dosid) {
            this.loadDosid(window, this.arg.dosid, this.arg.url);

            delete this.arg.dosid;
            delete this.arg.url;
        } else if (this.arg.url) {
            this.loadTrustedUrl(window, this.arg.url);

            delete this.arg.url;
        } else if (url) {
            this.loadTrustedUrl(window, url, loadOptions);
        } else {
            this.loadPage(window, DEFAULT_URL);
        }

        tools.settingsWindow(window, type);

        window.webContents.on('before-input-event', (event, input) => {
            // Runs for every key press in the game, so leave as early as possible.
            if (!input.control || input.type !== "keyDown") {
                return;
            }

            let focus = BrowserWindow.getFocusedWindow();

            if (!focus) {
                return;
            }

            if (input.shift && input.code === "KeyI") {
                if (this.arg.dev && parseUrl(focus.webContents.getURL())?.search === "?action=internalMapRevolution") {
                    event.preventDefault();
                    focus.webContents.toggleDevTools();
                }
            } else if (input.code === "F5") {
                event.preventDefault();
                focus.reload();
            } else if (input.code === "Numpad0") {
                event.preventDefault();
                focus.webContents.zoomLevel = 0;
            } else if (input.key === "+") {
                event.preventDefault();
                focus.webContents.zoomLevel += 0.5;
            } else if (input.key === "-") {
                event.preventDefault();
                focus.webContents.zoomLevel -= 0.5;
            }
        })

        window.on("close", () => {
            if (this.arg.dev && window.webContents.debugger.isAttached()) {
                window.webContents.debugger.detach();
            }
        })

        window.on("closed", () => {
            this.windowTypes.delete(webContentsId);
            this.customJsHooked.delete(webContentsId);
            this.customCssHooked.delete(webContentsId);
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

    // Navigations replaced by redirects or a new load reject with ERR_ABORTED; that is expected.
    loadPage(window, url, loadOptions) {
        return window.loadURL(url, Object.assign({}, loadOptions, { userAgent: this.useragent })).catch(error => {
            if (error.code !== "ERR_ABORTED") {
                console.error(error);
            }
        });
    }

    loadTrustedUrl(window, url, loadOptions) {
        if (isTrustedUrl(url)) {
            this.loadPage(window, url, loadOptions);
        } else {
            dialog.showErrorBox("Load url", `Only https DarkOrbit urls can be loaded: ${url}`);
            this.loadPage(window, DEFAULT_URL);
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
            this.loadPage(window, DEFAULT_URL);
            return;
        }

        window.webContents.session.cookies.set(cookie)
            .catch(error => console.error(error))
            .then(() => this.loadPage(window, target));
    }

    handleNewWindow(event, webContents, url, loadOptions, guest) {
        let type = this.windowTypes.get(webContents.id);
        // Electron destroys Chromium's window when it is not used, so the opener then gets no reference.
        let keep = guest && OPENER_KEEPS_WINDOW.includes(type) ? guest : null;
        let window = this.routeNewWindow(webContents, url, loadOptions, keep);

        if (keep && window instanceof BrowserWindow && window.webContents === keep) {
            event.newGuest = window;
        }
    }

    routeNewWindow(webContents, url, loadOptions, guest) {
        let type = this.windowTypes.get(webContents.id);
        let window = BrowserWindow.fromWebContents(webContents);
        let parsed = parseUrl(url);

        if (!type || !window || parsed === null) {
            return openExternalSafe(url);
        }

        if (!isTrustedUrl(url)) {
            // Payment providers opened from the shop keep working in a window without preload.
            if (THIRD_PARTY_TYPES.includes(type) && parsed.protocol === "https:") {
                return this.createPopupWindow(url, loadOptions, guest);
            }
            return openExternalSafe(url);
        }

        if (parsed.search === "?action=internalMapRevolution") {
            return this.createWindow("game", url, loadOptions, guest);
        }

        if (!isDarkorbitUrl(url)) {
            return this.createWindow("config", url, loadOptions, guest);
        }

        let action = parsed.search.split("&")[0];

        if (parsed.hostname.split(".")[0].includes("board") || parsed.search === "?action=portal.redirectToBoard") {
            return this.createWindow("board", url, loadOptions, guest);
        }

        if (action === "?action=internalPaymentProxy") {
            return this.createWindow("shop", url, loadOptions, guest);
        }

        if (type === "game" || THIRD_PARTY_TYPES.includes(type)) {
            return this.createWindow("client", url, loadOptions, guest);
        }

        if (action === "?action=externalLogout") {
            if (settings.getSync().Settings.PreventCloseSessionWindow) {
                return this.loadPage(window, DEFAULT_URL);
            }
            return window.close();
        }

        if (parsed.pathname.split("/")[1] === "p") {
            return this.createWindow("board", url, loadOptions, guest);
        }

        return this.loadPage(window, url, loadOptions);
    }

    createPopupWindow(url, loadOptions, guest) {
        let options = {
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
        };

        if (guest) {
            options.webContents = guest;
        }

        let popup = new BrowserWindow(options);

        let webContentsId = popup.webContents.id;
        this.windowTypes.set(webContentsId, "popup");
        popup.on("closed", () => this.windowTypes.delete(webContentsId));

        popup.setMenuBarVisibility(false);
        if (!guest) {
            this.loadPage(popup, url, loadOptions);
        }

        return popup;
    }

    // DarkDev tools only apply to the game client windows, never to local pages or the shop/payment windows.
    customWindows() {
        return BrowserWindow.getAllWindows().filter(win => {
            let type = this.windowTypes.get(win.webContents.id);
            return type && type !== "api" && !THIRD_PARTY_TYPES.includes(type);
        });
    }

    setCustomLoad() {
        if (!this.arg.dev || this.arg.api) {
            return;
        }

        let backup = settings.getSync();
        let customLoad = backup.DarkDev.CustomLoad;

        for (let win of this.customWindows()) {
            let statusDevTools = win.webContents.isDevToolsOpened();
            if (!statusDevTools) {
                win.webContents.openDevTools();
            }

            if (!win.webContents.debugger.isAttached()) {
                win.webContents.debugger.attach("1.1");
            }

            if (!customLoad.enable) {
                win.webContents.debugger.sendCommand("Fetch.disable").catch(error => console.error(error));
                win.webContents.debugger.removeAllListeners("message");
                if (!statusDevTools) {
                    win.webContents.closeDevTools();
                }
                continue;
            }

            let patterns = [];

            for (let id in customLoad.list) {
                if (customLoad.list[id].enable) {
                    patterns.push({ urlPattern: customLoad.list[id].match });
                }
            }

            win.webContents.debugger.sendCommand("Fetch.enable", { patterns }).catch(error => console.error(error));

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
                        }).catch(error => console.error(error));

                        return;
                    }
                }
                dialog.showErrorBox("Injecting custom load", `Error when injecting custom load in the url: ${params.request.url}`);
                win.webContents.debugger.sendCommand("Fetch.continueRequest", { requestId: params.requestId }).catch(error => console.error(error));
            })
        }
    }

    setCustomJs() {
        if (!this.arg.dev || this.arg.api) {
            return;
        }

        for (let win of this.customWindows()) {
            // The listener reads the current settings, so one per window is enough.
            if (this.customJsHooked.has(win.webContents.id)) {
                continue;
            }
            this.customJsHooked.add(win.webContents.id);

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

        for (let win of this.customWindows()) {
            // The listener reads the current settings, so one per window is enough.
            if (this.customCssHooked.has(win.webContents.id)) {
                continue;
            }
            this.customCssHooked.add(win.webContents.id);

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