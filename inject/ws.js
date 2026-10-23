const { ipcRenderer } = require("electron");
const { isLocalWsClient } = require("../security");

const WebSocket = require('ws');

let dev = false;

(async () => {
    let config = await ipcRenderer.invoke("getApiConfig");
    dev = config.dev;

    // Only local tools may control the client, never other machines or web pages.
    const wss = new WebSocket.WebSocketServer({
        host: "127.0.0.1",
        port: config.port,
        maxPayload: 1024,
        verifyClient: isLocalWsClient
    });

    wss.on('error', error => console.error(error));

    wss.on('connection', ws => {
        ws.binaryType = 'arraybuffer';

        ws.on('message', message => {
            try {
                handleMessage(ws, message, config);
            } catch (e) {
                log(e);
            }
        });
    });
})();

function handleMessage(ws, message, config) {
    log(`Received message`);
    let data = new DataView(message);
    let buffer, dv;

    log(data);

    if (data.byteLength < 2) {
        return;
    }

    switch (data.getInt16(0)) {
        case 1:
            log("getVersion");
            log(config.version);

            let version = config.version.split(".");
            buffer = new ArrayBuffer(8);
            dv = new DataView(buffer);
            dv.setInt16(0, 1);
            dv.setInt16(2, version[0]);
            dv.setInt16(4, version[1]);
            dv.setInt16(6, version[2]);
            ws.send(buffer);

            break;
        case 2:
            log("getPid");
            ipcRenderer.invoke("getAppMetrics").then(data => {
                let buffer = new ArrayBuffer(6);
                let dv = new DataView(buffer);
                dv.setInt16(0, 2);

                let plugin = data.find(elem => elem.type === "Pepper Plugin");
                if (plugin) {
                    log(plugin.pid);
                    dv.setInt32(2, plugin.pid);
                }

                ws.send(buffer);
            }).catch(log);
            break;
        case 3:
            if (data.byteLength < 10) {
                return;
            }
            log("setSize");
            log(`Width: ${data.getInt32(2)}`);
            log(`Height: ${data.getInt32(6)}`);

            ipcRenderer.invoke("apiWindow", "setSize", data.getInt32(2), data.getInt32(6)).catch(log);

            break;
        case 4:
            if (data.byteLength < 4) {
                return;
            }
            log("setVisible");
            log(`Visible: ${data.getInt16(2)}`);

            if (data.getInt16(2) === 1) {
                ipcRenderer.invoke("apiWindow", "show").catch(log);
            } else if (data.getInt16(2) === 0) {
                ipcRenderer.invoke("apiWindow", "hide").catch(log);
            }
            break;
        case 5:
            if (data.byteLength < 4) {
                return;
            }
            log("setMinimized");
            log(`Minimized: ${data.getInt16(2)}`);

            if (data.getInt16(2) === 1) {
                ipcRenderer.invoke("apiWindow", "minimize").catch(log);
            } else if (data.getInt16(2) === 0) {
                ipcRenderer.invoke("apiWindow", "restore").catch(log);
            }
            break;
        case 6:
            log("Reload");

            location.reload();
            break;
        case 7:
            log("isValid");
            log(document.readyState);

            buffer = new ArrayBuffer(4);
            dv = new DataView(buffer);
            dv.setInt16(0, 7);

            if (document.readyState === "complete") {
                dv.setInt16(2, 1);
            } else {
                dv.setInt16(2, 0);
            }

            ws.send(buffer);
            break;
    }
}

function log(data) {
    if (dev) {
        console.log(data);
    }
}
