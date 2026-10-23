// Starts the real client (Electron 11) with a throw-away profile and drives its pages through
// the Chrome DevTools Protocol. Used by the end-to-end tests; needs a display.

const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const WebSocket = require("ws");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const ELECTRON = require("electron");

function freePort() {
    return new Promise((resolve, reject) => {
        let server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            let { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class App {
    // options.settings: initial settings.json content, options.args: extra command line arguments.
    static async launch(options = {}) {
        let app = new App();
        app.userData = options.userData || fs.mkdtempSync(path.join(os.tmpdir(), "darkorbit-e2e-"));
        app.port = await freePort();

        if (options.settings) {
            fs.writeFileSync(path.join(app.userData, "settings.json"), JSON.stringify(options.settings, null, 2));
        }

        app.output = "";
        app.process = spawn(ELECTRON, [ROOT, `--user-data-dir=${app.userData}`, `--remote-debugging-port=${app.port}`, ...(options.args || [])], {
            cwd: ROOT,
            env: Object.assign({}, process.env, { ELECTRON_ENABLE_LOGGING: "1" })
        });
        app.process.stdout.on("data", data => app.output += data);
        app.process.stderr.on("data", data => app.output += data);
        app.exited = new Promise(resolve => app.process.on("exit", resolve));

        await app.waitFor(async () => (await app.targets()).length > 0, 30000, "DevTools endpoint");
        return app;
    }

    async targets() {
        try {
            let response = await fetch(`http://127.0.0.1:${this.port}/json`);
            return (await response.json()).filter(target => target.type === "page");
        } catch (e) {
            return [];
        }
    }

    async waitFor(condition, timeout = 20000, what = "condition") {
        let started = Date.now();
        for (;;) {
            let value = await condition();
            if (value) {
                return value;
            }
            if (Date.now() - started > timeout) {
                throw new Error(`Timed out waiting for ${what}.\n--- app output ---\n${this.output.slice(-3000)}`);
            }
            await sleep(100);
        }
    }

    // Resolves with the first page whose url contains `part`, or null after the timeout.
    async findPage(part, timeout = 20000) {
        try {
            return await this.waitFor(async () => (await this.targets()).find(target => target.url.includes(part)), timeout, `page ${part}`);
        } catch (e) {
            return null;
        }
    }

    async page(part, timeout) {
        let target = await this.findPage(part, timeout);
        if (!target) {
            throw new Error(`No page matching ${part}: ${(await this.targets()).map(t => t.url).join(", ")}`);
        }
        return target;
    }

    // Evaluates `expression` in the page (or in the preload world with { isolated: true }).
    async evaluate(part, expression, { isolated = false, timeout } = {}) {
        let target = await this.page(part, timeout);
        let socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            socket.once("open", resolve);
            socket.once("error", reject);
        });

        let id = 0;
        let pending = new Map();
        let contexts = [];
        socket.on("message", raw => {
            let message = JSON.parse(raw);
            if (message.method === "Runtime.executionContextCreated") {
                contexts.push(message.params.context);
            } else if (message.id && pending.has(message.id)) {
                pending.get(message.id)(message);
                pending.delete(message.id);
            }
        });
        let send = (method, params) => new Promise(resolve => {
            pending.set(++id, resolve);
            socket.send(JSON.stringify({ id, method, params }));
        });

        try {
            let params = { expression, awaitPromise: true, returnByValue: true, userGesture: true };
            if (isolated) {
                await send("Runtime.enable");
                let context = await this.waitFor(() => contexts.find(c => c.name === "Electron Isolated Context"), 5000, "preload context");
                params.contextId = context.id;
            }

            let { result } = await send("Runtime.evaluate", params);
            if (result.exceptionDetails) {
                throw new Error(result.exceptionDetails.exception ? result.exceptionDetails.exception.description : result.exceptionDetails.text);
            }
            return result.result.value;
        } finally {
            socket.close();
        }
    }

    settings() {
        let file = path.join(this.userData, "settings.json");
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    }

    async close() {
        if (this.process.exitCode === null) {
            this.process.kill();
            await Promise.race([this.exited, sleep(5000)]);
        }
    }
}

module.exports = { App, freePort, sleep };
