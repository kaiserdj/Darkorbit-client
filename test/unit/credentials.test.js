const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("events");
const legacy = require("../helpers/legacy-crypt");
const {
    installMocks, uninstallMocks, loadFresh, createSettings, createElectron,
    FakeBrowserWindow, FakeWebContents, waitFor
} = require("../helpers/mocks");

const LOGIN_PAGE = "https://www.darkorbit.com/";
const GAME_PAGE = "https://es1.darkorbit.com/indexInternal.es?action=internalStart";

// Builds a Credentials instance with a fake menubar window and a fake client.
function setup(initialSettings = {}) {
    let electron = createElectron();
    let settings = createSettings(Object.assign({ Settings: {} }, initialSettings));

    let mb = new EventEmitter();
    mb.window = new FakeBrowserWindow({}, "file:///app/credentials/html/masterLogin.html");
    mb.shown = 0;
    mb.showWindow = () => mb.shown++;
    mb.hideWindow = () => {};
    mb.getOption = () => "trayCenter";

    installMocks({
        electron,
        menubar: { menubar: () => mb },
        "electron-settings": settings,
        "electron-positioner": class Positioner { move() {} }
    });

    let Credentials = loadFresh("credentials/credentials.js");

    let created = [];
    let client = {
        menuTray: { insert() {} },
        rebuildTrayMenu() {},
        tray: {},
        arg: {},
        useragent: "BigPointClient/1.6.9",
        createWindow(type, url) {
            let window = new FakeBrowserWindow({}, "");
            created.push({ type, url, window });
            return window;
        }
    };

    let credentials = new Credentials(client);
    let own = mb.window.webContents;
    let ipc = electron.ipcMain;

    return { electron, settings, mb, credentials, created, own, ipc };
}

async function unlockedWithAccounts(accounts = []) {
    let ctx = setup();
    ctx.ipc.deliver("registerMaster", ctx.own, "master-pw");
    await waitFor(() => ctx.credentials.check);
    for (let [username, password] of accounts) {
        ctx.ipc.deliver("registerUser", ctx.own, [username, password]);
    }
    return ctx;
}

function listedAccounts(ctx) {
    ctx.ipc.deliver("loadList", ctx.own);
    return JSON.parse(ctx.own.lastSent("sendList")[0]);
}

