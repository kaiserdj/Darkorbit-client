const { dialog, ipcMain, BrowserWindow, MenuItem, session } = require('electron');
const { menubar } = require('menubar');
const settings = require("electron-settings");
const Alert = require("electron-alert");
const Positioner = require('electron-positioner');

const crypt = require("./crypt");
const { parseUrl, isDarkorbitUrl } = require("../security");

class Credentials {
    constructor(client) {
        this.client = client;
        this.mb = menubar(this.config());
        this.window;
        this.check = false;
        this.key = null;
        this.editingId = null;
        this.ready = false;

        this.mb.on("ready", ()=> {
            this.ready = true;
            if(settings.getSync().master) {
                this.checkMaster("");
                this.mb.hideWindow();
            }
        });

        // Messages from the credentials window itself.
        const onCredentials = (channel, handler) => {
            ipcMain.on(channel, (event, ...args) => {
                if (this.mb.window && event.sender === this.mb.window.webContents) {
                    handler(event, ...args);
                }
            });
        };

        // Messages that need an unlocked master password.
        const onUnlocked = (channel, handler) => {
            onCredentials(channel, (event, ...args) => {
                if (this.check) {
                    handler(event, ...args);
                }
            });
        };

        onCredentials('registerMaster', (event, pass) => {
            if (!settings.getSync().master) {
                this.registerMaster(pass);
            }
        });

        // Sent by the AUTOLOGIN button injected into the DarkOrbit login page.
        ipcMain.on('autoLogin', (event) => {
            if (!isDarkorbitUrl(event.sender.getURL())) {
                return;
            }

            this.window = BrowserWindow.fromWebContents(event.sender);

            if (this.check) {
                this.load("list");
            } else {
                let backup = settings.getSync();

                if (typeof backup.salt === "undefined" && typeof backup.master !== "undefined") {
                    const message = {
                        type: "warning",
                        title: "Security update",
                        message: "An update has been made to make saving passwords more secure.\nAll credentials will be erased and you will have to save them again. \n \nSorry for the inconvenience.",
                        buttons: ["OK"]
                    }

                    dialog.showMessageBox(message)
                        .then(() => {
                            delete backup.master;
                            delete backup.accounts;
                            settings.setSync(backup);

                            this.load("register");
                        });

                    return;
                }

                this.load(backup.master ? "login" : "register");
            }
        });

        onCredentials('checkMaster', (event, pass) => {
            this.checkMaster(pass);
            if (!this.check) {
                this.mb.window.webContents.send("checkMasterRet", this.check);
            }
        });

        onCredentials('hideMasterRegister', (event, data) => {
            let backup = settings.getSync();

            backup.hideMasterRegister = Boolean(data);

            settings.setSync(backup);

            this.mb.window.hide();
        });

        onCredentials('resetMaster', () => {
            this.resetMaster();
        });

        onUnlocked('loadList', () => {
            this.mb.window.webContents.send("sendList", JSON.stringify(this.readAccounts()));
        });

        onUnlocked('userRegister', () => {
            this.load("userRegister");
        });

        onUnlocked('registerUser', (event, data) => {
            this.registerAccount(data);
        });

        onUnlocked('editUser', (event, id) => {
            this.editingId = id;
            this.load("editUser");
        });

        onUnlocked('getEditUser', () => {
            let account = this.readAccounts().find(o => o.id == this.editingId);

            if (account) {
                this.mb.window.webContents.send("sendEditUser", [account.id, account.username]);
            }
        });

        onUnlocked('changeUser', (event, data) => {
            this.editAccount(data);
            this.load("list");
        });

        onUnlocked('deleteUser', (event, data) => {
            this.deleteAccount(data);
            this.load("list");
        });

        onUnlocked('loginUser', (event, data) => {
            this.mb.hideWindow();

            let account = this.readAccounts().find(o => o.id == data);

            if (!account) {
                return;
            }

            let credentials = [account.username, account.password];

            // The window that asked for autologin still shows a DarkOrbit login form.
            if (this.window && !this.window.isDestroyed() && isDarkorbitUrl(this.window.webContents.getURL())) {
                return this.window.webContents.send("login", credentials);
            }

            let window = this.client.createWindow("client");
            window.webContents.once('did-finish-load', () => {
                // Credentials are only ever handed to a DarkOrbit page.
                if (isDarkorbitUrl(window.webContents.getURL())) {
                    window.webContents.send("login", credentials);
                }
            });
        });

        onCredentials('close', () => {
            this.load("list")
        });
    }

    config() {
        this.client.menuTray.insert(3, new MenuItem({
            label: "Login with Dosid",
            type: "normal",
            click: () => this.loginDosid()
        }));

        this.client.menuTray.insert(3, new MenuItem({
            label: "Autologin",
            type: "normal",
            click: () => this.mb.showWindow()
        }));

        this.client.menuTray.insert(3, new MenuItem({type: "separator"}));

        this.client.rebuildTrayMenu();

        let config = {
            tooltip: "Darkorbit Client",
            tray: this.client.tray,
            transparent: true,
            preloadWindow: true,
            showOnAllWorkspaces: false,
            browserWindow: {
                'width': 380,
                'height': !settings.getSync().master ? 400 : 370,
                'webPreferences': {
                    'preload': `${__dirname}/html/master.js`,
                    'contextIsolation': true,
                    'nodeIntegration': true,
                    'devTools': this.client.arg.dev
                }
            }
        };

        if (!settings.getSync().master) {
            config.index = `file://${__dirname}/html/masterRegister.html`;
        } else {
            config.index = `file://${__dirname}/html/masterLogin.html`;
        }

        return config;
    }

