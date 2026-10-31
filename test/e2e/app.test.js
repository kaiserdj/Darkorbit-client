// End-to-end tests against the real Electron 11 client. Run with `npm run test:e2e`.
// They need a display; tests that need darkorbit.com are skipped when it cannot be reached.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const legacy = require("../helpers/legacy-crypt");
const { App, freePort, sleep } = require("./helpers/app");

// Fills the form of a local page and submits it; returns false while the page is still loading.
const submitScript = (fields) => `(() => {
    let form = document.getElementById("form");
    let ids = ${JSON.stringify(Object.keys(fields))};
    if (document.readyState !== "complete" || !form || ids.some(id => !document.getElementById(id))) {
        return false;
    }
    ${Object.entries(fields).map(([id, value]) => `document.getElementById(${JSON.stringify(id)}).value = ${JSON.stringify(value)};`).join("\n")}
    form.requestSubmit();
    return true;
})()`;

const submit = (app, page, fields) => app.waitFor(() => app.evaluate(page, submitScript(fields)).catch(() => false), 15000, `form on ${page}`);

// Clicks an element once the page has rendered it.
const click = (app, page, selector) => app.waitFor(() => app.evaluate(page, `(() => {
    let element = document.querySelector(${JSON.stringify(selector)});
    if (!element || document.readyState !== "complete") return false;
    element.click();
    return true;
})()`).catch(() => false), 15000, `${selector} on ${page}`);

const tableRows = `[...document.querySelectorAll("tbody tr")].map(row => [...row.cells].slice(2, 3).map(cell => cell.textContent.trim())[0])`;

describe("credentials manager", { timeout: 120000 }, () => {
    let app;
    let profile;

    after(async () => app && app.close());

    it("registers a master password and stores accounts encrypted", async () => {
        app = await App.launch();
        profile = app.userData;

        await submit(app, "masterRegister.html", { password: "e2e-master" });
        await app.page("list.html");

        await click(app, "list.html", "#new");
        await submit(app, "userRegister.html", { username: "<img src=x onerror=alert(1)>", password: "e2e-secret" });
        await app.page("list.html");

        let rows = await app.waitFor(async () => {
            let value = await app.evaluate("list.html", tableRows).catch(() => []);
            return value.length ? value : null;
        });
        assert.deepEqual(rows, ["<img src=x onerror=alert(1)>"]);
        assert.equal(await app.evaluate("list.html", `document.querySelectorAll("tbody img").length`), 0);

        let stored = JSON.stringify(app.settings());
        assert.equal(app.settings().cryptVersion, 2);
        assert.equal(stored.includes("e2e-secret"), false);
        assert.equal(stored.includes("e2e-master"), false);

        await app.close();
    });

    it("rejects a wrong master password after a restart and unlocks with the right one", async () => {
        app = await App.launch({ userData: profile });

        await submit(app, "masterLogin.html", { password: "wrong" });
        await app.waitFor(() => app.evaluate("masterLogin.html", `!!document.querySelector(".swal2-icon-error")`), 5000, "error dialog");

        await click(app, "masterLogin.html", ".swal2-confirm");
        await submit(app, "masterLogin.html", { password: "e2e-master" });
        await app.page("list.html");

        await app.close();
    });
});

describe("migration from version 2.8.0", { timeout: 60000 }, () => {
    let app;

    after(async () => app && app.close());

    it("moves legacy accounts to the new encryption", async () => {
        let accounts = [{ id: 42, username: "veteran", password: "legacy-secret" }];
        app = await App.launch({ settings: Object.assign({ check: true }, legacy.legacySettings("oldpass", accounts)) });

        await submit(app, "masterLogin.html", { password: "oldpass" });
        await app.page("list.html");

        let rows = await app.waitFor(async () => {
            let value = await app.evaluate("list.html", tableRows).catch(() => []);
            return value.length ? value : null;
        });
        assert.deepEqual(rows, ["veteran"]);

        let stored = app.settings();
        assert.equal(stored.cryptVersion, 2);
        assert.equal(stored.accounts.v, 2);
        assert.equal(JSON.stringify(stored).includes("legacy-secret"), false);
    });
});

describe("DarkOrbit pages", { timeout: 60000 }, () => {
    let app;
    let online;

    before(async () => {
        app = await App.launch();
        online = Boolean(await app.findPage("www.darkorbit.com", 20000));
    });

    after(async () => app && app.close());

    it("do not get the privileged window.api object", async (t) => {
        if (!online) {
            return t.skip("darkorbit.com not reachable");
        }
        assert.equal(await app.evaluate("www.darkorbit.com", "typeof window.api"), "undefined");
        assert.equal(await app.evaluate("www.darkorbit.com", "typeof require"), "undefined");
    });

    it("run without Node in the preload world (sandboxed renderer)", async (t) => {
        if (!online) {
            return t.skip("darkorbit.com not reachable");
        }
        // With Node integration the preload world exposed require/process/Buffer as globals.
        let globals = await app.evaluate("www.darkorbit.com", `JSON.stringify([typeof require, typeof process, typeof Buffer, typeof global])`, { isolated: true });
        assert.deepEqual(JSON.parse(globals), ["undefined", "undefined", "undefined", "undefined"]);
    });

    it("show the AUTOLOGIN button on the login page", async (t) => {
        if (!online) {
            return t.skip("darkorbit.com not reachable");
        }
        await app.waitFor(() => app.evaluate("www.darkorbit.com", `!!document.getElementById("autoLogin")`), 10000, "AUTOLOGIN button");
    });
});

describe("api mode WebSocket", { timeout: 60000 }, () => {
    let app;
    let port;
    let online;

    before(async () => {
        port = await freePort();
        app = await App.launch({ args: ["--api", String(port), "--url", "https://www.darkorbit.com/"] });
        online = Boolean(await app.findPage("www.darkorbit.com", 20000));
        await sleep(1000);
    });

    after(async () => app && app.close());

    // Sends one binary message and resolves with the reply, "rejected <status>" or "no reply".
    function exchange(headers, payload) {
        return new Promise(resolve => {
            let socket = new WebSocket(`ws://127.0.0.1:${port}`, { headers });
            socket.binaryType = "arraybuffer";
            let timer = setTimeout(() => {
                socket.terminate();
                resolve("no reply");
            }, 2000);
            socket.on("open", () => socket.send(payload));
            socket.on("message", data => {
                clearTimeout(timer);
                socket.close();
                resolve(new DataView(data));
            });
            socket.on("unexpected-response", (request, response) => {
                clearTimeout(timer);
                resolve(`rejected ${response.statusCode}`);
            });
            socket.on("error", () => {});
        });
    }

    const command = code => {
        let view = new DataView(new ArrayBuffer(2));
        view.setInt16(0, code);
        return Buffer.from(view.buffer);
    };

    it("answers local tools", async (t) => {
        if (!online) {
            return t.skip("darkorbit.com not reachable");
        }
        let reply = await exchange({}, command(1));
        assert.equal(reply.getInt16(0), 1);
        assert.equal(reply.getInt16(2), Number(require("../../package.json").version.split(".")[0]));
    });

    it("rejects connections from web pages", async (t) => {
        if (!online) {
            return t.skip("darkorbit.com not reachable");
        }
        assert.equal(await exchange({ Origin: "https://evil.tld" }, command(1)), "rejected 401");
    });

    it("survives malformed messages", async (t) => {
        if (!online) {
            return t.skip("darkorbit.com not reachable");
        }
        assert.equal(await exchange({}, Buffer.from([1])), "no reply");
        assert.equal((await exchange({}, command(7))).getInt16(0), 7);
    });
});
