// Preload for the DarkOrbit windows (client, game, board, config).
//
// These windows run in a sandboxed renderer: at runtime only `electron` can be required, so this
// file and everything it requires is bundled into inject/dist/preload.js by `npm run build:preload`.
// Anything that needs Node (packet_dumper, WebSocket servers) lives in the main process.

const { ipcRenderer } = require("electron");
const api = require("./api");
const { isDarkorbitUrl, isLoginPage, matchesGlob } = require("../security");
const nprogress = require("../libs/nprogress/nprogress");
const nprogressCss = require("../libs/nprogress/nprogressCss.js");

const GAME_PAGE = /\?action=internalMapRevolution/;

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

async function run() {
    let url = location.href;

    if (!isDarkorbitUrl(url)) {
        return;
    }

    if (isLoginPage(url)) {
        require("./login");
        return;
    }

    if (GAME_PAGE.test(url)) {
        let data = await api.getConfig();

        if (data.Settings.PreventCloseGame) {
            api.injectJs("bpCloseWindow = function() {}");
            window.removeEventListener("beforeunload", showUnloadProgress);
        }
    }
}

// Game packets read by packet_dumper arrive from the main process (see packet.js).
ipcRenderer.on("packet", (event, packet) => {
    window.dispatchEvent(new CustomEvent("Packet", { detail: { packet } }));
});

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
