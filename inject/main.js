document.onreadystatechange = function(e) {
    if (document.readyState === 'interactive') {
        run();
    }
}

function run() {
    let url = this.location.href;

    switch (url) {
        case "https://www.darkorbit.com/":
            require("./login");

            break;
        default:

            break;
    }
}
