const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { installMocks, uninstallMocks, loadFresh, createSettings, createElectron, FakeWebContents } = require("../helpers/mocks");

describe("api.js (IPC used by the page preload)", () => {
    let ipc;
    let fetched = [];
    const darkorbit = { sender: new FakeWebContents("https://es1.darkorbit.com/indexInternal.es") };
    const evil = { sender: new FakeWebContents("https://evil.tld/") };

    before(() => {
        let electron = createElectron();
        ipc = electron.ipcMain;
        installMocks({
            electron,
            "electron/main": electron,
            "electron-settings": createSettings({
                Settings: { Packet: false },
                master: { v: 2 },
                salt: "00",
                accounts: { v: 2 }
            }),
            "./tools": {
                get: async url => {
                    fetched.push(url);
                    return "body";
                }
            }
        });

        let Api = loadFresh("api.js");
        new Api();
    });

    after(uninstallMocks);

    it("does not expose open or setConfig any more", () => {
        assert.deepEqual([...ipc.handlers.keys()].sort(), ["get", "getConfig"]);
    });

    it("returns only the Settings section, never credentials", async () => {
        assert.deepEqual(await ipc.invoke("getConfig", darkorbit), { Settings: { Packet: false } });
    });

    it("refuses getConfig for other sites", async () => {
        await assert.rejects(ipc.invoke("getConfig", evil), /Untrusted sender/);
    });

    it("fetches https urls for DarkOrbit pages", async () => {
        assert.equal(await ipc.invoke("get", darkorbit, "https://gist.githubusercontent.com/x.js"), "body");
        assert.deepEqual(fetched, ["https://gist.githubusercontent.com/x.js"]);
    });

    for (let url of ["http://127.0.0.1:8080/", "file:///etc/passwd", "//evil.tld/", "data:text/plain,x"]) {
        it(`refuses to fetch ${url}`, async () => {
            await assert.rejects(ipc.invoke("get", darkorbit, url));
        });
    }

    it("refuses get for other sites", async () => {
        await assert.rejects(ipc.invoke("get", evil, "https://example.com/"), /Untrusted sender/);
    });
});
