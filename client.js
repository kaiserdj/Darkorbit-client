const { BrowserWindow } = require('electron');
const settings = require("electron-settings");
const fs = require("fs");
const path = require("path");

const tools = require("./tools");
const update = require("./update");
const useragent = require("./useragent");
const Credentials = require("./credentials/credentials");
const DarkDev = require("./darkDev/darkDev");
const Api = require("./api");
const defaultSettings = require("./defaultSettings.json");

class Client {
    constructor(core) {
        settings.configure({
            atomicSave: true,
            fileName: 'settings.json',
            prettify: true
        });

        if (!settings.getSync().check) {
            settings.setSync(defaultSettings);
        } else {
            tools.checkSettings();
        }

        return (async () => {
            this.core = core;
            this.arg = tools.commandLine();
            this.useragent = await useragent();
            this.menuTray;
            this.tray = tools.tray(this);
            this.credentials = new Credentials(this);
            this.darkDev = new DarkDev(this);

            if (await update()) {
                return this;
            }

            if (this.arg.dev) {
                this.api = new Api();
                console.log("Settings:");
                console.log(settings.getSync());
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

            return this;
        })()
    }

    createWindow(type, url) {
        let window;
        let options = {
            'width': settings.getSync()[type].width,
            'height': settings.getSync()[type].height,
            'x': settings.getSync()[type].x,
            'y': settings.getSync()[type].y,
            'webPreferences': {
                'preload': `${__dirname}/inject/main.js`,
                'contextIsolation': true,
                'nodeIntegration': true,
                'enableRemoteModule': true,
                'plugins': true,
                'devTools': this.arg.dev
            }
        };

        window = new BrowserWindow(options);

        window.setMenuBarVisibility(false);

        if (this.arg.dev) {
            window.webContents.openDevTools();
        }

        this.setCustomLoad();
        this.setCustomJs();
        this.setCustomCss();

        if (this.arg.login) {
            if (this.arg.login.length === 2) {
                window.webContents.once('did-finish-load', () => {
                    window.webContents.send("login", this.arg.login)
                    delete this.arg.login;
                });
            }
        }

        if (this.arg.dosid) {
            let sid = this.arg.dosid.match(/[?&](dosid|sid)=([^&]+)/);
            let baseUrl = new URL(this.arg.dosid).origin;

            if (sid !== null && baseUrl !== null) {
                const cookie = { url: baseUrl, name: 'dosid', value: sid[2] };
                window.webContents.session.cookies.set(cookie);
                window.loadURL(`${baseUrl}/indexInternal.es?action=internalStart`, { userAgent: this.useragent });
            }

            delete this.arg.dosid;
        } else if (url) {
            window.loadURL(url, { userAgent: this.useragent });
        } else {
            window.loadURL(`https://www.darkorbit.com/`, { userAgent: this.useragent });
        }

        tools.settingsWindow(window, type);

        window.webContents.on('before-input-event', (event, input) => {
            let focus = () => BrowserWindow.getFocusedWindow();

            if (!focus()) {
                return;
            }

            if (this.arg.dev && input.control && input.shift && input.code === "KeyI" && new URL(focus().webContents.getURL()).search === "?action=internalMapRevolution") {
                event.preventDefault()
                focus().webContents.toggleDevTools()
            }
            if (input.control && input.code === "F5") {
                event.preventDefault()
                focus().reload()
            }
            if (input.control && input.code === "Numpad0") {
                event.preventDefault()
                focus().webContents.zoomLevel = 0;
            }
            if (input.control && input.key === "+") {
                event.preventDefault()
                focus().webContents.zoomLevel += 0.5;
            }
            if (input.control && input.key === "-") {
                event.preventDefault()
                focus().webContents.zoomLevel -= 0.5;
            }
        })

        window.on("close", () => {
            if (this.arg.dev) {
                let winFocused = BrowserWindow.getFocusedWindow();
                winFocused.webContents.debugger.detach();
            }

            if (settings.getSync().autoClose) {
                if (BrowserWindow.getAllWindows().length <= 3 && this.arg.dev === true) {
                    BrowserWindow.getAllWindows().forEach((win) => {
                        win.destroy();
                    })
                    this.core.app.quit();
                }
                if (BrowserWindow.getAllWindows().length <= 2 && this.arg.dev === false) {
                    BrowserWindow.getAllWindows().forEach((win) => {
                        win.destroy();
                    })
                    this.core.app.quit();
                }
            }
        })

        let client = this;
        window.webContents.on('new-window', async function(e, url) {
            if (type === "game" || type === "shop") {
                return;
            }
            e.preventDefault();
            if (new URL(url).search === "?action=internalMapRevolution") {
                client.createWindow("game", url)
            } else if (new URL(url).host.split(".")[1] === "darkorbit") {
                if (new URL(url).host.split(".")[0].search("board") !== -1 || new URL(url).search === "?action=portal.redirectToBoard") {
                    client.createWindow("board", url)
                } else if (new URL(url).search.split("&")[0] === "?action=internalPaymentProxy") {
                    client.createWindow("shop", url);
                } else {
                    if (new URL(url).search.split("&")[0] === "?action=externalLogout") {
                        return window.close();
                    } else if (new URL(url).host.split(".")[1] === "darkorbit") {
                        return window.loadURL(url, { userAgent: client.useragent });
                    }
                    client.createWindow("client", url);
                }
            } else if (new URL(url).host.split(".")[1] === "bpsecure") {
                client.createWindow("config", url);
            } else {
                require('open')(url);
                return;
            }
        });

        return window;
    }

    setCustomLoad() {
        if (!this.arg.dev) {
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
                win.webContents.openDevTools()
            }

            if (!win.webContents.debugger.isAttached()) {
                win.webContents.debugger.attach("1.1");
            }

            if (!customLoad.enable) {
                win.webContents.debugger.sendCommand("Fetch.enable", { patterns: [] });
                win.webContents.debugger.removeAllListeners("message");
                if (!statusDevTools) {
                    win.webContents.closeDevTools()
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

                    let pattern = customLoad.list[id].match.replaceAll("/", "\\/");
                    pattern = pattern.replaceAll(".", "\\.");
                    pattern = pattern.replaceAll("*", ".*");
                    pattern = pattern.replace(/[+?^${}()|]/g, '\\$&');

                    let check = new RegExp(pattern).test(params.request.url);
                    if (check) {
                        let body;

                        if (customLoad.list[id].LocalFileEnable) {
                            body = fs.readFileSync(path.normalize(customLoad.list[id].LocalFile), { encoding: "base64" });
                        } else {
                            body = await tools.getBase64(customLoad.list[id].actionUrl);
                        }

                        win.webContents.debugger.sendCommand("Fetch.fulfillRequest", {
                            responseCode: 200,
                            requestId: params.requestId,
                            body
                        });

                        return;
                    }
                }

                alert(`Error when injecting custom load in the url: ${params.request.url}`);
                win.webContents.debugger.sendCommand("Fetch.continueRequest", { requestId: params.requestId });
            })
        }
    }

    setCustomJs() {
        if (!this.arg.dev) {
            return;
        }

        let windows = BrowserWindow.getAllWindows();

        for (let win of windows) {
            if (win.webContents.getURL().split(":")[0] === "file") {
                return;
            }

            win.webContents.on("dom-ready", () => {
                if (settings.getSync().DarkDev.CustomJs.enable) {
                    win.webContents.send("customJs", settings.getSync().DarkDev.CustomJs)
                }
            })
        }
    }

    setCustomCss() {
        if (!this.arg.dev) {
            return;
        }

        let windows = BrowserWindow.getAllWindows();

        for (let win of windows) {
            if (win.webContents.getURL().split(":")[0] === "file") {
                return;
            }

            win.webContents.on("dom-ready", () => {
                if (settings.getSync().DarkDev.CustomCss.enable) {
                    win.webContents.send("customCss", settings.getSync().DarkDev.CustomCss)
                }
            })
        }
    }
}

module.exports = Client;