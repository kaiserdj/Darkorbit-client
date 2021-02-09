const { ipcRenderer } = require('electron')

document.onreadystatechange = function(e) {
    if (document.readyState === 'complete') {
        run();
    }
}

function run() {
    let type = document.body.getAttribute("id");

    switch (type) {
        case "registerMaster":
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
        case "list":
            document.getElementById("search").addEventListener('keyup', function() {
                var input, filter, table, tr, td, i, txtValue;
                input = document.getElementById("search");
                filter = input.value.toUpperCase();
                table = document.getElementById("table");
                tr = table.getElementsByTagName("tr");

                for (i = 0; i < tr.length; i++) {
                    td = tr[i].getElementsByTagName("td")[1];
                    if (td) {
                        txtValue = td.textContent || td.innerText;
                        if (txtValue.toUpperCase().indexOf(filter) > -1) {
                            tr[i].style.display = "";
                        } else {
                            tr[i].style.display = "none";
                        }
                    }
                }
            });
            break;
    }
}

ipcRenderer.on("checkMasterRet", function(event, ret) {
    if (!ret) {
        alert("Incorrect password");
    }
});