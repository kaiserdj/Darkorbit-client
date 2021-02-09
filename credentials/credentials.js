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
        }

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
        })
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
}

module.exports = credentials;