// Test doubles for the Electron main process APIs and a loader that swaps modules by name.
// Unit tests run under plain Node, so `electron`, `electron-settings` and friends are replaced.

const Module = require("module");
const path = require("path");
const EventEmitter = require("events");

const ROOT = path.resolve(__dirname, "..", "..");
const originalLoad = Module._load;

let activeMocks = null;

// Replaces `require(name)` for every name in `mocks` until `uninstallMocks()` is called.
function installMocks(mocks) {
    activeMocks = mocks;
    Module._load = function (request, parent, isMain) {
        if (activeMocks && Object.prototype.hasOwnProperty.call(activeMocks, request)) {
            return activeMocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };
}

function uninstallMocks() {
    activeMocks = null;
    Module._load = originalLoad;
}

// Loads a project module (path relative to the repository root) without cached project modules,
// so each test gets module state built from the currently installed mocks.
function loadFresh(relativePath) {
    for (let key of Object.keys(require.cache)) {
        if (key.startsWith(ROOT) && !key.includes(`${path.sep}node_modules${path.sep}`) && !key.includes(`${path.sep}test${path.sep}`)) {
            delete require.cache[key];
        }
    }
    return require(path.join(ROOT, relativePath));
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// In-memory electron-settings: getSync returns a copy, like reading the file again.
function createSettings(initial = {}) {
    let data = clone(initial);
    return {
        configure() {},
        file: () => path.join(ROOT, "settings.json"),
        getSync: () => clone(data),
        setSync: (value) => {
            data = clone(value);
        },
        get data() {
            return clone(data);
        }
    };
}

class FakeWebContents extends EventEmitter {
    constructor(url = "") {
        super();
        this.id = FakeWebContents.nextId++;
        this.url = url;
        this.sent = [];
    }

    getURL() {
        return this.url;
    }

    send(channel, ...args) {
        this.sent.push({ channel, args });
    }

    lastSent(channel) {
        let messages = this.sent.filter(message => message.channel === channel);
        return messages.length ? messages[messages.length - 1].args : undefined;
    }
}
FakeWebContents.nextId = 1;

class FakeBrowserWindow extends EventEmitter {
    constructor(options = {}, url = "") {
        super();
        this.options = options;
        this.webContents = new FakeWebContents(url);
        this.destroyed = false;
        this.loaded = [];
        FakeBrowserWindow.all.push(this);
    }

    static fromWebContents(webContents) {
        return FakeBrowserWindow.all.find(window => window.webContents === webContents) || null;
    }

    static getAllWindows() {
        return FakeBrowserWindow.all.filter(window => !window.destroyed);
    }

    isDestroyed() {
        return this.destroyed;
    }

    loadFile(file) {
        this.loaded.push(file);
    }

    loadURL(url) {
        this.loaded.push(url);
        this.webContents.url = url;
        return Promise.resolve();
    }

    setSize() {}
    setMenuBarVisibility() {}
    focus() {}
    hide() {}

    close() {
        this.destroyed = true;
        this.emit("closed");
    }
}
FakeBrowserWindow.all = [];

// ipcMain with helpers to deliver messages the way Electron does.
class FakeIpcMain extends EventEmitter {
    constructor() {
        super();
        this.handlers = new Map();
    }

    handle(channel, handler) {
        if (this.handlers.has(channel)) {
            throw new Error(`Attempted to register a second handler for '${channel}'`);
        }
        this.handlers.set(channel, handler);
    }

    async invoke(channel, event, ...args) {
        if (!this.handlers.has(channel)) {
            throw new Error(`No handler registered for '${channel}'`);
        }
        return this.handlers.get(channel)(event, ...args);
    }

    // Like ipcMain.on handlers receiving a message from `sender`.
    deliver(channel, sender, ...args) {
        this.emit(channel, { sender }, ...args);
    }
}

function createElectron() {
    FakeBrowserWindow.all = [];

    let electron = {
        ipcMain: new FakeIpcMain(),
        BrowserWindow: FakeBrowserWindow,
        MenuItem: class MenuItem {
            constructor(options) {
                Object.assign(this, options);
            }
        },
        dialog: {
            errors: [],
            showErrorBox(title, message) {
                this.errors.push({ title, message });
            },
            showMessageBox: async () => ({ response: 0 }),
            showOpenDialog: async () => ({ canceled: true, filePaths: [] })
        },
        shell: {
            opened: [],
            openExternal(url) {
                this.opened.push(url);
                return Promise.resolve();
            }
        },
        session: {
            defaultSession: {
                cookies: {
                    set: async () => {}
                }
            }
        }
    };

    return electron;
}

// Waits until the microtask queue and pending timers of the current tick have run.
function flush() {
    return new Promise(resolve => setImmediate(resolve));
}

// Polls `condition` until it is truthy (async work such as scrypt runs on the thread pool).
async function waitFor(condition, timeout = 5000) {
    let started = Date.now();
    while (!condition()) {
        if (Date.now() - started > timeout) {
            throw new Error("Timed out waiting for condition");
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

module.exports = {
    ROOT,
    installMocks,
    uninstallMocks,
    loadFresh,
    createSettings,
    createElectron,
    FakeWebContents,
    FakeBrowserWindow,
    flush,
    waitFor
};
