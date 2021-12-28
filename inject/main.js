const { ipcRenderer, contextBridge } = require("electron");
const path = require("path");
const fs = require('fs');
const api = require("./api");
const nprogress = require("../libs/nprogress/nprogress");
const nprogressCss = require("../libs/nprogress/nprogressCss.js");

document.onreadystatechange = () => {
    if (document.readyState === 'interactive') {
        contextBridge.exposeInMainWorld("api", api);
        api.injectCss(nprogressCss);
        api.injectCss("#qc-cmp2-container {display: none;}");
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

window.addEventListener("beforeunload", () => {
    nprogress.configure({ showSpinner: false, minimum: 0.01 });
    nprogress.start();
});

async function run() {
    let url = this.location.href;

    switch (true) {
        case /https:\/\/www\.darkorbit\.[^./]*\//.test(url):
        case /https:\/\/.*\.darkorbit\.com\/\?/.test(url):
        case /https:\/\/.*\.darkorbit\.com\/index\.[^.\/]*\?action=externalHome&loginError=.{0,3}/.test(url):
            require("./login");
            break;
        case /.*\?action=internalMapRevolution.*/.test(url):
            api.getConfig().then(async (data) => {
                if (data.Settings.Packet) {
                    const WebSocket = require('ws');

                    const wss = new WebSocket.Server({ port: 44569 });

                    wss.on('connection', ws => {
                        ws.on('message', message => {
                            let event = new CustomEvent("Packet", {
                                detail: {
                                    packet: JSON.parse(message.toString())
                                }
                            });
                            window.dispatchEvent(event);
                        });
                    });

                    for (;;) {
                        if (document.readyState == "complete") {
                            console.log(document.readyState);
                            await new Promise(r => setTimeout(r, 5000));

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

                            let python = require('child_process').spawn('python', [packet_dumper]);

                            python.stdout.on('data', data => {
                                console.log(data.toString());
                            });

                            python.stderr.on('data', data => {
                                console.error(`stderr: ${data}`);
                            });

                            python.on('close', code => {
                                console.log(`child process exited with code ${code}`);
                            });

                            break;
                        } else {
                            console.log(document.readyState);
                            await new Promise(r => setTimeout(r, 50));
                        }
                    }
                }

                if (data.Settings.PreventCloseGame) {
                    api.injectJs("bpCloseWindow = function() {}");
                    window.removeEventListener("beforeunload");
                }
            })
            break;
        default:
            break;
    }
}

function customUrlRegex(match, url) {
    let pattern = match.replaceAll("/", "\\/");
    pattern = pattern.replaceAll(".", "\\.");
    pattern = pattern.replaceAll("*", ".*");
    pattern = pattern.replace(/[+?^${}()|]/g, '\\$&');

    return new RegExp(pattern).test(url);
}

ipcRenderer.once("customJs", (event, data) => {
    if (data.enable) {
        for (let id in data.list) {
            if (data.list[id].enable) {
                if (customUrlRegex(data.list[id].match, document.location.href)) {
                    api.get(data.list[id].actionUrl)
                        .then(res => api.injectJs(res));
                }
            }
        }
    }
});

ipcRenderer.once("customCss", (event, data) => {
    if (data.enable) {
        for (let id in data.list) {
            if (data.list[id].enable) {
                if (customUrlRegex(data.list[id].match, document.location.href)) {
                    api.get(data.list[id].actionUrl)
                        .then(res => api.injectCss(res));
                }
            }
        }
    }
});