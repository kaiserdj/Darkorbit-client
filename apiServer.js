// `--api <port>` mode: a local WebSocket that lets another program control the client window.
//
// It used to run inside the window's preload; with the window sandboxed it runs in the main
// process and acts on the BrowserWindow directly. The binary protocol is unchanged: every
// message starts with an Int16 command id.

const WebSocket = require("ws");
const { isLocalWsClient } = require("./security");

const GET_VERSION = 1;
const GET_PID = 2;
const SET_SIZE = 3;
const SET_VISIBLE = 4;
const SET_MINIMIZED = 5;
const RELOAD = 6;
const IS_VALID = 7;

function reply(...values) {
    // values: [command, ...[type, value]] encoded big-endian like DataView does by default.
    let size = values.reduce((total, [type]) => total + (type === "int32" ? 4 : 2), 0);
    let view = new DataView(new ArrayBuffer(size));
    let offset = 0;
    for (let [type, value] of values) {
        if (type === "int32") {
            view.setInt32(offset, value);
            offset += 4;
        } else {
            view.setInt16(offset, value);
            offset += 2;
        }
    }
    return Buffer.from(view.buffer);
}

class ApiServer {
    constructor(app, window, port, { dev = false } = {}) {
        this.app = app;
        this.window = window;
        this.dev = dev;

        // Only local tools may control the client, never other machines or web pages.
        this.server = new WebSocket.Server({
            host: "127.0.0.1",
            port,
            maxPayload: 1024,
            verifyClient: isLocalWsClient
        });

        this.server.on("error", error => console.error(`API server: ${error.message}`));

        this.server.on("connection", socket => {
            socket.on("message", message => {
                this.handle(socket, message).catch(error => this.log(error));
            });
        });
    }

    log(data) {
        if (this.dev) {
            console.log(data);
        }
    }

    async handle(socket, message) {
        let data = new DataView(message.buffer, message.byteOffset, message.byteLength);

        if (data.byteLength < 2 || this.window.isDestroyed()) {
            return;
        }

        let command = data.getInt16(0);
        this.log(`API command ${command}`);

        switch (command) {
            case GET_VERSION: {
                let version = this.app.getVersion().split(".").map(Number);
                socket.send(reply(["int16", GET_VERSION], ["int16", version[0]], ["int16", version[1]], ["int16", version[2]]));
                break;
            }
            case GET_PID: {
                let plugin = this.app.getAppMetrics().find(process => process.type === "Pepper Plugin");
                socket.send(reply(["int16", GET_PID], ["int32", plugin ? plugin.pid : 0]));
                break;
            }
            case SET_SIZE: {
                if (data.byteLength < 10) {
                    return;
                }
                let width = data.getInt32(2);
                let height = data.getInt32(6);
                if (width > 0 && height > 0) {
                    this.window.setSize(width, height);
                }
                break;
            }
            case SET_VISIBLE: {
                if (data.byteLength < 4) {
                    return;
                }
                let visible = data.getInt16(2);
                if (visible === 1) {
                    this.window.show();
                } else if (visible === 0) {
                    this.window.hide();
                }
                break;
            }
            case SET_MINIMIZED: {
                if (data.byteLength < 4) {
                    return;
                }
                let minimized = data.getInt16(2);
                if (minimized === 1) {
                    this.window.minimize();
                } else if (minimized === 0) {
                    this.window.restore();
                }
                break;
            }
            case RELOAD:
                this.window.webContents.reload();
                break;
            case IS_VALID: {
                let state = await this.window.webContents.executeJavaScript("document.readyState");
                socket.send(reply(["int16", IS_VALID], ["int16", state === "complete" ? 1 : 0]));
                break;
            }
        }
    }

    close() {
        this.server.close();
    }
}

module.exports = ApiServer;