    showWhenReady() {
        if (this.ready) {
            this.mb.showWindow();
        } else {
            this.mb.once("ready", () => this.mb.showWindow());
        }
    }

    load(type) {
        switch (type) {
            case "login":
                this.mb.window.setSize(380, 370);
                this.mb.window.loadFile("./credentials/html/masterLogin.html");

                break;
            case "register":
                this.mb.window.setSize(380, 400);
                this.mb.window.loadFile("./credentials/html/masterRegister.html");

                break;
            case "list":
                this.mb.window.setSize(500, 500);
                this.mb.window.loadFile("./credentials/html/list.html");

                break;
            case "userRegister":
                this.mb.window.setSize(380, 400);
                this.mb.window.loadFile("./credentials/html/userRegister.html");

                break;
            case "editUser":
                this.mb.window.setSize(380, 480);
                this.mb.window.loadFile("./credentials/html/userEdit.html");

                break;
        }
        
        // Workarround https://github.com/maxogden/menubar/issues/435
        var positioner = new Positioner(this.mb.window)
        
        this.mb.showWindow();

        if(this.mb.getOption("windowPosition") == "trayBottomCenter" && process.platform == "win32") {
            positioner.move('bottomRight');
        }
    }

    registerMaster(input) {
        let backup = settings.getSync();

        backup.salt = crypt.salt();
        this.key = crypt.deriveKey(input, backup.salt);
        this.check = true;

        backup.cryptVersion = crypt.VERSION;
        backup.master = crypt.createVerifier(this.key);
        delete backup.accounts;

        settings.setSync(backup);

        this.load("list");
    }

    checkMaster(input) {
        if (this.check === true) {
            return this.check;
        }

        let backup = settings.getSync();

        if (backup.cryptVersion === crypt.VERSION) {
            let key = crypt.deriveKey(input, backup.salt);

            if (crypt.checkVerifier(key, backup.master)) {
                this.key = key;
                this.check = true;
            }
        } else if (this.migrateLegacy(input, backup)) {
            this.check = true;
        }

        if (this.check) {
            this.load("list");
        }

        return this.check;
    }

    // Re-encrypts settings written with the old embedded key once the user proves the master password.
    migrateLegacy(input, backup) {
        let hashMaster;

        try {
            hashMaster = crypt.legacyHash(input, backup.salt);
            if (crypt.legacyDecrypt(backup.master) !== hashMaster) {
                return false;
            }
        } catch (e) {
            return false;
        }

        let accounts = [];
        if (typeof backup.accounts === "string") {
            try {
                accounts = JSON.parse(crypt.legacyDecrypt({ "iv": hashMaster, "content": backup.accounts }));
            } catch (e) {
                console.error("Saved accounts could not be migrated");
            }
        }

        backup.salt = crypt.salt();
        this.key = crypt.deriveKey(input, backup.salt);

        backup.cryptVersion = crypt.VERSION;
        backup.master = crypt.createVerifier(this.key);
        backup.accounts = crypt.encryptJson(this.key, accounts);

        settings.setSync(backup);

        return true;
    }

    resetMaster() {
        let backup = settings.getSync();

        delete backup.master;
        delete backup.salt;
        delete backup.accounts;
        delete backup.cryptVersion;

        settings.setSync(backup);

        this.check = false;
        this.key = null;

        this.load("register");
    }

    readAccounts() {
        let backup = settings.getSync();

        if (!backup.accounts) {
            return [];
        }

        return crypt.decryptJson(this.key, backup.accounts);
    }

    writeAccounts(accounts) {
        let backup = settings.getSync();

        backup.accounts = crypt.encryptJson(this.key, accounts);

        settings.setSync(backup);
    }

    registerAccount(input) {
        let accounts = this.readAccounts();

        accounts.push({
            id: new Date().valueOf(),
            username: String(input[0]),
            password: String(input[1])
        });

        this.writeAccounts(accounts);

        this.load("list");
    }

    editAccount(input) {
        let accounts = this.readAccounts();

        let accountIndex = accounts.findIndex(x => x.id == input[0]);

        if (accountIndex === -1) {
            return;
        }

        accounts[accountIndex] = {
            id: accounts[accountIndex].id,
            username: String(input[1]),
            password: String(input[2])
        };

        this.writeAccounts(accounts);
    }

    deleteAccount(id) {
        this.writeAccounts(this.readAccounts().filter(elem => elem.id != id));
    }

    loginDosid() {
        let alert = new Alert();

        let swalOptions = {
            imageUrl: 'https://i.imgur.com/tkyZuOn.png',
            imageHeight: 30,
            imageAlt: 'Sid Login',
            input: 'text',
            inputPlaceholder: 'https://es1.darkorbit.com/?dosid=c21cf6377518dd6e93450c6085a548b1',
            inputAttributes: {
                maxlength: 100,
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            showCancelButton: true,
            cancelButtonColor: '#d33',
        };

        alert.fireFrameless(swalOptions, null, true, true).then((dosid) => {
            if (dosid.value) {
                let sid = dosid.value.match(/[?&](dosid|sid)=([^&#]+)/);

                if (sid === null || !isDarkorbitUrl(dosid.value)) {
                    dialog.showErrorBox("Login with Dosid", "Only https DarkOrbit urls with a dosid parameter can be used.");
                    return;
                }

                let baseUrl = parseUrl(dosid.value).origin;
                const cookie = { url: baseUrl, name: 'dosid', value: sid[2] };
                // Client windows share the default session, so the cookie is set before the window loads.
                session.defaultSession.cookies.set(cookie)
                    .catch(error => console.error(error))
                    .then(() => this.client.createWindow("client", `${baseUrl}/indexInternal.es?action=internalStart`));
            }
        });
    }
}

module.exports = Credentials;