describe("credentials/credentials.js", () => {
    afterEach(uninstallMocks);

    describe("master password", () => {
        it("stores only a salt and a verifier, never the password", async () => {
            let ctx = setup();
            ctx.ipc.deliver("registerMaster", ctx.own, "master-pw");
            await waitFor(() => ctx.credentials.check);

            let stored = ctx.settings.data;
            assert.equal(stored.cryptVersion, 2);
            assert.match(stored.salt, /^[0-9a-f]{32}$/);
            assert.equal(stored.master.v, 2);
            assert.equal(JSON.stringify(stored).includes("master-pw"), false);
            assert.match(ctx.mb.window.loaded.pop(), /list\.html$/);
        });

        it("ignores registration from other windows", async () => {
            let ctx = setup();
            ctx.ipc.deliver("registerMaster", new FakeWebContents("https://evil.tld/"), "attacker");
            await new Promise(resolve => setTimeout(resolve, 150));
            assert.equal(ctx.settings.data.master, undefined);
        });

        it("cannot overwrite an existing master password", async () => {
            let ctx = await unlockedWithAccounts([["pilot", "secret"]]);
            let before = ctx.settings.data.master;
            ctx.ipc.deliver("registerMaster", ctx.own, "other");
            await new Promise(resolve => setTimeout(resolve, 150));
            assert.deepEqual(ctx.settings.data.master, before);
        });

        it("rejects a wrong password and unlocks with the right one", async () => {
            let { settings } = await unlockedWithAccounts();
            let ctx = setup(settings.data);

            ctx.ipc.deliver("checkMaster", ctx.own, "wrong");
            await waitFor(() => ctx.own.lastSent("checkMasterRet"));
            assert.deepEqual(ctx.own.lastSent("checkMasterRet"), [false]);
            assert.equal(ctx.credentials.check, false);

            ctx.ipc.deliver("checkMaster", ctx.own, "master-pw");
            await waitFor(() => ctx.credentials.check);
        });

        it("answers each attempt with its own result when submitted quickly", async () => {
            let { settings } = await unlockedWithAccounts();
            let ctx = setup(settings.data);

            let results = await Promise.all([
                ctx.credentials.checkMaster("typo"),
                ctx.credentials.checkMaster("master-pw")
            ]);
            assert.deepEqual(results, [false, true]);
        });

        it("unlocks automatically at startup only when the master password is empty", async () => {
            let empty = setup();
            empty.ipc.deliver("registerMaster", empty.own, "");
            await waitFor(() => empty.credentials.check);

            let restarted = setup(empty.settings.data);
            restarted.mb.emit("ready");
            await waitFor(() => restarted.credentials.check);

            let { settings } = await unlockedWithAccounts();
            let locked = setup(settings.data);
            locked.mb.emit("ready");
            await new Promise(resolve => setTimeout(resolve, 300));
            assert.equal(locked.credentials.check, false);
        });

        it("reset removes the master password and all accounts", async () => {
            let ctx = await unlockedWithAccounts([["pilot", "secret"]]);
            ctx.ipc.deliver("resetMaster", ctx.own);

            let stored = ctx.settings.data;
            assert.equal(stored.master, undefined);
            assert.equal(stored.accounts, undefined);
            assert.equal(ctx.credentials.check, false);
        });
    });

    describe("migration from version 2.8.0", () => {
        it("re-encrypts legacy accounts after the right master password", async () => {
            let accounts = [{ id: 42, username: "veteran", password: "old-secret" }];
            let ctx = setup(legacy.legacySettings("oldpass", accounts));

            ctx.ipc.deliver("checkMaster", ctx.own, "oldpass");
            await waitFor(() => ctx.credentials.check);

            let stored = ctx.settings.data;
            assert.equal(stored.cryptVersion, 2);
            assert.equal(stored.master.v, 2);
            assert.equal(stored.accounts.v, 2);
            assert.equal(JSON.stringify(stored).includes("old-secret"), false);
            assert.deepEqual(listedAccounts(ctx), accounts);
        });

        it("keeps legacy data untouched after a wrong password", async () => {
            let initial = legacy.legacySettings("oldpass", [{ id: 1, username: "a", password: "b" }]);
            let ctx = setup(initial);

            ctx.ipc.deliver("checkMaster", ctx.own, "wrong");
            await waitFor(() => ctx.own.lastSent("checkMasterRet"));

            assert.deepEqual(ctx.settings.data.master, initial.master);
            assert.equal(ctx.settings.data.accounts, initial.accounts);
        });
    });

    describe("accounts", () => {
        it("are only listed after unlocking", () => {
            let ctx = setup();
            ctx.ipc.deliver("loadList", ctx.own);
            assert.equal(ctx.own.lastSent("sendList"), undefined);
        });

        it("are stored encrypted and can be added, edited and deleted", async () => {
            let ctx = await unlockedWithAccounts([["pilot", "secret"]]);
            assert.equal(JSON.stringify(ctx.settings.data).includes("secret"), false);

            let [account] = listedAccounts(ctx);
            assert.equal(account.username, "pilot");

            ctx.ipc.deliver("changeUser", ctx.own, [account.id, "renamed", "new-secret"]);
            assert.deepEqual(listedAccounts(ctx).map(a => [a.username, a.password]), [["renamed", "new-secret"]]);

            ctx.ipc.deliver("deleteUser", ctx.own, account.id);
            assert.deepEqual(listedAccounts(ctx), []);
        });

        it("gives accounts saved in the same millisecond different ids", async () => {
            let ctx = await unlockedWithAccounts([["first", "1"], ["second", "2"], ["third", "3"]]);
            let ids = listedAccounts(ctx).map(account => account.id);
            assert.equal(new Set(ids).size, 3);
        });

        it("ignores account changes from other windows", async () => {
            let ctx = await unlockedWithAccounts([["pilot", "secret"]]);
            let [account] = listedAccounts(ctx);
            ctx.ipc.deliver("deleteUser", new FakeWebContents(LOGIN_PAGE), account.id);
            assert.equal(listedAccounts(ctx).length, 1);
        });

        it("edits the selected account without piling up listeners", async () => {
            let ctx = await unlockedWithAccounts([["first", "1"], ["second", "2"]]);
            let [first, second] = listedAccounts(ctx);

            for (let account of [first, second, first]) {
                ctx.ipc.deliver("editUser", ctx.own, account.id);
            }
            ctx.ipc.deliver("getEditUser", ctx.own);

            assert.deepEqual(ctx.own.lastSent("sendEditUser")[0], [first.id, "first"]);
            assert.equal(ctx.ipc.listenerCount("getEditUser"), 1);
        });
    });

    describe("autologin", () => {
        it("fills the login form of the window that asked for it", async () => {
            let ctx = await unlockedWithAccounts([["pilot", "secret"]]);
            let page = new FakeBrowserWindow({}, LOGIN_PAGE);

            ctx.ipc.deliver("autoLogin", page.webContents);
            ctx.ipc.deliver("loginUser", ctx.own, listedAccounts(ctx)[0].id);

            assert.deepEqual(page.webContents.lastSent("login")[0], ["pilot", "secret"]);
            assert.equal(ctx.created.length, 0);
        });

        it("ignores autologin requests from other sites", async () => {
            let ctx = await unlockedWithAccounts([["pilot", "secret"]]);
            let shown = ctx.mb.shown;
            ctx.ipc.deliver("autoLogin", new FakeWebContents("https://evil.tld/"));
            assert.equal(ctx.mb.shown, shown);
        });

        it("opens a new window when the requesting window left the login page", async () => {
            let ctx = await unlockedWithAccounts([["first", "1"], ["second", "2"]]);
            let page = new FakeBrowserWindow({}, LOGIN_PAGE);
            ctx.ipc.deliver("autoLogin", page.webContents);

            page.webContents.url = GAME_PAGE;
            ctx.ipc.deliver("loginUser", ctx.own, listedAccounts(ctx)[1].id);

            assert.equal(page.webContents.lastSent("login"), undefined);
            assert.equal(ctx.created.length, 1);

            let opened = ctx.created[0].window.webContents;
            opened.url = LOGIN_PAGE;
            opened.emit("did-finish-load");
            assert.deepEqual(opened.lastSent("login")[0], ["second", "2"]);
        });

        it("never sends credentials to a page that is not a DarkOrbit login page", async () => {
            let ctx = await unlockedWithAccounts([["pilot", "secret"]]);
            ctx.ipc.deliver("loginUser", ctx.own, listedAccounts(ctx)[0].id);

            let opened = ctx.created[0].window.webContents;
            opened.url = "https://evil.tld/";
            opened.emit("did-finish-load");
            opened.url = LOGIN_PAGE;
            opened.emit("did-finish-load");

            assert.equal(opened.lastSent("login"), undefined);
        });
    });

    describe("login with dosid", () => {
        it("only accepts https DarkOrbit urls with a dosid", () => {
            let ctx = setup();
            ctx.credentials.loginDosid();
            let dialog = FakeBrowserWindow.all[FakeBrowserWindow.all.length - 1];

            ctx.ipc.deliver("dosidSubmit", dialog.webContents, "https://evil.tld/?dosid=abc");
            ctx.ipc.deliver("dosidSubmit", dialog.webContents, "http://es1.darkorbit.com/?dosid=abc");

            assert.equal(ctx.electron.dialog.errors.length, 2);
            assert.equal(ctx.created.length, 0);
        });

        it("sets the cookie and opens the game for a valid url", async () => {
            let ctx = setup();
            let cookies = [];
            ctx.electron.session.defaultSession.cookies.set = async cookie => cookies.push(cookie);

            ctx.credentials.loginDosid();
            let dialog = FakeBrowserWindow.all[FakeBrowserWindow.all.length - 1];
            ctx.ipc.deliver("dosidSubmit", dialog.webContents, "https://es1.darkorbit.com/?dosid=abc123");

            await waitFor(() => ctx.created.length);
            assert.deepEqual(cookies, [{ url: "https://es1.darkorbit.com", name: "dosid", value: "abc123" }]);
            assert.equal(ctx.created[0].url, "https://es1.darkorbit.com/indexInternal.es?action=internalStart");
            assert.equal(dialog.isDestroyed(), true);
        });

        it("ignores submissions from other windows", () => {
            let ctx = setup();
            ctx.credentials.loginDosid();
            ctx.ipc.deliver("dosidSubmit", new FakeWebContents(LOGIN_PAGE), "https://es1.darkorbit.com/?dosid=abc");
            assert.equal(ctx.electron.dialog.errors.length, 0);
            assert.equal(ctx.created.length, 0);
        });
    });
});
