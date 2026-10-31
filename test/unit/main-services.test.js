const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("events");
const net = require("net");
const WebSocket = require("ws");
const { installMocks, uninstallMocks, loadFresh, createSettings, createElectron, FakeWebContents, ROOT, waitFor } = require("../helpers/mocks");

const GAME = "https://es1.darkorbit.com/indexInternal.es?action=internalMapRevolution";

function freePort() {
    return new Promise(resolve => {
        let server = net.createServer().listen(0, "127.0.0.1", () => {
            let { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

// Opens a WebSocket, sends `payload` once open and resolves with the first reply or a status.
function exchange(port, payload, headers = {}) {
    return new Promise(resolve => {
        let socket = new WebSocket(`ws://127.0.0.1:${port}`, { headers });
        let timer = setTimeout(() => {
            socket.terminate();
            resolve("no reply");
        }, 1000);
        socket.on("open", () => payload !== undefined ? socket.send(payload) : null);
        socket.on("message", data => {
            clearTimeout(timer);
            socket.close();
            resolve(new DataView(data.buffer, data.byteOffset, data.byteLength));
        });
        socket.on("unexpected-response", (request, response) => {
            clearTimeout(timer);
            resolve(`rejected ${response.statusCode}`);
        });
        socket.on("error", () => {});
    });
}

const command = (code, ...int32) => {
    let view = new DataView(new ArrayBuffer(2 + int32.length * 4));
    view.setInt16(0, code);
    int32.forEach((value, i) => view.setInt32(2 + i * 4, value));
    return Buffer.from(view.buffer);
};

describe("packet.js (packet logger in the main process)", () => {
    let PacketService, settings, spawned, service, port;

    beforeEach(async () => {
        settings = createSettings({ Settings: { Packet: true, PacketTimeout: 0, PythonPath: "/usr/bin/python3" } });
        installMocks({ electron: createElectron(), "electron-settings": settings });
        PacketService = loadFresh("packet.js");

        spawned = [];
        let spawnProcess = (command, args, options) => {
            let child = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            child.killed = false;
            child.kill = () => { child.killed = true; };
            spawned.push({ command, args, options, child });
            return child;
        };
        port = await freePort();
        service = new PacketService({ getAppPath: () => ROOT }, { port, spawnProcess });
    });

    afterEach(() => {
        for (let id of [...service.pages.keys()]) {
            service.stop(id);
        }
        uninstallMocks();
    });

    it("recognises only the DarkOrbit game page", () => {
        assert.equal(PacketService.isGamePage(GAME), true);
        assert.equal(PacketService.isGamePage("https://es1.darkorbit.com/indexInternal.es?action=internalStart"), false);
        assert.equal(PacketService.isGamePage("https://evil.tld/?action=internalMapRevolution"), false);
    });

    it("starts packet_dumper with the configured interpreter for a game page", async () => {
        service.onPageLoaded(new FakeWebContents(GAME));
        await waitFor(() => spawned.length);

        assert.equal(spawned[0].command, "/usr/bin/python3");
        assert.match(spawned[0].args[0], /darkDev[/\\]packet_dumper\.py$/);
        assert.equal(spawned[0].options.shell, false);
    });

    it("does nothing when the packet logger is disabled or the page is not the game", async () => {
        service.onPageLoaded(new FakeWebContents("https://es1.darkorbit.com/indexInternal.es?action=internalStart"));
        settings.setSync({ Settings: { Packet: false } });
        service.onPageLoaded(new FakeWebContents(GAME));
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.equal(spawned.length, 0);
        assert.equal(service.server, null);
    });

    it("forwards packets from local clients to the game page", async () => {
        let page = new FakeWebContents(GAME);
        page.isDestroyed = () => false;
        service.onPageLoaded(page);

        assert.equal(await exchange(port, JSON.stringify({ id: 7, name: "ShipMove" })), "no reply");
        assert.deepEqual(page.lastSent("packet"), [{ id: 7, name: "ShipMove" }]);
    });

    it("ignores invalid JSON and rejects web pages", async () => {
        let page = new FakeWebContents(GAME);
        page.isDestroyed = () => false;
        service.onPageLoaded(page);

        await exchange(port, "{not json");
        assert.equal(page.lastSent("packet"), undefined);
        assert.equal(await exchange(port, undefined, { Origin: "https://evil.tld" }), "rejected 401");
    });

    it("stops packet_dumper and the server when the game page goes away", async () => {
        let page = new FakeWebContents(GAME);
        page.isDestroyed = () => false;
        service.onPageLoaded(page);
        await waitFor(() => spawned.length);

        page.emit("destroyed");
        assert.equal(spawned[0].child.killed, true);
        assert.equal(service.server, null);
    });

    it("restarts cleanly when the game page reloads", async () => {
        let page = new FakeWebContents(GAME);
        page.isDestroyed = () => false;
        service.onPageLoaded(page);
        await waitFor(() => spawned.length === 1);

        service.onPageLoaded(page);
        await waitFor(() => spawned.length === 2);
        assert.equal(spawned[0].child.killed, true);
        assert.equal(service.pages.size, 1);
    });
});

describe("apiServer.js (--api mode in the main process)", () => {
    let ApiServer, server, port, window;

    beforeEach(async () => {
        installMocks({ electron: createElectron() });
        ApiServer = loadFresh("apiServer.js");
        port = await freePort();

        window = {
            calls: [],
            readyState: "complete",
            isDestroyed: () => false,
            setSize: (w, h) => window.calls.push(["setSize", w, h]),
            show: () => window.calls.push(["show"]),
            hide: () => window.calls.push(["hide"]),
            minimize: () => window.calls.push(["minimize"]),
            restore: () => window.calls.push(["restore"]),
            webContents: {
                reload: () => window.calls.push(["reload"]),
                executeJavaScript: async () => window.readyState
            }
        };
        let app = {
            getVersion: () => "3.1.2",
            getAppMetrics: () => [{ type: "Browser", pid: 1 }, { type: "Pepper Plugin", pid: 4242 }]
        };
        server = new ApiServer(app, window, port);
        await new Promise(resolve => server.server.once("listening", resolve));
    });

    afterEach(() => {
        server.close();
        uninstallMocks();
    });

    it("listens on localhost only", () => {
        assert.equal(server.server.address().address, "127.0.0.1");
    });

    it("reports the version and the Flash plugin pid", async () => {
        let version = await exchange(port, command(1));
        assert.deepEqual([version.getInt16(0), version.getInt16(2), version.getInt16(4), version.getInt16(6)], [1, 3, 1, 2]);

        let pid = await exchange(port, command(2));
        assert.deepEqual([pid.getInt16(0), pid.getInt32(2)], [2, 4242]);
    });

    it("controls the window", async () => {
        await exchange(port, command(3, 900, 600));
        let visible = new DataView(new ArrayBuffer(4));
        visible.setInt16(0, 4);
        visible.setInt16(2, 0);
        await exchange(port, Buffer.from(visible.buffer));
        await exchange(port, command(6));
        assert.deepEqual(window.calls, [["setSize", 900, 600], ["hide"], ["reload"]]);
    });

    it("reports whether the page finished loading", async () => {
        let ready = await exchange(port, command(7));
        assert.deepEqual([ready.getInt16(0), ready.getInt16(2)], [7, 1]);
        window.readyState = "loading";
        let loading = await exchange(port, command(7));
        assert.equal(loading.getInt16(2), 0);
    });

    it("ignores truncated and invalid messages", async () => {
        assert.equal(await exchange(port, Buffer.from([1])), "no reply");
        assert.equal(await exchange(port, command(3)), "no reply");
        assert.equal(await exchange(port, command(-3, 0, -5)), "no reply");
        assert.deepEqual(window.calls, []);
    });

    it("rejects web pages", async () => {
        assert.equal(await exchange(port, command(1), { Origin: "https://evil.tld" }), "rejected 401");
    });
});
