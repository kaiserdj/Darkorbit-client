// Packet logger support (Settings → "Run Darkorbit packet logger").
//
// packet_dumper.py reads the game traffic and sends it to a local WebSocket server. Both the
// server and the Python process run here in the main process, because the game window is
// sandboxed; packets are forwarded to the game page, which raises a "Packet" event.

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const settings = require("electron-settings");
const { isDarkorbitUrl, isLocalWsClient } = require("./security");

const DEFAULT_PORT = 44569;
const GAME_PAGE = /\?action=internalMapRevolution/;

class PacketService {
    constructor(app, { port = DEFAULT_PORT, spawnProcess = spawn } = {}) {
        this.app = app;
        this.port = port;
        this.spawnProcess = spawnProcess;
        this.server = null;
        // webContents id -> { webContents, timer, dumper }
        this.pages = new Map();
    }

    static isGamePage(url) {
        return isDarkorbitUrl(url) && GAME_PAGE.test(url);
    }

    // Called whenever a DarkOrbit window finished loading a page.
    onPageLoaded(webContents) {
        this.stop(webContents.id);

        let config = settings.getSync().Settings;
        if (!config.Packet || !PacketService.isGamePage(webContents.getURL())) {
            return;
        }

        this.listen();

        let id = webContents.id;
        let entry = { webContents, timer: null, dumper: null };
        this.pages.set(id, entry);

        // Like before, give the game time to start before attaching packet_dumper.
        entry.timer = setTimeout(() => {
            entry.timer = null;
            entry.dumper = this.startDumper(config.PythonPath);
        }, Math.max(0, Number(config.PacketTimeout) || 0));

        webContents.once("destroyed", () => this.stop(id));
    }

    listen() {
        if (this.server) {
            return;
        }

        // Only the local packet_dumper may connect, never other machines or web pages.
        this.server = new WebSocket.Server({
            host: "127.0.0.1",
            port: this.port,
            maxPayload: 1024 * 1024,
            verifyClient: isLocalWsClient
        });

        this.server.on("error", error => console.error(`Packet server: ${error.message}`));

        this.server.on("connection", socket => {
            socket.on("message", message => {
                let packet;
                try {
                    packet = JSON.parse(message.toString());
                } catch (e) {
                    return;
                }
                this.forward(packet);
            });
        });
    }

    forward(packet) {
        for (let { webContents } of this.pages.values()) {
            if (!webContents.isDestroyed()) {
                webContents.send("packet", packet);
            }
        }
    }

    dumperPath() {
        // Packaged apps ship it as an extra resource, development runs use the repository copy.
        let candidates = [
            path.join(process.resourcesPath || "", "darkDev", "packet_dumper.py"),
            path.join(this.app.getAppPath(), "darkDev", "packet_dumper.py")
        ];
        return candidates.find(file => fs.existsSync(file)) || null;
    }

    startDumper(interpreter) {
        let script = this.dumperPath();
        if (!script) {
            console.error("packet_dumper.py not found");
            return null;
        }

        console.log("Start packet_dumper");
        let dumper = this.spawnProcess(interpreter || "python", [script], { cwd: path.dirname(script), shell: false });

        dumper.on("error", error => console.error(`packet_dumper: ${error.message}`));
        if (dumper.stdout) {
            dumper.stdout.on("data", data => console.log(data.toString()));
        }
        if (dumper.stderr) {
            dumper.stderr.on("data", data => console.error(`packet_dumper: ${data}`));
        }
        dumper.on("close", code => console.log(`packet_dumper exited with code ${code}`));

        return dumper;
    }

    stop(id) {
        let entry = this.pages.get(id);
        if (!entry) {
            return;
        }

        clearTimeout(entry.timer);
        if (entry.dumper) {
            entry.dumper.kill();
        }
        this.pages.delete(id);

        if (this.pages.size === 0 && this.server) {
            this.server.close();
            this.server = null;
        }
    }
}

module.exports = PacketService;
