const { ipcRenderer, contextBridge } = require("electron");
const api = require("./api");
const nprogress = require("../libs/nprogress/nprogress");
const nprogressCss = require("../libs/nprogress/nprogressCss.js");

document.onreadystatechange = () => {
    if (document.readyState === 'interactive') {
        contextBridge.exposeInMainWorld("api", api);
        api.inejctCss(nprogressCss)
        api.inejctCss("#qc-cmp2-container {display: none;}");
        api.inejctCss("#nprogress .bar {background: #7ECE3B !important; height: 3px !important;}");
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

function run() {
    let url = this.location.href;

    switch (true) {
        case /https:\/\/www\.darkorbit\.[^./]*\//.test(url):
        case /https:\/\/.*\.darkorbit\.com\/\?/.test(url):
        case /https:\/\/.*\.darkorbit\.com\/index\.[^.\/]*\?action=externalHome&loginError=.{0,3}/.test(url):
            require("./login");
            break;
        case /.*\?action=internalMapRevolution.*/.test(url):
            api.getConfig().then((data) => {
                if (data.Settings.PreventCloseGame) {
                    api.inejctJs("bpCloseWindow = function() {}");
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
                        .then(res => api.inejctJs(res))
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
                        .then(res => api.inejctCss(res))
                }
            }
        }
    }
});