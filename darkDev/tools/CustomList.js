const { ipcMain } = require("electron");
const settings = require("electron-settings");
const { hasItem, sanitizeItem } = require("./validate");

// Shared store for the DarkDev CustomLoad, CustomJs and CustomCss lists.
class CustomList {
    constructor(darkDev, name, allowLocalFile, onChange) {
        this.name = name;
        this.allowLocalFile = allowLocalFile;
        this.onChange = onChange;

        let config = settings.getSync().DarkDev[name];
        this.enable = config.enable;
        this.list = config.list;

        const on = (channel, handler) => {
            ipcMain.on(channel, (event, data) => {
                if (darkDev.isDarkDevWindow(event)) {
                    handler(data);
                }
            });
        };

        on(`SetEnable${name}`, (opt) => {
            this.enable = Boolean(opt);
            this.save();
        });

        on(`New${name}`, (data) => {
            let item = sanitizeItem(data, this.allowLocalFile);
            if (!item) {
                return;
            }
            this.list[item.id] = item;
            this.save();
        });

        on(`enable${name}Item`, (data) => {
            if (!data || !hasItem(this.list, data.id)) {
                return;
            }
            this.list[data.id].enable = Boolean(data.enable);
            this.save();
        });

        on(`remove${name}Item`, (id) => {
            if (!hasItem(this.list, id)) {
                return;
            }
            delete this.list[id];
            this.save();
        });
    }

    save() {
        let backup = settings.getSync();

        backup.DarkDev[this.name] = {
            enable: this.enable,
            list: this.list
        };

        settings.setSync(backup);

        this.onChange();
    }
}

module.exports = CustomList;
