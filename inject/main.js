const { ipcRenderer } = require("electron");
const tools = require("./tools");
const nprogress = require("../libs/nprogress/nprogress");
const nprogressCss = require("../libs/nprogress/nprogressCss.js");

document.onreadystatechange = () => {
    if (document.readyState === 'interactive') {
        tools.addStyle(nprogressCss);
        tools.addStyle("#qc-cmp2-container {display: none;}");
        tools.addStyle("#nprogress .bar {background: #7ECE3B !important; height: 3px !important;}");
        nprogress.configure({ showSpinner: false,  });
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
        case /https:\/\/www\.darkorbit\.com/.test(url):
        case /https:\/\/.{0,4}darkorbit\.com\/index\.es\?action=externalHome&loginError=99/.test(url):
            require("./login");
            break;
        default:
            break;
    }
}

ipcRenderer.once("customCss", (event, data) => {
    if(data.enable) {
        for (let id in data.list) {
            if (data.list[id].enable) {
                if (tools.customUrlRedex(data.list[id].match, document.location.href)) {
                    fetch(data.list[id].actionUrl)
                        .then(r => r.text())
                        .then(t => tools.addStyle(t))
                }
            }
        }
    }
});