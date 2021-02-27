const tools = require("./tools");
const nprogress = require("./nprogress");

let css = document.createElement('link');
css.href = "https://cdn.jsdelivr.net/npm/nprogress@0.2.0/nprogress.css";
css.rel = "stylesheet";

document.onreadystatechange = () => {
    if (document.readyState === 'interactive') {
        tools.addStyle("#qc-cmp2-container {display: none;}");
        tools.addStyle("#nprogress .bar {background: #7ECE3B !important; height: 3px !important;}");
        nprogress.configure({ showSpinner: false,  });
        nprogress.start();
        document.getElementsByTagName('head')[0].appendChild(css);
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
        case /https:\/\/www.darkorbit.com/.test(url):
        case /https:\/\/.{0,4}darkorbit.com\/index\.es\?action=externalHome&loginError=99/.test(url):
            require("./login");
            break;
        default:
            break;
    }
}