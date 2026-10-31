const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const defaultSettings = require("../../defaultSettings.json");
const { installMocks, uninstallMocks, loadFresh, createSettings, createElectron, FakeBrowserWindow, FakeWebContents } = require("../helpers/mocks");

describe("settings/settings.js", () => {
    let electron, settings, client, window, ipc;

    beforeEach(() => {
        electron = createElectron();
        settings = createSettings(defaultSettings);
        installMocks({ electron, "electron-settings": settings });

        let Settings = loadFresh("settings/settings.js");
        client = {
            menuTray: { insert() {} },
            rebuildTrayMenu() {},
            arg: {},
            relaunched: 0,
            core: { app: { relaunch: () => client.relaunched++, exit() {} } }
        };

        let instance = new Settings(client);
        window = new FakeBrowserWindow({}, "file:///app/settings/index.html");
        instance.window = window;
        ipc = electron.ipcMain;
    });

    afterEach(uninstallMocks);

    describe("SetOptionConfig", () => {
        it("stores known options with the type of their default", () => {
            ipc.deliver("SetOptionConfig", window.webContents, "PreventCloseGame", 1);
            ipc.deliver("SetOptionConfig", window.webContents, "PacketTimeout", "20000");
            ipc.deliver("SetOptionConfig", window.webContents, "PythonPath", "/usr/bin/python3");

            let stored = settings.data.Settings;
            assert.equal(stored.PreventCloseGame, true);
            assert.equal(stored.PacketTimeout, 20000);
            assert.equal(stored.PythonPath, "/usr/bin/python3");
        });

        for (let [name, option] of [["removed options", "NoSandbox"], ["unknown options", "Whatever"], ["__proto__", "__proto__"], ["constructor", "constructor"]]) {
            it(`ignores ${name}`, () => {
                let before = settings.data;
                ipc.deliver("SetOptionConfig", window.webContents, option, { polluted: true });
                assert.deepEqual(settings.data, before);
                assert.equal({}.polluted, undefined);
            });
        }

        it("rejects invalid numbers", () => {
            for (let value of ["abc", -1, "Infinity"]) {
                ipc.deliver("SetOptionConfig", window.webContents, "PacketTimeout", value);
            }
            assert.equal(settings.data.Settings.PacketTimeout, defaultSettings.Settings.PacketTimeout);
        });

        it("ignores other windows", () => {
            ipc.deliver("SetOptionConfig", new FakeWebContents("https://www.darkorbit.com/"), "DefaultDev", true);
            assert.equal(settings.data.Settings.DefaultDev, false);
        });
    });

    it("sends the Settings section to the settings window", () => {
        ipc.deliver("LoadSettings", window.webContents);
        assert.deepEqual(window.webContents.lastSent("SendLoadSettings")[0], defaultSettings.Settings);
    });

    it("relaunches only on request of the settings window", () => {
        ipc.deliver("relaunch", new FakeWebContents("https://www.darkorbit.com/"));
        assert.equal(client.relaunched, 0);
        ipc.deliver("relaunch", window.webContents);
        assert.equal(client.relaunched, 1);
    });

    it("opens only web links externally, and only for the settings window", () => {
        ipc.deliver("openExternal", window.webContents, "file:///Applications/Calculator.app");
        ipc.deliver("openExternal", new FakeWebContents("https://evil.tld/"), "https://evil.tld/");
        ipc.deliver("openExternal", window.webContents, "https://github.com/");
        assert.deepEqual(electron.shell.opened, ["https://github.com/"]);
    });
});
