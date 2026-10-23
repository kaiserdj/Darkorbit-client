const { ipcRenderer } = require("electron");
const path = require("path");
const fs = require('fs');
const api = require("./api");
const { parseUrl, isDarkorbitUrl, matchesGlob, isLocalWsClient } = require("../security");
const nprogress = require("../libs/nprogress/nprogress");
const nprogressCss = require("../libs/nprogress/nprogressCss.js");

document.onreadystatechange = () => {
    if (document.readyState === 'interactive') {
        api.injectCss(nprogressCss);
        api.injectCss("#nprogress .bar {background: #7ECE3B !important; height: 3px !important;}");
        nprogress.configure({ showSpinner: false });
        nprogress.start();
        run();
    } else {
        setTimeout(() => {
            nprogress.done();
        }, 1000);
    }
}

function showUnloadProgress() {
    nprogress.configure({ showSpinner: false, minimum: 0.01 });
    nprogress.start();
}

window.addEventListener("beforeunload", showUnloadProgress);

function isLoginPage(href) {
    if (!isDarkorbitUrl(href)) {
        return false;
    }

    let url = parseUrl(href);

    return url.hostname === "www.darkorbit.com" ||
        (url.pathname === "/" && href.includes("?")) ||
        (/^\/index\.[^./]*$/.test(url.pathname) && url.search.startsWith("?action=externalHome&loginError="));
}

async function run() {
    let url = this.location.href;

    if (!isDarkorbitUrl(url)) {
        return;
    }

    switch (true) {
        case isLoginPage(url):
            require("./login");
            break;
        case /.*\?action=internalMapRevolution.*/.test(url):
            api.getConfig().then(async (data) => {
                if (data.Settings.Packet) {
                    const WebSocket = require('ws');

                    // Only the local packet_dumper may connect, never other machines or web pages.
                    const wss = new WebSocket.WebSocketServer({
                        host: "127.0.0.1",
                        port: 44569,
                        maxPayload: 1024 * 1024,
                        verifyClient: isLocalWsClient
                    });

                    wss.on('error', error => console.error(error));

                    wss.on('connection', ws => {
                        ws.on('message', message => {
                            let packet;
                            try {
                                packet = JSON.parse(message.toString());
                            } catch (e) {
                                return;
                            }

                            window.dispatchEvent(new CustomEvent("Packet", { detail: { packet } }));
                        });
                    });

                    // Wait for the page load event instead of polling readyState.
                    if (document.readyState !== "complete") {
                        await new Promise(resolve => window.addEventListener("load", resolve, { once: true }));
                    }

                    await new Promise(r => setTimeout(r, data.Settings.PacketTimeout));

                    console.log('Start packet_dumper');

                    let packet_dumper;
                    if (process.platform == 'win32') {
                        packet_dumper = path.join(await ipcRenderer.invoke("getAppPath"), '../darkDev/packet_dumper.py');
                        if (!fs.existsSync(packet_dumper)) {
                            packet_dumper = path.join(await ipcRenderer.invoke("getAppPath"), './darkDev/packet_dumper.py');
                        }
                    } else if (process.platform == 'linux') {
                        packet_dumper = path.join(process.resourcesPath.split("/")[1] === "tmp" ? process.resourcesPath : await ipcRenderer.invoke("getAppPath"), './darkDev/packet_dumper.py');
                    } else if (process.platform == 'darwin') {
                        packet_dumper = path.join(await ipcRenderer.invoke("getAppPath"), `../darkDev/packet_dumper.py`);
                        if (!fs.existsSync(packet_dumper)) {
                            packet_dumper = path.join(await ipcRenderer.invoke("getAppPath"), './darkDev/packet_dumper.py');
                        }
                    }

                    let interpreter = data.Settings.PythonPath || "python";
                    let python = require('child_process').spawn(interpreter, [packet_dumper], { cwd: path.dirname(packet_dumper), shell: false });

                    python.on('error', error => console.error(error));

                    python.stdout.on('data', data => {
                        console.log(data.toString());
                    });

                    python.stderr.on('data', data => {
                        console.error(`stderr: ${data}`);
                    });

                    python.on('close', code => {
                        console.log(`child process exited with code ${code}`);
                    });

                    // Do not leave a packet_dumper running for every game window that was opened.
                    window.addEventListener("unload", () => {
                        python.kill();
                        wss.close();
                    });
                }

                if (data.Settings.PreventCloseGame) {
                    api.injectJs("bpCloseWindow = function() {}");
                    window.removeEventListener("beforeunload", showUnloadProgress);
                }
            })
            break;
        default:
            break;
    }
}

ipcRenderer.once("customJs", (event, data) => {
    if (data.enable) {
        for (let id in data.list) {
            if (data.list[id].enable) {
                if (matchesGlob(data.list[id].match, document.location.href)) {
                    api.get(data.list[id].actionUrl)
                        .then(res => api.injectJs(res))
                        .catch(error => console.error(error));
                }
            }
        }
    }
});

ipcRenderer.once("customCss", (event, data) => {
    if (data.enable) {
        for (let id in data.list) {
            if (data.list[id].enable) {
                if (matchesGlob(data.list[id].match, document.location.href)) {
                    api.get(data.list[id].actionUrl)
                        .then(res => api.injectCss(res))
                        .catch(error => console.error(error));
                }
            }
        }
    }
});