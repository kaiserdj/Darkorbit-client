const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { installMocks, uninstallMocks, loadFresh, createSettings, createElectron, FakeWebContents } = require("../helpers/mocks");

describe("darkDev/tools/CustomList.js", () => {
    let electron, settings, ipc, changes, own, localFile;

    beforeEach(() => {
        electron = createElectron();
        settings = createSettings({
            DarkDev: {
                CustomLoad: { enable: false, list: {} },
                CustomJs: { enable: false, list: {} }
            }
        });
        installMocks({ electron, "electron-settings": settings });

        let CustomList = loadFresh("darkDev/tools/CustomList.js");
        own = new FakeWebContents("file:///app/darkDev/index.html");
        let darkDev = { isDarkDevWindow: event => event.sender === own };
        changes = 0;
        new CustomList(darkDev, "CustomLoad", true, () => changes++);
        new CustomList(darkDev, "CustomJs", false, () => changes++);
        ipc = electron.ipcMain;

        localFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "darkdev-")), "main.swf");
        fs.writeFileSync(localFile, "swf");
    });

    afterEach(uninstallMocks);

    const list = name => settings.data.DarkDev[name].list;

    it("adds a clean item and drops unknown fields", () => {
        ipc.deliver("NewCustomJs", own, { id: 1, enable: true, match: "*darkorbit*", actionUrl: "https://a.com/x.js", extra: "drop" });
        assert.deepEqual(list("CustomJs"), { 1: { id: 1, enable: true, match: "*darkorbit*", actionUrl: "https://a.com/x.js" } });
        assert.equal(changes, 1);
    });

    it("ignores other windows", () => {
        ipc.deliver("NewCustomJs", new FakeWebContents("https://www.darkorbit.com/"), { id: 1, match: "*", actionUrl: "https://a.com/x.js" });
        ipc.deliver("SetEnableCustomJs", new FakeWebContents("https://www.darkorbit.com/"), true);
        assert.deepEqual(list("CustomJs"), {});
        assert.equal(settings.data.DarkDev.CustomJs.enable, false);
    });

    const invalid = [
        ["http sources", { id: 2, match: "*", actionUrl: "http://a.com/x.js" }],
        ["a missing pattern", { id: 3, match: "", actionUrl: "https://a.com/x.js" }],
        ["a non numeric id", { id: "__proto__", match: "*", actionUrl: "https://a.com/x.js" }],
        ["local files for JS", { id: 4, match: "*", LocalFileEnable: true, LocalFile: "/etc/hosts" }]
    ];

    for (let [name, item] of invalid) {
        it(`rejects ${name}`, () => {
            ipc.deliver("NewCustomJs", own, item);
            assert.deepEqual(list("CustomJs"), {});
            assert.equal(electron.dialog.errors.length, 1);
        });
    }

    it("accepts an existing local file for CustomLoad", () => {
        ipc.deliver("NewCustomLoad", own, { id: 5, enable: true, match: "*main.swf*", LocalFileEnable: true, LocalFile: localFile, actionUrl: "ignored" });
        assert.equal(list("CustomLoad")[5].LocalFile, localFile);
        assert.equal(list("CustomLoad")[5].actionUrl, "");
    });

    it("rejects missing or relative local files", () => {
        ipc.deliver("NewCustomLoad", own, { id: 6, match: "*", LocalFileEnable: true, LocalFile: "/nope/missing.swf" });
        ipc.deliver("NewCustomLoad", own, { id: 7, match: "*", LocalFileEnable: true, LocalFile: "main.swf" });
        assert.deepEqual(list("CustomLoad"), {});
    });

    it("enables, disables and removes existing items only", () => {
        ipc.deliver("NewCustomJs", own, { id: 8, enable: true, match: "*", actionUrl: "https://a.com/x.js" });

        ipc.deliver("enableCustomJsItem", own, { id: "8", enable: 0 });
        assert.equal(list("CustomJs")[8].enable, false);

        ipc.deliver("enableCustomJsItem", own, { id: "toString", enable: true });
        ipc.deliver("removeCustomJsItem", own, "999");
        assert.equal(Object.keys(list("CustomJs")).length, 1);

        ipc.deliver("removeCustomJsItem", own, "8");
        assert.deepEqual(list("CustomJs"), {});
    });
});

describe("darkDev/tools/ResourceDownload.js", () => {
    let ResourceDownload;

    beforeEach(() => {
        ResourceDownload = loadFresh("darkDev/tools/ResourceDownload.js");
    });

    function fakeWindow() {
        let messages = [];
        return {
            messages,
            destroyed: false,
            isDestroyed() {
                return this.destroyed;
            },
            webContents: {
                send: (channel, text) => messages.push(text),
                downloadURL() {},
                session: { once() {} }
            }
        };
    }

    const resolve = (folder, file) => ResourceDownload.prototype.resolveInFolder.call({ opt: { folder } }, file);

    it("keeps files inside the chosen folder", () => {
        assert.equal(resolve("/tmp/res", "spacemap/main.swf"), path.resolve("/tmp/res/spacemap/main.swf"));
        assert.equal(resolve("/tmp/res", "..hidden/x"), path.resolve("/tmp/res/..hidden/x"));
    });

    for (let file of ["../outside.txt", "spacemap/../../outside.txt", "/etc/passwd"]) {
        it(`refuses ${file}`, () => {
            assert.throws(() => resolve("/tmp/res", file), /outside of the download folder/);
        });
    }

    it("allows a drive root as download folder", () => {
        assert.equal(resolve("/", "spacemap/main.swf"), path.resolve("/spacemap/main.swf"));
    });

    it("refuses server names that would change the host", () => {
        let window = fakeWindow();
        let download = new ResourceDownload(window, { customServer: true, server: "evil.tld#", folder: "/tmp/res", listXmlColections: [], listExtraFiles: [] });
        assert.equal(download.domain, undefined);
        assert.match(window.messages.join("\n"), /Invalid server name/);
    });

    it("lower-cases custom server names", () => {
        let download = new ResourceDownload(fakeWindow(), { customServer: true, server: "ES1", folder: "/tmp/res", listXmlColections: [], listExtraFiles: [] });
        assert.equal(download.domain, "https://es1.darkorbit.com");
    });

    it("does not fail when the DarkDev window was closed", () => {
        let window = fakeWindow();
        window.destroyed = true;
        assert.doesNotThrow(() => ResourceDownload.prototype.console.call({ window }, "text"));
    });
});
