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
            document.getElementById("hide").onclick = (sub) => {
                sub.preventDefault();
                sweetalert2.default.fire({
                    html: "This window will not come out automatically every time you open the client.<br>Is it what you want?",
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, please!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        ipcRenderer.send('hideMasterRegister', true);
                    }
                })
            }

            document.getElementById("form").onsubmit = (sub) => {
                sub.preventDefault();
                let master = document.getElementById("password").value;

                if (master === "") {
                    sweetalert2.default.fire({
                        title: 'Are you sure to leave the master password empty?',
                        showCancelButton: true,
                        confirmButtonText: `Yes`,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            ipcRenderer.send('registerMaster', master);
                        }
                    })
                } else {
                    ipcRenderer.send('registerMaster', master);
                }
            }
            break;
        case "login":
            document.getElementById("lost").onclick = (sub) => {
                sub.preventDefault();
                sweetalert2.default.fire({
                    html: "Passwords cannot be recovered.<br>The only option is to delete the master password and all saved passwords.<br>Do you want to delete them?",
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, delete it!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        ipcRenderer.send('resetMaster', true);
                    }
                })
            }

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
                    confirmButtonText: `Yes`,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33'
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
            <td>&nbsp;
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square edit" viewBox="0 0 16 16">
                <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456l-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
                </svg>
            </td>
            <td>&nbsp;
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-key login" viewBox="0 0 16 16">
                <path d="M0 8a4 4 0 0 1 7.465-2H14a.5.5 0 0 1 .354.146l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0L13 9.207l-.646.647a.5.5 0 0 1-.708 0L11 9.207l-.646.647a.5.5 0 0 1-.708 0L9 9.207l-.646.647A.5.5 0 0 1 8 10h-.535A4 4 0 0 1 0 8zm4-3a3 3 0 1 0 2.712 4.285A.5.5 0 0 1 7.163 9h.63l.853-.854a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.793-.793-1-1h-6.63a.5.5 0 0 1-.451-.285A3 3 0 0 0 4 5z"/>
                <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>
            </td>    
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