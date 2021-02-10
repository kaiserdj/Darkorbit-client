const crypt = require("./crypt");

class credentials {
    constructor(BrowserWindow, mainWindow, settings, ipcMain) {
        this.BrowserWindow = BrowserWindow;
        this.mainWindow = mainWindow;
        this.settings = settings;
        this.ipcMain = ipcMain;
        this.window;
        this.check = false;
        this.hashMaster;
        this.master;

        if (!settings.getSync().master) {
            this.createWindow("register");
        };

        ipcMain.on('registerMaster', (event, pass) => {
            this.registerMaster(pass);
        });

        ipcMain.on('autoLogin', (event, arg) => {
            if (this.check) {
                this.createWindow("list");
            } else {
                this.createWindow("login");
            }
        });

        ipcMain.on('checkMaster', (event, pass) => {
            this.checkMaster(pass);
            if (!this.check) {
                this.window.webContents.send("checkMasterRet", this.check);
            }
        });

        ipcMain.on('loadList', (event, arg) => {
            let backup = this.settings.getSync();

            if ("accounts" in backup) {
                backup.accounts = crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts });
            } else {
                backup.accounts = [];
            }

            this.window.webContents.send("sendList", backup.accounts);
        });

        ipcMain.on('userRegister', (event, arg) => {
            this.createWindow("userRegister");
        });

        ipcMain.on('registerUser', (event, data) => {
            this.registerAccount(data);

            this.createWindow("list");
        });

        ipcMain.on('editUser', (event, data) => {
            let backup = this.settings.getSync();

            backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));

            let account = backup.accounts.find(o => o.id == data);

            this.createWindow("editUser");

            ipcMain.on('getEditUser', (event, e) => {
                this.window.webContents.send("sendEditUser", [account.id, account.username]);
            });
        });

        ipcMain.on('changeUser', (event, data) => {
            this.editAccount(data);
            this.createWindow("list");
        });

        ipcMain.on('deleteUser', (event, data) => {
            this.deleteAccount(data);
            this.createWindow("list");
        });

        ipcMain.on('loginUser', (event, data) => {
            this.window.close();

            let backup = this.settings.getSync();

            backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));

            let account = backup.accounts.find(o => o.id == data);

            this.mainWindow.webContents.send("login", [account.username, account.password]);
        });
    }

    createWindow(type) {
        if (!this.window) {
            this.window = new this.BrowserWindow({
                'width': 380,
                'height': 370,
                'webPreferences': {
                    'preload': `${__dirname}/html/master.js`,
                    'contextIsolation': true,
                    'nodeIntegration': true,
                    'devTools': true
                },
            });
            this.window.on('close', () => {
                this.window = null;
            });
        }
        this.window.setMenuBarVisibility(false);
        this.window.setAlwaysOnTop(true);

        switch (type) {
            case "login":
                this.window.loadFile("./credentials/html/masterLogin.html");

                break;
            case "register":
                this.window.setSize(380, 400);
                this.window.loadFile("./credentials/html/masterRegister.html");

                break;
            case "list":
                this.window.setSize(500, 500);
                this.window.loadFile("./credentials/html/list.html");

                break;
            case "userRegister":
                this.window.setSize(380, 400);
                this.window.loadFile("./credentials/html/userRegister.html");

                break;
            case "editUser":
                this.window.setSize(380, 480);
                this.window.loadFile("./credentials/html/userEdit.html");

                break;
        }
    }

    registerMaster(input) {
        let backup = this.settings.getSync();

        this.hashMaster = crypt.hash(input);

        this.master = crypt.encrypt(this.hashMaster);

        this.check = true;

        backup.master = this.master;

        this.settings.setSync(backup);

        this.createWindow("list");
    }

    checkMaster(input) {
        if (this.check === true) {
            return this.check;
        };

        let backup = this.settings.getSync();

        let hashMaster = crypt.hash(input);

        if (crypt.decrypt(backup.master) === hashMaster) {
            this.check = true;
            this.hashMaster = hashMaster;
            this.createWindow("list");
        }

        return this.check;
    }

    registerAccount(input) {
        let backup = this.settings.getSync();

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

        this.settings.setSync(backup);

        this.createWindow("list");
    }

    editAccount(input) {
        let backup = this.settings.getSync();

        backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));

        let accountIndex = backup.accounts.findIndex(x => x.id == input[0]);

        backup.accounts[accountIndex] = {
            id: input[0],
            username: input[1],
            password: input[2]
        };

        backup.accounts = crypt.encrypt(JSON.stringify(backup.accounts), this.hashMaster).content;

        this.settings.setSync(backup);
    }

    deleteAccount(id) {
        let backup = this.settings.getSync();

        backup.accounts = JSON.parse(crypt.decrypt({ "iv": this.hashMaster, "content": backup.accounts }));

        let newAccounts = [];

        for(let elem of backup.accounts) {
            if(elem.id !== id) {
                newAccounts.push(elem);
            }
        }

        backup.accounts = newAccounts;

        backup.accounts = crypt.encrypt(JSON.stringify(backup.accounts), this.hashMaster).content;

        this.settings.setSync(backup);
    }
}

module.exports = credentials;