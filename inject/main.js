const nprogress = require("./nprogress");

let css = document.createElement('link');
css.href = "https://cdn.jsdelivr.net/npm/nprogress@0.2.0/nprogress.css";
css.rel = "stylesheet";

document.onreadystatechange = function(e) {
    if (document.readyState === 'interactive') {
        nprogress.configure({ showSpinner: false });
        nprogress.start();
        document.getElementsByTagName('head')[0].appendChild(css);
        run();
    } else{
        setTimeout(function () {
            nprogress.done();
        }, 1000);
    }
}

window.addEventListener("beforeunload", function (event) {
    nprogress.configure({ showSpinner: false, minimum: 0.01 });
    nprogress.start();
});

function run() {
    let url = this.location.href;

    switch (true) {
        case /https:\/\/www.darkorbit.com(\/\?.)?/.test(url):
            require("./login");
            break;
        default:
            break;
    }
}