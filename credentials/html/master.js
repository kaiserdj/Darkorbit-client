const { ipcRenderer } = require('electron');
let sweetalert2;

document.onreadystatechange = () => {
    if (document.readyState === 'complete') {
        sweetalert2 = require('sweetalert2')
        run();
    }
}

function run() {
    document.oncontextmenu = function() {
        return false;
    }

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
            ipcRenderer.send('loadList', true);

            document.getElementById("search").addEventListener('keyup', () => {
                var input, filter, table, tr, td, i, txtValue;
                input = document.getElementById("search");
                filter = input.value.toUpperCase();
                table = document.getElementById("table");
                tr = table.getElementsByTagName("tr");

                for (i = 0; i < tr.length; i++) {
                    td = tr[i].getElementsByTagName("td")[2];
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

            document.getElementById("new").addEventListener("click", () => {
                ipcRenderer.send('userRegister', null);
            });
            break;
        case "registerUser":
            document.getElementById("close").onclick = () => {
                ipcRenderer.send("close", true)
            }

            document.getElementById("form").onsubmit = (sub) => {
                sub.preventDefault();
                let username = document.getElementById("username").value;
                let password = document.getElementById("password").value;

                ipcRenderer.send('registerUser', [username, password]);
            }
            break;
        case "editUser":
            ipcRenderer.send('getEditUser', true);

            document.getElementById("close").onclick = () => {
                ipcRenderer.send("close", true)
            }

            document.getElementById("form").onsubmit = (sub) => {
                sub.preventDefault();
                let username = document.getElementById("username").value;
                let password = document.getElementById("password").value;

                if (username !== "" && password !== "") {
                    ipcRenderer.send('changeUser', [global.id, username, password]);
                }
            };

            document.getElementById("delete").addEventListener("click", (sub) => {
                sub.preventDefault();
                sweetalert2.default.fire({
                    title: 'Are you sure to delete the account data?',
                    showCancelButton: true,
                    confirmButtonText: `Yes`
                  }).then((result) => {
                    if (result.isConfirmed) {
                        ipcRenderer.send('deleteUser', global.id);
                    }
                  })
            });
            break;
    }
}

ipcRenderer.on("checkMasterRet", (event, data) => {
    if (!data) {
        sweetalert2.default.fire({
            icon: 'error',
            title: 'Incorrect password',
        })
    }
});

ipcRenderer.on("sendList", (event, data) => {
    let accounts = JSON.parse(data);
    let i = 0;
    for (let account of accounts) {
        i++;
        let table = document.getElementById('table').getElementsByTagName('tbody')[0];
        let newRow = table.insertRow();
        newRow.innerHTML = `
            <td class="id">${account.id}</td>
            <td>${i}</td>
            <td>${account.username}</td>
            <td>&nbsp;<i class="bi bi-pencil-square edit"></i></td>
            <td>&nbsp;<i class="bi bi-key login"></i></td>    
        `;
    }
    const edit = document.querySelectorAll('.edit');
    edit.forEach(el => el.addEventListener('click', event => {
        ipcRenderer.send('editUser', event.target.parentNode.parentNode.querySelectorAll(".id")[0].innerText);
    }));

    const login = document.querySelectorAll('.login');
    login.forEach(el => el.addEventListener('click', event => {
        ipcRenderer.send('loginUser', event.target.parentNode.parentNode.querySelectorAll(".id")[0].innerText);
    }));
});

ipcRenderer.on("sendEditUser", (event, data) => {
    global.id = data[0];
    document.getElementById("username").value = data[1];
})