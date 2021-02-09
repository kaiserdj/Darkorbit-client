document.onreadystatechange = function(e) {
    if (document.readyState === 'interactive') {
        run();
    }
}

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