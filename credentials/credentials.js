const { dialog, ipcMain, BrowserWindow, MenuItem } = require('electron');
const { menubar } = require('menubar');
const settings = require("electron-settings");
const Alert = require("electron-alert");

const crypt = require("./crypt");

class Credentials {
    constructor(client) {
        this.client = client;
        this.mb = menubar(this.config());
        this.window;
        this.check = false;
        this.hashMaster;
        this.master;

        this.mb.on("ready", ()=> {
            if(settings.getSync().master) {
                this.checkMaster("");
                this.mb.hideWindow();
            }
        });

        ipcMain.on('registerMaster', (event, pass) => {
            this.registerMaster(pass);
        });

        ipcMain.on('autoLogin', (event, id) => {
            this.window = BrowserWindow.fromId(id);

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
                            backup.salt = true;
                            delete backup.master;
                            delete backup.accounts;
                            settings.setSync(backup);

                            this.load("register");
                        });

                    return;
                }

                this.load("login");
            }
        });

        ipcMain.on('checkMaster', (event, pass) => {
            this.checkMaster(pass);
            if (!this.check) {
                this.mb.window.webContents.send("checkMasterRet", this.check);
            }
        });

        ipcMain.on('hideMasterRegister', (event, data) => {
            let backup = settings.getSync();

            backup.hideMasterRegister = data;

            settings.setSync(backup);

            this.mb.window.hide();
        });

        ipcMain.on('resetMaster', () => {
            this.resetMaster();
        });

        ipcMain.on('loadList', () => {
            let backup = settings.getSync();

            if ("accounts" in backup) {
                backup.accounts = crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts });
            } else {
                backup.accounts = [];
            }

            this.mb.window.webContents.send("sendList", backup.accounts);
        });

        ipcMain.on('userRegister', () => {
            this.load("userRegister");
        });

        ipcMain.on('registerUser', (event, data) => {
            this.registerAccount(data);

            this.load("list");
        });

        ipcMain.on('editUser', (event, id) => {
            let backup = settings.getSync();

            backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));

            let account = backup.accounts.find(o => o.id == id);

            this.load("editUser");

            ipcMain.on('getEditUser', () => {
                this.mb.window.webContents.send("sendEditUser", [account.id, account.username]);
            });
        });

        ipcMain.on('changeUser', (event, data) => {
            this.editAccount(data);
            this.load("list");
        });

        ipcMain.on('deleteUser', (event, data) => {
            this.deleteAccount(data);
            this.load("list");
        });

        ipcMain.on('loginUser', (event, data) => {
            this.mb.hideWindow();

            let backup = settings.getSync();

            backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));

            let account = backup.accounts.find(o => o.id == data);

            if (this.window) {
                try {
                    if (new URL(this.window.webContents.getURL()).origin === "https://www.darkorbit.com") {
                        return this.window.webContents.send("login", [account.username, account.password]);
                    }
                } catch (e) {

                }
            }

            let window = this.client.createWindow("client");
            window.webContents.on('did-finish-load', () => {
                window.webContents.send("login", [account.username, account.password])
            });
        });

        ipcMain.on('close', () => {
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
                    'plugins': true,
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

    load(type) {
        switch (type) {
            case "login":
                this.mb.window.loadURL("./credentials/html/masterLogin.html");

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

        this.mb.setOption("browserWindow", {
            "x": this.mb.window.getBounds().x,
            "y": this.mb.window.getBounds().y
        });

        this.mb.showWindow();
    }

    registerMaster(input) {
        let backup = settings.getSync();

        backup.salt = crypt.salt();

        this.hashMaster = crypt.hash(input, backup.salt);

        this.master = crypt.encrypt(this.hashMaster);

        this.check = true;

        backup.master = this.master;

        settings.setSync(backup);

        this.load("list");
    }

    checkMaster(input) {
        if (this.check === true) {
            return this.check;
        }

        let backup = settings.getSync();

        let hashMaster = crypt.hash(input, backup.salt);

        if (crypt.decrypt(backup.master) === hashMaster) {
            this.check = true;
            this.hashMaster = hashMaster;
            this.load("list");
        }

        return this.check;
    }

    resetMaster() {
        let backup = settings.getSync();

        delete backup.master;
        delete backup.salt;
        delete backup.accounts;

        settings.setSync(backup);

        this.load("register");
    }

    registerAccount(input) {
        let backup = settings.getSync();

        if ("accounts" in backup) {
            backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));
        } else {
            backup.accounts = [];
        }

        let id = new Date().valueOf();

        let account = {
            id,
            username: input[0],
            password: input[1]
        }

        backup.accounts.push(account);

        backup.accounts = crypt.encrypt(JSON.stringify(backup.accounts), this.hashMaster).content;

        settings.setSync(backup);

        this.load("list");
    }

    editAccount(input) {
        let backup = settings.getSync();

        backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));

        let accountIndex = backup.accounts.findIndex(x => x.id == input[0]);

        backup.accounts[accountIndex] = {
            id: input[0],
            username: input[1],
            password: input[2]
        };

        backup.accounts = crypt.encrypt(JSON.stringify(backup.accounts), this.hashMaster).content;

        settings.setSync(backup);
    }

    deleteAccount(id) {
        let backup = settings.getSync();

        backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));

        let newAccounts = [];

        for (let elem of backup.accounts) {
            if (elem.id !== id) {
                newAccounts.push(elem);
            }
        }

        backup.accounts = newAccounts;

        backup.accounts = crypt.encrypt(JSON.stringify(backup.accounts), this.hashMaster).content;

        settings.setSync(backup);
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
                let sid = dosid.value.match(/[?&](dosid|sid)=([^&]+)/);
                let baseUrl = new URL(dosid.value).origin;

                if (sid !== null && baseUrl !== null) {
                    const cookie = { url: baseUrl, name: 'dosid', value: sid[2] };
                    let window = this.client.createWindow("client");
                    window.webContents.session.cookies.set(cookie);
                    window.loadURL(`${baseUrl}/indexInternal.es?action=internalStart`, { userAgent: this.useragent });
                }
            }
        });
    }
}

module.exports = Credentials;