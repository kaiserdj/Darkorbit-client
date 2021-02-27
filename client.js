const { BrowserWindow, globalShortcut } = require('electron');
const settings = require("electron-settings");

const tools = require("./tools");
const update = require("./update");
const useragent = require("./useragent");
const Credentials = require("./credentials/credentials");
const defaultSettings = require("./defaultSettings.json");

class Client {
    constructor(electron) {
        settings.configure({
            atomicSave: true,
            fileName: 'settings.json',
            prettify: true
        });

        if (!settings.getSync().check) {
            settings.setSync(defaultSettings);
        }

        return (async () => {
            this.electron = electron;
            this.arg = tools.commandLine();
            this.useragent = await useragent();
            this.credentials = new Credentials(this);

            await update();

            if (this.arg.dev) {
                console.log(settings.getSync())
            }

            tools.contextMenu(this.arg.dev);

            this.createWindow("client");

            if (!settings.getSync().master) {
                this.credentials.mb.showWindow();
            }

            let focus = () => BrowserWindow.getFocusedWindow();
            globalShortcut.register('CmdOrCtrl+F5', () => {
                if (focus()) {
                    focus().reload()
                }
            });
            globalShortcut.register('CmdOrCtrl+num0', () => {
                if (focus()) {
                    focus().webContents.zoomLevel = 0;
                }
            })
            globalShortcut.register('CmdOrCtrl+numadd', () => {
                if (focus()) {
                    focus().webContents.zoomLevel += 0.5;
                }
            })
            globalShortcut.register('CmdOrCtrl+numsub', () => {
                if (focus()) {
                    focus().webContents.zoomLevel -= 0.5;
                }
            })

            return this
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
                'contextIsolation': true,
                'nodeIntegration': true,
                'enableRemoteModule': true,
                'plugins': true,
                'devTools': this.arg.dev
            }
        };

        switch (type) {
            case "client":
                options.webPreferences.preload = `${__dirname}/inject/main.js`;
                break;
        }

        window = new BrowserWindow(options);

        window.setMenuBarVisibility(false);

        if (this.arg.dev) {
            window.webContents.openDevTools();
        }

        if (this.arg.login) {
            if (this.arg.login.length === 2) {
                window.webContents.on('did-finish-load', () => {
                    window.webContents.send("login", this.arg.login)
                });

                delete this.arg.login;
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

        window.on("close", () => {
            if (settings.getSync().autoClose && BrowserWindow.getAllWindows().length <= 2) {
                global.app.quit();
            }
        })

        let client = this;
        window.webContents.on('new-window', async function(e, url) {
            e.preventDefault();
            if (new URL(url).search === "?action=internalMapRevolution") {
                client.createWindow("game", url)
            } else if (new URL(url).host.split(".")[1] === "darkorbit") {
                if (new URL(url).host.split(".")[0].search("board") !== -1 || new URL(url).search === "?action=portal.redirectToBoard") {
                    client.createWindow("board", url)
                } else {
                    if (new URL(url).search.split("&")[0] === "?action=externalLogout") {
                        return window.close();
                    } else if (new URL(url).host.split(".")[1] === "darkorbit") {
                        return window.loadURL(url, { userAgent: client.useragent });
                    }
                    client.createWindow("client", url);
                }
            } else if (new URL(url).host.split(".")[1] === "bpsecure") {
                createWindow("config", url);
            } else {
                require('open')(url);
                return;
            }
        });

        return window;
    }
}

module.exports = Client;