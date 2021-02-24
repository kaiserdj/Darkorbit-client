const { app } = require('electron');
const path = require("path");

class Electron {
    constructor() {
        return (async () => {
            this.app = app;
            global.app = app;
            this.appReady = false;
            this.ppapi_flash_path;

            this.ppapi();

            await this.app.whenReady();
            this.appReady = true;

            this.app.on('window-all-closed', () => {
                if (process.platform !== 'darwin') {
                    app.quit();
                }
            });

            return this
        })()
    }

    ppapi() {
        if (process.platform == 'win32') {
            this.ppapi_flash_path = path.join(app.getAppPath(), '../flash/pepflashplayer.dll');
        } else if (process.platform == 'linux') {
            this.ppapi_flash_path = path.join(process.resourcesPath, './flash/libpepflashplayer.so');
            this.app.commandLine.appendSwitch("--no-sandbox");
        } else if (process.platform == 'darwin') {
            this.ppapi_flash_path = path.join(app.getAppPath(), '../flash/PepperFlashPlayer.plugin');
        }

        this.app.commandLine.appendSwitch('ppapi-flash-path', this.ppapi_flash_path);
    }
}

module.exports = Electron;