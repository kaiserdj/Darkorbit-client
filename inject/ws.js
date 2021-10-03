const { ipcRenderer, remote } = require("electron");

let dev = remote.getGlobal("dev");

let id;
(async () => { id = await ipcRenderer.invoke("getIdBrowser").then(data => data) })();

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: remote.getGlobal('api') });

wss.on('connection', ws => {
    ws.binaryType = 'arraybuffer';

    ws.on('message', message => {
        log(`Received message`);
        let data = new DataView(message);
        let buffer, dv;

        log(data);

        switch (data.getInt16(0)) {
            case 1:
                log("getVersion");
                log(remote.app.getVersion());

                let version = remote.app.getVersion().split(".");
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
                (async () => {
                    await ipcRenderer.invoke("getAppMetrics").then(data => {
                        let buffer = new ArrayBuffer(6);
                        let dv = new DataView(buffer);
                        dv.setInt16(0, 2);

                        for (let elem of data) {
                            if (elem.type === "Pepper Plugin") {
                                log(elem.pid);
                                dv.setInt32(2, elem.pid);
                                ws.send(buffer);
                                return;
                            }
                        }

                        dv.setInt32(2, elem.pid);
                        ws.send(buffer);
                    })
                })();
                break;
            case 3:
                log("setSize");
                log(`Width: ${data.getInt32(2)}`);
                log(`Height: ${data.getInt32(6)}`);

                remote.BrowserWindow.fromId(id).setSize(data.getInt32(2), data.getInt32(6));

                break;
            case 4:
                log("setVisible");
                log(`Visible: ${data.getInt16(2)}`);

                if (data.getInt16(2) === 1) {
                    remote.BrowserWindow.fromId(id).show();
                } else if (data.getInt16(2) === 0) {
                    remote.BrowserWindow.fromId(id).hide();
                }
                break;
            case 5:
                log("setMinimized");
                log(`Minimized: ${data.getInt16(2)}`);

                if (data.getInt16(2) === 1) {
                    remote.BrowserWindow.fromId(id).minimize();
                } else if (data.getInt16(2) === 0) {
                    remote.BrowserWindow.fromId(id).restore();
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
    })
})

function log(data) {
    if (dev) {
        console.log(data);
    }
}