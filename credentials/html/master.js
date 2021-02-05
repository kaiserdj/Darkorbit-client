const { ipcRenderer } = require('electron')

document.onreadystatechange = function(e) {
    if (document.readyState === 'complete') {
        run();
    }
}

function run() {
    let type = document.body.getAttribute("id");

    switch (type) {
        case "register":
            document.getElementById("form").onsubmit = (sub) => {
                sub.preventDefault();
                let master = document.getElementById("password").value;

                if (master === "" && !confirm("Are you sure to leave the master password empty?")) {
                    return;
                }

                ipcRenderer.send('registerMaster', master);
                close();
            }
            break;
        case "login":
            document.getElementById("form").onsubmit = (sub) => {
                sub.preventDefault();
                let master = document.getElementById("password").value;

                ipcRenderer.send('checkMaster', master);
            }
            break;
    }
}

ipcRenderer.on("checkMasterRet", function(event, ret) {
    if (!ret) {
        alert("Incorrect password");
    }
});